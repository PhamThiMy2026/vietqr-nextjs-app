import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Xác thực Webhook Secret
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("x-sepay-api-key");
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (expectedSecret && authHeader) {
      const token = authHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim();
      if (token !== expectedSecret) {
        console.warn("⚠️ [WEBHOOK] Từ chối truy cập: WEBHOOK_SECRET không khớp.");
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();
    console.log("📥 [WEBHOOK RECEIVED]:", JSON.stringify(body));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let transaction = body;
    if (Array.isArray(body) && body.length > 0) transaction = body[0];
    else if (Array.isArray(body?.data) && body.data.length > 0) transaction = body.data[0];

    const amount = Number(
      transaction?.transferAmount ||
      transaction?.amount ||
      transaction?.creditAmount ||
      0
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

    // Case 1: Nâng cấp gói SaaS (SUBPRO..., SUBBASIC...)
    const saasMatch = rawContent.match(/SUB_?(BASIC|PRO)_?([A-Z0-9]+)/i);
    if (saasMatch) {
      const fullCode = saasMatch[0].toUpperCase();
      const planType = saasMatch[1].toLowerCase();
      const isPro = planType === "pro";
      const newQuota = isPro ? 1500 : 300;
      const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from("saas_subscriptions").upsert(
        {
          order_id: fullCode,
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
        order_id: fullCode,
        amount: amount,
        content: rawContent,
        status: "paid",
      });

      const { data: shopInfo } = await supabase
        .from("shops")
        .select("phone")
        .eq("shop_id", "SHOP_DEMO")
        .maybeSingle();

      if (shopInfo?.phone) {
        await sendZaloMessage(
          shopInfo.phone,
          `🎉 Cảm ơn bạn! Tài khoản shop đã nâng cấp thành công lên GÓI ${planType.toUpperCase()} (${newQuota} đơn/tháng). Hạn dùng: ${new Date(expireDate).toLocaleDateString("vi-VN")}`
        );
      }

      return NextResponse.json({ success: true, message: `Kích hoạt gói ${planType.toUpperCase()} thành công` });
    }

    // Case 2: Gạch nợ đơn hàng (HD102, DH1001, ORDER1001...)
    const orderMatch = rawContent.match(/(HD|DH|ORDER|INV)_?([A-Z0-9]+)/i);
    if (orderMatch) {
      const orderId = orderMatch[0].toUpperCase();

      const { data: updatedInvoice } = await supabase
        .from("invoices")
        .update({ status: "paid" })
        .or(`invoice_id.eq.${orderId},invoice_id.eq.${orderMatch[0]}`)
        .select()
        .maybeSingle();

      const { data: updatedOrder } = await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("order_id", orderId)
        .select()
        .maybeSingle();

      await supabase.from("transactions").insert({
        order_id: orderId,
        amount: amount,
        content: rawContent,
        status: "paid",
      });

      const phone =
        updatedInvoice?.customer_phone ||
        updatedOrder?.phone ||
        "0373695296";

      if (phone) {
        const zaloMsg = `Cảm ơn bạn! Đơn hàng #${orderId} đã được thanh toán thành công.`;
        await sendZaloMessage(phone, zaloMsg);
      }

      return NextResponse.json({
        success: true,
        message: `Gạch nợ tự động thành công cho đơn #${orderId}. Đã cập nhật status = 'paid'`,
      });
    }

    await supabase.from("transactions").insert({
      order_id: "UNMATCHED",
      amount: amount,
      content: rawContent,
      status: "paid",
    });

    return NextResponse.json({ success: true, message: "Đã lưu lịch sử giao dịch" });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ [WEBHOOK ERROR]:", errMessage);
    return NextResponse.json({ success: false, error: errMessage }, { status: 200 });
  }
}