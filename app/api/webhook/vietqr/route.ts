import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Thêm kiểm tra Secret Key ở đầu hàm POST
const authHeader = request.headers.get("x-webhook-secret");
if (authHeader !== process.env.WEBHOOK_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
    // 1. Nhận dữ liệu Webhook gửi lên
    const body = await request.json();
    console.log("--> [WEBHOOK RECEIVED]:", body);

    const amount = Number(body.amount || body.transferAmount || 0);
    const content = String(body.content || body.description || '');
    const phone = String(body.phone || body.customerPhone || '');

    // 2. Trích xuất mã đơn hàng (Ép kiểu String an toàn 100% cho TypeScript)
    const match = content.match(/(DH|HD)[\s\-]*(\d+)/i);
    let extractedOrderId = '';

    if (match && match) {
      // String(match) đảm bảo kiểu dữ liệu thu được luôn là string primitive
      const rawText = String(match);
      extractedOrderId = rawText.replace(/[\s\-]/g, '').toUpperCase();
    } else if (body.referenceCode) {
      extractedOrderId = String(body.referenceCode);
    } else if (body.order_id) {
      extractedOrderId = String(body.order_id);
    } else {
      extractedOrderId = content.trim() || `ORD_${Date.now()}`;
    }

    console.log(`🔎 Mã đơn hàng trích xuất: "${extractedOrderId}" | Số tiền: ${amount}`);

    // 3. Khai báo kết nối Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ Thiếu cấu hình Supabase trong .env.local");
      return NextResponse.json({
        success: true,
        savedToDatabase: false,
        message: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc KEY trong .env.local",
        order_id: extractedOrderId,
        amount: amount,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. Lưu vào Supabase (Khớp chuẩn 5 cột theo file 33: amount, content, order_id, phone, status)
    const { error } = await supabase.from('transactions').insert([
      {
        amount: amount,          // numeric
        content: content,        // text
        order_id: extractedOrderId, // text
        phone: phone,            // text
        status: 'success',       // text
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi Server Webhook:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
