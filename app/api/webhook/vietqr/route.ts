import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 200 });
    }

    // Fix bóc tách mảng Array chính xác
    let transaction = body;
    if (Array.isArray(body) && body.length > 0) {
      transaction = body[0];
    } else if (body && Array.isArray(body.data) && body.data.length > 0) {
      transaction = body.data[0];
    }

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
      return NextResponse.json({ success: false, message: "Empty content" }, { status: 200 });
    }

    // Tách mã đơn hàng an toàn
    const match = rawContent.match(/(HD|DH|ORDER|INV|SUBBASIC|SUBPRO)[A-Z0-9]*/i);
    const orderId = match ? match[0].toUpperCase() : rawContent.toUpperCase();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase Credentials" }, { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cập nhật CSDL Supabase
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

    await supabase.from("transactions").insert({
      order_id: orderId,
      amount: amount,
      content: rawContent,
      status: "paid",
    });

    await sendZaloMessage("0373695296", `Cảm ơn bạn! Đơn hàng #${orderId} đã được thanh toán thành công.`);

    return NextResponse.json({
      success: true,
      message: `Gạch nợ tự động thành công cho đơn #${orderId}`,
    }, { status: 200 });

  } catch (error: any) {
    console.error("❌ [WEBHOOK ERROR]:", error?.message || error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 200 });
  }
}