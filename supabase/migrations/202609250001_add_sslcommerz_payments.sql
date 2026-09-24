-- Apply before deploying the payment API. Existing order fulfillment status is separate.
alter table public.orders
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_transaction_id text,
  add column if not exists payment_token text,
  add column if not exists payment_validation_id text,
  add column if not exists payment_bank_transaction_id text,
  add column if not exists paid_at timestamptz;

create unique index if not exists orders_payment_transaction_id_key on public.orders(payment_transaction_id);
create unique index if not exists orders_payment_token_key on public.orders(payment_token);
create unique index if not exists orders_payment_validation_id_key on public.orders(payment_validation_id);

-- Never allow a browser's direct Supabase write to forge a paid order.
create or replace function public.protect_order_payment_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if TG_OP = 'INSERT' then
      if NEW.payment_status <> 'pending' or NEW.payment_transaction_id is not null
        or NEW.payment_token is not null or NEW.payment_validation_id is not null
        or NEW.payment_bank_transaction_id is not null or NEW.paid_at is not null then
        raise exception 'Payment fields are server-managed';
      end if;
    elsif ROW(NEW.payment_status, NEW.payment_transaction_id, NEW.payment_token,
      NEW.payment_validation_id, NEW.payment_bank_transaction_id, NEW.paid_at)
      is distinct from ROW(OLD.payment_status, OLD.payment_transaction_id, OLD.payment_token,
      OLD.payment_validation_id, OLD.payment_bank_transaction_id, OLD.paid_at) then
      raise exception 'Payment fields are server-managed';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists protect_order_payment_fields on public.orders;
create trigger protect_order_payment_fields before insert or update on public.orders
for each row execute function public.protect_order_payment_fields();
