import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Đọc tất cả các dạng Header xác thực có thể có từ SePay
    const customHeader =
      request.headers.get("x-webhook-secret") ||
      request.headers.get("x-sepay-api-key") ||
      request.headers.get("x-api-key") ||
      "";

    const authorizationHeader = request.headers.get("authorization") || "";

    // Cắt bớt tiền tố nếu SePay gửi dạng "Apikey MY_KEY" hoặc "Bearer MY_KEY"
    const bearerOrApikeyToken = authorizationHeader
      .replace(/^(Apikey|Bearer)\s+/i, "")
      .trim();

    // Lấy Secret Key cấu hình trên Vercel (loại bỏ khoảng trắng hai đầu)
    const envSecret = (
      process.env.WEBHOOK_SECRET ||
      process.env.SEPAY_API_KEY ||
      ""
    ).trim();

    // Tập hợp tất cả các Token nhận được từ phía SePay
    const receivedTokens = [
      customHeader.trim(),
      authorizationHeader.trim(),
      bearerOrApikeyToken,
    ].filter(Boolean);

    // Kiểm tra xem có bất kỳ Token nào gửi lên khớp với WEBHOOK_SECRET không
    const isAuthorized =
      envSecret !== "" &&
      receivedTokens.some((token) => token === envSecret);

    if (!isAuthorized) {
      console.warn("⚠️ [WEBHOOK 401 REJECTED]: Secret Key không khớp!");
      console.warn(
        `👉 WEBHOOK_SECRET trên Vercel: "${envSecret || "CHƯA CẤU HÌNH"}"`
      );
      console.warn(`👉 Header 'x-webhook-secret' nhận được: "${request.headers.get("x-webhook-secret")}"`);
      console.warn(`👉 Header 'authorization' nhận được: "${authorizationHeader}"`);

      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          message:
            "Secret Key không khớp. Vui lòng kiểm tra Vercel Logs để xem chi tiết.",
        },
        { status: 401 }
      );
    }

    // 2. Đọc dữ liệu JSON gửi từ SePay
    const body = await request.json();
    console.log("--> [WEBHOOK BODY RECEIVED]:", body);

    const amount = Number(body.amount || body.transferAmount || 0);
    const content = String(body.content || body.description || "");
    const phone = String(body.phone || body.customerPhone || "");

    // 3. Trích xuất mã đơn hàng chuẩn xác (Lấy match[0] để loại bỏ lỗi dính dấu phẩy)
    let extractedOrderId = "";
    const match = content.match(/(DH|HD)[\s\-]*([a-zA-Z0-9]+)/i);

    if (match && match[0]) {
      extractedOrderId = match[0].replace(/[\s\-]/g, "").toUpperCase();
    } else if (body.referenceCode) {
      extractedOrderId = String(body.referenceCode);
    } else if (body.order_id) {
      extractedOrderId = String(body.order_id);
    } else {
      extractedOrderId = content.trim() || `ORD_${Date.now()}`;
    }

    console.log(
      `🔎 Mã đơn hàng trích xuất: "${extractedOrderId}" | Số tiền: ${amount}`
    );

    // 4. Khai báo kết nối Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ Thiếu cấu hình Supabase URL/KEY trong .env");
      return NextResponse.json({
        success: true,
        savedToDatabase: false,
        message: "Chưa cấu hình Supabase URL hoặc Key trên Vercel",
        order_id: extractedOrderId,
        amount: amount,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. Lưu giao dịch vào Supabase (Bảng transactions)
    const { error } = await supabase.from("transactions").insert([
      {
        amount: amount,          // numeric
        content: content,        // text
        order_id: extractedOrderId, // text
        phone: phone,            // text
        status: "success",       // text
      },
    ]);

    if (error) {
      console.error("❌ Lỗi Supabase Insert:", error.message);
      return NextResponse.json({
        success: true,
        savedToDatabase: false,
        dbError: error.message,
        order_id: extractedOrderId,
        amount: amount,
      });
    }

    console.log("✅ Lưu vào Supabase thành công!");
    return NextResponse.json({
      success: true,
      savedToDatabase: true,
      dbError: null,
      order_id: extractedOrderId,
      amount: amount,
      message: "Lưu giao dịch thành công!",
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi Server Webhook:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}