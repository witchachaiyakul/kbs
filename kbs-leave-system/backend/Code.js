// ==========================================
// ⚙️ 1. การตั้งค่า (Configuration)
// ==========================================
// 🔐 Token เก็บใน Script Properties (Project Settings → Script properties)
//    TOKEN_ADMIN   = Channel access token ของบอทผู้บริหาร
//    TOKEN_TEACHER = Channel access token ของบอทครู
const PROPS = PropertiesService.getScriptProperties();
const TOKEN_ADMIN = PROPS.getProperty('TOKEN_ADMIN') || '';
const TOKEN_TEACHER = PROPS.getProperty('TOKEN_TEACHER') || '';
const API_SHARED_SECRET = PROPS.getProperty('API_SHARED_SECRET') || '';
// Channel ID ของ LINE Login channel (ตัวเลขหน้าขีดใน LIFF ID)
const LINE_LOGIN_CHANNEL_ID = '2012279186';
const ADMIN_USER_ID = 'Uf286e2374b7d6dbd570c2511db16dfe0';

// 📁 ID ไฟล์และโฟลเดอร์
const SPREADSHEET_ID = "1c2SilaeHl_cExc9lckZFEYDL39kdaIVvFEnN_AWr_2w";
const FOLDER_ID_OFFICIAL = "1DP_u4GdxPsybuQMm72_WLhkvKQ7UCFPO";
const FOLDER_ID_SUBSTITUTE = "1c1-UxvqFC0syNTgY7jtWy9LRNmGAVRZs";
const FOLDER_ID_GENERAL = "1qmrW6rybe-ir-hezwtnjoTzgjyFJVYgP";
const FOLDER_ID_OUTSIDE = "1RUZntTJVgokw29nZ-hW3eyeTTEdBZbvc";

const TEMPLATE_ID_GENERAL = "1ccPXe0L9lCr_6FskdZ_CEU4jQDPkxVrc4I3RDAGLOws";
const TEMPLATE_ID_OFFICIAL = "197F5rVICYmKrKIArGS1UP-DTrtNa65VkcabFc5W2I8s";
const TEMPLATE_ID_OUTSIDE = "18u2v5Bqql7dQknkrv2tZJtq1kzeU8fSi1I2knxxsflE";
const TEMPLATE_ID_SUBSTITUTE = "1rQFfKGQevuI-soLxdJrLUKAbWDrVrxyOoe0hrIuD9_8";

// 🕒 ค่าคงที่อื่นๆ
const STAFF_SHEET_NAME = 'Name-List';      // เทียบแบบไม่สนตัวพิมพ์ใหญ่-เล็ก (ดู getStaffSheet_)
const SCHEDULE_SHEET_NAME = 'Class';
const SUB_RECORD_SHEET_NAME = 'Data_Substitution';
const SHEET_GENERAL = 'SHEET_GENERAL';
const SHEET_OFFICIAL = 'SHEET_OFFICIAL';
const SHEET_OUTSIDE = 'SHEET_OUTSIDE';
const SHEET_QUOTA = 'Quota';

// คอลัมน์ในชีต Name-List (เริ่มนับ 0 = A)
const COL = { NAME: 0, POSITION: 1, DEPT: 2, PHONE: 3, CODE: 10, LINE: 11 };
const HEAD_ROLE_TEXT = 'หัวหน้ากลุ่มสาระ';
const FISCAL_YEAR_QUOTA = true;   // true = นับวันลาสะสมเฉพาะปีงบประมาณปัจจุบัน (1 ต.ค. - 30 ก.ย.)
const STATUS_PENDING = 'รออนุมัติ';

const PERIOD_TIMINGS = {
  1: { start: "08:30", end: "09:20" },
  2: { start: "09:20", end: "10:10" },
  3: { start: "10:10", end: "11:00" },
  4: { start: "11:00", end: "11:50" },
  5: { start: "12:50", end: "13:40" },
  6: { start: "13:40", end: "14:30" },
  7: { start: "14:30", end: "15:20" },
  8: { start: "15:20", end: "16:10" },
  9: { start: "16:10", end: "17:00" }
};

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TITLE_REGEX = /(ว่าที่\s*ร\.?ต\.?\s*(หญิง)?|นางสาว|นาง|นาย|ครูผู้ช่วย|ครู|ข้าราชการ|พนักงานราชการ|ลูกจ้างชั่วคราว)/g;

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ service: 'kbs-leave-api', status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 🛠️ Helpers
// ==========================================
function pad2_(n) { return ('0' + n).slice(-2); }

// แปลง 'yyyy-mm-dd' เป็น Date (UTC เที่ยงคืน) ไม่ขึ้นกับ timezone ของโปรเจกต์
function parseYMD_(s) {
  var p = String(s || '').trim().split('-').map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}

function cleanTitle_(s) { return String(s || '').replace(TITLE_REGEX, '').replace(/\s+/g, ' ').trim(); }
function cleanKey_(s) { return String(s || '').replace(TITLE_REGEX, '').replace(/\s+/g, '').toLowerCase(); }

function getSheetCI_(ss, name) {
  var exact = ss.getSheetByName(name);
  if (exact) return exact;
  var target = String(name).toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase() === target) return sheets[i];
  }
  return null;
}

function getStaffSheet_(ss) {
  return getSheetCI_(ss, STAFF_SHEET_NAME);
}

function findLineCol_(headers) {
  for (var j = 0; j < headers.length; j++) {
    if (String(headers[j]).trim().toLowerCase().indexOf('line') > -1) return j;
  }
  return COL.LINE;
}

function findCodeCol_(headers) {
  for (var j = 0; j < headers.length; j++) {
    var h = String(headers[j]).trim().toLowerCase();
    if (h.indexOf('no_teach') > -1 || h.indexOf('รหัส') > -1) return j;
  }
  return COL.CODE;
}

function getThaiDate_(d) {
  return d.getDate() + " " + THAI_MONTHS[d.getMonth()] + " " + (d.getFullYear() + 543);
}

// ==========================================
// 2️⃣ ข้อมูลบุคลากร / ตารางสอน
// ==========================================
function getStaffList_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getStaffSheet_(ss);
  if (!sheet) return [];

  var data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) return [];
  var lineCol = findLineCol_(data[0]);
  var codeCol = findCodeCol_(data[0]);
  var staffList = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var name = String(row[COL.NAME] || '').trim();
    if (!name) continue;
    staffList.push({
      name: name,
      code: String(row[codeCol] || '').trim(),
      position: String(row[COL.POSITION] || '-').trim(),
      dept: String(row[COL.DEPT] || '-').trim(),
      phone: String(row[COL.PHONE] || '-').trim()
    });
  }
  return staffList;
}

function classifyCourse_(course) {
  var c = String(course);
  var lower = c.toLowerCase();
  var special = c === '-' || c.indexOf('พัก') > -1 || c.indexOf('กิจกรรม') > -1 || c.indexOf('PLC') > -1 ||
    c.indexOf('โฮมรูม') > -1 || lower.indexOf('homeroom') > -1 || c.indexOf('ชุมนุม') > -1 ||
    c.indexOf('ลูกเสือ') > -1 || c.indexOf('เนตรนารี') > -1 || c.indexOf('ยุวกาชาด') > -1 ||
    c.indexOf('เบญจวิถี') > -1 || c.indexOf('สาธารณ ประโยชน์') > -1;
  if (!special) return 'class';
  return c.indexOf('พัก') > -1 ? 'break' : 'activity';
}

