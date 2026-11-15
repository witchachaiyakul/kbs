export const KBS_CONFIG = {
  // 1. ตั้งค่า LINE Login (ใส่ทั้ง ID และ Secret เพื่อเรียกผ่าน JS โดยตรง)
  LINE_CHANNEL_ID: "2012615849",
  LINE_CHANNEL_SECRET: "468de18a5c93b9838c3a1b88c327d59a",
  MAIN_PORTAL_URL: "https://kbs-gm.web.app/",
  REDIRECT_URI: window.location.origin + window.location.pathname,

// รายชื่อทั้ง 4 ระบบ (ปรับ URL และ isExternalUrl ตามจริง)
  SYSTEMS: [
    {
      id: "general",
      name: "ระบบงานทั่วไป",
      desc: "จัดการงานธุรการและเอกสาร",
      url: "https://kbs-gm.web.app/general/", // Domain เดียวกัน
      isExternalUrl: false
    },
    {
      id: "leave",
      name: "ระบบลางาน",
      desc: "ยื่นใบลาและตรวจสอบวันลา",
      url: "https://kbs-gm.web.app/leave/",   // Domain เดียวกัน
      isExternalUrl: false
    },
    {
      id: "pay",
      name: "ระบบการเงิน (KBS Pay)",
      desc: "ตรวจสอบรายการเบิกจ่ายและค่าตอบแทน",
      url: "https://studio-1060072528-ff5ab.web.app/", // คนละ Domain (ส่ง Token ข้ามไปให้)
      isExternalUrl: true
    },
    {
      id: "system4",
      name: "ระบบที่ 4",
      desc: "ระบบงานเฉพาะส่วน",
      url: "https://kbs-system4.web.app/",
      isExternalUrl: true
    }
  ]
};