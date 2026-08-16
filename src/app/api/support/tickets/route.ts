import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatStaffName } from "@/lib/utils";
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types/database";

const STATUSES = new Set<SupportTicketStatus>(["open", "in_progress", "waiting_on_venue", "resolved", "closed"]);
const PRIORITIES = new Set<SupportTicketPriority>(["low", "normal", "high", "urgent"]);
const CATEGORIES = new Set<SupportTicketCategory>([
  "technical",
  "billing",
  "menu",
  "orders",
  "payments",
  "whatsapp",
  "account",
  "other",
]);

interface SupportIdentity {
  type: "venue" | "support";
  id: string;
  name: string;
}

function validSupportKey(request: Request) {
  const configured = process.env.SUPPORT_API_KEY;
  const authorization = request.headers.get("authorization");
  if (!configured || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7);
  const first = Buffer.from(configured);
  const second = Buffer.from(supplied);
  return first.length === second.length && timingSafeEqual(first, second);
}

async function authenticate(request: Request): Promise<SupportIdentity | null> {
  if (validSupportKey(request)) {
    return {
      type: "support",
      id: request.headers.get("x-support-agent-id") ?? "support-api",
      name: request.headers.get("x-support-agent-name") ?? "TableFlow Support",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role === "waiter") return null;

  return { type: "venue", id: user.id, name: formatStaffName(profile.full_name) };
}

async function ticketPayload(ticketId?: string, options?: { includeInternal?: boolean; since?: string; statuses?: string[] }) {
  const admin = createAdminClient();
  let query = admin.from("support_tickets").select("*").order("updated_at", { ascending: false });
  if (ticketId) query = query.eq("id", ticketId);
  if (options?.since) query = query.gte("updated_at", options.since);
  if (options?.statuses?.length) query = query.in("status", options.statuses);

  const { data: tickets, error } = await query;
  if (error) throw new Error(error.message);
  const ids = (tickets ?? []).map((ticket) => ticket.id);
  if (!ids.length) return [];

  const [{ data: messages }, { data: events }] = await Promise.all([
    admin
      .from("support_ticket_messages")
      .select("*")
      .in("ticket_id", ids)
      .order("created_at"),
    admin
      .from("support_ticket_events")
      .select("*")
      .in("ticket_id", ids)
      .order("created_at"),
  ]);

  return (tickets ?? []).map((ticket) => ({
    ...ticket,
    messages: (messages ?? []).filter(
      (message) => message.ticket_id === ticket.id && (options?.includeInternal || !message.is_internal)
    ),
    events: (events ?? []).filter((event) => event.ticket_id === ticket.id),
  }));
}

export async function GET(request: Request) {
  const identity = await authenticate(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId") ?? undefined;
  const since = url.searchParams.get("since") ?? undefined;
  const statuses = url.searchParams
    .get("status")
    ?.split(",")
    .filter((status) => STATUSES.has(status as SupportTicketStatus));

  try {
    const tickets = await ticketPayload(ticketId, {
      includeInternal: identity.type === "support",
      since,
      statuses,
    });
    return NextResponse.json(ticketId ? tickets[0] ?? null : tickets);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load support tickets" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const identity = await authenticate(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    action?: "create" | "reply";
    ticketId?: string;
    subject?: string;
    description?: string;
    category?: SupportTicketCategory;
    priority?: SupportTicketPriority;
    message?: string;
    isInternal?: boolean;
  };
  const admin = createAdminClient();

  if (body.action === "create") {
    if (identity.type !== "venue") return NextResponse.json({ error: "Only venues create tickets" }, { status: 403 });
    if (!body.subject?.trim() || !body.description?.trim() || !body.category || !CATEGORIES.has(body.category)) {
      return NextResponse.json({ error: "Subject, description and category are required" }, { status: 400 });
    }
    const priority = body.priority && PRIORITIES.has(body.priority) ? body.priority : "normal";
    const { data: venue } = await admin.from("venue_settings").select("id, name").maybeSingle();
    const { data: ticket, error } = await admin
      .from("support_tickets")
      .insert({
        venue_id: venue?.id ?? null,
        venue_name: venue?.name ?? "TableFlow Venue",
        subject: body.subject.trim(),
        description: body.description.trim(),
        category: body.category,
        priority,
        created_by: identity.id,
      })
      .select("*")
      .single();
    if (error || !ticket) return NextResponse.json({ error: error?.message ?? "Could not create ticket" }, { status: 500 });
    await admin.from("support_ticket_events").insert({
      ticket_id: ticket.id,
      event_type: "created",
      actor_type: "venue",
      actor_id: identity.id,
      actor_name: identity.name,
      new_value: ticket.status,
    });
    return NextResponse.json(ticket, { status: 201 });
  }

  if (body.action === "reply") {
    if (!body.ticketId || !body.message?.trim()) {
      return NextResponse.json({ error: "Ticket and message are required" }, { status: 400 });
    }
    const database = identity.type === "support" ? admin : await createClient();
    const { data: message, error } = await database
      .from("support_ticket_messages")
      .insert({
        ticket_id: body.ticketId,
        author_type: identity.type,
        author_staff_id: identity.type === "venue" ? identity.id : null,
        author_name: identity.name,
        body: body.message.trim(),
        is_internal: identity.type === "support" && Boolean(body.isInternal),
      })
      .select("*")
      .single();
    if (error || !message) return NextResponse.json({ error: error?.message ?? "Could not add reply" }, { status: 500 });
    return NextResponse.json(message, { status: 201 });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const identity = await authenticate(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    ticketId?: string;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    externalAssigneeId?: string | null;
    externalAssigneeName?: string | null;
    externalReference?: string | null;
    resolutionSummary?: string | null;
  };
  if (!body.ticketId) return NextResponse.json({ error: "Ticket is required" }, { status: 400 });
  if (body.status && !STATUSES.has(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (body.priority && !PRIORITIES.has(body.priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });

  const admin = createAdminClient();
  const database = identity.type === "support" ? admin : await createClient();
  const updates = {
    ...(body.status ? { status: body.status } : {}),
    ...(body.priority ? { priority: body.priority } : {}),
    ...(identity.type === "support"
      ? {
          ...(body.externalAssigneeId !== undefined ? { external_assignee_id: body.externalAssigneeId } : {}),
          ...(body.externalAssigneeName !== undefined ? { external_assignee_name: body.externalAssigneeName } : {}),
          ...(body.externalReference !== undefined ? { external_reference: body.externalReference } : {}),
          ...(body.resolutionSummary !== undefined ? { resolution_summary: body.resolutionSummary } : {}),
        }
      : {}),
    ...(body.status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    ...(body.status === "closed" ? { closed_at: new Date().toISOString() } : {}),
    ...(body.status === "open" || body.status === "in_progress"
      ? { resolved_at: null, closed_at: null }
      : {}),
  };

  const { data: ticket, error } = await database
    .from("support_tickets")
    .update(updates)
    .eq("id", body.ticketId)
    .select("*")
    .single();
  if (error || !ticket) return NextResponse.json({ error: error?.message ?? "Could not update ticket" }, { status: 500 });

  await admin.from("support_ticket_events").insert({
    ticket_id: ticket.id,
    event_type: "api_update",
    actor_type: identity.type,
    actor_id: identity.id,
    actor_name: identity.name,
    new_value: body.status ?? body.priority ?? "metadata_updated",
  });

  return NextResponse.json(ticket);
}
