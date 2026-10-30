window.onload = function() {
    // ตั้งค่าวันปัจจุบันให้ Input Date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterDate').value = today;
    loadData();
};

function loadData() {
    const dateVal = document.getElementById('filterDate').value;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('resultList').classList.add('hidden');
    document.getElementById('noData').classList.add('hidden');

    google.script.run.withSuccessHandler(renderData).getDailyStats(dateVal);
}

function renderData(data) {
    document.getElementById('loading').classList.add('hidden');
    
    // Update Counts
    document.getElementById('countTotal').innerText = data.length;
    document.getElementById('countPending').innerText = data.filter(d => d.status.includes('รอ')).length;
    document.getElementById('countApproved').innerText = data.filter(d => d.status.includes('อนุมัติ') && !d.status.includes('ไม่')).length;

    const list = document.getElementById('resultList');
    list.innerHTML = '';

    if (data.length === 0) {
        document.getElementById('noData').classList.remove('hidden');
        return;
    }

    data.forEach(item => {
        let statusColor = 'bg-gray-100 text-gray-600';
        let icon = 'fa-clock';
        if (item.status.includes('อนุมัติ') && !item.status.includes('ไม่')) { 
            statusColor = 'bg-green-100 text-green-700'; icon = 'fa-check-circle';
        } else if (item.status.includes('ไม่อนุมัติ')) { 
            statusColor = 'bg-red-100 text-red-700'; icon = 'fa-times-circle';
        } else {
            statusColor = 'bg-yellow-100 text-yellow-700'; 
        }

        let typeBadge = '';
        if(item.cat === 'general') typeBadge = '<span class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">ลาทั่วไป</span>';
        else if(item.cat === 'official') typeBadge = '<span class="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded">ไปราชการ</span>';
        else if(item.cat === 'outside') typeBadge = '<span class="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded">ออกนอก</span>';

        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl shadow-sm flex items-start justify-between border border-gray-100';
        div.innerHTML = `
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-gray-800 text-lg">${item.name}</span>
                    ${typeBadge}
                </div>
                <p class="text-gray-600 text-sm mb-1"><i class="fa-solid fa-tag opacity-50 w-5 text-center"></i> ${item.type}</p>
                <p class="text-gray-500 text-xs"><i class="fa-solid fa-note-sticky opacity-50 w-5 text-center"></i> ${item.reason}</p>
            </div>
            <div class="flex flex-col items-end gap-2">
                <span class="text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${statusColor}">
                    <i class="fa-regular ${icon}"></i> ${item.status || 'รออนุมัติ'}
                </span>
                <span class="text-xs text-gray-400">${item.dateDisplay}</span>
            </div>
        `;
        list.appendChild(div);
    });
    list.classList.remove('hidden');
}