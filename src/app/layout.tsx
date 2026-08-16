import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TableFlow | Restaurant Operations & Guest Growth",
  description:
    "QR ordering, live restaurant operations, loyalty, marketing and customer intelligence in one connected platform.",
  manifest: "/manifest.webmanifest",
  applicationName: "TableFlow",
  appleWebApp: {
    capable: true,
    title: "TableFlow",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
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