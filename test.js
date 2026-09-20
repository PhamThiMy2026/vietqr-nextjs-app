async function testWebhook() {
  console.log("🚀 Đang gửi request tới http://127.0.0.1:3000/api/webhook/vietqr...");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('http://127.0.0.1:3000/api/webhook/vietqr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 100000,
        content: "Thanh toan don hang DH001",
        referenceCode: "DH001",
        phone: "0987654321"
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log("📍 Mã trạng thái HTTP:", response.status);
    const data = await response.json();
    console.log("✅ KẾT QUẢ:", data);

  } catch (error) {
    clearTimeout(timeoutId);
    console.error("❌ Lỗi kết nối:", error.message);
  }
}

testWebhook();