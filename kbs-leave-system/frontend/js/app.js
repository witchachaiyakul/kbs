// ==========================================
// ค่าคงที่ & ตัวแปรหลัก
// ==========================================
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const VALID_CATEGORIES = ['general', 'official', 'outside'];
const COUNT_WEEKENDS = false;      // true = นับเสาร์-อาทิตย์รวมในจำนวนวันลา
const LIFF_ID = "2012279186-NxQVJ4Ni";

let allTeachers = [], currentSchedule = [], selectedClasses = [];
let currentCategory = '', lockedCategory = '';
let currentWeekStart = getMonday(new Date());
let currentUserBalance = null, fpInstance = null;
let accCounter = 0;
let allSchedulesMap = {};          // { teacherCode: [รายการตาราง] }
let currentLineUserId = '';
let currentIdToken = '';
let lineUser = null;               // ครูที่ล็อกอินผ่าน LINE
let scheduleCheckToken = 0;
let isSubmitting = false;

// ==========================================
// Utilities
// ==========================================
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parseISO(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function getMonday(d) {
    d = new Date(d); d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d;
}
function normalizeSchedule(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(s => Object.assign({}, s, { period: parseInt(s.period) }));
}
// เรียก API proxy พร้อม failure handler เสมอ
function gas(fn, args, ok, fail) {
    const wrapped = err => {
        const msg = (err && err.message) || String(err);
        if (msg.includes('AUTH_EXPIRED')) { showLoading(false); showLoginGate('เซสชัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่'); return; }
        if (msg.includes('NOT_REGISTERED')) { showLoading(false); showBindModal(); return; }
        if (fail) fail(err);
        else { console.error(fn, err); showLoading(false); Swal.fire('ระบบขัดข้อง', msg, 'error'); }
    };
    const apiUrl = window.APP_CONFIG && window.APP_CONFIG.apiUrl;
    if (!apiUrl || apiUrl.includes('YOUR_FIREBASE_PROJECT_ID')) {
        wrapped(new Error('กรุณาตั้งค่า Firebase Function URL ใน frontend/js/config.js'));
        return;
    }
    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: fn, args })
    }).then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'API_REQUEST_FAILED');
        return result.data;
    }).then(ok).catch(wrapped);
}

// ดึงตารางสอนของครู (ใช้แคชก่อน ถ้าไม่มีค่อยถามเซิร์ฟเวอร์)
function fetchSchedule(code, cb, fail) {
    if (allSchedulesMap && Array.isArray(allSchedulesMap[code])) {
        cb(normalizeSchedule(allSchedulesMap[code]));
        return;
    }
    gas('apiGetSchedule', [currentIdToken, code], data => {
        allSchedulesMap[code] = data || [];
        cb(normalizeSchedule(data));
    }, fail);
}

// ==========================================
// เริ่มต้นระบบ
// ==========================================
window.onload = function () {
    updateWeekDisplay();

    fpInstance = flatpickr("#dateRangeDisplay", {
        mode: "range", dateFormat: "Y-m-d", locale: "th",
        onChange: function (selectedDates, dateStr, instance) {
            if (selectedDates.length > 0) {
                const s = fmtDate(selectedDates[0]);
                const e = selectedDates.length === 2 ? fmtDate(selectedDates[1]) : s;
                document.getElementById('startDate').value = s;
                document.getElementById('endDate').value = e;
                const sDisplay = instance.formatDate(selectedDates[0], "j M y");
                const eDisplay = selectedDates.length === 2 ? instance.formatDate(selectedDates[1], "j M y") : sDisplay;
                instance.input.value = (currentCategory === 'outside' || s === e) ? sDisplay : `${sDisplay} - ${eDisplay}`;
                handleDateChange();
            } else {
                document.getElementById('startDate').value = '';
                document.getElementById('endDate').value = '';
                document.getElementById('totalDays').value = currentCategory === 'outside' ? '-' : '';
            }
        }
    });

    const timeConfig = { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, static: true };
    flatpickr("#outsideStartTime", Object.assign({}, timeConfig, { onChange: calculateTimeDiff }));
    flatpickr("#outsideEndTime", Object.assign({}, timeConfig, { onChange: calculateTimeDiff }));

    // ปิด dropdown เมื่อคลิกนอกกล่อง (listener เดียวทั้งหน้า)
    document.addEventListener('click', e => {
        document.querySelectorAll('.searchable-select-dropdown.show').forEach(drop => {
            if (!drop.parentElement.contains(e.target)) drop.classList.remove('show');
        });
    });

    document.getElementById('bindSearchName').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); submitBindLine(); }
    });

    // บังคับล็อกอิน LINE ก่อนทุกอย่าง
    bootstrapSession();
};

