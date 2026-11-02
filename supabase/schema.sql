-- Personal expense & finance tracker: run this once in Supabase SQL Editor.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('Income','Expense','Investment')),
  unique (user_id, name)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('Income','Expense','Investment')),
  account text not null,
  category text not null,
  note text default '',
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);

create table if not exists public.budgets (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  primary key (user_id, category)
);

-- Row level security: every user only sees their own rows
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','transactions','budgets'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Seeds your default accounts and categories on first login (same as your Sheet)
create or replace function public.ensure_defaults()
returns void
language plpgsql
security invoker
as $$
begin
  if exists (select 1 from public.categories where user_id = auth.uid()) then
    return;
  end if;
  insert into public.accounts (name) values ('Bank Account'), ('Credit Card')
    on conflict do nothing;
  insert into public.categories (name, type) values
    ('Salary','Income'),('Freelance','Income'),('Other Income','Income'),('Rent','Income'),
    ('Transport','Expense'),('Dining Out','Expense'),('Personal Care','Expense'),('Shopping','Expense'),
    ('Work expenses','Expense'),('Groceries','Expense'),('Healthcare','Expense'),('Utilities','Expense'),
    ('Entertainment','Expense'),('Other Expense','Expense'),
    ('Small Case','Investment'),('Coin','Investment'),('Zebpay','Investment'),('Kites','Investment'),
    ('Insurance','Investment')
    on conflict do nothing;
end;
$$;
