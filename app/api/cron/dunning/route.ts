import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

// Khai báo bắt buộc route chạy dạng Dynamic (Tránh lỗi 405 Method Not Allowed)
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Đọc Secret Key cấu hình trong môi trường
    const cronSecret = (process.env.CRON_SECRET || "").trim();

    // 2. Lấy tham số 'key' từ URL an toàn (bọc trong try-catch tránh lỗi 400)
    let keyParam = "";
    try {
      const { searchParams } = new URL(request.url);
      keyParam = searchParams.get("key") || "";
    } catch {
      keyParam = "";
    }

    // 3. Đọc Header Authorization gửi từ Vercel Cron
    const authHeader = request.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Kiểm tra quyền truy cập (Hỗ trợ cả Header Authorization và ?key=...)
    const isAuthorized =
      !cronSecret ||
      bearerToken === cronSecret ||
      keyParam === cronSecret;

    if (!isAuthorized) {
      console.warn("⚠️ [CRON 401]: Truy cập không hợp lệ!");
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          message:
            "Thiếu hoặc sai Secret Key. Vui lòng truyền ?key=CRON_SECRET hoặc Header Authorization.",
        },
        { status: 401 }
      );
    }

    // 4. Kiểm tra cấu hình Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ Thiếu cấu hình Supabase URL/KEY trong môi trường.");
      return NextResponse.json({
        success: true,
        message: "Chưa cấu hình Supabase URL hoặc Key trên Vercel",
        processedOrders: 0,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. Lấy mốc thời gian 1 đến 3 ngày trước
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // 6. Quét các đơn hàng status = 'pending' trong Supabase
    const { data: pendingOrders, error: dbError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .gte("created_at", threeDaysAgo)
      .lte("created_at", oneDayAgo);

    if (dbError) {
      console.error("❌ Lỗi Supabase Query:", dbError.message);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    let sentCount = 0;
    if (pendingOrders && pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        if (order.phone) {
          const checkoutUrl = `https://vietqr-nextjs-app.vercel.app/checkout/${order.order_id}`;
          const reminderMsg = `Chào bạn, đơn hàng #${
            order.order_id
          } trị giá ${Number(order.amount || 0).toLocaleString(
            "vi-VN"
          )} VNĐ vẫn đang chờ thanh toán. Bấm vào link để thanh toán ngay qua VietQR: ${checkoutUrl}`;

          try {
            await sendZaloMessage(order.phone, reminderMsg);
            sentCount++;
          } catch (zaloErr) {
            console.error(`❌ Lỗi gửi Zalo cho đơn ${order.order_id}:`, zaloErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đã xử lý nhắc nợ thành công cho ${sentCount} đơn hàng.`,
      processedOrders: pendingOrders?.length || 0,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi Server Cron Job:", errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}