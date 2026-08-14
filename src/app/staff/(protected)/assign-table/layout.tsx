import { redirect } from "next/navigation";
import { requireStaffProfile } from "@/lib/get-staff-profile";

/** Binding/creating tables is manager/admin only — a waiter hitting this URL directly bounces to their dashboard. */
export default async function AssignTableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireStaffProfile();
  if (profile.role === "waiter") redirect("/staff/dashboard");

  return children;
}
