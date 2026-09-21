"use client";

import { use, useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Loader2 } from "lucide-react";

// Cấu hình thông tin ngân hàng nhận tiền
const BANK_CONFIG = {
  BANK_ID: "MB", // Tên viết tắt ngân hàng (MB, VCB, ICB, TCB, ACB, ...)
  ACCOUNT_NO: "0373695296", // Số tài khoản ngân hàng
  ACCOUNT_NAME: "PHAM THI MY", // Tên chủ tài khoản
};

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const amount = 100000;
  const [isPaid, setIsPaid] = useState(false);

  // Cố định đối tượng Supabase client bằng useMemo
  const supabase = useMemo(() => createClient(), []);

  // Tạo URL mã QR VietQR chuẩn
  const qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.BANK_ID}-${BANK_CONFIG.ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${orderId}&accountName=${encodeURIComponent(BANK_CONFIG.ACCOUNT_NAME)}`;

  useEffect(() => {
    // Lắng nghe giao dịch Realtime từ Supabase cho đơn hàng này
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new && payload.new.amount >= amount) {
            setIsPaid(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, amount, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card p-6 rounded-xl border shadow-lg text-center flex flex-col items-center gap-6">
        {!isPaid ? (
          <>
            <div>
              <h1 className="text-2xl font-bold">Thanh toán đơn hàng</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Mã đơn: <span className="font-semibold text-primary">{orderId}</span>
              </p>
            </div>

            {/* Mã QR VietQR */}
            <div className="relative w-64 h-64 border p-2 rounded-lg bg-white">
              <img
                src={qrUrl}
                alt="Mã VietQR Thanh Toán"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="w-full bg-muted p-4 rounded-lg text-left text-sm space-y-1">
              <p>
                Số tiền:{" "}
                <strong className="text-green-600">
                  {amount.toLocaleString("vi-VN")} VNĐ
                </strong>
              </p>
              <p>
                Nội dung chuyển khoản:{" "}
                <strong className="text-blue-600">{orderId}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang chờ hệ thống ghi nhận chuyển khoản...
            </div>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 animate-bounce" />
            <h2 className="text-2xl font-bold text-green-600">
              Thanh toán thành công!
            </h2>
            <p className="text-sm text-muted-foreground">
              Hệ thống đã xác nhận đơn hàng <strong>{orderId}</strong>. Cảm ơn bạn!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}