"use client";

import { useState } from "react";

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");

  const MY_BANK_ID = "MB";
  const MY_ACCOUNT_NO = "0373695296";
  const MY_ACCOUNT_NAME = "PHAM THI MY";

  const handleSelectPlan = (plan: "basic" | "pro") => {
    setSelectedPlan(plan);
    const price = plan === "basic" ? 199000 : 399000;
    const generatedOrderId = `SUB${plan.toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
    setOrderId(generatedOrderId);

    const vietQrLink = `https://img.vietqr.io/image/${MY_BANK_ID}-${MY_ACCOUNT_NO}-compact2.png?amount=${price}&addInfo=${generatedOrderId}&accountName=${encodeURIComponent(
      MY_ACCOUNT_NAME
    )}`;

    setQrUrl(vietQrLink);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-12 flex flex-col items-center justify-center font-sans">
      <div className="text-center mb-12 max-w-xl">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-tight">
          Gói Dịch Vụ VietQR & Zalo Automation
        </h1>
        <p className="text-slate-400 text-sm md:text-base">
          Tự động hóa 100% quy trình đối soát ngân hàng và gửi tin nhắn Zalo chăm sóc khách hàng.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* Gói Cơ Bản */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <h3 className="text-2xl font-bold mb-2">Gói Cơ Bản</h3>
            <p className="text-slate-400 text-xs mb-6">Dành cho shop vừa và nhỏ</p>
            <div className="text-4xl font-black mb-6">
              199.000đ <span className="text-sm font-normal text-slate-400">/ tháng</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 mb-8">
              <li>✅ Tối đa <b>300 giao dịch/tháng</b></li>
              <li>✅ Tự động gạch nợ 3 giây</li>
              <li>✅ Bắn tin nhắn Zalo cảm ơn</li>
            </ul>
          </div>
          <button
            onClick={() => handleSelectPlan("basic")}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl transition cursor-pointer"
          >
            Chọn Gói Cơ Bản (199k)
          </button>
        </div>

        {/* Gói Pro */}
        <div className="bg-slate-900 border-2 border-emerald-500 p-8 rounded-3xl flex flex-col justify-between relative shadow-2xl shadow-emerald-500/10">
          <div className="absolute -top-3.5 right-6 bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full">
            NĂNG SUẤT CAO
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2 text-emerald-400">Gói Pro</h3>
            <p className="text-slate-400 text-xs mb-6">Dành cho shop bán hàng chuyên nghiệp</p>
            <div className="text-4xl font-black mb-6">
              399.000đ <span className="text-sm font-normal text-slate-400">/ tháng</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 mb-8">
              <li>🚀 Tối đa <b>1.500 giao dịch/tháng</b></li>
              <li>✅ Tự động gạch nợ 3 giây</li>
              <li>💬 <b>Kịch bản Zalo Nhắc Nợ tự động</b> (Dunning Cron)</li>
            </ul>
          </div>
          <button
            onClick={() => handleSelectPlan("pro")}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            Nâng Cấp Gói Pro (399k) 🚀
          </button>
        </div>
      </div>

      {/* Modal QR Code */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold">Kích Hoạt Gói {selectedPlan.toUpperCase()}</h3>
            <p className="text-slate-400 text-xs">
              Mã đơn: <span className="text-emerald-400 font-mono font-bold">{orderId}</span>
            </p>

            <img src={qrUrl} alt="VietQR Payment" className="mx-auto rounded-xl border border-slate-700 w-60 h-60 bg-white p-2" />

            <p className="text-xs text-slate-400 leading-relaxed">
              STK: <b className="text-white">0373695296</b> (MB Bank) - <b>{MY_ACCOUNT_NAME}</b>
              <br />
              ⚡ Hệ thống tự động nâng cấp gói ngay khi nhận tiền!
            </p>

            <button
              onClick={() => setSelectedPlan(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}