-- =============================================
-- TRADEIX — Supabase Database Schema
-- הרץ את הקוד הזה ב Supabase > SQL Editor
-- =============================================

-- Enable RLS (Row Level Security)
-- כל משתמש יראה רק את הנתונים שלו

-- ── PROFILES ──
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  language text default 'he',
  theme text default 'dark',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── PORTFOLIOS ──
create table if not exists public.portfolios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  market_type text default 'forex' check (market_type in ('forex','stocks','crypto','commodities','other')),
  initial_capital numeric default 0,
  currency text default 'USD',
  created_at timestamptz default now()
);

alter table public.portfolios enable row level security;

create policy "Users can manage own portfolios"
  on public.portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── TRADES ──
create table if not exists public.trades (
  id uuid default gen_random_uuid() primary key,
  portfolio_id uuid references public.portfolios on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  symbol text not null,
  direction text not null check (direction in ('long','short')),
  entry_price numeric not null,
  stop_loss numeric not null,
  take_profit numeric not null,
  pnl numeric default 0,
  rr_ratio numeric default 0,
  outcome text check (outcome in ('win','loss','breakeven')),
  image_url text,
  ai_analysis text,
  notes text,
  traded_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.trades enable row level security;

create policy "Users can manage own trades"
  on public.trades for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── STORAGE BUCKETS ──
-- צור את הבאקטים האלה ב Supabase > Storage:
-- 1. "trade-images" — public
-- 2. "avatars" — public

insert into storage.buckets (id, name, public)
values ('trade-images', 'trade-images', true)
on conflict do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

-- Storage policies
create policy "Anyone can view trade images"
  on storage.objects for select
  using (bucket_id = 'trade-images');

create policy "Users can upload own trade images"
  on storage.objects for insert
  with check (bucket_id = 'trade-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

create policy "Users can update avatars"
  on storage.objects for update
  using (bucket_id = 'avatars');

-- ─────────────────────────────────────────────
-- TRADER LOCKER — broker connections + lock state
-- ─────────────────────────────────────────────
create table if not exists public.broker_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  portfolio_id uuid,
  broker text not null check (broker in ('tradovate','rithmic','mt5','ftmo')),
  account_label text,
  encrypted_credentials text not null,
  daily_loss_limit numeric default 0,
  per_trade_loss_limit numeric default 0,
  status text default 'active' check (status in ('active','locked','disabled')),
  locked_at timestamptz,
  locked_reason text,
  daily_realized_pnl numeric default 0,
  last_check_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.broker_connections enable row level security;

drop policy if exists "Users manage own broker connections" on public.broker_connections;
create policy "Users manage own broker connections"
  on public.broker_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.broker_lock_events (
  id uuid default gen_random_uuid() primary key,
  connection_id uuid references public.broker_connections on delete cascade not null,
  event text not null check (event in ('locked','unlocked','check','error')),
  realized_pnl numeric,
  message text,
  created_at timestamptz default now()
);

alter table public.broker_lock_events enable row level security;

drop policy if exists "Users view own lock events" on public.broker_lock_events;
create policy "Users view own lock events"
  on public.broker_lock_events for select
  using (auth.uid() = (select user_id from public.broker_connections where id = broker_lock_events.connection_id));
