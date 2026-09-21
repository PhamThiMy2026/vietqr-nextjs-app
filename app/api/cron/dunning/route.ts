import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

// Bắt buộc Route chạy dạng Dynamic Rendering (Xử lý dứt điểm lỗi 405)
export const dynamic = "force-dynamic";

async function handleCronTask(request: Request) {
  try {
    // 1. Kiểm tra Secret Key
    const cronSecret = (process.env.CRON_SECRET || "").trim();

    let keyParam = "";
    try {
      const { searchParams } = new URL(request.url);
      keyParam = searchParams.get("key") || "";
    } catch {
      keyParam = "";
    }

    const authHeader = request.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    const isAuthorized =
      !cronSecret ||
      bearerToken === cronSecret ||
      keyParam === cronSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          message: "Thiếu hoặc sai Secret Key (?key=YOUR_CRON_SECRET).",
        },
        { status: 401 }
      );
    }

    // 2. Kết nối Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        message: "Chưa cấu hình NEXT_PUBLIC_SUPABASE_URL hoặc KEY trên Vercel.",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Lấy mốc thời gian 1 đến 3 ngày trước
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // 4. Truy vấn bảng 'orders' an toàn
    const { data: pendingOrders, error: dbError } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "pending")
      .gte("created_at", threeDaysAgo)
      .lte("created_at", oneDayAgo);

    if (dbError) {
      console.error("⚠️ Lỗi truy vấn bảng orders:", dbError.message);
      return NextResponse.json({
        success: false,
        error: dbError.message,
        hint: "Hãy đảm bảo bạn đã tạo bảng 'orders' trong Supabase SQL Editor.",
      });
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
      { status: 200 } // Trả về HTTP 200 kèm nội dung lỗi JSON để tránh ngắt đột ngột Vercel Cron
    );
  }
}

// Export cả GET và POST để phục vụ Vercel Cron Job
export async function GET(request: Request) {
  return handleCronTask(request);
}

export async function POST(request: Request) {
  return handleCronTask(request);
}