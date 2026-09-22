import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> | Array<unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 200 });
    }

    let transaction: Record<string, unknown> = {};
    if (Array.isArray(body) && body.length > 0) {
      transaction = (body[0] as Record<string, unknown>) || {};
    } else if (body && typeof body === "object" && "data" in body && Array.isArray(body.data) && body.data.length > 0) {
      transaction = (body.data[0] as Record<string, unknown>) || {};
    } else if (body && typeof body === "object") {
      transaction = body as Record<string, unknown>;
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

    // Lấy phần tử mảng match[0] an toàn chuẩn TypeScript
    const match = rawContent.match(/(HD|DH|ORDER|INV|SUBBASIC|SUBPRO)[A-Z0-9]*/i);
    const orderId = match && match[0] ? match[0].toUpperCase() : rawContent.toUpperCase();

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

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ [WEBHOOK ERROR]:", errMessage);
    return NextResponse.json({ success: false, error: errMessage }, { status: 200 });
  }
}