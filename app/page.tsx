// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 md:p-12">
      {/* Header / Navbar */}
      <header className="max-w-6xl mx-auto w-full flex justify-between items-center py-4 border-b border-slate-800">
        <div className="text-xl font-bold tracking-wider text-emerald-400">
          VietQR AutoPay
        </div>
        <Link
          href="/checkout/DH1001"
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-lg transition"
        >
          Thử nghiệm Demo
        </Link>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto text-center my-16 space-y-6">
        <div className="inline-block bg-emerald-500/10 text-emerald-400 text-sm font-medium px-4 py-1.5 rounded-full border border-emerald-500/20">
          ⚡ Giải pháp Tự động hóa Thanh toán VietQR & Zalo 24/7
        </div>

        <h1 className="text-3xl md:text-5xl font-extrabold leading-tight text-slate-100">
          Tự động xác nhận chuyển khoản VietQR & Bắn tin nhắn Zalo cho khách trong{" "}
          <span className="text-emerald-400">3 giây</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Không lo đọng vốn, không mất công tra sao kê thủ công. Giảm 99% thời gian xử lý đơn hàng và tự động hóa kịch bản chăm sóc/nhắc nợ qua Zalo.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/checkout/DH1001"
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-lg px-8 py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            Tạo đơn hàng & Test thử ngay 🚀
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 my-12">
        <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
          <div className="text-3xl mb-3">📲</div>
          <h3 className="text-xl font-semibold mb-2">VietQR Động</h3>
          <p className="text-slate-400 text-sm">
            Tự động khởi tạo mã QR chuyển khoản chính xác tới từng xu, tự điền nội dung đơn hàng.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
          <div className="text-3xl mb-3">⚡</div>
          <h3 className="text-xl font-semibold mb-2">Webhook Khóa Đơn 3s</h3>
          <p className="text-slate-400 text-sm">
            Xác thực thanh toán tức thì qua SePay / Casso, gạch nợ tự động trên Supabase Realtime.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
          <div className="text-3xl mb-3">💬</div>
          <h3 className="text-xl font-semibold mb-2">Tự động hóa Zalo</h3>
          <p className="text-slate-400 text-sm">
            Bắn tin nhắn xác nhận tức thì và tự động kích hoạt kịch bản nhắc nợ (Dunning Cron Job) 9:00 sáng.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center py-6 text-slate-500 text-sm border-t border-slate-800">
        © 2026 VietQR AutoPay Solution. Powered by Next.js & Vercel.
      </footer>
    </main>
  );
}