// rows: [{day, period, course}] ของครู 1 คน → ตารางพร้อม pairId
function buildSchedule_(rows) {
  var scheduleMap = {};
  rows.forEach(function (r) {
    if (!scheduleMap[r.day]) scheduleMap[r.day] = {};
    scheduleMap[r.day][r.period] = { day: r.day, period: r.period, courseCode: r.course, room: "", type: classifyCourse_(r.course), pairId: null };
  });

  var finalSchedule = [];
  for (var day in scheduleMap) {
    var daySch = scheduleMap[day];
    [[1, 4], [5, 9]].forEach(function (range) {
      var blockItems = []; var commonName = null;
      for (var p = range[0]; p <= range[1]; p++) {
        var item = daySch[p];
        if (item && item.type === 'class' && item.courseCode.indexOf('เพิ่มเติม') > -1) {
          if (!commonName) commonName = item.courseCode;
          if (item.courseCode === commonName) blockItems.push(item);
        }
      }
      if (blockItems.length > 1) {
        var pid = day + '_Elective_' + commonName + '_' + range[0];
        blockItems.forEach(function (it) { it.pairId = pid; });
      }
    });
    for (var p2 = 1; p2 <= 9; p2++) {
      var curr = daySch[p2]; var next = daySch[p2 + 1];
      if (curr && next && !curr.pairId && !next.pairId && curr.type === 'class' && next.type === 'class' && curr.courseCode === next.courseCode) {
        var pid2 = day + '_' + curr.courseCode + '_' + p2; curr.pairId = pid2; next.pairId = pid2;
      }
      if (curr) finalSchedule.push(curr);
    }
    if (daySch[10]) finalSchedule.push(daySch[10]);
    if (daySch[11]) finalSchedule.push(daySch[11]);
  }
  return finalSchedule;
}

function readClassRows_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getSheetCI_(ss, SCHEDULE_SHEET_NAME);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.length < 6) continue;
    var code = String(row[5] || '').trim();
    var day = String(row[4] || '').trim();
    var period = parseInt(row[3]);
    var course = String(row[2] || '-').trim();
    if (code && day && !isNaN(period) && period >= 1 && period <= 11) {
      out.push({ code: code, day: day, period: period, course: course });
    }
  }
  return out;
}

function getSchedule_(teacherCode) {
  var target = String(teacherCode).trim();
  var rows = readClassRows_().filter(function (r) { return r.code === target; });
  return buildSchedule_(rows);
}

// ตารางสอนของทุกคน (รูปแบบเดียวกับ getSchedule รวม pairId) จัดกลุ่มตามรหัสครู
function getAllSchedulesMap_() {
  var grouped = {};
  readClassRows_().forEach(function (r) {
    if (!grouped[r.code]) grouped[r.code] = [];
    grouped[r.code].push(r);
  });
  var map = {};
  for (var code in grouped) map[code] = buildSchedule_(grouped[code]);
  return map;
}

function checkScheduleForLeave_(teacherCode, startDateStr, endDateStr, timeStart, timeEnd) {
  var fullSchedule = getSchedule_(teacherCode);
  if (fullSchedule.length === 0) return { found: false, data: [] };

  var start = parseYMD_(startDateStr);
  var end = parseYMD_(endDateStr || startDateStr);
  if (!start || !end) return { found: false, data: [] };
  var affectedClasses = [];

  var toMins = function (t) { if (!t) return 0; var p = t.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
  var reqStart = timeStart ? toMins(timeStart) : 0;
  var reqEnd = timeEnd ? toMins(timeEnd) : 1440;

  for (var d = new Date(start.getTime()); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    var dayName = THAI_DAYS[d.getUTCDay()];
    var y = d.getUTCFullYear(), m = pad2_(d.getUTCMonth() + 1), dd = pad2_(d.getUTCDate());
    var todayClasses = fullSchedule.filter(function (s) { return s.day === dayName && s.type === 'class'; });

    todayClasses.forEach(function (c) {
      var isOverlap = true;
      if (timeStart && timeEnd && PERIOD_TIMINGS[c.period]) {
        var pStart = toMins(PERIOD_TIMINGS[c.period].start);
        var pEnd = toMins(PERIOD_TIMINGS[c.period].end);
        if (pEnd <= reqStart || pStart >= reqEnd) isOverlap = false;
      }
      if (isOverlap) {
        affectedClasses.push({
          date: dd + '/' + m + '/' + y,
          isoDate: y + '-' + m + '-' + dd,
          day: dayName, period: c.period, subject: c.courseCode, room: c.room || '', pairId: c.pairId
        });
      }
    });
  }
  return { found: affectedClasses.length > 0, data: groupConsecutivePeriodsForLeave_(affectedClasses) };
}

function groupConsecutivePeriodsForLeave_(dataList) {
  if (!dataList || dataList.length === 0) return [];
  dataList.sort(function (a, b) {
    var d1 = a.date.split('/').reverse().join(''); var d2 = b.date.split('/').reverse().join('');
    return d1.localeCompare(d2) || a.period - b.period;
  });
  var grouped = []; var current = null;
  dataList.forEach(function (item) {
    if (current && current.date === item.date && current.subject === item.subject && item.period === current.endPeriod + 1) {
      current.endPeriod = item.period; current.periodDisplay = current.startPeriod + '-' + item.period;
    } else {
      if (current) grouped.push(current);
      current = Object.assign({}, item); current.startPeriod = item.period; current.endPeriod = item.period; current.periodDisplay = String(item.period);
    }
  });
  if (current) grouped.push(current);
  return grouped;
}

// ==========================================
// 🔗 LINE ผูกบัญชี / ตรวจสอบตัวตน
// ==========================================
function getUserByLineId_(lineUserId) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getStaffSheet_(ss);
  if (!sheet || !lineUserId) return null;

  var data = sheet.getDataRange().getDisplayValues();
  var lineCol = findLineCol_(data[0]);
  var codeCol = findCodeCol_(data[0]);
  var target = String(lineUserId).trim();

  for (var i = 1; i < data.length; i++) {
    var existingId = String(data[i][lineCol] || '').trim();
    if (existingId && existingId === target) {
      return {
        name: String(data[i][COL.NAME]).trim(),
        position: String(data[i][COL.POSITION]).trim(),
        dept: String(data[i][COL.DEPT]).trim(),
        phone: String(data[i][COL.PHONE]).trim(),
        code: String(data[i][codeCol]).trim()
      };
    }
  }
  return null;
}

