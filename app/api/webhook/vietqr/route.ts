import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Xác thực bằng API Key / Header Authentication
    const authHeader = request.headers.get("x-webhook-secret");
    const webhookSecret = process.env.WEBHOOK_SECRET;

    // Kiểm tra xem Header gửi lên có khớp với biến WEBHOOK_SECRET trên Vercel không
    if (!webhookSecret || authHeader !== webhookSecret) {
      console.warn("⚠️ Webhook bị từ chối: Header x-webhook-secret không hợp lệ!");
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid x-webhook-secret header" },
        { status: 401 }
      );
    }

    // 2. Nhận dữ liệu Webhook gửi lên từ ngân hàng
    const body = await request.json();
    console.log("--> [WEBHOOK RECEIVED]:", body);

    const amount = Number(body.amount || body.transferAmount || 0);
    const content = String(body.content || body.description || "");
    const phone = String(body.phone || body.customerPhone || "");

    // 3. Trích xuất mã đơn hàng chuẩn xác từ nội dung chuyển khoản (Fix lỗi String(match))
    let extractedOrderId = "";
    // Tìm tiền tố DH hoặc HD theo sau là số hoặc chữ (VD: DH12345, HD-98765, DH 12345)
    const match = content.match(/(DH|HD)[\s\-]*([a-zA-Z0-9]+)/i);

    if (match && match[0]) {
      // lấy match[0] để lấy chính xác chuỗi khớp (VD: "DH12345"), tránh bị dính dấu phẩy
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
      console.warn("⚠️ Thiếu cấu hình Supabase trong môi trường (.env)");
      return NextResponse.json({
        success: true,
        savedToDatabase: false,
        message: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc KEY",
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