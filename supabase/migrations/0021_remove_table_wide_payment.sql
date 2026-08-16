-- Payment is now strictly order-scoped. Remove the obsolete endpoint so no
-- future client can accidentally mark every open order at a table paid.
drop function if exists mark_table_paid_with_loyalty(uuid, payment_method, numeric);
