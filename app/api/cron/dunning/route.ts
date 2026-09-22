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

    const { data: pendingInvoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("status", "pending")
      .gte("created_at", threeDaysAgo)
      .lte("created_at", oneDayAgo);

    let sentCount = 0;

    for (const inv of pendingInvoices || []) {
      if (!inv.customer_phone) continue;

      const bankId = "MB";
      const accountNo = "0373695296";
      const accountName = "PHAM THI MY";

      const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${inv.amount}&addInfo=${inv.invoice_id}&accountName=${encodeURIComponent(
        accountName
      )}`;

      const reminderMsg = `🔔 [NHẮC THÁNH TOÁN]: Hóa đơn #${inv.invoice_id} trị giá ${Number(
        inv.amount
      ).toLocaleString("vi-VN")} VNĐ của bạn vẫn đang chờ thanh toán.
Bạn có thể quét mã VietQR nhanh tại đường link sau: ${vietQrUrl}`;

      const isSuccess = await sendZaloMessage(inv.customer_phone, reminderMsg);
      if (isSuccess) sentCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Đã gửi thành công ${sentCount} tin nhắn Zalo nhắc nợ.`,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errMessage }, { status: 500 });
  }
}