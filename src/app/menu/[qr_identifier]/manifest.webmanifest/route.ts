import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ qr_identifier: string }> }) {
  const { qr_identifier } = await params;
  return NextResponse.json({
    name: "TableFlow Order",
    short_name: "TableFlow",
    description: "View the menu, order and receive live order updates.",
    id: `/menu/${qr_identifier}`,
    start_url: `/menu/${qr_identifier}?source=pwa`,
    scope: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#174c3a",
    icons: [192, 512].map((size) => ({ src: `/icons/icon-${size}.webp`, type: "image/webp", sizes: `${size}x${size}`, purpose: "any maskable" })),
  }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
