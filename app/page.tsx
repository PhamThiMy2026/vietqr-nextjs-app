import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl w-full text-center space-y-6 relative z-10">
        <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full border border-emerald-500/20">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Nền Tảng Micro-SaaS VietQR & Zalo Automation
        </span>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
          Tự Động Đối Soát VietQR <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            & Gửi Tin Nhắn Zalo 3s
          </span>
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Tự động nhận diện nội dung chuyển khoản, gạch nợ CSDL Supabase tức thì và tự động gửi tin nhắn Zalo cảm ơn hoặc nhắc nợ lịch sự.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/pricing"
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-8 py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 text-center"
          >
            Xem Bảng Giá SaaS 🚀
          </Link>
          <Link
            href="/checkout/HD102"
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold px-8 py-3.5 rounded-xl transition text-center"
          >
            Demo Màn Hình Checkout (HD102) 💳
          </Link>
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
            <div className="text-emerald-400 font-bold text-lg mb-1">⚡ 3 Giây Gạch Nợ</div>
            <p className="text-xs text-slate-400">Tự động nhận Webhook từ SePay/Casso và cập nhật trạng thái đơn 'paid' tức thì.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
            <div className="text-blue-400 font-bold text-lg mb-1">🤖 Zalo Giả Lập / OA</div>
            <p className="text-xs text-slate-400">Gửi tin nhắn Zalo xác nhận đơn hàng hoặc nhắc nợ tự động lúc 9h sáng.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
            <div className="text-purple-400 font-bold text-lg mb-1">🛡️ Khắc Phục RLS</div>
            <p className="text-xs text-slate-400">Kết nối Supabase SSR qua Server API, khắc phục hoàn toàn lỗi đứng màn hình Checkout.</p>
          </div>
        </div>
      </div>
    </main>
  );
}