import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Quét các đơn pending/unpaid quá hạn 1-3 ngày
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("*")
      .or("status.eq.pending,status.eq.unpaid")
      .gte("created_at", threeDaysAgo)
      .lte("created_at", oneDayAgo);

    let sentCount = 0;

    for (const order of pendingOrders || []) {
      if (!order.phone) continue;

      const bankId = "MB";
      const accountNo = "0373695296";
      const accountName = "PHAM THI MY";

      const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${order.amount}&addInfo=${order.order_id}&accountName=${encodeURIComponent(
        accountName
      )}`;

      const reminderMsg = `🔔 [NHẮC THÁNH TOÁN]: Đơn hàng #${order.order_id} trị giá ${Number(
        order.amount
      ).toLocaleString("vi-VN")} VNĐ của bạn đang chờ hoàn tất.
Quét mã VietQR nhanh tại link sau để giữ ưu đãi: ${vietQrUrl}`;

      const isSuccess = await sendZaloMessage(order.phone, reminderMsg);
      if (isSuccess) sentCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Đã gửi ${sentCount}/${pendingOrders?.length || 0} tin nhắn Zalo nhắc nợ.`,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errMessage }, { status: 500 });
  }
}