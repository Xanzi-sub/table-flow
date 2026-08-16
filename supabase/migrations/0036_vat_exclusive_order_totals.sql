alter table orders
  add column subtotal_amount numeric,
  add column vat_percentage_snapshot numeric,
  add column vat_amount numeric;

alter table orders
  add constraint orders_subtotal_amount_nonnegative
    check (subtotal_amount is null or subtotal_amount >= 0) not valid,
  add constraint orders_vat_percentage_snapshot_range
    check (vat_percentage_snapshot is null or vat_percentage_snapshot between 0 and 100) not valid,
  add constraint orders_vat_amount_nonnegative
    check (vat_amount is null or vat_amount >= 0) not valid;

comment on column orders.subtotal_amount is
  'VAT-exclusive menu/special subtotal before loyalty. Null on legacy VAT-inclusive orders.';
comment on column orders.vat_percentage_snapshot is
  'Venue VAT rate captured when the order was submitted.';
comment on column orders.vat_amount is
  'VAT charged on subtotal_amount when the order was submitted.';
