alter table public.products
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

alter table public.products
  add constraint products_size_stock_object
  check (jsonb_typeof(size_stock) = 'object') not valid;

alter table public.products
  validate constraint products_size_stock_object;

