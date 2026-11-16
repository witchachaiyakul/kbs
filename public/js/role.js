import { getAllCommittees, updateCommitteeDropdown, insertAuditLog } from "./firestore.js";

const STORAGE_KEY = "kbs_user_session";
let allCommittees = [];
let currentAdmin = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. ตรวจสอบสิทธิ์ Admin จาก Session กลางของ kbs-main
  const rawSession = localStorage.getItem(STORAGE_KEY);
  if (!rawSession) {
    alert("กรุณาเข้าสู่ระบบก่อนใช้งาน");
    window.location.href = "index.html";
    return;
  }

  const session = JSON.parse(rawSession);
  if ((session.expiresAt && Date.now() > session.expiresAt) || session.user?.role !== "admin") {
    alert("คุณไม่มีสิทธิ์เข้าถึงหน้าจัดการระบบ (เฉพาะ Admin เท่านั้น)");
    window.location.href = "index.html";
    return;
  }

  currentAdmin = session.user;

  // 2. โหลดข้อมูลบุคลากรทั้งหมด
  await loadCommitteesData();

  // 3. ตั้งค่าช่องค้นหา
  document.getElementById("search-input").addEventListener("input", (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    const filtered = allCommittees.filter(
      (item) =>
        (item.name || "").toLowerCase().includes(keyword) ||
        (item.pos || "").toLowerCase().includes(keyword)
    );
    renderTable(filtered);
  });
});

async function loadCommitteesData() {
  try {
    allCommittees = await getAllCommittees();
    renderTable(allCommittees);
  } catch (err) {
    console.error("โหลดข้อมูลล้มเหลว:", err);
    document.getElementById("committees-tbody").innerHTML = `
      <tr><td colspan="6" class="center" style="color: #dc2626; padding: 24px;">
        เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}
      </td></tr>
    `;
  }
}

function renderTable(list) {
  const tbody = document.getElementById("committees-tbody");
  document.getElementById("total-count").textContent = `แสดง ${list.length} จาก ${allCommittees.length} รายการ`;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="center" style="padding: 24px; color: #6b7280;">ไม่พบข้อมูลบุคลากร</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  list.forEach((person, index) => {
    const isLinked = person.status === "done" && person.line_user_id;
    const isGeneralChecked = Boolean(person.general_dropdown);
    const isPayChecked = Boolean(person.pay_dropdown);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>
        <strong>${person.name || "-"}</strong>
        ${person.role === "admin" ? '<span class="badge badge-admin" style="margin-left:6px;">Admin</span>' : ""}
      </td>
      <td>${person.pos || "-"}</td>
      <td class="center">
        <span class="badge ${isLinked ? "badge-done" : "badge-wait"}">
          ${isLinked ? "ผูก LINE แล้ว" : "ยังไม่ผูกบัญชี"}
        </span>
      </td>
      <td class="center">
        <label class="switch">
          <input type="checkbox" class="toggle-dropdown" data-id="${person.docId}" data-name="${person.name}" data-field="general_dropdown" ${isGeneralChecked ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </td>
      <td class="center">
        <label class="switch">
          <input type="checkbox" class="toggle-dropdown" data-id="${person.docId}" data-name="${person.name}" data-field="pay_dropdown" ${isPayChecked ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // ผูก Event เมื่อมีการกดเปิด/ปิดสวิตช์
  document.querySelectorAll(".toggle-dropdown").forEach((checkbox) => {
    checkbox.addEventListener("change", handleToggleChange);
  });
}

async function handleToggleChange(e) {
  const checkbox = e.target;
  const docId = checkbox.dataset.id;
  const personName = checkbox.dataset.name;
  const field = checkbox.dataset.field;
  const newValue = checkbox.checked;

  checkbox.disabled = true;

  try {
    await updateCommitteeDropdown(docId, field, newValue);

    // อัปเดตค่าในตัวแปร local เพื่อไม่ให้เพี้ยนตอนพิมพ์ค้นหา
    const targetItem = allCommittees.find((item) => item.docId === docId);
    if (targetItem) targetItem[field] = newValue;

    // บันทึก Audit Log
    const labelName = field === "general_dropdown" ? "General Dropdown" : "Pay Dropdown";
    await insertAuditLog(
      "UPDATE_ROLE",
      `${newValue ? "เปิด" : "ปิด"}สิทธิ์ ${labelName} ของ ${personName}`,
      {
        id: currentAdmin.line_user_id,
        name: currentAdmin.name,
        picture: currentAdmin.picture || ""
      }
    );

    showToast(`✅ บันทึก ${labelName} ของ ${personName} เรียบร้อย`);
  } catch (err) {
    console.error("อัปเดตไม่สำเร็จ:", err);
    checkbox.checked = !newValue; // คืนค่าสวิตช์กลับถ้าบันทึกพลาด
    alert("บันทึกข้อมูลไม่สำเร็จ: " + err.message);
  } finally {
    checkbox.disabled = false;
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}