function linkLineUserId_(teacherCode, lineUserId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = getStaffSheet_(ss);
    if (!sheet) return { success: false, error: "ไม่พบชีตรายชื่อบุคลากร (" + STAFF_SHEET_NAME + ")" };
    if (!lineUserId) return { success: false, error: "ไม่พบ LINE User ID" };

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var lineCol = -1;
    for (var j = 0; j < headers.length; j++) {
      if (String(headers[j]).trim().toLowerCase().indexOf('line') > -1) { lineCol = j; break; }
    }
    if (lineCol === -1) { lineCol = COL.LINE; if (!String(headers[lineCol] || '').trim()) sheet.getRange(1, lineCol + 1).setValue("Line User ID"); }
    var codeCol = findCodeCol_(headers);

    var target = String(teacherCode).trim();
    var newId = String(lineUserId).trim();
    var targetRow = -1;

    for (var i = 1; i < data.length; i++) {
      var code = String(data[i][codeCol] || '').trim();
      var nm = String(data[i][COL.NAME] || '').trim();
      if ((code && code === target) || nm === target) { targetRow = i; break; }
    }
    if (targetRow === -1) return { success: false, error: "ไม่พบข้อมูลบุคลากรในระบบ" };

    var currentId = String(data[targetRow][lineCol] || '').trim();
    if (currentId && currentId !== newId) {
      return { success: false, error: "ชื่อนี้ถูกผูกกับบัญชี LINE อื่นแล้ว กรุณาติดต่อผู้ดูแลระบบ" };
    }
    // กัน LINE ID เดียวผูกหลายคน
    for (var k = 1; k < data.length; k++) {
      if (k !== targetRow && String(data[k][lineCol] || '').trim() === newId) {
        return { success: false, error: "บัญชี LINE นี้ถูกผูกกับบุคลากรท่านอื่นแล้ว" };
      }
    }
    sheet.getRange(targetRow + 1, lineCol + 1).setValue(newId);
    return { success: true, name: String(data[targetRow][COL.NAME]).trim() };
  } catch (e) {
    return { success: false, error: "System Error: " + e.message };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ==========================================
// 📊 วันลา / ข้อมูลประกอบ
// ==========================================
function getFiscalYearStart_(now) {
  var y = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 9, 1, 0, 0, 0);
}

function getLeaveBalance_(teacherName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var recordSheet = getSheetCI_(ss, SHEET_GENERAL);
  var quotaSheet = getSheetCI_(ss, SHEET_QUOTA);
  var quotas = {};
  if (quotaSheet) {
    var qData = quotaSheet.getDataRange().getValues();
    for (var k = 1; k < qData.length; k++) {
      var qType = String(qData[k][0]).trim(); var qLimit = parseFloat(qData[k][1]) || 0;
      if (qType) quotas[qType] = qLimit;
    }
  } else { quotas = { 'ลาป่วย': 60, 'ลากิจส่วนตัว': 45, 'ลาพักผ่อน': 10, 'ลาคลอดบุตร': 90 }; }

  var used = {}; for (var key in quotas) used[key] = 0; used['other'] = 0;
  var fyStart = getFiscalYearStart_(new Date());

  if (recordSheet && recordSheet.getLastRow() >= 2) {
    var data = recordSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowName = String(data[i][2]).trim();
      if (rowName !== teacherName) continue;
      if (String(data[i][11]).trim() === 'ไม่อนุมัติ') continue;       // ไม่นับใบที่ถูกปฏิเสธ
      var created = data[i][1];
      if (FISCAL_YEAR_QUOTA && created instanceof Date && created < fyStart) continue;
      var type = String(data[i][5]).trim();
      var days = parseFloat(data[i][8]) || 0;
      if (quotas.hasOwnProperty(type)) used[type] = (used[type] || 0) + days; else used['other'] += days;
    }
  }
  return { quotas: quotas, used: used };
}

function findHeadOfDepartment_(deptName) {
  if (!deptName) return "-";
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getStaffSheet_(ss);
  if (!sheet) return "-";
  var mainDept = String(deptName).split('(')[0].trim();
  if (!mainDept) return "-";
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var tDept = String(data[i][COL.DEPT] || '');
    if (tDept.indexOf(mainDept) === -1) continue;
    var isHead = data[i].some(function (cell) { return String(cell).indexOf(HEAD_ROLE_TEXT) > -1; });
    if (isHead) return String(data[i][COL.NAME]).trim();
  }
  return "-";
}

function generateRunNumber_(sheet) {
  var lastRow = sheet.getLastRow();
  var nextNum = 1;
  var year = new Date().getFullYear() + 543;
  if (lastRow > 1) {
    var lastId = sheet.getRange(lastRow, 1).getValue();
    if (lastId && String(lastId).indexOf('/') > -1) {
      var parts = String(lastId).split('/');
      if (parseInt(parts[1]) === year) nextNum = parseInt(parts[0]) + 1;
    }
  }
  return String(nextNum).padStart(4, '0') + '/' + year;
}

function findPreviousLeaveDays_(teacherName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getSheetCI_(ss, SHEET_GENERAL);
  if (!sheet || sheet.getLastRow() < 2) return "-";
  var data = sheet.getDataRange().getValues();
  var foundCount = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][2]).trim() === teacherName) {
      foundCount++;
      if (foundCount === 2) return String(data[i][8]);   // ใบล่าสุด = ใบที่เพิ่งบันทึก ดังนั้นใบก่อนหน้าคือลำดับที่ 2
    }
  }
  return "-";
}

