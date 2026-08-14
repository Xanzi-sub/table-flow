-- ============================================================================
-- Store the Zernio "profile" id used to initiate the WhatsApp connect (OAuth
-- redirect) flow directly from our own Settings page instead of requiring the
-- manager to go set it up in Zernio's own dashboard.
-- ============================================================================

alter table venue_settings add column if not exists zendio_profile_id text;
