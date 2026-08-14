-- ============================================================================
-- Store the Zernio/Zendio WhatsApp account id on venue_settings instead of a
-- hand-typed env var — /staff/marketing can now auto-detect it via the
-- Zernio accounts API instead of the manager copying an id from a dashboard.
-- ============================================================================

alter table venue_settings add column zendio_account_id text;
alter table venue_settings add column zendio_account_label text;
