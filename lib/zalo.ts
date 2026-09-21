// lib/zalo.ts

/**
 * Hàm gửi tin nhắn Zalo thông báo / ZNS
 * @param phone Số điện thoại nhận tin (VD: "0912345678" hoặc "84912345678")
 * @param message Nội dung tin nhắn
 */
export async function sendZaloMessage(phone: string, message: string) {
  try {
    // Chuẩn hóa số điện thoại về dạng 84...
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "84" + formattedPhone.slice(1);
    }

    const zaloAccessToken = process.env.ZALO_OA_ACCESS_TOKEN;

    if (!zaloAccessToken) {
      console.warn("⚠️ Chưa cấu hình ZALO_OA_ACCESS_TOKEN trong biến môi trường. Giả lập gửi tin nhắn:");
      console.log(`📱 Gửi đến [${formattedPhone}]: "${message}"`);
      return { success: true, simulated: true };
    }

    // Gọi Zalo OpenAPI gửi tin nhắn thoại / tư vấn / ZNS
    const response = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: zaloAccessToken,
      },
      body: JSON.stringify({
        recipient: {
          user_id: formattedPhone, // Hoặc phone_number tùy loại tài khoản OA
        },
        message: {
          text: message,
        },
      }),
    });

    const result = await response.json();
    if (result.error !== 0) {
      console.error("❌ Lỗi Zalo API:", result.message);
      return { success: false, error: result.message };
    }

    console.log(`✅ Đã gửi tin nhắn Zalo thành công đến ${formattedPhone}`);
    return { success: true, data: result };
  } catch (error) {
    console.error("❌ Lỗi khi kết nối Zalo API:", error);
    return { success: false, error };
  }
}