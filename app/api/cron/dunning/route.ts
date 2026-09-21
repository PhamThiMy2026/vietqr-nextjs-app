import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

export async function POST(request: Request) {
  try {
    // 1. Kiểm tra Secret Key từ Header (Hỗ trợ x-webhook-secret, x-sepay-api-key, Authorization)
    const customHeader =
      request.headers.get("x-webhook-secret") ||
      request.headers.get("x-sepay-api-key") ||
      request.headers.get("x-api-key") ||
      "";

    const authorizationHeader = request.headers.get("authorization") || "";

    // Tách token từ Authorization Header (nếu gửi dạng "Apikey KEY" hoặc "Bearer KEY")
    const bearerOrApikeyToken = authorizationHeader
      .replace(/^(Apikey|Bearer)\s+/i, "")
      .trim();

    // Lấy Secret Key cấu hình trong biến môi trường
    const envSecret = (
      process.env.WEBHOOK_SECRET ||
      process.env.SEPAY_API_KEY ||
      ""
    ).trim();

    const receivedTokens = [
      customHeader.trim(),
      authorizationHeader.trim(),
      bearerOrApikeyToken,
    ].filter(Boolean);

    // Xác thực request
    const isAuthorized =
      envSecret !== "" &&
      receivedTokens.some((token) => token === envSecret);

    if (!isAuthorized) {
      console.warn("⚠️ [WEBHOOK 401 REJECTED]: Secret Key không hợp lệ hoặc chưa cấu hình!");
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          message: "Secret Key không hợp lệ.",
        },
        { status: 401 }
      );
    }

    // 2. Nhận và parse dữ liệu JSON từ Webhook
    const body = await request.json();
    console.log("--> [WEBHOOK BODY RECEIVED]:", body);

    const amount = Number(body.amount || body.transferAmount || 0);
    const content = String(body.content || body.description || "");
    const phone = String(body.phone || body.customerPhone || "");

    // 3. Trích xuất mã đơn hàng chuẩn xác từ nội dung chuyển khoản
    let extractedOrderId = "";
    const match = content.match(/(DH|HD)[\s\-]*([a-zA-Z0-9]+)/i);

    if (match && match[0]) {
      // match[0] lấy chính xác chuỗi khớp (VD: "DH1001" hoặc "HD-1002")
      extractedOrderId = match[0].replace(/[\s\-]/g, "").toUpperCase();
    } else if (body.referenceCode) {
      extractedOrderId = String(body.referenceCode).trim();
    } else if (body.order_id) {
      extractedOrderId = String(body.order_id).trim();
    } else {
      extractedOrderId = content.trim() || `ORD_${Date.now()}`;
    }

    console.log(
      `🔎 Mã đơn hàng trích xuất: "${extractedOrderId}" | Số tiền: ${amount}`
    );

    // 4. Kết nối Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ Thiếu cấu hình Supabase URL/KEY trong biến môi trường.");
      return NextResponse.json({
        success: true,
        savedToDatabase: false,
        message: "Chưa cấu hình Supabase URL hoặc Key trên Vercel",
        order_id: extractedOrderId,
        amount: amount,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. Lưu thông tin giao dịch vào bảng 'transactions'
    const { error: dbError } = await supabase.from("transactions").insert([
      {
        amount: amount,
        content: content,
        order_id: extractedOrderId,
        phone: phone,
        status: "success",
      },
    ]);

    if (dbError) {
      console.error("❌ Lỗi Supabase Insert:", dbError.message);
      return NextResponse.json({
        success: true,
        savedToDatabase: false,
        dbError: dbError.message,
        order_id: extractedOrderId,
        amount: amount,
      });
    }

    console.log("✅ Lưu vào Supabase thành công!");

    // 6. Tự động gửi tin nhắn Zalo xác nhận nếu có số điện thoại
    if (phone) {
      const zaloMessage = `Cảm ơn bạn! Đơn hàng #${extractedOrderId} (${amount.toLocaleString(
        "vi-VN"
      )} VNĐ) đã được thanh toán thành công.`;

      // Thực thi gửi Zalo bất đồng bộ để tránh bị block HTTP Response
      try {
        await sendZaloMessage(phone, zaloMessage);
      } catch (zaloErr) {
        console.error("❌ Lỗi khi gọi hàm sendZaloMessage:", zaloErr);
      }
    }

    return NextResponse.json({
      success: true,
      savedToDatabase: true,
      dbError: null,
      order_id: extractedOrderId,
      amount: amount,
      message: "Lưu giao dịch thành công và đã kích hoạt gửi Zalo!",
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