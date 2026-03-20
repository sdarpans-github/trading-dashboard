import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trading Dashboard",
  description: "Paper trading dashboard — Nifty 50",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#020817", color: "#e2e8f0", fontFamily: "sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
