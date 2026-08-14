import { redirect } from "next/navigation";

// Middleware normally intercepts /q/[qr_identifier] before this ever renders.
// This fallback exists only if middleware is bypassed (e.g. direct RSC fetch).
export default async function QrRedirectPage({
  params,
}: {
  params: Promise<{ qr_identifier: string }>;
}) {
  const { qr_identifier } = await params;
  redirect(`/menu/${qr_identifier}`);
}