// ==========================================
// 🚀 3. บันทึกและสร้างเอกสาร
// ==========================================
function recordLeave_(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var now = new Date();

    // ตรวจสอบรายการฝากคาบ
    if (formData.substituteList && formData.substituteList.length > 0) {
      var requesterKey = cleanKey_(formData.name);
      var staffList = getStaffList_();
      var scheduleCache = {};

      for (var i = 0; i < formData.substituteList.length; i++) {
        var subItem = formData.substituteList[i];
        var receiverKey = cleanKey_(subItem.recipientTeacherName);

        if (!receiverKey) return { success: false, error: "กรุณาระบุครูผู้สอนแทนให้ครบ (" + subItem.courseCode + ")" };
        if (requesterKey === receiverKey) {
          return { success: false, error: "ไม่สามารถฝากคาบให้ตัวเองได้ (" + subItem.courseCode + ")" };
        }

        var receiverStaff = staffList.filter(function (s) { return cleanKey_(s.name) === receiverKey; })[0];
        if (!receiverStaff) return { success: false, error: "ไม่พบรายชื่อครูผู้สอนแทน: " + subItem.recipientTeacherName };

        if (!scheduleCache[receiverStaff.code]) scheduleCache[receiverStaff.code] = getSchedule_(receiverStaff.code);
        var receiverSchedule = scheduleCache[receiverStaff.code];

        var dayName = subItem.day;
        if (!dayName) {
          var dt = parseYMD_(subItem.isoDate || subItem.date);
          if (dt) dayName = THAI_DAYS[dt.getUTCDay()];
        }

        var periodsToCheck = [];
        if (subItem.periods && Array.isArray(subItem.periods)) {
          periodsToCheck = subItem.periods.map(Number);
        } else if (subItem.periodDisplay) {
          var pParts = String(subItem.periodDisplay).split('-');
          var startP = parseInt(pParts[0]);
          var endP = pParts.length > 1 ? parseInt(pParts[1]) : startP;
          for (var p = startP; p <= endP; p++) periodsToCheck.push(p);
        }

        for (var pIdx = 0; pIdx < periodsToCheck.length; pIdx++) {
          var chkPeriod = periodsToCheck[pIdx];
          // เลขคาบฝั่งหน้าเว็บตรงกับเลขคาบในชีต Class อยู่แล้ว (ไม่ต้อง +1)
          var conflict = receiverSchedule.filter(function (sch) {
            return sch.day === dayName && sch.period === chkPeriod && (sch.type === 'class' || sch.type === 'activity');
          })[0];
          if (conflict) {
            return {
              success: false,
              error: "❌ คาบสอนชนกัน!\n\nไม่สามารถฝากคาบให้ " + subItem.recipientTeacherName + " ได้\nเนื่องจากมีสอนวิชา '" + conflict.courseCode + "'\nในวัน" + dayName + " คาบที่ " + chkPeriod + " อยู่แล้วครับ"
            };
          }
        }
      }
    }

    var leaveID = saveToSheet_(ss, formData, now);
    var pdfResults = generateDocuments_(formData, leaveID, getThaiDate_(now));

    // การแจ้งเตือน LINE ล้มเหลวได้ แต่ต้องไม่ทำให้การบันทึกถือว่าล้มเหลว
    try { if (ADMIN_USER_ID && TOKEN_ADMIN) sendFlexToAdmin_(formData, leaveID, pdfResults); }
    catch (e) { Logger.log("Admin LINE Error: " + e); }

    try {
      var teacherLineId = findTeacherLineId_(formData.name);
      if (teacherLineId) pushMessageToTeacher_(teacherLineId, "⏳ ส่งคำร้องเลขที่ " + leaveID + " เรียบร้อยแล้ว\nกรุณารอผลการอนุมัติครับ");
    } catch (e2) { Logger.log("Teacher LINE Error: " + e2); }

    return { success: true, files: pdfResults, leaveID: leaveID };
  } catch (error) {
    return { success: false, error: "System Error: " + error.message };
  } finally {
    try { lock.releaseLock(); } catch (e3) {}
  }
}

function saveToSheet_(ss, formData, now) {
  var category = formData.category;
  var subSheet = getSheetCI_(ss, SUB_RECORD_SHEET_NAME);
  var sheetName = category === 'general' ? SHEET_GENERAL : (category === 'official' ? SHEET_OFFICIAL : SHEET_OUTSIDE);
  var targetSheet = getSheetCI_(ss, sheetName) || ss.insertSheet(sheetName);
  if (!subSheet) subSheet = ss.insertSheet(SUB_RECORD_SHEET_NAME);

  var leaveID = generateRunNumber_(targetSheet);

  if (category === 'general') {
    targetSheet.appendRow([leaveID, now, formData.name, formData.position, formData.dept, formData.type, formData.reason, formData.dateOrTime, formData.totalDays, formData.address, formData.teachingStatus, STATUS_PENDING]);
  } else if (category === 'official') {
    targetSheet.appendRow([leaveID, now, formData.name, formData.position, formData.official_accompany, formData.official_purpose, formData.official_topic, formData.official_location, formData.dateOrTime, formData.totalDays, formData.official_vehicle, formData.official_budget, formData.teachingStatus, STATUS_PENDING]);
  } else if (category === 'outside') {
    targetSheet.appendRow([leaveID, now, formData.name, formData.position, formData.outside_reason, formData.outside_location, formData.dateOrTime, formData.outside_time_range, formData.totalDays, formData.teachingStatus, STATUS_PENDING]);
  }

  if (formData.substituteList && formData.substituteList.length > 0) {
    var headName = findHeadOfDepartment_(formData.dept);
    var subReason = (category === 'general') ? formData.type : ((category === 'official') ? "ไปราชการ: " + formData.official_topic : "ออกนอก: " + formData.outside_reason);
    var consolidatedList = consolidateSubstituteItems_(formData.substituteList);
    var subRows = consolidatedList.map(function (item) {
      return [leaveID, now, formData.name, item.courseCode, item.date, "'" + item.periodDisplay, subReason, item.recipientTeacherName, headName];
    });
    subSheet.getRange(subSheet.getLastRow() + 1, 1, subRows.length, subRows[0].length).setValues(subRows);
  }
  return leaveID;
}

function generateDocuments_(formData, leaveID, docDateThai) {
  var createdFiles = [];
  var templateId = "", targetFolderId = "", docPrefix = "";

  if (formData.category === 'general') { templateId = TEMPLATE_ID_GENERAL; targetFolderId = FOLDER_ID_GENERAL; docPrefix = "ใบลา"; }
  else if (formData.category === 'official') { templateId = TEMPLATE_ID_OFFICIAL; targetFolderId = FOLDER_ID_OFFICIAL; docPrefix = "ไปราชการ"; }
  else if (formData.category === 'outside') { templateId = TEMPLATE_ID_OUTSIDE; targetFolderId = FOLDER_ID_OUTSIDE; docPrefix = "ออกนอก"; }

  if (templateId) {
    var folder = DriveApp.getFolderById(targetFolderId);
    var mainUrl = createSinglePDF_(templateId, folder, formData, leaveID, docDateThai, docPrefix);
    createdFiles.push({ name: docPrefix, url: mainUrl });
  }

  if (formData.substituteList && formData.substituteList.length > 0) {
    var subFolder = DriveApp.getFolderById(FOLDER_ID_SUBSTITUTE);
    var subList = consolidateSubstituteItems_(formData.substituteList);
    var itemsPerPage = 5;
    var totalPages = Math.ceil(subList.length / itemsPerPage);

    for (var p = 0; p < totalPages; p++) {
      var chunk = subList.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
      var pageSuffix = totalPages > 1 ? "_ฉบับที่" + (p + 1) : "";
      var subUrl = createSubstitutePDF_(TEMPLATE_ID_SUBSTITUTE, subFolder, formData, chunk, leaveID, docDateThai, pageSuffix);
      createdFiles.push({ name: "ใบฝากคาบ" + pageSuffix, url: subUrl });
    }
  }
  return createdFiles;
}

function thaiDateParts_(ymd) {
  var d = parseYMD_(ymd);
  if (!d) return { d: '-', m: '-', y: '-', full: ymd || '-' };
  var day = d.getUTCDate(), mon = THAI_MONTHS[d.getUTCMonth()], yr = d.getUTCFullYear() + 543;
  return { d: day, m: mon, y: yr, full: day + " " + mon + " " + yr };
}

