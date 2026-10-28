# AdWall — website

The public site: a free advertising wall where student sellers and small local
businesses post ads and buyers browse them in one place.

Plain HTML, CSS, and JavaScript. **No build step, no dependencies.** The data layer
is either the visitor's browser (demo mode) or Supabase (shared wall) — see
[`SUPABASE.md`](SUPABASE.md).

```
site/
├── index.html              # the wall
├── 404.html                # fallback page (used by GitHub Pages / Netlify)
├── assets/
│   ├── styles.css          # all styling
│   ├── app.js              # filtering, dialogs, posting, data layer
│   ├── config.js           # Supabase URL + anon key (empty = demo mode)
│   ├── ads.js              # demo ads used when Supabase is not configured
│   └── favicon.svg
├── supabase/
│   ├── schema.sql          # tables, view, functions, storage bucket
│   └── seed.sql            # optional starter ads
├── SUPABASE.md             # 5-minute setup for the shared wall
└── README.md
```

## Run it locally

```bash
cd site
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Opening `index.html` directly with `file://` mostly works too, but serving it is
closer to how it behaves online.

## Two modes

The site decides which mode it is in from `assets/config.js`:

| | Demo mode (no keys) | Shared mode (keys filled in) |
|---|---|---|
| Ads seen by visitors | The 12 in `assets/ads.js` + their own posts | Everything in the database |
| Where a new ad goes | `localStorage` on that device | Postgres, visible to everyone |
| Photos | Compressed and stored as data URLs locally | Uploaded to the `ad-photos` bucket |
| "Yours" badge and delete | Per browser | Per browser, enforced by a device token in the database |
| Offline / no connection | Works | Shows a "could not reach the wall" banner with Retry |

The footer tells you which mode is live, so there is no guessing.

## Editing the demo ads

`assets/ads.js` only matters in demo mode. Copy a block, change the fields, done.
`ageHours` only controls the "posted X ago" label. In shared mode the equivalent
job is done by `supabase/seed.sql`.

## Features

| Feature | Status |
|---|---|
| Browse, search, filter by category, sort by price/date | Works |
| Post an ad with photo, price, description, contact | Works |
| Save ads, share links, deep link `?ad=<id>` | Works |
| Ads visible to other people/devices | With Supabase configured |
| Delete your own ad | Works; server-side check stops others |
| Rate limiting | 5 posts per device per 10 minutes |
| Automatic refresh | On tab focus, and once a minute |

## Deploying for free

Live at <https://resuramor-oss.github.io/adwall/> — this folder is its own git repo.
After editing:

```bash
git add . && git commit -m "update ads" && git push
```

Full comparison of free hosts and step-by-step alternatives: [`../HOSTING.md`](../HOSTING.md).
