// Hand-authored types mirroring supabase/migrations/0001_init.sql.
// Regenerate/replace with `supabase gen types typescript` once the project is linked.

export type UserRole = "admin" | "manager" | "waiter";
export type TableStatus = "vacant" | "dining" | "awaiting_bill" | "paid";
export type MenuItemStatus = "draft" | "live" | "archived";
export type MenuItemSource = "manual" | "scanned";
export type ScanJobStatus =
  | "uploaded"
  | "processing"
  | "needs_review"
  | "published"
  | "failed";
export type OrderStatus =
  | "pending"
  | "preparing"
  | "served"
  | "completed"
  | "cancelled";
export type PaymentStatus = "unpaid" | "portal_processing" | "paid";
export type PaymentMethod = "cash" | "speedpoint" | "online_portal";
export type StaffNotificationType = "new_order" | "waiter_call" | "bill_requested" | "order_cancelled" | "table_assigned" | "manager_message" | "unassigned_order";

export interface StaffDevice {
  id: string;
  staff_id: string;
  venue_id: string | null;
  platform: "android" | "ios" | "web";
  push_token: string;
  device_identifier: string;
  app_version: string | null;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface StaffNotification {
  id: string;
  venue_id: string | null;
  recipient_staff_id: string;
  type: StaffNotificationType;
  title: string;
  body: string;
  table_id: string | null;
  order_id: string | null;
  metadata: Record<string, unknown>;
  event_key: string;
  read_at: string | null;
  created_at: string;
}

export interface TableServiceRequest {
  id: string;
  table_id: string;
  order_id: string;
  customer_session_id: string;
  request_type: "waiter_call" | "bill_requested";
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface StaffProfile {
  id: string;
  full_name: string;
  role: UserRole;
  is_checked_in: boolean;
  current_assigned_sections: number[];
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface VenueSettings {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  vat_percentage: number;
  tip_percentage: number;
  loyalty_points_per_rand: number;
  loyalty_reward_threshold: number;
  loyalty_reward_value: number;
  zendio_account_id: string | null;
  zendio_account_label: string | null;
  zendio_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  customer_id: string;
  order_id: string | null;
  points: number;
  entry_type: "earned" | "redeemed" | "adjustment";
  description: string | null;
  created_at: string;
}

export type FeedbackRecoveryStatus = "open" | "contacted" | "resolved";

export interface OrderFeedback {
  id: string;
  order_id: string;
  customer_id: string;
  table_id: string | null;
  waiter_id: string | null;
  rating: number;
  comment: string | null;
  recovery_status: FeedbackRecoveryStatus;
  recovery_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export type SupportTicketCategory = "technical" | "billing" | "menu" | "orders" | "payments" | "whatsapp" | "account" | "other";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";
export type SupportTicketStatus = "open" | "in_progress" | "waiting_on_venue" | "resolved" | "closed";

export interface SupportTicket {
  id: string;
  ticket_number: string;
  venue_id: string | null;
  venue_name: string;
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  created_by: string | null;
  external_assignee_id: string | null;
  external_assignee_name: string | null;
  external_reference: string | null;
  resolution_summary: string | null;
  last_reply_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  author_type: "venue" | "support" | "system";
  author_staff_id: string | null;
  author_name: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface SupportTicketEvent {
  id: string;
  ticket_id: string;
  event_type: string;
  actor_type: "venue" | "support" | "system";
  actor_id: string | null;
  actor_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface StaffInvite {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  invited_by: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface TableRow {
  id: string;
  qr_identifier: string;
  table_number: number | null;
  section: string | null;
  status: TableStatus;
  current_waiter_id: string | null;
  service_requested_at: string | null;
  updated_at: string;
}

export interface MenuCategoryGroup {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  group_id: string | null;
}

export interface MenuScanJob {
  id: string;
  uploaded_by: string | null;
  image_urls: string[];
  status: ScanJobStatus;
  raw_ai_output: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  status: MenuItemStatus;
  source: MenuItemSource;
  scan_confidence: number | null;
  scan_job_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type MenuSpecialKind = "item_discount" | "combo";
export type MenuSpecialDiscountType = "percentage" | "fixed_price" | "quantity_deal";

export interface MenuSpecial {
  id: string;
  name: string;
  description: string | null;
  kind: MenuSpecialKind;
  item_ids: string[];
  discount_type: MenuSpecialDiscountType;
  discount_value: number;
  applicable_quantity: number;
  buy_quantity: number;
  pay_quantity: number;
  status: MenuItemStatus;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile {
  id: string;
  phone_number: string | null;
  full_name: string | null;
  loyalty_points: number;
  whatsapp_opt_in: boolean;
  consent_timestamp: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  table_id: string;
  waiter_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  customer_session_id: string;
  customer_id: string | null;
  total_amount: number;
  tip_amount: number;
  tip_cashout_request_id: string | null;
  loyalty_points_redeemed: number;
  loyalty_discount_amount: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  unit_price: number;
  bundle_id: string | null;
  special_id: string | null;
  special_name: string | null;
}

export interface MarketingCampaign {
  id: string;
  title: string;
  message_body: string;
  total_recipients: number;
  status: string;
  created_by: string | null;
  created_at: string;
}

export type TipCashoutStatus = "pending" | "scheduled" | "approved" | "rejected";

export interface TipCashoutRequest {
  id: string;
  waiter_id: string;
  amount: number;
  status: TipCashoutStatus;
  scheduled_for: string | null;
  notes: string | null;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface Database {
  public: {
    Tables: {
      staff_profiles: { Row: StaffProfile; Insert: Partial<StaffProfile> & { id: string; full_name: string }; Update: Partial<StaffProfile>; Relationships: [] };
      tables: { Row: TableRow; Insert: Partial<TableRow> & { qr_identifier: string }; Update: Partial<TableRow>; Relationships: [] };
      menu_categories: { Row: MenuCategory; Insert: Partial<MenuCategory> & { name: string }; Update: Partial<MenuCategory>; Relationships: [] };
      menu_category_groups: { Row: MenuCategoryGroup; Insert: Partial<MenuCategoryGroup> & { name: string }; Update: Partial<MenuCategoryGroup>; Relationships: [] };
      menu_scan_jobs: { Row: MenuScanJob; Insert: Partial<MenuScanJob> & { image_urls: string[] }; Update: Partial<MenuScanJob>; Relationships: [] };
      menu_items: { Row: MenuItem; Insert: Partial<MenuItem> & { name: string; price: number }; Update: Partial<MenuItem>; Relationships: [] };
      menu_specials: { Row: MenuSpecial; Insert: Partial<MenuSpecial> & { name: string; kind: MenuSpecialKind; item_ids: string[]; discount_type: MenuSpecialDiscountType; discount_value: number }; Update: Partial<MenuSpecial>; Relationships: [] };
      customer_profiles: { Row: CustomerProfile; Insert: Partial<CustomerProfile> & { id: string }; Update: Partial<CustomerProfile>; Relationships: [] };
      orders: { Row: Order; Insert: Partial<Order> & { table_id: string; customer_session_id: string; total_amount: number }; Update: Partial<Order>; Relationships: [] };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem> & { order_id: string; menu_item_id: string; quantity: number; unit_price: number }; Update: Partial<OrderItem>; Relationships: [] };
      marketing_campaigns: { Row: MarketingCampaign; Insert: Partial<MarketingCampaign> & { title: string; message_body: string }; Update: Partial<MarketingCampaign>; Relationships: [] };
      loyalty_ledger: { Row: LoyaltyLedgerEntry; Insert: Partial<LoyaltyLedgerEntry> & { customer_id: string; points: number }; Update: Partial<LoyaltyLedgerEntry>; Relationships: [] };
      order_feedback: { Row: OrderFeedback; Insert: Partial<OrderFeedback> & { order_id: string; customer_id: string; rating: number }; Update: Partial<OrderFeedback>; Relationships: [] };
      support_tickets: { Row: SupportTicket; Insert: Partial<SupportTicket> & { venue_name: string; subject: string; description: string; category: SupportTicketCategory; created_by: string }; Update: Partial<SupportTicket>; Relationships: [] };
      support_ticket_messages: { Row: SupportTicketMessage; Insert: Partial<SupportTicketMessage> & { ticket_id: string; author_type: SupportTicketMessage["author_type"]; author_name: string; body: string }; Update: Partial<SupportTicketMessage>; Relationships: [] };
      support_ticket_events: { Row: SupportTicketEvent; Insert: Partial<SupportTicketEvent> & { ticket_id: string; event_type: string; actor_type: SupportTicketEvent["actor_type"] }; Update: Partial<SupportTicketEvent>; Relationships: [] };
      staff_devices: { Row: StaffDevice; Insert: Partial<StaffDevice> & { staff_id: string; platform: StaffDevice["platform"]; push_token: string; device_identifier: string }; Update: Partial<StaffDevice>; Relationships: [] };
      staff_notifications: { Row: StaffNotification; Insert: Partial<StaffNotification> & { recipient_staff_id: string; type: StaffNotificationType; title: string; body: string; event_key: string }; Update: Partial<StaffNotification>; Relationships: [] };
      table_service_requests: { Row: TableServiceRequest; Insert: Partial<TableServiceRequest> & { table_id: string; order_id: string; customer_session_id: string; request_type: TableServiceRequest["request_type"] }; Update: Partial<TableServiceRequest>; Relationships: [] };
      tip_cashout_requests: { Row: TipCashoutRequest; Insert: Partial<TipCashoutRequest> & { waiter_id: string; amount: number }; Update: Partial<TipCashoutRequest>; Relationships: [] };
      venue_settings: { Row: VenueSettings; Insert: Partial<VenueSettings> & { name: string }; Update: Partial<VenueSettings>; Relationships: [] };
      staff_invites: { Row: StaffInvite; Insert: Partial<StaffInvite> & { email: string; full_name: string }; Update: Partial<StaffInvite>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      assign_next_waiter: { Args: Record<string, never>; Returns: string | null };
      claim_staff_invite: { Args: { p_user_id: string; p_email: string }; Returns: StaffProfile };
      assign_table: {
        Args: {
          p_qr_identifier: string;
          p_table_number: number;
          p_section?: string | null;
          p_waiter_id?: string | null;
        };
        Returns: TableRow;
      };
      get_order_status: {
        Args: { p_order_id: string; p_session_id: string };
        Returns: Record<string, unknown> | null;
      };
      staff_profiles_is_empty: { Args: Record<string, never>; Returns: boolean };
      request_table_service: { Args: { p_table_id: string }; Returns: undefined };
      request_table_assistance: { Args: { p_table_id: string; p_request_type: "waiter_call" | "bill_requested" }; Returns: string };
      resolve_table_service_requests: { Args: { p_table_id: string }; Returns: undefined };
      get_table_waiter_name: { Args: { p_table_id: string }; Returns: string | null };
      mark_order_paid_with_loyalty: {
        Args: { p_order_id: string; p_method: PaymentMethod; p_tip_amount?: number };
        Returns: undefined;
      };
      apply_loyalty_redemption: {
        Args: { p_order_id: string; p_points: number };
        Returns: number;
      };
      consume_rate_limit: {
        Args: {
          p_scope: string;
          p_identifier_hash: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: Array<{ allowed: boolean; remaining: number; retry_after_seconds: number }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

