import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

// Bắt buộc Route chạy dạng Dynamic
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("📥 [WEBHOOK RECEIVED]:", JSON.stringify(body));

    // 1. Chuẩn hóa dữ liệu đầu vào (Tương thích cả SePay và Casso)
    let transaction = body;
    // Nếu là Webhook từ Casso (dữ liệu nằm trong mảng body.data)
    if (Array.isArray(body.data) && body.data.length > 0) {
      transaction = body.data[0];
    }

    // Lấy số tiền và nội dung chuyển khoản
    const amount = Number(
      transaction.transferAmount ||
      transaction.amount ||
      transaction.creditAmount ||
      0
    );

    const rawContent = String(
      transaction.content ||
      transaction.description ||
      transaction.referenceCode ||
      ""
    ).trim();

    console.log(`💵 Số tiền: ${amount} VNĐ | Nội dung: "${rawContent}"`);

    if (!rawContent) {
      return NextResponse.json(
        { success: false, message: "Nội dung chuyển khoản trống" },
        { status: 200 }
      );
    }

    // Khởi tạo Supabase Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========================================================================
    // TRƯỜNG HỢP 1: THANH TOÁN MUA GÓI SAAS (Dogfooding - Tự nâng cấp gói 3s)
    // =========================================================================
    const saasMatch = rawContent.match(/SUB_(BASIC|PRO)_[A-Z0-9]+/i);

    if (saasMatch) {
      const saasOrderId = saasMatch[0].toUpperCase();
      console.log(`🚀 [DOGFOODING]: Xử lý nâng cấp gói SaaS cho mã: ${saasOrderId}`);

      // Dùng .maybeSingle() an toàn tuyệt đối, không làm crash server nếu không tìm thấy
      const { data: subOrder, error: subError } = await supabase
        .from("saas_subscriptions")
        .select("*")
        .eq("order_id", saasOrderId)
        .maybeSingle();

      if (subError) {
        console.error("❌ Lỗi tìm đơn saas_subscriptions:", subError.message);
      }

      if (subOrder && subOrder.status === "pending") {
        const isPro = subOrder.plan.toLowerCase() === "pro";
        const newQuota = isPro ? 1500 : 300;
        const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Đổi trạng thái đơn nâng cấp -> 'success'
        await supabase
          .from("saas_subscriptions")
          .update({ status: "success" })
          .eq("order_id", saasOrderId);

        // 2. Tự động nâng cấp Gói + Hạn ngạch + Gia hạn 30 ngày cho Shop
        await supabase
          .from("shops")
          .update({
            plan: subOrder.plan,
            monthly_quota: newQuota,
            plan_expires_at: expireDate,
          })
          .eq("shop_id", subOrder.shop_id);

        // 3. Lấy số điện thoại shop để gửi tin Zalo xác nhận
        const { data: shopInfo } = await supabase
          .from("shops")
          .select("phone")
          .eq("shop_id", subOrder.shop_id)
          .maybeSingle();

        if (shopInfo?.phone) {
          await sendZaloMessage(
            shopInfo.phone,
            `🎉 Cảm ơn bạn! Tài khoản shop [${subOrder.shop_id}] đã được nâng cấp thành công lên GÓI ${subOrder.plan.toUpperCase()} (${newQuota} đơn/tháng). Hạn dùng đến: ${new Date(expireDate).toLocaleDateString("vi-VN")}`
          );
        }

        return NextResponse.json({
          success: true,
          message: `Kích hoạt gói ${subOrder.plan} thành công cho shop ${subOrder.shop_id}!`,
        });
      }
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: KHÁCH HÀNG THANH TOÁN ĐƠN HÀNG CỦA CHỦ SHOP
    // =========================================================================
    const orderMatch = rawContent.match(/(DH|ORDER)[A-Z0-9]+/i);

    if (!orderMatch) {
      console.log("ℹ️ Không tìm thấy mã đơn hàng (DH.../ORDER...) trong nội dung.");
      return NextResponse.json({
        success: false,
        message: "Nội dung chuyển khoản không chứa mã đơn hàng hợp lệ.",
      });
    }

    const orderId = orderMatch[0].toUpperCase();
    const shopId = "SHOP_DEMO"; // Mã shop mặc định (hoặc bóc tách từ hệ thống của bạn)

    // 1. Kiểm tra Hạn ngạch (Quota) tháng này của Shop
    const currentMonthYear = new Date().toISOString().slice(0, 7); // Dạng 'YYYY-MM'

    const { data: shopInfo } = await supabase
      .from("shops")
      .select("*")
      .eq("shop_id", shopId)
      .maybeSingle();

    const monthlyQuota = shopInfo?.monthly_quota || 300;

    // Lấy số lượng đơn đã dùng trong tháng
    const { data: usage } = await supabase
      .from("shop_usage")
      .select("*")
      .eq("shop_id", shopId)
      .eq("month_year", currentMonthYear)
      .maybeSingle();

    const currentCount = usage?.transaction_count || 0;

    // Chặn nếu hết hạn ngạch gói
    if (currentCount >= monthlyQuota) {
      console.warn(`⚠️ [QUOTA EXCEEDED]: Shop ${shopId} đã dùng hết ${monthlyQuota} đơn/tháng!`);
      return NextResponse.json({
        success: false,
        error: "Quota Exceeded",
        message: `Shop đã sử dụng hết hạn ngạch (${monthlyQuota} đơn/tháng). Vui lòng nâng cấp gói!`,
      });
    }

    // 2. Tìm đơn hàng trong bảng 'orders'
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("❌ Lỗi truy vấn đơn hàng:", orderError.message);
    }

    if (order) {
      // Gạch nợ đơn hàng -> 'success'
      await supabase
        .from("orders")
        .update({ status: "success" })
        .eq("order_id", orderId);

      // Tăng bộ đếm giao dịch tháng thêm +1
      if (usage) {
        await supabase
          .from("shop_usage")
          .update({ transaction_count: currentCount + 1 })
          .eq("id", usage.id);
      } else {
        await supabase.from("shop_usage").insert({
          shop_id: shopId,
          month_year: currentMonthYear,
          transaction_count: 1,
        });
      }

      // Gửi tin nhắn Zalo cảm ơn khách hàng
      if (order.phone) {
        await sendZaloMessage(
          order.phone,
          `Cảm ơn bạn! Đơn hàng #${orderId} trị giá ${amount.toLocaleString("vi-VN")} VNĐ đã được xác nhận thanh toán thành công.`
        );
      }

      return NextResponse.json({
        success: true,
        message: `Đã gạch nợ thành công đơn hàng #${orderId}`,
      });
    }

    return NextResponse.json({
      success: false,
      message: `Không tìm thấy đơn hàng #${orderId} trong hệ thống.`,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi Server Webhook:", errMessage);

    // Luôn trả về 200 kèm JSON thông báo lỗi để SePay/Casso không gọi lại liên tục
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 200 }
    );
  }
}