// อ่านพารามิเตอร์ ?page=general|official|outside
function checkUrlParameter() {
    const page = new URLSearchParams(window.location.search).get('page');
    if (page && VALID_CATEGORIES.includes(page)) {
        lockedCategory = page;
        selectCategory(page);
        document.getElementById('btnBack').classList.add('hidden');
    }
}

// ==========================================
// ฟอร์มทั่วไป
// ==========================================
function addAccompany() {
    accCounter++;
    const uid = `acc_${accCounter}`;
    const div = document.createElement('div');
    div.className = "searchable-select-container mb-2";
    div.innerHTML = `<input type="text" id="${uid}" name="accompanyName" class="form-input text-sm" placeholder="ค้นหาชื่อ..." autocomplete="off"><div id="drop_${uid}" class="searchable-select-dropdown"></div>`;
    document.getElementById('accompanyList').appendChild(div);
    initSearchableDropdown(uid, `drop_${uid}`, null, allTeachers, null);
}

function togglePlate(show) { document.getElementById('vehiclePlate').classList.toggle('hidden', !show); }

function handleBudgetClick(type) {
    document.getElementById('budgetDetailBox').classList.toggle('hidden', type !== 'partial');
    document.getElementById('projectBudgetDetail').classList.toggle('hidden', type !== 'project');
}

function calculateTimeDiff() {
    if (currentCategory !== 'outside') return;
    const start = document.getElementById('outsideStartTime').value;
    const end = document.getElementById('outsideEndTime').value;
    if (start && end) {
        const s = new Date(`2000-01-01T${start}`);
        const e = new Date(`2000-01-01T${end}`);
        const diff = (e - s) / 3600000;
        if (diff <= 0) {
            document.getElementById('totalDays').value = '-';
            Swal.fire('เวลาไม่ถูกต้อง', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'warning');
            return;
        }
        document.getElementById('totalDays').value = diff.toFixed(1) + " ชม.";
    }
}

function selectCategory(cat) {
    if (!VALID_CATEGORIES.includes(cat)) return;
    currentCategory = cat;
    document.getElementById('step1').classList.remove('active');
    document.getElementById('leaveForm').classList.add('active');
    if (!lockedCategory) document.getElementById('btnBack').classList.remove('hidden');
    ['general', 'official', 'outside'].forEach(c => document.getElementById('type-' + c).classList.add('hidden'));
    document.getElementById('assignWorkOption').classList.add('hidden');
    document.getElementById('type-' + cat).classList.remove('hidden');

    if (cat === 'general') {
        fpInstance.set('mode', 'range');
        document.getElementById('dateLabel').innerHTML = 'ช่วงวันที่ลา <span class="text-red-500">*</span>';
        document.getElementById('totalLabel').innerText = "รวม (วัน)";
    } else if (cat === 'official') {
        fpInstance.set('mode', 'range');
        document.getElementById('dateLabel').innerHTML = 'ช่วงวันที่ไปราชการ <span class="text-red-500">*</span>';
        document.getElementById('totalLabel').innerText = "รวม (วัน)";
    } else {
        document.getElementById('assignWorkOption').classList.remove('hidden');
        fpInstance.set('mode', 'single');
        document.getElementById('dateLabel').innerHTML = 'วันที่ขอออก <span class="text-red-500">*</span>';
        document.getElementById('totalLabel').innerText = "รวม (ชม.)";
        document.getElementById('totalDays').value = "-";
    }
    fpInstance.clear();
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
}

function resetFormState() {
    document.getElementById('leaveForm').reset();
    fpInstance.clear();
    document.getElementById('dateRangeDisplay').value = "";
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('totalDays').value = '';
    document.getElementById('accompanyList').innerHTML = '';
    accCounter = 0;
    addAccompany();
    ['vehiclePlate', 'projectBudgetDetail', 'budgetDetailBox', 'otherReason'].forEach(id => document.getElementById(id).classList.add('hidden'));
    resetUserData();
}

function goBack() {
    resetFormState();
    if (lockedCategory) {
        // เปิดจากลิงก์ตรง: อยู่หน้าฟอร์มเดิม
        selectCategory(lockedCategory);
    } else {
        document.getElementById('leaveForm').classList.remove('active');
        document.getElementById('step1').classList.add('active');
        document.getElementById('btnBack').classList.add('hidden');
        currentCategory = '';
    }
    // ถ้าล็อกอินด้วย LINE อยู่ ให้กรอกชื่อกลับให้อัตโนมัติ
    if (lineUser) onMainUserSelect(lineUser);
}

function toggleOther(radio) { document.getElementById('otherReason').classList.toggle('hidden', radio.value !== 'other'); }
function toggleSubstituteTable(show) { document.getElementById('substituteTableContainer').classList.toggle('hidden', !show); }
function showLoading(show) {
    const el = document.getElementById('loadingOverlay');
    el.classList.toggle('hidden', !show);
    el.classList.toggle('flex', show);
}

