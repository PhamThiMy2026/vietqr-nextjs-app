"use client";

import { useEffect, useState } from "react";

export default function CheckoutPage({
  params,
}: {
  params: { orderId: string };
}) {
  const [isPaid, setIsPaid] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(199000);

  const bankInfo = {
    bankId: "MB",
    bankName: "Ngân hàng TMCP Quân Đội (MB Bank)",
    accountNo: "0373695296",
    accountName: "PHAM THI MY",
    content: params.orderId.toUpperCase(),
  };

  const qrUrl = `https://img.vietqr.io/image/${bankInfo.bankId}-${bankInfo.accountNo}-compact2.png?amount=${amount}&addInfo=${bankInfo.content}&accountName=${encodeURIComponent(
    bankInfo.accountName
  )}`;

  useEffect(() => {
    if (isPaid) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/status?orderId=${params.orderId}`);
        const data = await res.json();

        if (data.order?.amount) {
          setAmount(Number(data.order.amount));
        }

        if (data.paid) {
          setIsPaid(true);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [params.orderId, isPaid]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="max-w-xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/20 mb-3">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Cổng Thanh Toán Tự Động VietQR
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Thanh Toán Đơn Hàng #{params.orderId.toUpperCase()}
          </h1>
        </div>

        {isPaid ? (
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-8 text-center space-y-6 animate-fade-in relative z-10 shadow-xl shadow-emerald-500/10">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-4xl font-extrabold shadow-lg shadow-emerald-500/20 border border-emerald-500/50 animate-bounce">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-400 mb-2">
                Thanh Toán Thành Công!
              </h2>
              <p className="text-slate-300 text-sm">
                Đơn hàng <span className="font-mono font-bold text-white">#{params.orderId}</span> đã được gạch nợ tự động thành công.
              </p>
            </div>

            <div className="bg-slate-900/90 p-4 rounded-xl text-left text-sm space-y-2.5 border border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Số tiền thanh toán:</span>
                <span className="text-emerald-400 font-bold">{amount.toLocaleString("vi-VN")} VNĐ</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Trạng thái đơn:</span>
                <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded text-xs border border-emerald-500/20">
                  Đã gạch nợ (Paid)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Thông báo Zalo:</span>
                <span className="text-slate-200">Đã gửi tin nhắn xác nhận</span>
              </div>
            </div>

            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Hoàn Tất & Về Trang Chủ
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-6">
              <div className="relative">
                <img
                  src={qrUrl}
                  alt="VietQR MBBank"
                  className="w-56 h-56 rounded-xl border border-slate-700 bg-white p-2 shadow-md"
                />
              </div>

              <div className="flex-1 space-y-3.5 w-full text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">Ngân hàng thụ hưởng</span>
                  <span className="font-bold text-white">{bankInfo.bankName}</span>
                </div>

                <div>
                  <span className="text-slate-400 text-xs block">Số tài khoản</span>
                  <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800 mt-1">
                    <span className="font-mono font-bold text-emerald-400 text-base">{bankInfo.accountNo}</span>
                    <button
                      onClick={() => handleCopy(bankInfo.accountNo, "acc")}
                      className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-slate-200 transition border border-slate-700 cursor-pointer"
                    >
                      {copiedField === "acc" ? "✓ Đã copy" : "Copy"}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-xs block">Chủ tài khoản</span>
                  <span className="font-bold text-white block mt-0.5">{bankInfo.accountName}</span>
                </div>

                <div>
                  <span className="text-slate-400 text-xs block">Nội dung chuyển khoản (Bắt buộc)</span>
                  <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-emerald-500/40 mt-1">
                    <span className="font-mono font-bold text-emerald-400 text-base">{bankInfo.content}</span>
                    <button
                      onClick={() => handleCopy(bankInfo.content, "content")}
                      className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 py-1.5 rounded-lg transition border border-emerald-500/30 font-semibold cursor-pointer"
                    >
                      {copiedField === "content" ? "✓ Đã copy" : "Copy nội dung"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800/80 text-center">
              <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              <p className="text-xs text-slate-300">
                Hệ thống đang kiểm tra giao dịch tự động. Màn hình sẽ chuyển trạng thái ngay khi nhận tiền!
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}