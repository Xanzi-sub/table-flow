alter table orders
  add column client_request_id uuid;

create unique index orders_customer_request_unique
  on orders(customer_session_id, client_request_id)
  where client_request_id is not null;
