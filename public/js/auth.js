import { KBS_CONFIG } from "./config.js";
import { 
  getCommitteeByLineId, 
  getUnregisteredCommittees, 
  registerCommitteeLineId, 
  insertAuditLog 
} from "./firestore.js";

const STORAGE_KEY = "kbs_user_session";
let pendingLineProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  // 1. กรณีเพิ่งกลับมาจาก LINE Login
  if (code) {
    window.history.replaceState({}, document.title, window.location.pathname);
    await processLineCallback(code);
    return;
  }

  // 2. ตรวจสอบ Session เดิมในเครื่อง
  const rawSession = localStorage.getItem(STORAGE_KEY);
  if (rawSession) {
    const session = JSON.parse(rawSession);
    if (!session.expiresAt || Date.now() < session.expiresAt) {
      handleRedirectOrRender(session);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  }

  // 3. แสดงหน้า Login
  showView("login-view");
  document.getElementById("btn-line-login").addEventListener("click", startLineLogin);
});

function startLineLogin() {
  const returnUrl = new URLSearchParams(window.location.search).get("redirect");
  if (returnUrl) sessionStorage.setItem("kbs_return_url", returnUrl);

  const state = Math.random().toString(36).substring(2);
  const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${KBS_CONFIG.LINE_CHANNEL_ID}&redirect_uri=${encodeURIComponent(KBS_CONFIG.REDIRECT_URI)}&state=${state}&scope=profile%20openid`;
  window.location.href = lineAuthUrl;
}

async function processLineCallback(code) {
  showView("loading-view");
  try {
    // 1. แลก Access Token กับ LINE
    const tokenParams = new URLSearchParams();
    tokenParams.append("grant_type", "authorization_code");
    tokenParams.append("code", code);
    tokenParams.append("redirect_uri", KBS_CONFIG.REDIRECT_URI);
    tokenParams.append("client_id", KBS_CONFIG.LINE_CHANNEL_ID);
    tokenParams.append("client_secret", KBS_CONFIG.LINE_CHANNEL_SECRET);

    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "ไม่สามารถแลก Token กับ LINE ได้");
    }

    // 2. ดึงโปรไฟล์ผู้ใช้จาก LINE
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const lineProfile = await profileRes.json();

    // 3. ค้นหาใน Firestore (ต้องมี line_user_id ตรงกัน และ status == "done")
    const committeeData = await getCommitteeByLineId(lineProfile.userId);

    if (committeeData) {
      // บันทึก Audit Log การเข้าสู่ระบบ
      await insertAuditLog("LOGIN", "เข้าสู่ระบบผ่าน KBS Portal", {
        id: lineProfile.userId,
        name: committeeData.name,
        picture: lineProfile.pictureUrl || ""
      });
      createSessionAndProceed(committeeData, lineProfile.pictureUrl || "");
    } else {
      // ยังไม่เคยลงทะเบียน -> เปิดหน้า Dropdown เลือกรายชื่อ
      pendingLineProfile = lineProfile;
      await openRegistrationView(lineProfile);
    }
  } catch (err) {
    alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
    showView("login-view");
  }
}

async function openRegistrationView(lineProfile) {
  document.getElementById("reg-avatar").src = lineProfile.pictureUrl || "https://via.placeholder.com/72";
  document.getElementById("reg-line-name").textContent = lineProfile.displayName;

  const selectEl = document.getElementById("committee-select");
  selectEl.innerHTML = '<option value="">-- กรุณาเลือกชื่อของท่าน --</option>';

  const unregisteredList = await getUnregisteredCommittees();
  unregisteredList.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.docId;
    option.textContent = item.pos ? `${item.name} (${item.pos})` : item.name;
    selectEl.appendChild(option);
  });

  document.getElementById("btn-confirm-register").onclick = confirmRegistration;
  showView("register-view");
}

async function confirmRegistration() {
  const docId = document.getElementById("committee-select").value;
  if (!docId) {
    alert("กรุณาเลือกรายชื่อของท่านก่อนกดยืนยัน");
    return;
  }

  const btn = document.getElementById("btn-confirm-register");
  btn.disabled = true;
  btn.textContent = "กำลังบันทึกข้อมูล...";

  try {
    // เรียกใช้ registerCommitteeLineId จาก firestore.js (อัปเดต line_user_id + status: "done")
    const updatedCommittee = await registerCommitteeLineId(docId, pendingLineProfile.userId);

    // บันทึก Audit Log การลงทะเบียนครั้งแรก
    await insertAuditLog("REGISTER", `ลงทะเบียนผูกบัญชี LINE ครั้งแรก (${updatedCommittee.name})`, {
      id: pendingLineProfile.userId,
      name: updatedCommittee.name,
      picture: pendingLineProfile.pictureUrl || ""
    });

    createSessionAndProceed(updatedCommittee, pendingLineProfile.pictureUrl || "");
  } catch (err) {
    alert("บันทึกข้อมูลไม่สำเร็จ: " + err.message);
    btn.disabled = false;
    btn.textContent = "ยืนยันการลงทะเบียน";
  }
}

function createSessionAndProceed(committeeData, pictureUrl) {
  const session = {
    user: {
      docId: committeeData.docId,
      line_user_id: committeeData.line_user_id,
      name: committeeData.name,
      pos: committeeData.pos || "",
      role: committeeData.role || "staff",
      picture: pictureUrl,
      allowedSystems: committeeData.allowedSystems || ["general", "leave", "pay", "system4"]
    },
    expiresAt: Date.now() + 8 * 60 * 60 * 1000 // อายุ Session 8 ชั่วโมง
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  handleRedirectOrRender(session);
}

function handleRedirectOrRender(session) {
  const returnUrl = sessionStorage.getItem("kbs_return_url");
  if (returnUrl) {
    sessionStorage.removeItem("kbs_return_url");
    const token = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
    const separator = returnUrl.includes("?") ? "&" : "?";
    window.location.href = `${returnUrl}${separator}token=${token}`;
    return;
  }
  renderPortal(session);
}

function renderPortal(session) {
  const user = session.user;
  document.getElementById("user-name").textContent = user.name;
  document.getElementById("user-pos").textContent = user.pos ? `${user.pos} (${user.role})` : user.role.toUpperCase();
  document.getElementById("user-avatar").src = user.picture || "https://via.placeholder.com/48";

  if (user.role === "admin") {
    document.getElementById("btn-admin").classList.remove("hidden");
  }

  const grid = document.getElementById("systems-grid");
  grid.innerHTML = "";

  KBS_CONFIG.SYSTEMS.forEach((sys) => {
    const hasAccess = user.allowedSystems.includes(sys.id) || user.role === "admin";
    const card = document.createElement("div");
    card.className = `system-card ${hasAccess ? "" : "disabled"}`;
    card.innerHTML = `
      <h3>${sys.name}</h3>
      <p>${sys.desc}</p>
      <span class="status">${hasAccess ? "เข้าใช้งาน →" : "ไม่มีสิทธิ์เข้าถึง"}</span>
    `;
    if (hasAccess) {
      card.addEventListener("click", () => {
        if (sys.isExternalUrl) {
          const token = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
          const separator = sys.url.includes("?") ? "&" : "?";
          window.location.href = `${sys.url}${separator}token=${token}`;
        } else {
          window.location.href = sys.url;
        }
      });
    }
    grid.appendChild(card);
  });

  document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  showView("portal-view");
}

function showView(viewId) {
  ["loading-view", "login-view", "register-view", "portal-view"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== viewId);
  });
}