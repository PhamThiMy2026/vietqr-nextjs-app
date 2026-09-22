"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function CheckoutPage({
  params,
}: {
  params: { orderId: string };
}) {
  const [status, setStatus] = useState<"pending" | "paid" | "loading">("loading");
  const [orderDetails, setOrderDetails] = useState<{
    amount?: number;
    order_id?: string;
  } | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fetchOrder = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("order_id", params.orderId)
        .maybeSingle();

      if (data) {
        setOrderDetails(data);
        setStatus(data.status === "paid" || data.status === "success" ? "paid" : "pending");
      } else {
        setStatus("pending");
      }
    };

    fetchOrder();

    // Hỏi vòng Database mỗi 3 giây
    const interval = setInterval(async () => {
      if (status === "paid") {
        clearInterval(interval);
        return;
      }

      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("order_id", params.orderId)
        .maybeSingle();

      if (data?.status === "paid" || data?.status === "success") {
        setStatus("paid");
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [params.orderId, status, supabaseUrl, supabaseKey]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center space-y-6 shadow-2xl">
        <h1 className="text-xl font-bold border-b border-slate-700 pb-4">
          Thanh Toán Đơn Hàng #{params.orderId}
        </h1>

        {status === "paid" ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-emerald-400">
              Thanh Toán Thành Công!
            </h2>
            <p className="text-slate-300 text-sm">
              Đơn hàng <span className="font-mono font-bold text-white">#{params.orderId}</span> đã được gạch nợ tự động.
            </p>
            {orderDetails?.amount && (
              <div className="bg-slate-900/60 p-3 rounded-lg text-sm text-slate-400">
                Số tiền:{" "}
                <span className="text-emerald-400 font-bold">
                  {Number(orderDetails.amount).toLocaleString("vi-VN")} VNĐ
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            <h2 className="text-lg font-semibold text-slate-200">
              Đang Chờ Thanh Toán VietQR...
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Vui lòng dùng App ngân hàng quét mã VietQR.
              <br />
              Màn hình sẽ <b>tự động chuyển trạng thái</b> trong vòng 3 giây ngay khi nhận được tiền!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}