function checkGenderAndBalance(radio) {
    const name = document.getElementById('name').value;
    if (name && (name.trim().startsWith('นาย') || name.trim().toLowerCase().startsWith('mr')) && radio.value === 'ลาคลอดบุตร') {
        Swal.fire({ icon: 'error', title: 'ไม่สามารถเลือกได้', text: 'สงวนสิทธิ์สำหรับสุภาพสตรี', confirmButtonColor: '#4f46e5' });
        radio.checked = false; document.getElementById('leaveBalanceInfo').classList.add('hidden'); return;
    }
    toggleOther(radio);
    const infoBox = document.getElementById('leaveBalanceInfo');
    const textSpan = document.getElementById('balanceText');
    const type = radio.value;
    if (!currentUserBalance || type === 'other') { infoBox.classList.add('hidden'); return; }
    const quota = (currentUserBalance.quotas && currentUserBalance.quotas[type]) || 0;
    const used = (currentUserBalance.used && currentUserBalance.used[type]) || 0;
    const remaining = quota - used;
    infoBox.classList.remove('hidden');
    textSpan.innerHTML = `ใช้ไป ${used} วัน | <span class="${remaining <= 3 ? 'text-red-600' : 'text-blue-800'}">คงเหลือ ${remaining} วัน</span> (จาก ${quota})`;
}

function resetUserData() {
    scheduleCheckToken++;
    currentSchedule = []; selectedClasses = []; currentUserBalance = null;
    document.getElementById('scheduleBody').innerHTML = `<tr><td colspan="${PERIODS.length + 1}" class="p-4 text-center text-gray-400">กรุณาเลือกชื่อผู้ลาด้านบนก่อน...</td></tr>`;
    document.getElementById('selectedClassesList').innerHTML = '';
    document.getElementById('detailsCard').classList.add('hidden');
    document.getElementById('leaveBalanceInfo').classList.add('hidden');
    document.getElementById('scheduleAlert').classList.add('hidden');
    document.getElementById('scheduleLoading').classList.add('hidden');
    document.getElementById('substituteTableContainer').classList.add('hidden');
    const first = document.getElementsByName("teachLoad")[0];
    if (first) first.checked = true;
}

function onMainUserSelect(teacher) {
    resetUserData();

    document.getElementById('name').value = teacher.name || '';
    document.getElementById('teacherCode').value = teacher.code || '';
    document.getElementById('teacherDeptRaw').value = teacher.dept || '';
    document.getElementById('position').value = teacher.position || '';
    document.getElementById('dept').value = teacher.dept || '';
    document.getElementById('contact').value = teacher.phone || '';

    const myCode = teacher.code;
    gas('apiGetLeaveBalance', [currentIdToken], data => {
        if (document.getElementById('teacherCode').value !== myCode) return; // เปลี่ยนคนแล้ว
        currentUserBalance = data;
        const cr = document.querySelector('input[name="leaveType"]:checked');
        if (cr) checkGenderAndBalance(cr);
    }, err => console.warn('getLeaveBalance ล้มเหลว', err));

    loadSchedule(teacher.code);

    if (document.getElementById('startDate').value) checkSchedule();
}

function loadSchedule(code) {
    document.getElementById('scheduleBody').innerHTML = `<tr><td colspan="${PERIODS.length + 1}" class="p-4 text-center"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดตาราง...</td></tr>`;
    fetchSchedule(code, data => {
        if (document.getElementById('teacherCode').value !== code) return;
        currentSchedule = data;
        renderTable();
    }, err => {
        console.error('getSchedule', err);
        document.getElementById('scheduleBody').innerHTML = `<tr><td colspan="${PERIODS.length + 1}" class="p-4 text-center text-red-500">โหลดตารางสอนไม่สำเร็จ</td></tr>`;
    });
}

function countLeaveDays(s, e) {
    const a = parseISO(s), b = parseISO(e);
    if (!a || !b || b < a) return 0;
    let n = 0;
    for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (COUNT_WEEKENDS || (dow !== 0 && dow !== 6)) n++;
    }
    return n;
}

function handleDateChange() {
    const s = document.getElementById('startDate').value;
    const e = document.getElementById('endDate').value;
    if (!s || !e) return;
    currentWeekStart = getMonday(parseISO(s));
    updateWeekDisplay();
    if (currentCategory === 'outside') { renderTable(); return; }
    const diff = countLeaveDays(s, e);
    document.getElementById('totalDays').value = diff > 0 ? diff : '-';
    checkSchedule();
}

