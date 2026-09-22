import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawOrderId = searchParams.get("orderId");

    // Xử lý an toàn nếu tham số rỗng
    if (!rawOrderId || rawOrderId.trim() === "") {
      return NextResponse.json(
        { paid: false, status: "pending", error: "Missing orderId" },
        { status: 200 }
      );
    }

    const orderId = rawOrderId.trim().toUpperCase();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ paid: false, status: "pending" }, { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Kiểm tra bảng 'invoices'
    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_id, amount, status, customer_phone, created_at")
      .or(`invoice_id.eq.${orderId},invoice_id.eq.HD${orderId}`)
      .maybeSingle();

    if (invoice) {
      const isPaid = invoice.status === "paid" || invoice.status === "success";
      return NextResponse.json({ paid: isPaid, status: invoice.status, order: invoice });
    }

    // 2. Kiểm tra bảng 'orders'
    const { data: order } = await supabase
      .from("orders")
      .select("order_id, amount, status, phone, created_at")
      .or(`order_id.eq.${orderId},order_id.eq.HD${orderId}`)
      .maybeSingle();

    if (order) {
      const isPaid = order.status === "paid" || order.status === "success";
      return NextResponse.json({ paid: isPaid, status: order.status, order });
    }

    return NextResponse.json({ paid: false, status: "pending" });
  } catch (error) {
    console.error("❌ [STATUS API ERROR]:", error);
    return NextResponse.json({ paid: false, status: "pending" }, { status: 200 });
  }
}