function createSinglePDF_(templateId, folder, data, leaveID, docDateThai, prefixName) {
  var templateFile = DriveApp.getFileById(templateId);
  var cleanFileName = data.name.replace(/\s+/g, '_');
  var docName = prefixName + "_" + cleanFileName + "_" + leaveID.replace('/', '-');

  var copyFile = templateFile.makeCopy(docName, folder);
  var doc = DocumentApp.openById(copyFile.getId());
  var body = doc.getBody();

  var cleanName = data.name.replace(/(ข้าราชการ|พนักงานราชการ|ครู|ครูผู้ช่วย|ลูกจ้างชั่วคราว)/g, "").trim();

  body.replaceText("{{ชื่อ_ผู้ฝาก}}", cleanName);
  body.replaceText("{{ตำแหน่ง_ผู้ฝาก}}", data.position || "-");
  body.replaceText("{{เลขที่}}", leaveID);
  body.replaceText("{{วันที่บันทึก}}", docDateThai);

  body.replaceText("{{ชื่อ}}", cleanName);
  body.replaceText("{{ตำแหน่ง}}", data.position || "-");
  body.replaceText("{{สังกัด}}", data.dept || "-");
  body.replaceText("{{ติดต่อ}}", data.address || "-");

  var dateParts = (data.dateOrTime || "").split(" - ");
  var sObj = thaiDateParts_(dateParts[0]);
  var eObj = thaiDateParts_(dateParts.length > 1 ? dateParts[1] : dateParts[0]);

  if (data.category === 'official') {
    body.replaceText("{{fol}}", data.official_accompany || "-");
    var p = data.official_purpose || "";
    body.replaceText("{{o1}}", p.indexOf("ประชุม") > -1 ? "/" : " ");
    body.replaceText("{{o2}}", p.indexOf("อบรม") > -1 ? "/" : " ");
    body.replaceText("{{o3}}", p.indexOf("สัมมนา") > -1 ? "/" : " ");
    body.replaceText("{{o4}}", p.indexOf("อื่นๆ") > -1 ? "/" : " ");
    body.replaceText("{{topic}}", data.official_topic || "-");
    body.replaceText("{{place}}", data.official_location || "-");
    body.replaceText("{{d1}}", String(sObj.d)); body.replaceText("{{m1}}", String(sObj.m)); body.replaceText("{{y1}}", String(sObj.y));
    body.replaceText("{{d2}}", String(eObj.d)); body.replaceText("{{m2}}", String(eObj.m)); body.replaceText("{{y2}}", String(eObj.y));
    body.replaceText("{{sum}}", data.totalDays || "-");
    var v = data.official_vehicle || "";
    body.replaceText("{{v1}}", v.indexOf("เครื่องบิน") > -1 ? "/" : " ");
    body.replaceText("{{v2}}", v.indexOf("รถโดยสาร") > -1 ? "/" : " ");
    body.replaceText("{{v3}}", v.indexOf("รถราชการ") > -1 ? "/" : " ");
    if (v.indexOf("รถส่วนตัว") > -1) {
      body.replaceText("{{v4}}", "/");
      var plateMatch = v.match(/\((.*?)\)/);
      body.replaceText("{{plate}}", plateMatch ? plateMatch[1] : "-");
    } else {
      body.replaceText("{{v4}}", " "); body.replaceText("{{plate}}", "");
    }
    var b = data.official_budget || "";
    body.replaceText("{{b1}}", b.indexOf("ไม่เบิก") > -1 ? "/" : " ");
    body.replaceText("{{b2}}", b.indexOf("เบิกตามสิทธิ์") > -1 ? "/" : " ");
    body.replaceText("{{b4}}", b.indexOf("เบิกโครงการ") > -1 ? "/" : " ");
    if (b.indexOf("เบิกบางส่วน") > -1) {
      body.replaceText("{{b3}}", "/");
      body.replaceText("{{c1}}", b.indexOf("ค่าพาหนะ") > -1 ? "/" : " ");
      body.replaceText("{{c2}}", b.indexOf("ค่าน้ำมัน") > -1 ? "/" : " ");
      body.replaceText("{{c3}}", b.indexOf("ค่าเบี้ยเลี้ยง") > -1 ? "/" : " ");
      body.replaceText("{{c4}}", b.indexOf("ค่าที่พัก") > -1 ? "/" : " ");
    } else {
      body.replaceText("{{b3}}", " ");
      body.replaceText("{{c1}}", " "); body.replaceText("{{c2}}", " ");
      body.replaceText("{{c3}}", " "); body.replaceText("{{c4}}", " ");
    }
  } else if (data.category === 'outside') {
    body.replaceText("{{reason}}", data.outside_reason || "-");
    body.replaceText("{{place}}", data.outside_location || "-");
    body.replaceText("{{d1}}", String(sObj.d));
    body.replaceText("{{m1}}", String(sObj.m));
    body.replaceText("{{y1}}", String(sObj.y));

    var times = (data.outside_time_range || " - ").split(" - ");
    body.replaceText("{{t1}}", times[0] || "......");
    body.replaceText("{{t2}}", times[1] || "......");

    var status = data.teachingStatus || "";
    body.replaceText("{{ch1}}", status.indexOf("ไม่มีสอน") > -1 ? "/" : " ");

    if (status.indexOf("มีสอน") > -1 && status.indexOf("ไม่มีสอน") === -1 || status.indexOf("ฝากสอน") > -1) {
      body.replaceText("{{ch2}}", "/");
      var subName = "";
      if (data.substituteList && data.substituteList.length > 0) {
        var names = [];
        data.substituteList.forEach(function (item) {
          var n = cleanTitle_(item.recipientTeacherName);
          if (n && names.indexOf(n) === -1) names.push(n);
        });
        subName = names.join(", ");
      }
      body.replaceText("{{swap}}", subName);
    } else {
      body.replaceText("{{ch2}}", " ");
      body.replaceText("{{swap}}", "");
    }
    body.replaceText("{{ch3}}", status.indexOf("มอบหมายงาน") > -1 ? "/" : " ");
  } else if (data.category === 'general') {
    body.replaceText("{{ตั้งแต่วันที่}}", sObj.full);
    body.replaceText("{{ถึงวันที่}}", eObj.full);
    body.replaceText("{{วันลา}}", sObj.full + (sObj.full !== eObj.full ? " ถึง " + eObj.full : ""));
    body.replaceText("{{รวมวัน}}", data.totalDays || "-");
    var t = data.type || "";
    var isStandard = (t === "ลาป่วย" || t === "ลากิจส่วนตัว" || t === "ลาคลอดบุตร");
    body.replaceText("{{เรื่อง}}", isStandard ? "ขอ" + t : t);
    body.replaceText("{{chk_sick}}", t === "ลาป่วย" ? "/" : " ");
    body.replaceText("{{chk_personal}}", t === "ลากิจส่วนตัว" ? "/" : " ");
    body.replaceText("{{chk_maternity}}", t === "ลาคลอดบุตร" ? "/" : " ");
    body.replaceText("{{chk_other}}", !isStandard ? "/" : " ");
    body.replaceText("{{ระบุ_อื่นๆ}}", !isStandard ? t : "..........................................");
    body.replaceText("{{สาเหตุ}}", data.reason || "-");
    body.replaceText("{{รวมวันลาครั้งก่อน}}", findPreviousLeaveDays_(data.name));
    body.replaceText("{{chk_last_sick}}", " "); body.replaceText("{{chk_last_personal}}", " ");
    body.replaceText("{{chk_last_maternity}}", " "); body.replaceText("{{chk_last_other}}", " ");
    body.replaceText("{{ระบุ_ลาล่าสุด}}", "..........................................");
    body.replaceText("{{ลาครั้งล่าสุด_ตั้งแต่วันที่}}", "-"); body.replaceText("{{ลาครั้งล่าสุด_ถึงวันที่}}", "-");
  }

  doc.saveAndClose();
  var pdfBlob = copyFile.getAs(MimeType.PDF);
  var pdfFile = folder.createFile(pdfBlob).setName(docName + ".pdf");
  return pdfFile.getUrl();
}