function checkSchedule() {
    const tCode = document.getElementById('teacherCode').value;
    const sDate = document.getElementById('startDate').value;
    const eDate = document.getElementById('endDate').value;
    if (!tCode || !sDate || !eDate) { renderTable(); return; }
    const myToken = ++scheduleCheckToken;
    document.getElementById('scheduleLoading').classList.remove('hidden');

    gas('apiCheckScheduleForLeave', [currentIdToken, sDate, eDate], res => {
        if (myToken !== scheduleCheckToken) return; // มีการเรียกใหม่แล้ว
        document.getElementById('scheduleLoading').classList.add('hidden');
        selectedClasses = [];
        if (res && res.found && res.data && res.data.length > 0) {
            document.querySelector('input[name="teachLoad"][value="ฝากสอน"]').checked = true;
            document.getElementById('scheduleAlert').classList.remove('hidden');
            toggleSubstituteTable(true);
            res.data.forEach(item => {
                const [dd, mm, yyyyRaw] = String(item.date).split('/');
                let yyyy = parseInt(yyyyRaw);
                if (yyyy > 2400) yyyy -= 543;
                const isoDate = `${yyyy}-${pad(parseInt(mm))}-${pad(parseInt(dd))}`;
                const sDis = parseInt(item.startPeriod), eDis = parseInt(item.endPeriod);
                const periodRange = [];
                for (let p = sDis; p <= eDis; p++) periodRange.push(p);
                selectedClasses.push({
                    date: isoDate, periodDisplay: (sDis === eDis) ? `${sDis}` : `${sDis}-${eDis}`, periods: periodRange,
                    courseCode: item.subject, recipientTeacherName: '', recipientTeacherCode: '', pairId: item.pairId
                });
            });
        } else {
            document.getElementById('scheduleAlert').classList.add('hidden');
            const cur = document.querySelector('input[name="teachLoad"]:checked');
            if (cur && cur.value === 'ฝากสอน') {
                document.querySelector('input[name="teachLoad"][value="ไม่มีคาบสอน"]').checked = true;
                toggleSubstituteTable(false);
            }
        }
        renderTable(); renderSelectedList();
    }, err => {
        if (myToken !== scheduleCheckToken) return;
        document.getElementById('scheduleLoading').classList.add('hidden');
        console.error('checkScheduleForLeave', err);
        Swal.fire('ตรวจสอบตารางสอนไม่สำเร็จ', 'กรุณาเลือกวิชาในตารางด้วยตนเอง หรือลองเลือกวันที่ใหม่', 'warning');
    });
}

// ==========================================
// ตารางสอน
// ==========================================
function changeWeek(days) { currentWeekStart.setDate(currentWeekStart.getDate() + days); updateWeekDisplay(); renderTable(); }
function updateWeekDisplay() {
    const end = new Date(currentWeekStart); end.setDate(end.getDate() + 4);
    document.getElementById('weekDisplay').innerText = `${currentWeekStart.getDate()}/${currentWeekStart.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}`;
}

