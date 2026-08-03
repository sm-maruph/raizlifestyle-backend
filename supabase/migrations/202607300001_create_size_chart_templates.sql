create extension if not exists pgcrypto;

create table if not exists public.size_chart_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  title text not null default 'Size chart',
  note text not null default 'Expected deviation < 3%',
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint size_chart_columns_array check (jsonb_typeof(columns) = 'array'),
  constraint size_chart_rows_array check (jsonb_typeof(rows) = 'array')
);

alter table public.size_chart_templates enable row level security;

grant all on public.size_chart_templates to service_role;
revoke all on public.size_chart_templates from anon, authenticated;

alter table public.products
  add column if not exists size_chart_id uuid
  references public.size_chart_templates(id)
  on delete set null;

create index if not exists products_size_chart_id_idx
  on public.products(size_chart_id);

