-- Create coupons table
create table public.coupons (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  product_name text not null,
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  claimed_at timestamp with time zone,
  claimed_by_email text,
  status text default 'active' check (status in ('active', 'claimed'))
);

-- Enable RLS
alter table public.coupons enable row level security;

-- Create policy to allow authenticated users to view their own claimed coupons
create policy "Users can view their own coupons"
  on public.coupons for select
  using (auth.jwt() ->> 'email' = claimed_by_email);

-- Create policy to allow service role (Edge Function) to manage all coupons
-- (Service role bypasses RLS, but good to be explicit if we add other roles)