function createSubstitutePDF_(templateId, folder, data, subChunk, leaveID, docDateThai, suffix) {
  var templateFile = DriveApp.getFileById(templateId);
  var senderName = data.name.replace(/(ข้าราชการ|พนักงานราชการ|ครู|ครูผู้ช่วย|ลูกจ้างชั่วคราว)/g, "").trim();
  var docName = "ฝากคาบ_" + senderName + "_" + leaveID.replace('/', '-') + suffix;
  var copyFile = templateFile.makeCopy(docName, folder);
  var doc = DocumentApp.openById(copyFile.getId());
  var body = doc.getBody();

  body.replaceText("{{เลขที่}}", leaveID);
  body.replaceText("{{วันที่บันทึก}}", docDateThai);
  body.replaceText("{{ชื่อ_ผู้ฝาก}}", senderName);
  body.replaceText("{{ตำแหน่ง_ผู้ฝาก}}", data.position || "-");

  var subReason = "";
  if (data.category === 'general') subReason = data.reason || data.type;
  else if (data.category === 'official') subReason = data.official_topic || "-";
  else if (data.category === 'outside') subReason = data.outside_reason || "-";
  body.replaceText("{{เหตุผล}}", subReason);

  var headName = findHeadOfDepartment_(data.dept).replace(/(ข้าราชการ|พนักงานราชการ|ครู|ครูผู้ช่วย)/g, "").trim();
  body.replaceText("{{หัวหน้ากลุ่มสาระ}}", headName);

  for (var i = 0; i < 5; i++) {
    var num = i + 1;
    if (i < subChunk.length) {
      var item = subChunk[i];
      var d = parseYMD_(item.date);
      var shortDate = d ? d.getUTCDate() + " " + THAI_MONTHS_SHORT[d.getUTCMonth()] + " " + (d.getUTCFullYear() + 543) : item.date;
      var dayName = d ? THAI_DAYS[d.getUTCDay()] : "";
      var receiverName = item.recipientTeacherName.replace(/(ข้าราชการ|พนักงานราชการ|ครู|ครูผู้ช่วย|ลูกจ้างชั่วคราว)/g, "").trim();
      body.replaceText("{{ลำดับ_" + num + "}}", String(num));
      body.replaceText("{{วัน_" + num + "}}", dayName);
      body.replaceText("{{วันที่_" + num + "}}", shortDate);
      body.replaceText("{{คาบ_" + num + "}}", String(item.periodDisplay));
      body.replaceText("{{วิชา_" + num + "}}", item.courseCode);
      body.replaceText("{{ผู้รับ_" + num + "}}", receiverName);
    } else {
      ["ลำดับ", "วัน", "วันที่", "คาบ", "วิชา", "ผู้รับ"].forEach(function (k) { body.replaceText("{{" + k + "_" + num + "}}", ""); });
    }
  }
  doc.saveAndClose();
  var pdfBlob = copyFile.getAs(MimeType.PDF);
  var pdfFile = folder.createFile(pdfBlob).setName(docName + ".pdf");
  return pdfFile.getUrl();
}

// รวมคาบติดกัน (เลขคาบตรงกับชีต Class ไม่ต้องบวก/ลบ)
function consolidateSubstituteItems_(originalList) {
  if (!originalList || originalList.length === 0) return [];
  var list = originalList.map(function (it) { return JSON.parse(JSON.stringify(it)); });
  list.forEach(function (it) {
    if (!it.periods || !it.periods.length) {
      var pp = String(it.periodDisplay || '').split('-').map(Number);
      it.periods = [];
      for (var k = pp[0]; k <= (pp[1] || pp[0]); k++) it.periods.push(k);
    }
    it.periods = it.periods.map(Number);
  });
  list.sort(function (a, b) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.periods[0] - b.periods[0];
  });

  var merged = []; var current = null;
  list.forEach(function (item) {
    if (current && current.date === item.date && current.courseCode === item.courseCode && current.recipientTeacherName === item.recipientTeacherName &&
        current.periods[current.periods.length - 1] + 1 === item.periods[0]) {
      current.periods = current.periods.concat(item.periods);
    } else {
      current = item; merged.push(current);
    }
  });
  merged.forEach(function (m) {
    var s = m.periods[0], e = m.periods[m.periods.length - 1];
    m.periodDisplay = (s === e) ? String(s) : s + "-" + e;
  });
  return merged;
}

// ==========================================
// 🔔 4. LINE Messaging API
// ==========================================
function lineFetch_(url, token, payload) {
  if (!token) { Logger.log('LINE token ว่าง: ตั้งค่า TOKEN_ADMIN / TOKEN_TEACHER ใน Script properties'); return null; }
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) Logger.log('LINE API ' + res.getResponseCode() + ': ' + res.getContentText());
  return res;
}

