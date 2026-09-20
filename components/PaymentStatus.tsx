"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PaymentStatus() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // 1. Tải danh sách giao dịch gần nhất
    async function fetchTransactions() {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("id", { ascending: false })
        .limit(5);

      if (data) setTransactions(data);
    }

    fetchTransactions();

    // 2. Lắng nghe thông báo Realtime khi có giao dịch mới gửi tới từ Webhook VietQR
    const channel = supabase
      .channel("realtime-transactions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          console.log("⚡ Có giao dịch mới vừa lưu:", payload.new);
          setTransactions((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-card p-6 rounded-lg border shadow-sm w-full">
      <h2 className="font-bold text-xl mb-4 text-primary flex items-center gap-2">
        💳 Lịch sử giao dịch VietQR (Cập nhật Realtime)
      </h2>

      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa ghi nhận giao dịch nào.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {transactions.map((tx, index) => (
            <div
              key={tx.id || index}
              className="flex justify-between items-center p-3 bg-muted/50 rounded-md border text-sm"
            >
              <div>
                <p className="font-semibold">
                  Mã đơn: <span className="text-blue-600">{tx.order_id}</span>
                </p>
                <p className="text-xs text-muted-foreground">Nội dung: {tx.content}</p>
                {tx.phone && <p className="text-xs text-muted-foreground">SĐT: {tx.phone}</p>}
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">
                  +{Number(tx.amount).toLocaleString("vi-VN")} VNĐ
                </p>
                <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded font-medium mt-1">
                  {tx.status || "Thành công"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}