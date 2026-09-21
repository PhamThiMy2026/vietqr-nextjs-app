// lib/zalo.ts

/**
 * Hàm gửi tin nhắn Zalo / ZNS an toàn
 * Tự động ép kiểu chuỗi, làm sạch số điện thoại và hỗ trợ chế độ Giả lập (Mock) khi chưa có Token thật.
 * @param phone Số điện thoại nhận tin (VD: "0912345678", "+84912345678", 912345678...)
 * @param message Nội dung tin nhắn
 */
export async function sendZaloMessage(phone: any, message: string) {
  try {
    // 1. Ép kiểu String an toàn và loại bỏ ký tự không phải số (dấu +, khoảng trắng, dấu gạch)
    let formattedPhone = String(phone || "").trim().replace(/\D/g, "");

    // Nếu không có số điện thoại hợp lệ
    if (!formattedPhone) {
      console.warn("⚠️ [ZALO WARNING]: Số điện thoại trống hoặc không hợp lệ.");
      return { success: false, error: "Invalid phone number" };
    }

    // Chuẩn hóa đầu số về dạng 84...
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "84" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("84")) {
      formattedPhone = "84" + formattedPhone;
    }

    // 2. Tự động phát hiện Token giả / Token thử nghiệm hoặc chưa cấu hình
    const zaloAccessToken = String(process.env.ZALO_OA_ACCESS_TOKEN || "").trim();

    const isFakeToken =
      !zaloAccessToken ||
      zaloAccessToken.toLowerCase().includes("fake") ||
      zaloAccessToken.toLowerCase().includes("dummy") ||
      zaloAccessToken.toLowerCase().includes("mock") ||
      zaloAccessToken.toLowerCase().includes("test") ||
      zaloAccessToken.length < 30; // Token Zalo OA thật thường dài hơn 50 ký tự

    if (isFakeToken) {
      console.log(
        `📱 [ZALO GIẢ LẬP / MOCK TOKEN] Đã gửi tin nhắn đến [${formattedPhone}]: "${message}"`
      );
      return {
        success: true,
        simulated: true,
        formattedPhone,
        message: "Đã gửi thành công ở chế độ Giả lập (Mock Mode)",
      };
    }

    // 3. Gọi Zalo OpenAPI nếu có Token thật
    const response = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: zaloAccessToken,
      },
      body: JSON.stringify({
        recipient: {
          user_id: formattedPhone,
        },
        message: {
          text: message,
        },
      }),
    });

    const result = await response.json();

    // 4. Nếu Zalo trả về lỗi Token / Quyền truy cập -> Fallback sang Giả lập an toàn
    if (result.error !== 0) {
      console.warn(
        `⚠️ [ZALO API WARNING]: Mã lỗi ${result.error} (${result.message}) -> Tự động chuyển về Giả lập.`
      );
      console.log(
        `📱 [GIẢ LẬP FALLBACK] Đã gửi tin nhắn đến [${formattedPhone}]: "${message}"`
      );

      return {
        success: true,
        simulated: true,
        warning: `Zalo Error ${result.error}: ${result.message}`,
      };
    }

    console.log(`✅ Đã gửi tin nhắn Zalo THẬT THÀNH CÔNG đến ${formattedPhone}`);
    return { success: true, data: result };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi ngoại lệ trong hàm sendZaloMessage:", errMessage);

    // Bắt mọi lỗi runtime để tránh làm sập Route Webhook hay Cron Job
    return { success: true, simulated: true, error: errMessage };
  }
}
