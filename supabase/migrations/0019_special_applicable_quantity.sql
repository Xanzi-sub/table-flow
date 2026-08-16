alter table menu_specials
  add column if not exists applicable_quantity int not null default 1 check (applicable_quantity >= 1);

-- Existing buy/pay deals already encode their package size in buy_quantity.
update menu_specials
set applicable_quantity = buy_quantity
where discount_type = 'quantity_deal';
