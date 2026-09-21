import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  // 1. Khởi tạo Supabase Server Client (dùng await theo chuẩn Next.js 15)
  const supabase = await createClient();

  // 2. Lấy thông tin người dùng từ Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Tự động chuyển hướng nếu người dùng chưa đăng nhập
  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8 items-center justify-center p-8">
      <div className="w-full max-w-4xl bg-card border rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Trang bảo mật (Protected Area)</h1>
        <p className="text-sm text-muted-foreground">
          Xin chào <strong className="text-primary">{user.email}</strong>, bạn đã đăng nhập thành công vào hệ thống!
        </p>
      </div>
    </div>
  );
}