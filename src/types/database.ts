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
  zendio_account_id: string | null;
  zendio_account_label: string | null;
  zendio_profile_id: string | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  unit_price: number;
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
      customer_profiles: { Row: CustomerProfile; Insert: Partial<CustomerProfile> & { id: string }; Update: Partial<CustomerProfile>; Relationships: [] };
      orders: { Row: Order; Insert: Partial<Order> & { table_id: string; customer_session_id: string; total_amount: number }; Update: Partial<Order>; Relationships: [] };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem> & { order_id: string; menu_item_id: string; quantity: number; unit_price: number }; Update: Partial<OrderItem>; Relationships: [] };
      marketing_campaigns: { Row: MarketingCampaign; Insert: Partial<MarketingCampaign> & { title: string; message_body: string }; Update: Partial<MarketingCampaign>; Relationships: [] };
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
      get_table_waiter_name: { Args: { p_table_id: string }; Returns: string | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

