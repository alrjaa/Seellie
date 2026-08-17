-- F14 — Future advertiser platform schema (NOT APPLIED — design reference only).
-- Run only when ads.seellie.com self-serve portal is built.
-- Current delivery uses app_blobs key `native_ads` (superadmin managed).

/*
create table public.advertiser_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  handle text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertiser_accounts (id) on delete cascade,
  name text not null,
  budget_cents integer,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'ended')),
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- advertisements, ad_assets: link campaigns to creative + placements.
-- RLS: advertiser sees own rows only; users cannot insert campaigns via client.
*/
