"use client";

import { useState } from "react";

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro" | null>(null);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const MY_BANK_ID = "MB";
  const MY_ACCOUNT_NO = "0373695296";
  const MY_ACCOUNT_NAME = "PHAM THI MY";

  const handleSelectPlan = async (plan: "basic" | "pro") => {
    setLoading(true);
    setSelectedPlan(plan);

    const price = plan === "basic" ? 199000 : 399000;
    const generatedOrderId = `SUB${plan.toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
    setOrderId(generatedOrderId);

    const vietQrLink = `https://img.vietqr.io/image/${MY_BANK_ID}-${MY_ACCOUNT_NO}-compact2.png?amount=${price}&addInfo=${generatedOrderId}&accountName=${encodeURIComponent(
      MY_ACCOUNT_NAME
    )}`;

    setQrUrl(vietQrLink);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6 md:p-12 flex flex-col items-center">
      <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-4">
        Gói Dịch Vụ VietQR & Zalo Automation
      </h1>
      <p className="text-slate-400 text-center mb-12 max-w-xl">
        Dùng thử 7 ngày miễn phí. Nâng cấp để tự động hóa gạch nợ và bắn tin nhắn Zalo 24/7.
      </p>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* Gói Cơ Bản */}
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">Gói Cơ Bản</h3>
            <p className="text-slate-400 text-sm mb-6">Dành cho shop quy mô nhỏ</p>
            <div className="text-4xl font-black mb-6">
              199.000đ <span className="text-sm font-normal text-slate-400">/ tháng</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 mb-8">
              <li>✅ Tối đa <b>300 giao dịch/tháng</b></li>
              <li>✅ Tự động gạch nợ 3 giây</li>
              <li>✅ Bắn tin Zalo cảm ơn</li>
            </ul>
          </div>
          <button
            onClick={() => handleSelectPlan("basic")}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition"
          >
            Chọn Gói Cơ Bản (199k)
          </button>
        </div>

        {/* Gói Pro */}
        <div className="bg-slate-800 border-2 border-emerald-500 p-8 rounded-2xl flex flex-col justify-between relative shadow-xl shadow-emerald-500/10">
          <div className="absolute -top-3 right-6 bg-emerald-500 text-slate-950 text-xs font-bold px-3 py-1 rounded-full">
            PHỔ BIẾN NHẤT
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2 text-emerald-400">Gói Pro</h3>
            <p className="text-slate-400 text-sm mb-6">Dành cho shop bán hàng chuyên nghiệp</p>
            <div className="text-4xl font-black mb-6">
              399.000đ <span className="text-sm font-normal text-slate-400">/ tháng</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 mb-8">
              <li>🚀 Tối đa <b>1.500 giao dịch/tháng</b></li>
              <li>✅ Tự động gạch nợ 3 giây</li>
              <li>💬 <b>Kịch bản Zalo Nhắc Nợ tự động</b></li>
            </ul>
          </div>
          <button
            onClick={() => handleSelectPlan("pro")}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            Nâng Cấp Gói Pro (399k) 🚀
          </button>
        </div>
      </div>

      {/* Modal VietQR */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-md w-full text-center space-y-4">
            <h3 className="text-xl font-bold">Quét VietQR Kích Hoạt Gói {selectedPlan.toUpperCase()}</h3>
            <p className="text-slate-400 text-sm">
              Mã đơn: <span className="text-emerald-400 font-mono font-bold">{orderId}</span>
            </p>

            {loading ? (
              <div className="py-12 text-slate-400">Đang tạo mã VietQR...</div>
            ) : (
              <img src={qrUrl} alt="VietQR Payment" className="mx-auto rounded-xl border border-slate-700 w-64 h-64" />
            )}

            <p className="text-xs text-slate-400">
              Ngân hàng: <b>MB Bank</b> - STK: <b>0373695296</b>
              <br />
              Chủ tài khoản: <b>{MY_ACCOUNT_NAME}</b>
              <br />
              ⚡ Hệ thống tự động kích hoạt tài khoản ngay khi tiền về!
            </p>

            <button
              onClick={() => setSelectedPlan(null)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg text-sm transition"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}