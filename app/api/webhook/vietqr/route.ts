import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Parse JSON an toàn (Tránh crash Server nếu body rỗng hoặc sai định dạng)
    let body: any;
    try {
      body = await request.json();
    } catch (e) {
      console.error("❌ [WEBHOOK] Payload không phải JSON hợp lệ");
      return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
    }

    console.log("📥 [WEBHOOK RECEIVED]:", JSON.stringify(body));

    // 2. Bóc tách Object giao dịch chính xác (Xử lý Mảng Array từ SePay / Casso)
    let transaction = body;
    if (Array.isArray(body) && body.length > 0) {
      transaction = body[0]; // FIX LỖI: Lấy phần tử đầu tiên của mảng
    } else if (body && Array.isArray(body.data) && body.data.length > 0) {
      transaction = body.data[0]; // FIX LỖI: Lấy phần tử trong body.data
    }

    // 3. Lấy số tiền & Nội dung chuyển khoản
    const amount = Number(
      transaction?.transferAmount ||
      transaction?.amount ||
      transaction?.creditAmount ||
      199000
    );

    const rawContent = String(
      transaction?.content ||
      transaction?.description ||
      transaction?.referenceCode ||
      ""
    ).trim();

    if (!rawContent) {
      return NextResponse.json({ success: false, message: "Nội dung chuyển khoản rỗng" }, { status: 200 });
    }

    console.log(`💵 [WEBHOOK OK] Số tiền: ${amount} VNĐ | Nội dung: "${rawContent}"`);

    // 4. Khởi tạo Supabase Client an toàn
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Thiếu cấu hình Supabase URL / Key");
      return NextResponse.json({ success: false, error: "Missing Supabase Credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. Tách mã đơn hàng (HD102, DH1001, SUBPRO2128...)
    const orderMatch = rawContent.match(/(HD|DH|ORDER|INV|SUB_?BASIC|SUB_?PRO)_?([A-Z0-9]+)/i);
    const orderId = orderMatch ? orderMatch[0].toUpperCase().replace(/_/g, "") : rawContent.toUpperCase();

    // =========================================================================
    // TRƯỜNG HỢP A: NÂNG CẤP GÓI SAAS (SUBBASIC / SUBPRO)
    // =========================================================================
    if (orderId.includes("SUBBASIC") || orderId.includes("SUBPRO")) {
      const planType = orderId.includes("SUBPRO") ? "pro" : "basic";
      const newQuota = planType === "pro" ? 1500 : 300;
      const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from("saas_subscriptions").upsert(
        {
          order_id: orderId,
          shop_id: "SHOP_DEMO",
          plan: planType,
          amount: amount,
          status: "paid",
        },
        { onConflict: "order_id" }
      );

      await supabase
        .from("shops")
        .update({
          plan: planType,
          monthly_quota: newQuota,
          plan_expires_at: expireDate,
        })
        .eq("shop_id", "SHOP_DEMO");

      await supabase.from("transactions").insert({
        order_id: orderId,
        amount: amount,
        content: rawContent,
        status: "paid",
      });

      await sendZaloMessage("0373695296", `🎉 Cảm ơn bạn! Tài khoản shop đã nâng cấp thành công lên GÓI ${planType.toUpperCase()} (${newQuota} đơn/tháng).`);

      return NextResponse.json({ success: true, message: `Nâng cấp gói ${planType} thành công!` }, { status: 200 });
    }

    // =========================================================================
    // TRƯỜNG HỢP B: GẠCH NỢ ĐƠN HÀNG LẺ (Ghi nhận vào invoices & orders)
    // =========================================================================
    // Cập nhật trạng thái 'paid' cho các đơn có sẵn
    const { data: invUpdated } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .or(`invoice_id.eq.${orderId},invoice_id.eq.HD${orderId}`)
      .select();

    const { data: ordUpdated } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .or(`order_id.eq.${orderId},order_id.eq.HD${orderId}`)
      .select();

    // Nếu đơn chưa từng tạo trước đó trong CSDL, tự động Upsert tạo mới với status = 'paid'
    if ((!invUpdated || invUpdated.length === 0) && (!ordUpdated || ordUpdated.length === 0)) {
      await supabase.from("invoices").upsert({
        invoice_id: orderId,
        amount: amount,
        customer_phone: "0373695296",
        status: "paid",
      }, { onConflict: "invoice_id" });

      await supabase.from("orders").upsert({
        order_id: orderId,
        amount: amount,
        phone: "0373695296",
        status: "paid",
      }, { onConflict: "order_id" });
    }

    // Ghi nhật ký lịch sử giao dịch
    await supabase.from("transactions").insert({
      order_id: orderId,
      amount: amount,
      content: rawContent,
      status: "paid",
    });

    // Bắn tin nhắn Zalo xác nhận
    await sendZaloMessage("0373695296", `Cảm ơn bạn! Đơn hàng #${orderId} đã được thanh toán thành công.`);

    return NextResponse.json({
      success: true,
      message: `Gạch nợ tự động thành công cho đơn #${orderId}`,
    }, { status: 200 });

  } catch (error: any) {
    const errMessage = error?.message || String(error);
    console.error("❌ [WEBHOOK FATAL ERROR]:", errMessage);
    return NextResponse.json({ success: false, error: errMessage }, { status: 200 });
  }
}
