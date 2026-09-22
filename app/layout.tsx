import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        {children}
        <Script src="https://example.com/analytics.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}