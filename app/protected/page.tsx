import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PaymentStatus from '@/components/PaymentStatus';
export const instant = false;

export default async function ProtectedPage() {
  const supabase = await createClient();

  // Kiểm tra thông tin người dùng từ Supabase Auth
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Nếu chưa đăng nhập hoặc có lỗi kết nối -> Chuyển hướng về trang đăng nhập
  if (error || !user) {
    redirect('/sign-in');
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8 max-w-4xl px-3 py-12 mx-auto">
      <div className="flex flex-col gap-2 items-start">
        <h1 className="font-bold text-3xl mb-2">🔒 Trang Bảo Mật (Protected)</h1>
        <p className="text-foreground/80">
          Xin chào <span className="font-semibold text-primary">{user.email}</span>!
        </p>
      </div>

      {/* Gọi Component hiển thị lịch sử giao dịch Realtime */}
      <PaymentStatus />

      <div className="bg-card p-6 rounded-lg border">
        <h2 className="font-bold text-lg mb-2">Thông tin tài khoản:</h2>
        <pre className="bg-muted p-4 rounded text-xs overflow-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  );
}