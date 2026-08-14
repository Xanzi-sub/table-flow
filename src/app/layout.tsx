import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TableFlow — QR Ordering & Loyalty",
  description: "QR-code table ordering, staff operations, and WhatsApp loyalty platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}