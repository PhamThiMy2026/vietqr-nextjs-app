export async function sendZaloMessage(phone: string, message: string) {
  try {
    const zaloAccessToken = process.env.ZALO_OA_ACCESS_TOKEN;
    if (!zaloAccessToken) {
      console.log("⚠️ Chưa cấu hình ZALO_OA_ACCESS_TOKEN. Bỏ qua gửi Zalo.");
      return false;
    }

    let formattedPhone = phone.trim().replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "84" + formattedPhone.slice(1);
    }

    const response = await fetch("https://openapi.zalo.me/v2.0/oa/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: zaloAccessToken,
      },
      body: JSON.stringify({
        recipient: { phone: formattedPhone },
        message: { text: message },
      }),
    });

    const result = await response.json();
    console.log(`💬 [ZALO SENT] SĐT: ${formattedPhone} | Kết quả:`, result);
    return result?.error === 0;
  } catch (error) {
    console.error("❌ Lỗi khi gửi tin nhắn Zalo:", error);
    return false;
  }
}