function renderTable() {
    const thead = document.querySelector('#scheduleTable thead');
    const tbody = document.getElementById('scheduleBody');
    const cols = PERIODS.length + 1;
    thead.innerHTML = `<tr><th>วัน/คาบ</th>${PERIODS.map(p => `<th>${p}</th>`).join('')}</tr>`;
    tbody.innerHTML = '';
    if (!currentSchedule.length) { tbody.innerHTML = `<tr><td colspan="${cols}" class="p-4 text-center text-gray-400">ไม่พบตารางสอน</td></tr>`; return; }

    const leaveStart = parseISO(document.getElementById('startDate').value);
    const leaveEnd = parseISO(document.getElementById('endDate').value);

    DAYS.forEach((day, i) => {
        const row = document.createElement('tr');
        const date = new Date(currentWeekStart); date.setDate(date.getDate() + i); date.setHours(0, 0, 0, 0);
        const dateStr = fmtDate(date);
        const isWithinLeaveDate = !!(leaveStart && leaveEnd && date >= leaveStart && date <= leaveEnd);

        row.innerHTML = `<td>${day}<br><span class="text-xs ${isWithinLeaveDate ? 'text-indigo-600 font-bold' : 'text-gray-500 font-normal'}">${date.getDate()}/${date.getMonth() + 1}</span></td>`;

        PERIODS.forEach(pNum => {
            const td = document.createElement('td');
            const item = currentSchedule.find(s => s.day === day && s.period === pNum);

            if (item) {
                if (item.type !== 'class') {
                    td.className = 'tt-break';
                    td.innerHTML = `<div class="class-cell-content"><span class="subject-text" style="opacity:0.5">${esc(item.courseCode)}</span></div>`;
                } else {
                    td.className = 'tt-class';
                    if (isWithinLeaveDate) {
                        const selectedGroup = selectedClasses.find(g => g.date === dateStr && g.periods.includes(pNum));
                        if (selectedGroup) td.classList.add(selectedGroup.recipientTeacherName ? 'status-complete' : 'status-pending');
                        td.innerHTML = `<div class="class-cell-content"><div class="subject-text">${esc(item.courseCode)}</div><div class="room-text">${esc(item.room || '')}</div></div>`;
                        td.onclick = () => toggleSelectClass(item, dateStr, pNum);
                    } else {
                        td.style.opacity = '0.35';
                        td.style.cursor = 'not-allowed';
                        td.innerHTML = `<div class="class-cell-content" style="background-color:#f3f4f6;color:#9ca3af;border:none;cursor:not-allowed"><div class="subject-text">${esc(item.courseCode)}</div></div>`;
                    }
                }
            } else {
                td.className = 'tt-empty';
                td.innerHTML = '-';
            }
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
}

function toggleSelectClass(item, dateStr, periodNum) {
    const existIdx = selectedClasses.findIndex(g => g.date === dateStr && g.periods.includes(periodNum));
    if (existIdx > -1) selectedClasses.splice(existIdx, 1);
    else {
        const periods = findSmartGroup(item, periodNum);
        const sDis = periods[0], eDis = periods[periods.length - 1];
        selectedClasses.push({
            date: dateStr, periodDisplay: (sDis === eDis) ? `${sDis}` : `${sDis}-${eDis}`, periods: periods,
            courseCode: item.courseCode, recipientTeacherName: '', recipientTeacherCode: '', pairId: item.pairId
        });
    }
    renderTable(); renderSelectedList();
}

function findSmartGroup(item, currentPeriod) {
    const group = [currentPeriod];
    if (item.pairId) {
        currentSchedule
            .filter(s => s.day === item.day && s.pairId === item.pairId && s.period !== currentPeriod && s.type === 'class')
            .forEach(p => group.push(p.period));
    } else {
        const next = currentSchedule.find(s => s.day === item.day && s.period === currentPeriod + 1);
        if (next && next.courseCode === item.courseCode && next.type === 'class') group.push(next.period);
        const prev = currentSchedule.find(s => s.day === item.day && s.period === currentPeriod - 1);
        if (prev && prev.courseCode === item.courseCode && prev.type === 'class') group.push(prev.period);
    }
    return Array.from(new Set(group)).sort((a, b) => a - b);
}

function findConflict(schedule, dayName, periods) {
    for (const p of periods) {
        const c = schedule.find(s => s.day === dayName && s.period === p && (s.type === 'class' || s.type === 'activity'));
        if (c) return { subject: c.courseCode, period: p };
    }
    return null;
}

function renderSelectedList() {
    const container = document.getElementById('selectedClassesList');
    const card = document.getElementById('detailsCard');
    const badge = document.getElementById('classCountBadge');
    if (selectedClasses.length === 0) { card.classList.add('hidden'); badge.innerText = "0 คาบ"; container.innerHTML = ''; return; }
    card.classList.remove('hidden'); badge.innerText = selectedClasses.length + " รายการ"; container.innerHTML = '';
    selectedClasses.sort((a, b) => a.date.localeCompare(b.date) || a.periods[0] - b.periods[0]);

    const currentName = document.getElementById('name').value;
    const availableTeachers = allTeachers.filter(t => t.name !== currentName);

    selectedClasses.forEach((item, idx) => {
        const uid = `sub_${idx}`;
        const d = parseISO(item.date);
        const dDisplay = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
        const div = document.createElement('div');
        div.className = 'selected-class-group border-b pb-3 last:border-0 last:pb-0';
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div><div class="font-bold text-gray-800 text-sm"><span class="text-indigo-600">📅 ${dDisplay}</span> คาบ ${esc(item.periodDisplay)}</div><div class="text-xs text-gray-500">${esc(item.courseCode)}</div></div>
                <button type="button" onclick="removeClass(${idx})" class="text-red-500 hover:text-red-700 text-xs border border-red-200 px-2 py-1 rounded">ลบ</button>
            </div>
            <div class="searchable-select-container">
                <input type="text" id="input_${uid}" class="form-input text-sm py-1.5 bg-gray-50 focus:bg-white" placeholder="เลือกครูสอนแทน..." value="${esc(item.recipientTeacherName)}" autocomplete="off">
                <div id="drop_${uid}" class="searchable-select-dropdown"></div>
            </div>`;
        container.appendChild(div);

        initSearchableDropdown(`input_${uid}`, `drop_${uid}`, null, availableTeachers, (t) => {
            const inputEl = document.getElementById(`input_${uid}`);
            inputEl.value = 'กำลังตรวจสอบตารางสอน...';
            inputEl.disabled = true;
            const dayName = THAI_DAYS[d.getDay()];

            const onFail = err => {
                inputEl.disabled = false;
                inputEl.value = item.recipientTeacherName || '';
                console.error(err);
                Swal.fire('ตรวจสอบตารางสอนไม่สำเร็จ', 'กรุณาลองเลือกครูผู้สอนแทนอีกครั้ง', 'error');
            };

            fetchSchedule(t.code, schedule => {
                inputEl.disabled = false;
                const conflict = findConflict(schedule, dayName, item.periods);
                if (conflict) {
                    inputEl.value = '';
                    item.recipientTeacherName = '';
                    item.recipientTeacherCode = '';
                    renderTable();
                    Swal.fire({
                        title: 'คาบสอนชนกัน!',
                        text: `ไม่สามารถฝากคาบให้ ${t.name} ได้ เนื่องจากมีสอนวิชา ${conflict.subject} ในวัน${dayName} คาบที่ ${conflict.period}`,
                        icon: 'error',
                        confirmButtonColor: '#4f46e5'
                    }).then(() => { inputEl.focus(); });
                    return;
                }
                inputEl.value = t.name;
                item.recipientTeacherName = t.name;
                item.recipientTeacherCode = t.code;
                renderTable();
            }, onFail);
        }, 'same_dept');

        // ถ้าพิมพ์ทับหรือลบชื่อ ให้ล้างค่าที่เลือกไว้
        document.getElementById(`input_${uid}`).addEventListener('input', e => {
            if (e.target.value !== item.recipientTeacherName) {
                item.recipientTeacherName = '';
                item.recipientTeacherCode = '';
                renderTable();
            }
        });
    });
}

function removeClass(idx) { selectedClasses.splice(idx, 1); renderTable(); renderSelectedList(); }

// ==========================================
// Dropdown ค้นหา
// ==========================================
function initSearchableDropdown(inputId, dropId, hiddenId, dataSource, onSelect, mode) {
    mode = mode || 'all';
    const input = document.getElementById(inputId);
    const drop = document.getElementById(dropId);
    if (!input || !drop) return;
    const render = (filterVal) => {
        filterVal = filterVal || '';
        drop.innerHTML = "";
        let filtered = [];
        let isFilteredByDept = false;
        if (filterVal === '') {
            if (mode === 'same_dept') {
                const myDeptRaw = document.getElementById('teacherDeptRaw').value || '';
                const myMainDept = myDeptRaw.split('(')[0].trim();
                if (myMainDept) { filtered = dataSource.filter(t => t.dept && t.dept.includes(myMainDept)); isFilteredByDept = true; }
                else filtered = dataSource.slice(0, 50);
            } else filtered = dataSource.slice(0, 50);
        } else {
            const term = filterVal.toLowerCase();
            filtered = dataSource.filter(t => (t.name || '').toLowerCase().includes(term) || (t.code && String(t.code).toLowerCase().includes(term))).slice(0, 50);
        }
        if (filtered.length === 0) drop.innerHTML = '<div class="p-3 text-center text-sm text-gray-400">ไม่พบข้อมูล</div>';
        else {
            if (isFilteredByDept) { const h = document.createElement('div'); h.className = 'dropdown-group-header'; h.innerText = 'แนะนำ: กลุ่มสาระเดียวกัน'; drop.appendChild(h); }
            filtered.forEach(t => {
                const div = document.createElement('div');
                div.className = "searchable-select-option";
                div.innerHTML = `<span class="font-medium">${esc(t.name)}</span> <span class="text-xs text-gray-400">(${esc(t.dept)})</span>`;
                div.onclick = () => {
                    input.value = t.name;
                    if (hiddenId) document.getElementById(hiddenId).value = t.code;
                    drop.classList.remove('show');
                    if (onSelect) onSelect(t);
                };
                drop.appendChild(div);
            });
        }
        drop.classList.add('show');
    };
    input.addEventListener('focus', () => render(''));
    input.addEventListener('input', () => render(input.value));
}

// ==========================================
// ส่งข้อมูล
// ==========================================
function submitForm(e) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!currentCategory) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกประเภทการทำรายการ', 'warning'); return; }
    if (!lineUser || !currentIdToken) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกชื่อผู้ลาจากรายการ', 'warning'); return; }
    if (!document.getElementById('startDate').value || !document.getElementById('endDate').value) {
        Swal.fire('แจ้งเตือน', 'กรุณาเลือกวันที่', 'warning'); return;
    }

    const teachRadio = document.querySelector('input[name="teachLoad"]:checked');
    const teachVal = teachRadio ? teachRadio.value : 'ไม่มีคาบสอน';
    const isTeaching = (teachVal === 'ฝากสอน');

    if (isTeaching) {
        if (selectedClasses.length === 0) { Swal.fire('แจ้งเตือน', 'กรุณาคลิกเลือกวิชาในตาราง', 'warning'); return; }
        if (selectedClasses.some(c => !c.recipientTeacherName)) { Swal.fire('ข้อมูลไม่ครบ', 'ระบุครูผู้สอนแทนให้ครบ', 'warning'); return; }
    }

    const val = id => (document.getElementById(id).value || '').trim();
    let typeVal = currentCategory;
    let reasonVal = '';
    let officialData = {}, outsideData = {};

    if (currentCategory === 'general') {
        const rt = document.querySelector('input[name="leaveType"]:checked');
        if (!rt) { Swal.fire('แจ้งเตือน', 'กรุณาเลือกประเภทการลา', 'warning'); return; }
        if (rt.value === 'other') {
            if (!val('otherReason')) { Swal.fire('แจ้งเตือน', 'กรุณาระบุประเภทการลา', 'warning'); return; }
            typeVal = val('otherReason');
        } else typeVal = rt.value;
        reasonVal = typeVal;
    } else if (currentCategory === 'official') {
        if (!val('officialPurpose') || !val('officialTopic') || !val('officialLocation')) {
            Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอก เพื่อ / เรื่อง / สถานที่ ให้ครบ', 'warning'); return;
        }
        const accList = [];
        document.getElementsByName('accompanyName').forEach(acc => { if (acc.value.trim()) accList.push(acc.value.trim()); });

        const veh = document.querySelector('input[name="vehicle"]:checked');
        let vehTxt = veh ? veh.value : '-';
        if (vehTxt === 'รถส่วนตัว') {
            if (!val('vehiclePlate')) { Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุหมายเลขทะเบียนรถ', 'warning'); return; }
            vehTxt += ` (${val('vehiclePlate')})`;
        }

        const bud = document.querySelector('input[name="budget"]:checked');
        let budTxt = bud ? bud.value : '-';
        if (budTxt === 'เบิกบางส่วน') {
            const selected = [];
            document.querySelectorAll('.budget-opt:checked').forEach(o => selected.push(o.value));
            if (!selected.length) { Swal.fire('ข้อมูลไม่ครบ', 'กรุณาเลือกรายการค่าใช้จ่ายที่ขอเบิก', 'warning'); return; }
            budTxt += ` (${selected.join(',')})`;
        } else if (budTxt === 'เบิกโครงการ') {
            if (!val('projectBudgetDetail')) { Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุชื่อโครงการ', 'warning'); return; }
            budTxt += ` (${val('projectBudgetDetail')})`;
        }

        officialData = {
            accompany: accList.join(', '),
            purpose: val('officialPurpose'),
            topic: val('officialTopic'),
            location: val('officialLocation'),
            vehicle: vehTxt,
            budget: budTxt
        };
        reasonVal = `[ไปราชการ] ${officialData.purpose}: ${officialData.topic}`;
    } else if (currentCategory === 'outside') {
        const st = val('outsideStartTime'), en = val('outsideEndTime');
        if (!val('outsideReason') || !val('outsideLocation') || !st || !en) {
            Swal.fire('ข้อมูลไม่ครบ', 'กรุณากรอก เหตุผล / สถานที่ / เวลา ให้ครบ', 'warning'); return;
        }
        if (st >= en) { Swal.fire('เวลาไม่ถูกต้อง', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', 'warning'); return; }
        outsideData = {
            reason: val('outsideReason'),
            location: val('outsideLocation'),
            timeRange: `${st} - ${en}`
        };
        reasonVal = `[ออกนอกบริเวณ] ${outsideData.reason}`;
    }

    const formData = {
        category: currentCategory,
        name: val('name'),
        position: val('position'),
        dept: val('dept'),
        type: typeVal,
        reason: reasonVal,
        dateOrTime: document.getElementById('startDate').value + " - " + document.getElementById('endDate').value,
        totalDays: document.getElementById('totalDays').value,
        address: val('contact'),
        teachingStatus: teachVal === 'มอบหมายงาน' ? 'มอบหมายงาน' : (isTeaching ? "มีสอน (ฝากคาบแล้ว)" : "ไม่มีสอน"),
        substituteList: isTeaching ? selectedClasses : [],

        official_accompany: officialData.accompany,
        official_purpose: officialData.purpose,
        official_topic: officialData.topic,
        official_location: officialData.location,
        official_vehicle: officialData.vehicle,
        official_budget: officialData.budget,

        outside_reason: outsideData.reason,
        outside_location: outsideData.location,
        outside_time_range: outsideData.timeRange
    };

    isSubmitting = true;
    document.getElementById('btnSubmit').disabled = true;
    showLoading(true);

    const done = () => { isSubmitting = false; document.getElementById('btnSubmit').disabled = false; showLoading(false); };

    gas('apiRecordLeave', [currentIdToken, formData], res => {
        done();
        if (res && res.success) {
            Swal.fire({ title: 'บันทึกสำเร็จ!', icon: 'success', confirmButtonColor: '#4f46e5' }).then(() => goBack());
        } else {
            const msg = (res && res.error) || 'ไม่ทราบสาเหตุ';
            if (msg.includes("คาบสอนชนกัน")) {
                Swal.fire({ title: 'เกิดข้อผิดพลาด!', text: msg.replace("❌ ", ""), icon: 'error', confirmButtonColor: '#4f46e5' });
            } else {
                Swal.fire('Error', msg, 'error');
            }
        }
    }, err => {
        done();
        Swal.fire('ระบบขัดข้อง', (err && err.message) || String(err), 'error');
    });
}

// ==========================================
// LINE Login (บังคับ) + ลงทะเบียนครั้งแรก
// ==========================================
// หน้านี้อยู่ใน iframe ของ Apps Script จึงล็อกอิน LINE ที่นี่ไม่ได้
// ครูต้องเข้าผ่านลิงก์ LIFF → หน้า relay ล็อกอินแล้วส่ง ID Token มาทาง ?idt=
const LIFF_URL = 'https://liff.line.me/' + LIFF_ID;
let appStarted = false;

function getUrlParam(name, cb) {
    cb(new URLSearchParams(window.location.search).get(name));
}

function showLoginGate(msg) {
    if (msg) document.getElementById('loginGateMsg').innerText = msg;
    const g = document.getElementById('loginGate');
    g.classList.remove('hidden'); g.classList.add('flex');
}
function hideLoginGate() {
    const g = document.getElementById('loginGate');
    g.classList.add('hidden'); g.classList.remove('flex');
}
function showBindModal() {
    const m = document.getElementById('lineBindModal');
    m.classList.remove('hidden'); m.classList.add('flex');
}
function hideBindModal() {
    const m = document.getElementById('lineBindModal');
    m.classList.add('hidden'); m.classList.remove('flex');
}

function goLineLogin() {
    getUrlParam('page', p => {
        const params = new URLSearchParams();
        if (p) params.set('page', p);
        params.set('returnTo', window.location.origin + window.location.pathname);
        window.location.assign(LIFF_URL + '?' + params.toString());
    });
}

function bootstrapSession() {
    showLoading(true);
    getUrlParam('idt', token => {
        if (!token) { showLoading(false); showLoginGate(); return; }
        gas('getUserByIdToken', [token], res => {
            showLoading(false);
            if (!res || res.error) { showLoginGate('การยืนยัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่'); return; }
            currentIdToken = token;
            if (res.user) startApp(res.user);
            else showBindModal();          // ยังไม่เคยลงทะเบียน
        }, err => {
            showLoading(false);
            console.error(err);
            showLoginGate('ตรวจสอบบัญชี LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        });
    });
}

// เริ่มใช้งานหลังยืนยันตัวตนแล้ว: ชื่อผู้ขอถูกกำหนดจากบัญชี LINE เท่านั้น
function startApp(user) {
    lineUser = user;
    hideLoginGate(); hideBindModal();
    if (appStarted) { onMainUserSelect(user); return; }
    appStarted = true;

    gas('apiGetAllSchedulesMap', [currentIdToken], map => {
        allSchedulesMap = map || {};
    }, err => console.warn('apiGetAllSchedulesMap ล้มเหลว (จะดึงตารางทีละคนแทน)', err));

    gas('apiGetStaffList', [currentIdToken], data => {
        allTeachers = data || [];
        addAccompany();
        checkUrlParameter();
        onMainUserSelect(user);
        Swal.fire({ title: 'เข้าสู่ระบบสำเร็จ', text: `ยินดีต้อนรับ ${user.name}`, icon: 'success', timer: 1500, showConfirmButton: false });
    }, err => {
        appStarted = false;
        Swal.fire('โหลดรายชื่อไม่สำเร็จ', (err && err.message) || 'กรุณารีเฟรชหน้าอีกครั้ง', 'error');
    });
}

function submitBindLine() {
    const typedName = document.getElementById('bindSearchName').value.trim();
    const phone4 = document.getElementById('bindPhone').value.trim();
    if (!typedName) { Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์ชื่อ-นามสกุลของคุณ', 'warning'); return; }
    if (!/^\d{4}$/.test(phone4)) { Swal.fire('แจ้งเตือน', 'กรุณากรอกเลขท้ายเบอร์โทรศัพท์ 4 หลัก', 'warning'); return; }

    showLoading(true);
    gas('registerLine', [currentIdToken, typedName, phone4], res => {
        showLoading(false);
        if (res && res.success) {
            Swal.fire({ title: 'ลงทะเบียนสำเร็จ!', text: `ผูกบัญชี LINE กับ ${res.user.name} แล้ว`, icon: 'success', confirmButtonColor: '#4f46e5' })
                .then(() => startApp(res.user));
        } else {
            Swal.fire('ลงทะเบียนไม่สำเร็จ', (res && res.error) || 'ไม่ทราบสาเหตุ', 'error');
        }
    }, err => {
        showLoading(false);
        Swal.fire('ระบบขัดข้อง', (err && err.message) || String(err), 'error');
    });
}