// Supabase Edge Function: send-order-receipt
// Fires right after an order is placed. Loads the order + line items + venue
// branding, formats a WhatsApp-friendly receipt, and sends it to the
// customer's phone via the Zernio (Zendio) WhatsApp API.
//
// IMPORTANT: WhatsApp/Meta only allows free-form messages within a 24h window
// of the customer messaging your business number first. Since the customer
// never messages the WhatsApp number directly (they only type it into our
// web app), this first contact must legally use a Meta-approved message
// template, not a plain text broadcast. Create a template (e.g. named
// "order_receipt") in your Zernio/Meta WhatsApp settings with body variables
// matching RECEIPT_TEMPLATE_VARS below, then set ZENDIO_RECEIPT_TEMPLATE to
// its name. Until that's approved, this falls back to a plain text broadcast,
// which will only actually deliver to numbers already inside a 24h window.
//
// Deploy with: supabase functions deploy send-order-receipt

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ZENDIO_API_URL = Deno.env.get("ZENDIO_API_URL") ?? "https://zernio.com/api/v1";
const ZENDIO_API_KEY = Deno.env.get("ZENDIO_API_KEY")!;
// Name of the Meta-approved WhatsApp template used for the very first,
// unsolicited message to a customer (see notice above).
const ZENDIO_RECEIPT_TEMPLATE = Deno.env.get("ZENDIO_RECEIPT_TEMPLATE") ?? "";

async function zendioFetch(path: string, body: unknown) {
  const response = await fetch(`${ZENDIO_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ZENDIO_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Zendio request to ${path} failed: ${await response.text()}`);
  }
  return response.json();
}

function formatCurrency(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function buildReceiptText(params: {
  venueName: string;
  tableNumber: number | null;
  orderId: string;
  items: { name: string; quantity: number; unitPrice: number }[];
  total: number;
}) {
  const shortOrderId = params.orderId.slice(0, 8).toUpperCase();
  const lines = params.items.map(
    (item) =>
      `${item.quantity}x ${item.name} — ${formatCurrency(item.unitPrice * item.quantity)}`
  );

  return [
    `*${params.venueName}*`,
    `Order #${shortOrderId}${params.tableNumber ? ` · Table ${params.tableNumber}` : ""}`,
    "",
    "*Your order:*",
    ...lines,
    "",
    `*Total: ${formatCurrency(params.total)}*`,
    "",
    "Thank you for your order! 🍽️",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), { status: 400 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, tables(table_number), order_items(quantity, unit_price, menu_items(name))")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    }

    let phoneNumber: string | null = null;
    if (order.customer_id) {
      const { data: customer } = await supabase
        .from("customer_profiles")
        .select("phone_number")
        .eq("id", order.customer_id)
        .single();
      phoneNumber = customer?.phone_number ?? null;
    }

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No phone number on this order" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: venue } = await supabase
      .from("venue_settings")
      .select("name, logo_url, zendio_account_id")
      .maybeSingle();

    if (!venue?.zendio_account_id) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No WhatsApp account connected yet" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    type ReceiptRow = {
      quantity: number;
      unit_price: number;
      menu_items: { name: string } | { name: string }[] | null;
    };

    const items = ((order.order_items ?? []) as ReceiptRow[]).map((line) => ({
      name: Array.isArray(line.menu_items)
        ? line.menu_items[0]?.name ?? "Item"
        : line.menu_items?.name ?? "Item",
      quantity: line.quantity,
      unitPrice: line.unit_price,
    }));

    const receiptText = buildReceiptText({
      venueName: venue?.name ?? "Your Order",
      tableNumber: order.tables?.table_number ?? null,
      orderId: order.id,
      items,
      total: order.total_amount,
    });

    if (ZENDIO_RECEIPT_TEMPLATE) {
      // Template send — variables mirror buildReceiptText's fields. Confirm
      // exact param naming against your approved template once created.
      await zendioFetch("/broadcasts", {
        accountId: venue.zendio_account_id,
        name: `Receipt for order ${orderId}`,
        message: {
          type: "template",
          templateName: ZENDIO_RECEIPT_TEMPLATE,
          variables: {
            venue_name: venue?.name ?? "Your Order",
            logo_url: venue?.logo_url ?? "",
            order_number: order.id.slice(0, 8).toUpperCase(),
            total: formatCurrency(order.total_amount),
          },
        },
        recipients: [{ phone: phoneNumber }],
      }).then((res) => zendioFetch(`/broadcasts/${res.broadcast.id}/send`, {}));
    } else {
      const { broadcast } = await zendioFetch("/broadcasts", {
        accountId: venue.zendio_account_id,
        name: `Receipt for order ${orderId}`,
        message: { type: "text", text: receiptText },
      });
      await zendioFetch(`/broadcasts/${broadcast.id}/recipients`, {
        recipients: [{ phone: phoneNumber }],
      });
      await zendioFetch(`/broadcasts/${broadcast.id}/send`, {});
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Receipt delivery failures should never break checkout — log and 200.
    console.error("send-order-receipt failed:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
