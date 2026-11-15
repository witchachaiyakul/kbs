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
      name: "งานบริหารทั่วไป",
      desc: "แจ้งซ่อม จองห้อง ขอรถ หรือกลุ่มบริหารทั่วไป",
      url: "https://kbs-gm.web.app/general/", // Domain เดียวกัน
      isExternalUrl: false
    },
    {
      id: "hr",
      name: "งานบุคคล",
      desc: "ยื่นใบลา ตรวจสอบวันลาหรือกล่มบริหารบุคคล",
      url: "https://kbs-gm.web.app/hr/",   // Domain เดียวกัน
      isExternalUrl: false
    },
    {
      id: "pay",
      name: "งานงบประมาณ",
      desc: "พิมพ์เบิกจ่าย พัสดุ หรือกลุ่มบริหารงบประมาณ",
      url: "https://kbs-gm.web.app/pay/", // 👈 เปลี่ยนเป็นโฟลเดอร์ย่อยใน Host เดียวกัน
      isExternalUrl: false                // 👈 เปลี่ยนเป็น false
    },
    {
      id: "academic",
      name: "งานวิชาการ",
      desc: "ส่งแผน หรือกลุ่มวิชาการ",
      url: "https://kbs-gm.web.app/academic/",
      isExternalUrl: false
    }
  ]
};