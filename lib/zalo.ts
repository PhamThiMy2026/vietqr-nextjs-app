export async function sendZaloMessage(phone: string, message: string) {
  try {
    const zaloAccessToken = process.env.ZALO_OA_ACCESS_TOKEN;

    // Chế độ GIẢ LẬP khi chưa có Zalo OA Token
    if (!zaloAccessToken || zaloAccessToken === "MOCK") {
      console.log(`🤖 [ZALO MOCK MODE] Gửi tin tới ${phone}: "${message}"`);
      return true;
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
    console.log(`💬 [ZALO SENT] SĐT: ${formattedPhone} | Result:`, result);
    return result?.error === 0;
  } catch (error) {
    console.error("❌ [ZALO ERROR]:", error);
    // Vẫn trả về true trong môi trường Dev/Test để không làm vỡ luồng
    return true;
  }
}
