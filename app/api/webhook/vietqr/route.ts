import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

// Bắt buộc Route chạy dạng Dynamic trên Vercel
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("📥 [WEBHOOK RECEIVED]:", JSON.stringify(body));

    // 1. Chuẩn hóa dữ liệu đầu vào (Hỗ trợ cả SePay và Casso)
    let transaction = body;
    if (Array.isArray(body.data) && body.data.length > 0) {
      transaction = body.data[0];
    }

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
    // TRƯỜNG HỢP 1: THANH TOÁN MUA GÓI SAAS (Bắt cả SUBPRO2128 lẫn SUB_PRO_2128)
    // =========================================================================
    // Group 1: BASIC hoặc PRO | Group 2: Mã số/mã đơn
    const saasMatch = rawContent.match(/SUB_?(BASIC|PRO)_?([A-Z0-9]+)/i);

    if (saasMatch) {
      const fullMatchedCode = saasMatch[0].toUpperCase();        // Ví dụ: "SUBPRO2128"
      const planType = saasMatch[1].toLowerCase();               // "pro" hoặc "basic"
      const codeNum = saasMatch[2];                              // "2128"
      const formattedCode = `SUB_${planType.toUpperCase()}_${codeNum}`; // "SUB_PRO_2128"

      console.log(`🚀 [DOGFOODING]: Nhận diện thanh toán Gói [${planType.toUpperCase()}] - Mã: ${fullMatchedCode}`);

      // Tìm đơn hàng trên Supabase khớp với 1 trong 2 định dạng mã
      const { data: subOrder, error: subError } = await supabase
        .from("saas_subscriptions")
        .select("*")
        .or(`order_id.eq.${fullMatchedCode},order_id.eq.${formattedCode}`)
        .maybeSingle();

      if (subError) {
        console.error("❌ Lỗi truy vấn saas_subscriptions:", subError.message);
      }

      if (subOrder && subOrder.status === "pending") {
        const isPro = planType === "pro";
        const newQuota = isPro ? 1500 : 300;
        const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Cập nhật trạng thái đơn nâng cấp -> 'success'
        await supabase
          .from("saas_subscriptions")
          .update({ status: "success" })
          .eq("id", subOrder.id);

        // 2. Nâng cấp Gói + Hạn ngạch + Gia hạn 30 ngày cho Shop
        await supabase
          .from("shops")
          .update({
            plan: planType,
            monthly_quota: newQuota,
            plan_expires_at: expireDate,
          })
          .eq("shop_id", subOrder.shop_id);

        // 3. Lưu vết lịch sử giao dịch vào bảng transactions
        await supabase.from("transactions").insert({
          order_id: subOrder.order_id,
          amount: amount,
          content: rawContent,
          status: "success",
          created_at: new Date().toISOString(),
        });

        // 4. Bắn tin nhắn Zalo xác nhận nâng cấp thành công
        const { data: shopInfo } = await supabase
          .from("shops")
          .select("phone")
          .eq("shop_id", subOrder.shop_id)
          .maybeSingle();

        if (shopInfo?.phone) {
          await sendZaloMessage(
            shopInfo.phone,
            `🎉 Cảm ơn bạn! Tài khoản shop [${subOrder.shop_id}] đã được nâng cấp thành công lên GÓI ${planType.toUpperCase()} (${newQuota} đơn/tháng). Hạn dùng đến: ${new Date(expireDate).toLocaleDateString("vi-VN")}`
          );
        }

        return NextResponse.json({
          success: true,
          message: `Kích hoạt gói ${planType} thành công cho shop ${subOrder.shop_id}!`,
        });
      }
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: KHÁCH HÀNG THANH TOÁN ĐƠN HÀNG CỦA CHỦ SHOP (DH1001 / ORDER...)
    // =========================================================================
    const orderMatch = rawContent.match(/(DH|ORDER)_?([A-Z0-9]+)/i);

    if (!orderMatch) {
      console.log("ℹ️ Không tìm thấy mã đơn hàng (DH... / SUB...) trong nội dung.");
      return NextResponse.json({
        success: false,
        message: "Nội dung chuyển khoản không chứa mã hợp lệ.",
      });
    }

    const orderId = orderMatch[0].toUpperCase();
    const shopId = "SHOP_DEMO"; // Mã shop mặc định

    // 1. Kiểm tra Hạn ngạch (Quota) tháng này
    const currentMonthYear = new Date().toISOString().slice(0, 7); // '2026-09'

    const { data: shopInfo } = await supabase
      .from("shops")
      .select("*")
      .eq("shop_id", shopId)
      .maybeSingle();

    const monthlyQuota = shopInfo?.monthly_quota || 300;

    const { data: usage } = await supabase
      .from("shop_usage")
      .select("*")
      .eq("shop_id", shopId)
      .eq("month_year", currentMonthYear)
      .maybeSingle();

    const currentCount = usage?.transaction_count || 0;

    if (currentCount >= monthlyQuota) {
      console.warn(`⚠️ [QUOTA EXCEEDED]: Shop ${shopId} đã hết hạn ngạch (${monthlyQuota} đơn/tháng)!`);
      return NextResponse.json({
        success: false,
        error: "Quota Exceeded",
        message: `Shop đã dùng hết hạn ngạch (${monthlyQuota} đơn/tháng). Vui lòng nâng cấp gói!`,
      });
    }

    // 2. Tìm và gạch nợ đơn hàng
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (order) {
      await supabase
        .from("orders")
        .update({ status: "success" })
        .eq("order_id", orderId);

      // Tăng bộ đếm giao dịch +1
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

      // Lưu vết vào bảng transactions
      await supabase.from("transactions").insert({
        order_id: orderId,
        amount: amount,
        content: rawContent,
        status: "success",
        created_at: new Date().toISOString(),
      });

      // Bắn tin nhắn Zalo cảm ơn
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
      message: `Không tìm thấy đơn hàng #${orderId} trên hệ thống.`,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi Server Webhook:", errMessage);

    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 200 }
    );
  }
}
