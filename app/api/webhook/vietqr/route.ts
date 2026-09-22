import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("📥 [WEBHOOK RECEIVED]:", JSON.stringify(body));

    // 1. Chuẩn hóa dữ liệu đầu vào (SePay hoặc Casso)
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
      return NextResponse.json({ success: false, message: "Nội dung chuyển khoản trống" }, { status: 200 });
    }

    // Khởi tạo Supabase Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =========================================================================
    // TRƯỜNG HỢP 1: THANH TOÁN MUA GÓI SAAS (Nâng cấp tài khoản)
    // =========================================================================
    const saasMatch = rawContent.match(/SUB_?(BASIC|PRO)_?([A-Z0-9]+)/i);

    if (saasMatch) {
      const fullMatchedCode = saasMatch[0].toUpperCase(); // VD: "SUBPRO2128"
      const planType = saasMatch[1].toLowerCase();        // "pro" hoặc "basic"
      const codeNum = saasMatch[2];                       // "2128"
      const formattedCode = `SUB_${planType.toUpperCase()}_${codeNum}`;

      console.log(`🚀 [DOGFOODING]: Phát hiện thanh toán Gói [${planType.toUpperCase()}] - Mã: ${fullMatchedCode}`);

      // Tìm đơn hàng trong saas_subscriptions
      const { data: subOrder } = await supabase
        .from("saas_subscriptions")
        .select("*")
        .or(`order_id.eq.${fullMatchedCode},order_id.eq.${formattedCode}`)
        .maybeSingle();

      const targetShopId = subOrder?.shop_id || "SHOP_DEMO";
      const isPro = planType === "pro";
      const newQuota = isPro ? 1500 : 300;
      const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Cập nhật hoặc tạo mới đơn saas_subscriptions -> 'success'
      if (subOrder) {
        await supabase.from("saas_subscriptions").update({ status: "success" }).eq("id", subOrder.id);
      } else {
        await supabase.from("saas_subscriptions").insert({
          order_id: fullMatchedCode,
          shop_id: targetShopId,
          plan: planType,
          amount: amount,
          status: "success"
        });
      }

      // Nâng cấp Gói + Hạn ngạch trên bảng shops
      await supabase
        .from("shops")
        .update({
          plan: planType,
          monthly_quota: newQuota,
          plan_expires_at: expireDate,
        })
        .eq("shop_id", targetShopId);

      // Lưu nhật ký giao dịch
      await supabase.from("transactions").insert({
        order_id: fullMatchedCode,
        amount: amount,
        content: rawContent,
        status: "success",
        created_at: new Date().toISOString(),
      });

      // Bắn Zalo thông báo
      const { data: shopInfo } = await supabase.from("shops").select("phone").eq("shop_id", targetShopId).maybeSingle();
      if (shopInfo?.phone) {
        await sendZaloMessage(
          shopInfo.phone,
          `🎉 Cảm ơn bạn! Tài khoản shop [${targetShopId}] đã nâng cấp thành công lên GÓI ${planType.toUpperCase()} (${newQuota} đơn/tháng). Hạn dùng: ${new Date(expireDate).toLocaleDateString("vi-VN")}`
        );
      }

      return NextResponse.json({
        success: true,
        message: `Đã nâng cấp gói ${planType} cho shop ${targetShopId}`,
      });
    }

    // =========================================================================
    // TRƯỜNG HỢP 2: KHÁCH HÀNG THANH TOÁN ĐƠN HÀNG (DH...)
    // =========================================================================
    const orderMatch = rawContent.match(/(DH|ORDER)_?([A-Z0-9]+)/i);

    if (!orderMatch) {
      // Lưu giao dịch tự do nếu không có mã đơn
      await supabase.from("transactions").insert({
        order_id: "NO_CODE",
        amount: amount,
        content: rawContent,
        status: "success",
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, message: "Đã lưu lịch sử giao dịch không mã" });
    }

    const orderId = orderMatch[0].toUpperCase();
    const shopId = "SHOP_DEMO";
    const currentMonthYear = new Date().toISOString().slice(0, 7);

    // Kiểm tra Hạn ngạch shop
    const { data: shopInfo } = await supabase.from("shops").select("*").eq("shop_id", shopId).maybeSingle();
    const monthlyQuota = shopInfo?.monthly_quota || 300;

    const { data: usage } = await supabase
      .from("shop_usage")
      .select("*")
      .eq("shop_id", shopId)
      .eq("month_year", currentMonthYear)
      .maybeSingle();

    const currentCount = usage?.transaction_count || 0;

    if (currentCount >= monthlyQuota) {
      return NextResponse.json({
        success: false,
        error: "Quota Exceeded",
        message: "Shop đã hết hạn ngạch giao dịch tháng này.",
      });
    }

    // Gạch nợ đơn hàng
    const { data: order } = await supabase.from("orders").select("*").eq("order_id", orderId).maybeSingle();

    if (order) {
      await supabase.from("orders").update({ status: "success" }).eq("order_id", orderId);

      // Cập nhật bộ đếm giao dịch
      if (usage) {
        await supabase.from("shop_usage").update({ transaction_count: currentCount + 1 }).eq("id", usage.id);
      } else {
        await supabase.from("shop_usage").insert({ shop_id: shopId, month_year: currentMonthYear, transaction_count: 1 });
      }

      // Lưu nhật ký biến động
      await supabase.from("transactions").insert({
        order_id: orderId,
        amount: amount,
        content: rawContent,
        status: "success",
        created_at: new Date().toISOString(),
      });

      // Bắn Zalo cảm ơn
      if (order.phone) {
        await sendZaloMessage(
          order.phone,
          `Cảm ơn bạn! Đơn hàng #${orderId} trị giá ${amount.toLocaleString("vi-VN")} VNĐ đã thanh toán thành công.`
        );
      }

      return NextResponse.json({ success: true, message: `Gạch nợ thành công đơn #${orderId}` });
    }

    return NextResponse.json({ success: false, message: `Không tìm thấy đơn #${orderId}` });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi Server Webhook:", errMessage);
    return NextResponse.json({ success: false, error: errMessage }, { status: 200 });
  }
}