function doPost(e) {
  try {
    var json = JSON.parse(e.postData.contents);
    if (json && json.kind === 'api') {
      return ContentService.createTextOutput(JSON.stringify(dispatchApiRequest_(json)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var events = json.events;
    if (!events || events.length === 0) return ContentService.createTextOutput('ok');
    var event = events[0];
    var replyToken = event.replyToken;

    if (event.type === 'message' && event.message && event.message.text === 'id') {
      replyUniversal_(replyToken, "User ID ของคุณคือ:\n" + event.source.userId);
    } else if (event.type === 'postback') {
      // รับคำสั่งอนุมัติจากผู้บริหารเท่านั้น
      if (!event.source || event.source.userId !== ADMIN_USER_ID) {
        return ContentService.createTextOutput('ok');
      }
      var params = {};
      event.postback.data.split('&').forEach(function (part) {
        var kv = part.split('=');
        params[kv[0]] = decodeURIComponent(kv[1] || '');
      });
      var leaveID = params.id, category = params.cat, action = params.action;

      var res = updateLeaveStatus_(leaveID, category, action);
      if (!res.found) {
        lineFetch_('https://api.line.me/v2/bot/message/reply', TOKEN_ADMIN, { replyToken: replyToken, messages: [{ type: 'text', text: '⚠️ ไม่พบคำร้อง ' + leaveID }] });
        return ContentService.createTextOutput('ok');
      }
      if (res.alreadyDone) {
        lineFetch_('https://api.line.me/v2/bot/message/reply', TOKEN_ADMIN, { replyToken: replyToken, messages: [{ type: 'text', text: 'ℹ️ คำร้อง ' + leaveID + ' ถูกดำเนินการไปแล้ว (' + res.prev + ')' }] });
        return ContentService.createTextOutput('ok');
      }

      var msgAdmin = (action === "approve") ? "✅ อนุมัติ " + leaveID + " เรียบร้อย" : "❌ บันทึกว่าไม่อนุมัติ " + leaveID;
      replyWithToken_(replyToken, msgAdmin, TOKEN_ADMIN);

      var requesterName = res.name;
      if (requesterName) {
        var teacherId = findTeacherLineId_(requesterName);
        if (teacherId) {
          var msgTeacher = (action === "approve")
            ? "✅ คำร้องเลขที่ " + leaveID + "\nได้รับการ 'อนุมัติ' แล้วครับ 🎉"
            : "❌ คำร้องเลขที่ " + leaveID + "\n'ไม่ได้รับการอนุมัติ' ครับ";
          pushMessageToTeacher_(teacherId, msgTeacher);
        }
      }
    }
  } catch (err) {
    Logger.log('doPost error: ' + err);
  }
  return ContentService.createTextOutput(JSON.stringify({ content: "ok" })).setMimeType(ContentService.MimeType.JSON);
}

function dispatchApiRequest_(request) {
  if (!API_SHARED_SECRET || request.apiSecret !== API_SHARED_SECRET) {
    return { success: false, error: 'API_UNAUTHORIZED' };
  }

  var apiMethods = {
    getUserByIdToken: getUserByIdToken,
    registerLine: registerLine,
    apiGetStaffList: apiGetStaffList,
    apiGetAllSchedulesMap: apiGetAllSchedulesMap,
    apiGetSchedule: apiGetSchedule,
    apiGetLeaveBalance: apiGetLeaveBalance,
    apiCheckScheduleForLeave: apiCheckScheduleForLeave,
    apiRecordLeave: apiRecordLeave,
    getDailyStats: getDailyStats
  };
  var method = apiMethods[request.method];
  if (!method || !Array.isArray(request.args)) {
    return { success: false, error: 'API_NOT_FOUND' };
  }

  try {
    return { success: true, data: method.apply(null, request.args) };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
}

function findTeacherLineId_(nameToFind) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getStaffSheet_(ss);
  if (!sheet || !nameToFind) return null;
  var data = sheet.getDataRange().getValues();
  var lineCol = findLineCol_(data[0]);
  var key = cleanKey_(nameToFind);
  if (!key) return null;

  for (var i = 1; i < data.length; i++) {
    if (cleanKey_(data[i][COL.NAME]) === key) {
      var id = String(data[i][lineCol] || '').trim();
      return id || null;
    }
  }
  return null;
}

function sendFlexToAdmin_(formData, leaveID, pdfResults) {
  var typeText = "";
  if (formData.category === 'general') typeText = "ลาทั่วไป (" + formData.type + ")";
  else if (formData.category === 'official') typeText = "ไปราชการ (" + formData.official_topic + ")";
  else if (formData.category === 'outside') typeText = "ออกนอกบริเวณ (" + formData.outside_reason + ")";

  // postback data จำกัด 300 ตัวอักษร จึงส่งเฉพาะ id/cat/action ส่วนชื่อผู้ขอไปค้นจากชีตเอง
  var btnDataApprove = "action=approve&id=" + encodeURIComponent(leaveID) + "&cat=" + formData.category;
  var btnDataReject = "action=reject&id=" + encodeURIComponent(leaveID) + "&cat=" + formData.category;

  var bodyContents = [
    { "type": "text", "text": "📝 คำร้องขออนุญาตใหม่", "weight": "bold", "size": "md", "color": "#1DB446" },
    { "type": "separator", "margin": "md" },
    { "type": "text", "text": "เลขที่: " + leaveID, "margin": "md", "size": "xs", "color": "#aaaaaa" },
    { "type": "text", "text": "ผู้ขอ: " + formData.name, "wrap": true },
    { "type": "text", "text": "ประเภท: " + typeText, "wrap": true },
    { "type": "text", "text": "วันที่: " + formData.dateOrTime, "size": "xs", "wrap": true }
  ];
  if (pdfResults && pdfResults[0] && pdfResults[0].url) {
    bodyContents.push({ "type": "button", "style": "link", "height": "sm", "action": { "type": "uri", "label": "📄 ดูเอกสาร PDF", "uri": pdfResults[0].url } });
  }

  var flexMessage = {
    "type": "flex",
    "altText": "มีรายการคำร้องใหม่ รออนุมัติ",
    "contents": {
      "type": "bubble",
      "body": { "type": "box", "layout": "vertical", "contents": bodyContents },
      "footer": {
        "type": "box", "layout": "horizontal", "spacing": "sm",
        "contents": [
          { "type": "button", "style": "primary", "color": "#1DB446", "action": { "type": "postback", "label": "อนุมัติ", "data": btnDataApprove } },
          { "type": "button", "style": "primary", "color": "#FF3333", "action": { "type": "postback", "label": "ไม่อนุมัติ", "data": btnDataReject } }
        ]
      }
    }
  };
  lineFetch_('https://api.line.me/v2/bot/message/push', TOKEN_ADMIN, { to: ADMIN_USER_ID, messages: [flexMessage] });
}

function pushMessageToTeacher_(userId, message) {
  lineFetch_('https://api.line.me/v2/bot/message/push', TOKEN_TEACHER, { to: userId, messages: [{ type: 'text', text: message }] });
}

function replyWithToken_(replyToken, message, token) {
  return lineFetch_('https://api.line.me/v2/bot/message/reply', token, { replyToken: replyToken, messages: [{ type: 'text', text: message }] });
}

// ตอบ "id" — ลอง token แรก ถ้าไม่สำเร็จค่อยลองอีกบอท
function replyUniversal_(replyToken, message) {
  var r = replyWithToken_(replyToken, message, TOKEN_ADMIN);
  if (!r || r.getResponseCode() >= 300) replyWithToken_(replyToken, message, TOKEN_TEACHER);
}

// อัปเดตสถานะ + คืนชื่อผู้ขอ
function updateLeaveStatus_(leaveID, category, action) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetName = "", statusCol = 0;
    if (category === 'general') { sheetName = SHEET_GENERAL; statusCol = 12; }
    else if (category === 'official') { sheetName = SHEET_OFFICIAL; statusCol = 14; }
    else if (category === 'outside') { sheetName = SHEET_OUTSIDE; statusCol = 11; }
    if (!sheetName) return { found: false };

    var sheet = getSheetCI_(ss, sheetName);
    if (!sheet) return { found: false };
    var data = sheet.getDataRange().getValues();
    var status = (action === "approve") ? "อนุมัติ" : "ไม่อนุมัติ";

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(leaveID)) {
        var prev = String(data[i][statusCol - 1] || '').trim();
        if (prev && prev !== STATUS_PENDING) return { found: true, alreadyDone: true, prev: prev, name: String(data[i][2]) };
        sheet.getRange(i + 1, statusCol).setValue(status);
        return { found: true, alreadyDone: false, name: String(data[i][2]) };
      }
    }
    return { found: false };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ==========================================
// 📈 5. Dashboard ผู้บริหาร
// ==========================================
function getDailyStats(idToken, dateStr) {
  requireAdmin_(idToken);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var result = [];
  var target = parseYMD_(dateStr);
  if (!target) return result;

  var isDateMatch = function (rangeStr) {
    if (!rangeStr) return false;
    var parts = String(rangeStr).split(' - ');
    var start = parseYMD_(parts[0]);
    var end = parseYMD_(parts.length > 1 ? parts[1] : parts[0]);
    if (!start || !end) return false;
    return target >= start && target <= end;
  };

  var sheetGen = getSheetCI_(ss, SHEET_GENERAL);
  if (sheetGen) {
    var d1 = sheetGen.getDataRange().getValues();
    for (var i = 1; i < d1.length; i++) {
      if (isDateMatch(d1[i][7])) result.push({ cat: 'general', name: d1[i][2], type: d1[i][5], reason: d1[i][6], dateDisplay: d1[i][7], status: d1[i][11] });
    }
  }
  var sheetOff = getSheetCI_(ss, SHEET_OFFICIAL);
  if (sheetOff) {
    var d2 = sheetOff.getDataRange().getValues();
    for (var j = 1; j < d2.length; j++) {
      if (isDateMatch(d2[j][8])) result.push({ cat: 'official', name: d2[j][2], type: 'ไปราชการ', reason: d2[j][6], dateDisplay: d2[j][8], status: d2[j][13] });
    }
  }
  var sheetOut = getSheetCI_(ss, SHEET_OUTSIDE);
  if (sheetOut) {
    var d3 = sheetOut.getDataRange().getValues();
    for (var k = 1; k < d3.length; k++) {
      if (isDateMatch(d3[k][6])) result.push({ cat: 'outside', name: d3[k][2], type: 'ออกนอกบริเวณ', reason: d3[k][4], dateDisplay: d3[k][6] + " (" + d3[k][7] + ")", status: d3[k][10] });
    }
  }
  return result;
}


// ==========================================
// 🔐 6. LINE ID Token: ยืนยันตัวตนฝั่งเซิร์ฟเวอร์ (ปลอมแปลงไม่ได้)
// ==========================================
// ฟังก์ชันที่ลงท้ายด้วย _ ไม่สามารถเรียกจากหน้าเว็บได้
// ฟังก์ชัน api* / registerLine / getUserByIdToken รับ ID Token แล้วตรวจกับ LINE ทุกครั้ง
function verifyIdToken_(idToken) {
  if (!idToken) return null;
  var cache = CacheService.getScriptCache();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  var cacheKey = 'tok_' + digest;
  var hit = cache.get(cacheKey);
  if (hit) return hit;

  var res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post',
    payload: { id_token: idToken, client_id: LINE_LOGIN_CHANNEL_ID },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) { Logger.log('verify id_token: ' + res.getContentText()); return null; }
  var j = JSON.parse(res.getContentText());
  if (!j.sub) return null;
  var ttl = Math.min(300, Math.max(1, (j.exp || 0) - Math.floor(Date.now() / 1000)));
  if (ttl > 1) cache.put(cacheKey, j.sub, ttl);
  return j.sub;
}

