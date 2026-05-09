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


-- Lemon Squeezy billing fields
alter table public.profiles
  add column if not exists subscription_tier text default 'free',
  add column if not exists subscription_status text default 'free',
  add column if not exists lemon_squeezy_customer_id text,
  add column if not exists lemon_squeezy_order_id text,
  add column if not exists lemon_squeezy_subscription_id text,
  add column if not exists lemon_squeezy_product_id text,
  add column if not exists lemon_squeezy_variant_id text,
  add column if not exists lemon_squeezy_customer_portal_url text,
  add column if not exists lemon_squeezy_update_payment_url text,
  add column if not exists subscription_renews_at timestamptz,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists subscription_trial_ends_at timestamptz,
  add column if not exists subscription_updated_at timestamptz;
