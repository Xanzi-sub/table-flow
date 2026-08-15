alter table menu_specials
  drop constraint if exists menu_specials_discount_type_check;

alter table menu_specials
  add constraint menu_specials_discount_type_check
  check (discount_type in ('percentage', 'fixed_price', 'quantity_deal'));

alter table menu_specials
  add column if not exists buy_quantity int not null default 1 check (buy_quantity >= 1),
  add column if not exists pay_quantity int not null default 1 check (pay_quantity >= 1);

alter table menu_specials
  add constraint menu_specials_quantity_deal_valid
  check (
    discount_type <> 'quantity_deal'
    or (kind = 'item_discount' and buy_quantity > pay_quantity)
  );