// ต้องล็อกอิน LINE และลงทะเบียนแล้วเท่านั้น
function requireUser_(idToken) {
  var uid = verifyIdToken_(idToken);
  if (!uid) throw new Error('AUTH_EXPIRED');
  var user = getUserByLineId_(uid);
  if (!user) throw new Error('NOT_REGISTERED');
  return user;
}

function requireAdmin_(idToken) {
  var uid = verifyIdToken_(idToken);
  if (!uid) throw new Error('AUTH_EXPIRED');
  if (uid !== ADMIN_USER_ID) throw new Error('NOT_ADMIN');
  return uid;
}

function getUserByIdToken(idToken) {
  var uid = verifyIdToken_(idToken);
  if (!uid) return { error: 'invalid_token' };
  return { lineUserId: uid, user: getUserByLineId_(uid) };
}

// ลงทะเบียนครั้งแรก: ชื่อ + เลขท้ายเบอร์โทร 4 หลัก (กันคนอื่นแย่งผูกชื่อ) จำกัด 5 ครั้ง/ชั่วโมง
function registerLine(idToken, typedName, phoneLast4) {
  var uid = verifyIdToken_(idToken);
  if (!uid) return { success: false, error: 'การยืนยัน LINE หมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  if (getUserByLineId_(uid)) return { success: false, error: 'บัญชี LINE นี้ลงทะเบียนแล้ว' };

  var cache = CacheService.getScriptCache();
  var tryKey = 'bind_' + uid;
  var tries = parseInt(cache.get(tryKey) || '0');
  if (tries >= 5) return { success: false, error: 'ลองผิดหลายครั้ง กรุณารอ 1 ชั่วโมง หรือติดต่อผู้ดูแลระบบ' };

  var digits = String(phoneLast4 || '').replace(/\D/g, '');
  if (digits.length !== 4) return { success: false, error: 'กรุณากรอกเลขท้ายเบอร์โทรศัพท์ 4 หลัก' };

  var fail = function () {
    cache.put(tryKey, String(tries + 1), 3600);
    return { success: false, error: 'ชื่อหรือเลขท้ายเบอร์โทรศัพท์ไม่ตรงกับในระบบ (ลองได้อีก ' + (4 - tries) + ' ครั้ง)' };
  };

  var key = cleanKey_(typedName);
  if (!key) return fail();
  var matches = getStaffList_().filter(function (s) { return cleanKey_(s.name) === key; });
  if (matches.length !== 1) return fail();
  var phoneDigits = String(matches[0].phone || '').replace(/\D/g, '');
  if (phoneDigits.length < 4 || phoneDigits.slice(-4) !== digits) return fail();

  var res = linkLineUserId_(matches[0].code || matches[0].name, uid);
  if (!res.success) return res;
  return { success: true, user: getUserByLineId_(uid) };
}

// ---- API สำหรับหน้าเว็บ (ทุกอันตรวจตัวตนจาก LINE Token) ----
function apiGetStaffList(idToken) {
  requireUser_(idToken);
  // ไม่ส่งเบอร์โทร/LINE ID ของคนอื่นไปหน้าเว็บ
  return getStaffList_().map(function (s) { return { name: s.name, code: s.code, position: s.position, dept: s.dept }; });
}

function apiGetAllSchedulesMap(idToken) {
  requireUser_(idToken);
  return getAllSchedulesMap_();
}

function apiGetSchedule(idToken, teacherCode) {
  requireUser_(idToken);
  return getSchedule_(teacherCode);
}

function apiGetLeaveBalance(idToken) {
  var user = requireUser_(idToken);
  return getLeaveBalance_(user.name);
}

// เช็คตารางสอน "ของผู้ล็อกอินเท่านั้น"
function apiCheckScheduleForLeave(idToken, startDateStr, endDateStr) {
  var user = requireUser_(idToken);
  return checkScheduleForLeave_(user.code, startDateStr, endDateStr);
}

// ชื่อผู้ขอ/ตำแหน่ง/สังกัด ถูกกำหนดจากบัญชี LINE เสมอ ไม่เชื่อค่าที่หน้าเว็บส่งมา
function apiRecordLeave(idToken, formData) {
  var user = requireUser_(idToken);
  formData = formData || {};
  formData.name = user.name;
  formData.position = user.position;
  formData.dept = user.dept;
  return recordLeave_(formData);
}
