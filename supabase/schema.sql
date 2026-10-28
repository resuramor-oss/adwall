-- ============================================================================
--  AdWall — Supabase schema
--
--  Paste this whole file into the Supabase dashboard → SQL Editor → New query,
--  then press Run. It is safe to run more than once.
--
--  Design in one paragraph: the `ads` table is never readable by the public.
--  Visitors read the `ads_public` view (which hides the owner token and any
--  hidden rows) and write through two SECURITY DEFINER functions, so nobody can
--  delete someone else's ad or edit the wall directly. Photos live in a public
--  Storage bucket called `ad-photos` with a 2 MB limit.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- table -----

create table if not exists public.ads (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  seller      text        not null,
  category    text        not null,
  price       numeric     not null default 0,
  unit        text        not null default '',
  description text        not null,
  contact     text        not null,
  photo_url   text,
  emoji       text        not null default '🛍️',
  gradient    text        not null default 'linear-gradient(150deg,#dbe7f5,#b9cfe8)',
  owner_token uuid        not null,
  hidden      boolean     not null default false,
  created_at  timestamptz not null default now(),

  constraint ads_title_len       check (char_length(title) between 3 and 60),
  constraint ads_seller_len      check (char_length(seller) between 1 and 40),
  constraint ads_desc_len        check (char_length(description) between 12 and 240),
  constraint ads_contact_len     check (char_length(contact) between 1 and 60),
  constraint ads_category_valid  check (category in ('Food', 'Crafts', 'Fashion', 'Digital', 'Services')),
  constraint ads_price_range     check (price >= 0 and price <= 1000000)
);

create index if not exists ads_created_at_idx on public.ads (created_at desc);
create index if not exists ads_owner_idx      on public.ads (owner_token, created_at desc);

-- Lock the table down. Supabase grants ALL on new public tables to anon by
-- default, so this revoke is not optional.
alter table public.ads enable row level security;
revoke all on public.ads from anon, authenticated;

-- ------------------------------------------------------------------ view -----

-- Owned by postgres, so it bypasses RLS on the table above: that is the only
-- door the public can read through. `hidden = true` is our moderation switch.
create or replace view public.ads_public as
  select id, title, seller, category, price, unit, description, contact,
         photo_url, emoji, gradient, created_at
  from public.ads
  where not hidden;

grant select on public.ads_public to anon, authenticated;

-- ------------------------------------------------------------- functions -----

-- Create an ad. Input is validated here as well as in the browser, and each
-- device token may post at most 5 ads per 10 minutes.
create or replace function public.create_ad(
  p_title       text,
  p_seller      text,
  p_category    text,
  p_price       numeric,
  p_unit        text,
  p_description text,
  p_contact     text,
  p_photo_url   text,
  p_emoji       text,
  p_gradient    text,
  p_token       uuid
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row    public.ads;
  recent     int;
  photo      text := nullif(btrim(coalesce(p_photo_url, '')), '');
begin
  if p_token is null then
    raise exception 'Missing device token';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 60 then
    raise exception 'Title must be 3 to 60 characters';
  end if;
  if char_length(btrim(coalesce(p_seller, ''))) not between 1 and 40 then
    raise exception 'Add your name or shop name';
  end if;
  if p_category not in ('Food', 'Crafts', 'Fashion', 'Digital', 'Services') then
    raise exception 'Pick a valid category';
  end if;
  if p_price is null or p_price < 0 or p_price > 1000000 then
    raise exception 'Price must be between 0 and 1,000,000';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) not between 12 and 240 then
    raise exception 'Description must be 12 to 240 characters';
  end if;
  if char_length(btrim(coalesce(p_contact, ''))) not between 1 and 60 then
    raise exception 'Add a way for buyers to reach you';
  end if;
  if photo is not null and photo !~* '^https?://' then
    raise exception 'Photo must be a web link';
  end if;

  select count(*) into recent
  from public.ads
  where owner_token = p_token and created_at > now() - interval '10 minutes';

  if recent >= 5 then
    raise exception 'You have posted a lot — try again in a few minutes';
  end if;

  insert into public.ads (
    title, seller, category, price, unit, description, contact,
    photo_url, emoji, gradient, owner_token
  ) values (
    btrim(p_title), btrim(p_seller), p_category, round(p_price, 2),
    btrim(coalesce(p_unit, '')), btrim(p_description), btrim(p_contact),
    photo, coalesce(nullif(btrim(p_emoji), ''), '🛍️'),
    coalesce(nullif(btrim(p_gradient), ''), 'linear-gradient(150deg,#dbe7f5,#b9cfe8)'),
    p_token
  )
  returning * into new_row;

  return json_build_object(
    'id', new_row.id,
    'title', new_row.title,
    'seller', new_row.seller,
    'category', new_row.category,
    'price', new_row.price,
    'unit', new_row.unit,
    'description', new_row.description,
    'contact', new_row.contact,
    'photo_url', new_row.photo_url,
    'emoji', new_row.emoji,
    'gradient', new_row.gradient,
    'created_at', new_row.created_at
  );
end;
$$;

-- Delete an ad, but only with the token that created it.
create or replace function public.delete_ad(p_id uuid, p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  if p_token is null then
    return false;
  end if;

  delete from public.ads where id = p_id and owner_token = p_token;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke execute on function public.create_ad(text, text, text, numeric, text, text, text, text, text, text, uuid) from public;
revoke execute on function public.delete_ad(uuid, uuid) from public;
grant execute on function public.create_ad(text, text, text, numeric, text, text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.delete_ad(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------- storage -----

-- Public bucket for ad photos: 2 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-photos', 'ad-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may upload a photo; nobody may list or delete the bucket's contents
-- through the API (there are no policies for those actions).
drop policy if exists "adwall upload ad photos" on storage.objects;
create policy "adwall upload ad photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'ad-photos');
