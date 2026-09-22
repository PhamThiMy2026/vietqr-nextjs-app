import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendZaloMessage } from "@/lib/zalo";

// Bắt buộc Route chạy dynamic trên Vercel
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("📥 [WEBHOOK VIETQR / SEPAY RECEIVED]:", JSON.stringify(body));

    // 1. Khởi tạo Supabase Client an toàn (Tránh lỗi Missing Key)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Thiếu cấu hình Supabase URL hoặc Key");
      return NextResponse.json(
        { success: false, error: "Missing Supabase credentials in environment variables" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Chuẩn hóa bóc tách dữ liệu từ SePay / Casso / VietQR Webhook
    // Hỗ trợ cả Object đơn, Mảng Object, hoặc { data: [...] }
    let data = body;
    if (Array.isArray(body)) {
      data = body[0] || {};
    } else if (Array.isArray(body?.data)) {
      data = body.data[0] || {};
    }

    const amount = Number(
      data?.transferAmount ||
      data?.amount ||
      data?.creditAmount ||
      0
    );

    const rawContent = String(
      data?.content ||
      data?.description ||
      data?.referenceCode ||
      ""
    ).trim();

    console.log(`💵 Số tiền nhận: ${amount} VNĐ | Nội dung CK: "${rawContent}"`);

    if (!rawContent) {
      return NextResponse.json(
        { success: false, message: "Nội dung chuyển khoản rỗng, không thể đối soát" },
        { status: 200 }
      );
    }

    // =========================================================================
    // TRƯỜNG HỢP A: NÂNG CẤP GÓI CƯỚC SAAS (Mã dạng SUBPRO2128, SUBBASIC1001, SUB_PRO_...)
    // =========================================================================
    const saasMatch = rawContent.match(/SUB_?(BASIC|PRO)_?([A-Z0-9]+)/i);

    if (saasMatch) {
      const fullCode = saasMatch[0].toUpperCase();       // VD: "SUBPRO2128"
      const planType = saasMatch[1].toLowerCase();      // "pro" hoặc "basic"
      const isPro = planType === "pro";
      const newQuota = isPro ? 1500 : 300;
      const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Kiểm tra đơn mua gói trong bảng saas_subscriptions
      const { data: subOrder } = await supabase
        .from("saas_subscriptions")
        .select("*")
        .or(`order_id.eq.${fullCode},order_id.ilike.${fullCode}`)
        .maybeSingle();

      const targetShopId = subOrder?.shop_id || "SHOP_DEMO";

      // Cập nhật trạng thái đơn mua gói cước thành 'paid'
      if (subOrder) {
        await supabase
          .from("saas_subscriptions")
          .update({ status: "paid" })
          .eq("id", subOrder.id);
      } else {
        await supabase.from("saas_subscriptions").insert({
          order_id: fullCode,
          shop_id: targetShopId,
          plan: planType,
          amount: amount,
          status: "paid",
        });
      }

      // Cập nhật Hạn ngạch & Gói cước vào bảng shops và customers
      await supabase
        .from("shops")
        .update({
          plan: planType,
          monthly_quota: newQuota,
          plan_expires_at: expireDate,
        })
        .eq("shop_id", targetShopId);

      await supabase
        .from("customers")
        .update({
          plan: planType,
          monthly_quota: newQuota,
          plan_expires_at: expireDate,
        })
        .eq("customer_id", targetShopId);

      // Ghi nhật ký giao dịch
      await supabase.from("transactions").insert({
        order_id: fullCode,
        amount: amount,
        content: rawContent,
        status: "paid",
        created_at: new Date().toISOString(),
      });

      // Lấy SĐT shop để gửi Zalo thông báo kích hoạt thành công
      const { data: shopInfo } = await supabase
        .from("shops")
        .select("phone")
        .eq("shop_id", targetShopId)
        .maybeSingle();

      if (shopInfo?.phone) {
        await sendZaloMessage(
          shopInfo.phone,
          `🎉 Cảm ơn bạn! Tài khoản shop [${targetShopId}] đã nâng cấp thành công lên GÓI ${planType.toUpperCase()} (${newQuota} đơn/tháng). Hạn dùng: ${new Date(expireDate).toLocaleDateString("vi-VN")}`
        );
      }

      return NextResponse.json({
        success: true,
        message: `Đã nâng cấp thành công gói ${planType.toUpperCase()} cho shop ${targetShopId}`,
      });
    }

    // =========================================================================
    // TRƯỜNG HỢP B: KHÁCH HÀNG THANH TOÁN ĐƠN HÀNG / HÓA ĐƠN (Mã HD102, DH1001, ORDER1001...)
    // =========================================================================
    const orderMatch = rawContent.match(/(HD|DH|ORDER|INV|INVOICE)_?([A-Z0-9]+)/i);

    if (orderMatch) {
      const orderId = orderMatch[0].toUpperCase(); // VD: "HD102" hoặc "DH1001"

      // Search bảng 'orders' trước
      let targetOrder = null;
      let tableName = "orders";

      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();

      if (orderData) {
        targetOrder = orderData;
      } else {
        // Dự phòng search bảng 'invoices' nếu dự án dùng bảng 'invoices'
        const { data: invoiceData } = await supabase
          .from("invoices")
          .select("*")
          .or(`invoice_id.eq.${orderId},order_id.eq.${orderId}`)
          .maybeSingle();

        if (invoiceData) {
          targetOrder = invoiceData;
          tableName = "invoices";
        }
      }

      if (targetOrder) {
        // Kiểm tra số tiền chuyển khoản >= số tiền đơn hàng
        const requiredAmount = Number(targetOrder.amount || 0);

        if (amount >= requiredAmount || requiredAmount === 0) {
          // 1. Tự động cập nhật status = 'paid' vào Database Supabase
          if (tableName === "orders") {
            await supabase
              .from("orders")
              .update({ status: "paid" })
              .eq("order_id", orderId);
          } else {
            await supabase
              .from("invoices")
              .update({ status: "paid" })
              .or(`invoice_id.eq.${orderId},order_id.eq.${orderId}`);
          }

          // 2. Ghi nhật ký giao dịch
          await supabase.from("transactions").insert({
            order_id: orderId,
            amount: amount,
            content: rawContent,
            status: "paid",
            created_at: new Date().toISOString(),
          });

          // 3. Tự động kích hoạt API Zalo gửi tin nhắn xác nhận tức thì
          const customerPhone = targetOrder.phone || targetOrder.customer_phone;
          if (customerPhone) {
            const zaloMessage = `Cảm ơn bạn! Đơn hàng #${orderId} đã được thanh toán thành công.`;
            await sendZaloMessage(customerPhone, zaloMessage);
          }

          return NextResponse.json({
            success: true,
            message: `Gạch nợ tự động thành công cho đơn #${orderId}. Cập nhật status = 'paid'`,
          });
        } else {
          console.warn(`⚠️ Đơn #${orderId} thiếu tiền: Nhận ${amount} / Cần ${requiredAmount}`);
          return NextResponse.json({
            success: false,
            message: `Số tiền chuyển (${amount}) nhỏ hơn số tiền đơn hàng (${requiredAmount})`,
          });
        }
      }
    }

    // Nếu không tìm thấy mã đơn trùng khớp, lưu vào sổ nhật ký giao dịch tự do
    await supabase.from("transactions").insert({
      order_id: "UNMATCHED",
      amount: amount,
      content: rawContent,
      status: "paid",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Đã ghi nhận biến động số dư thành công (không tìm thấy mã đơn trùng khớp).",
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Lỗi Server Webhook VietQR:", errMessage);
    return NextResponse.json({ success: false, error: errMessage }, { status: 200 });
  }
}