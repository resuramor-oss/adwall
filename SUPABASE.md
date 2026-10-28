# Turning on the shared wall (Supabase)

Out of the box the site runs in **demo mode**: ads are saved in the visitor's own
browser, so nobody else sees them. Connecting Supabase makes the wall real — every
visitor reads the same list, and photos go to cloud storage.

It takes about five minutes, and it stays inside the free tier.

---

## 1. Create the project

1. Go to <https://supabase.com> and sign in (GitHub login works).
2. **New project** → name it `adwall`, pick the region closest to you
   (Singapore for the Philippines), and let it generate a database password.
   Save that password somewhere; you will not need it for this project, but you
   will want it if you ever connect with `psql`.
3. Wait ~2 minutes while the database provisions.

## 2. Create the tables

1. In the dashboard, open **SQL Editor → New query**.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**.
3. You should see "Success. No rows returned". If you see an error, paste it back
   into the chat — do not run only part of the file, the pieces depend on each other.

Then, optionally, run [`supabase/seed.sql`](supabase/seed.sql) the same way to
pre-fill the wall with the 12 demo ads.

What the schema builds:

| Object | Purpose |
|---|---|
| `ads` table | The source of truth. Locked to the public — no direct read or write |
| `ads_public` view | What the site reads: hides `owner_token` and any `hidden` rows |
| `create_ad(...)` | Validates and inserts an ad, max 5 per device per 10 minutes |
| `delete_ad(id, token)` | Deletes only if the device token matches the one that posted |
| `ad-photos` bucket | Public read, anonymous upload, 2 MB cap, images only |

## 3. Copy the two keys into the site

Dashboard → **Project Settings → API**. You need:

- **Project URL** — looks like `https://abcdefghijkl.supabase.co`
- **anon / public** key — the long `eyJ...` string

Open [`assets/config.js`](assets/config.js) and fill them in:

```js
window.ADWALL_CONFIG = {
  supabaseUrl: "https://abcdefghijkl.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
  table: "ads_public",
  storageBucket: "ad-photos"
};
```

> The **anon key is designed to be public** — it ships in every Supabase web app.
> The `service_role` key is the dangerous one. Never put that one in this file, and
> never commit it anywhere.

## 4. Deploy

```bash
cd site
git add . && git commit -m "connect Supabase" && git push
```

GitHub Pages redeploys in about a minute. Open the live site: if the footer says
**"Shared wall: ads you post are live for everyone"**, it worked. Post an ad from
your phone and check it appears on your laptop.

## 5. Moderating

Everything is done in the dashboard, no code:

- **Hide an ad:** Table Editor → `ads` → set `hidden` to `true`. It disappears from
  the site immediately (the view filters it) but stays in the database.
- **Delete an ad:** same screen → delete the row. The photo stays in Storage;
  remove it under Storage → `ad-photos` if you care about the space.
- **Delete all the seed ads:** `delete from public.ads where owner_token =
  '00000000-0000-4000-8000-000000000000';`
- **Lift the per-device rate limit:** edit the `recent >= 5` line in `create_ad`.

## What the free tier means here

| Limit | Free tier | What it means for AdWall |
|---|---|---|
| Database | 500 MB | Roughly 100,000+ ads at ~4 KB each |
| Storage | 1 GB | ~500 photos at the 2 MB cap (most compress to ~100 KB) |
| Bandwidth | 5 GB/mo | A few thousand wall loads |
| **Inactivity** | **Projects pause after ~1 week with no traffic** | The site will show the "could not reach the wall" banner. Log in and press **Restore**. Data is not lost — but for a demo day, open the site the same morning |
| Backups | 7 days on paid plans only | Export the table if you care about the demo data |

## Is it safe to leave open like this?

For a class project, yes — with these honest caveats:

- **Anyone can post.** There is no account system, so a stranger who finds the URL
  can add an ad. The rate limit (5 per 10 minutes per browser) and the 240-character
  cap keep it from being catastrophic, but it is not spam-proof. The `hidden` flag
  is your delete button.
- **Photos are public** once uploaded. Do not post anything you would not put on a
  classroom wall.
- **Anyone can upload to the bucket.** The bucket only accepts images under 2 MB,
  but nothing cleans up abandoned uploads. If that becomes a problem, add
  authentication or move uploads behind an edge function.
- **Deleting is protected by a per-browser token**, not by a password. If someone
  clears their browser data, they lose the ability to delete their own old ads —
  they can ask you to remove it from the dashboard.
- **There is no profanity filter.** Add one on the client side, or moderate manually.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Footer still says "Demo mode" | `config.js` was not saved, or the browser cached the old file. Hard-reload (Ctrl+Shift+R) |
| "Could not reach the wall: Failed to fetch" | Wrong `supabaseUrl`, project paused, or no internet |
| `401` / "Invalid API key" | You pasted the wrong key, or a truncated one |
| `permission denied for table ads` | You are calling the table instead of the view/functions — re-run `schema.sql` |
| `new row violates row-level security policy` | The `create_ad` function was not created (SQL file partially run) |
| Photo upload fails | Bucket `ad-photos` missing, file over 2 MB, or the schema was run before the bucket insert |
| Ads appear but everyone's says "Yours" | Only possible if `adwall.myids.v1` was copied between browsers — clear site data |

To go back to demo mode, empty the two strings in `config.js` and redeploy.
