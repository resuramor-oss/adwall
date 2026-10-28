# AdWall — website

The public site: a free advertising wall where student sellers and small local
businesses post ads and buyers browse them in one place.

Plain HTML, CSS, and JavaScript with **no build step and no dependencies**. Ads live
in Supabase (Postgres + Storage), so every visitor sees the same wall. Setup and
moderation: [`SUPABASE.md`](SUPABASE.md).

```
site/
├── index.html              # the wall
├── 404.html                # fallback page (used by GitHub Pages / Netlify)
├── assets/
│   ├── styles.css          # all styling
│   ├── app.js              # filtering, dialogs, posting, Supabase calls
│   ├── config.js           # project URL + anon key
│   └── favicon.svg
├── supabase/
│   └── schema.sql          # tables, view, functions, storage bucket
├── SUPABASE.md             # setup, moderation, troubleshooting
└── README.md
```

## Run it locally

```bash
cd site
python3 -m http.server 8000
```

Then open <http://localhost:8000>. It talks to the real database, so anything you
post locally is live for everyone — use the "Delete my ad" button when you're done
testing.

If `assets/config.js` is empty the page shows a setup notice instead of the wall.

## How the data works

| Action | Where it goes |
|---|---|
| Read the wall | `GET /rest/v1/ads_public` — a view that hides owner tokens and `hidden` rows |
| Post an ad | `rpc/create_ad` — validates input, caps a device at 5 posts per 10 minutes |
| Delete your ad | `rpc/delete_ad` — only succeeds with the token that created it |
| Photo | Uploaded to the public `ad-photos` bucket (2 MB cap), compressed in the browser to ~100 KB first |

"Yours" badges and saved ads are remembered in `localStorage` on that device; the
ads themselves are always on the server.

## Features

| Feature | Notes |
|---|---|
| Browse, search, filter by category, sort by price/date | Client-side over the latest 200 ads |
| Post an ad with photo, price, description, contact | Works from any device; appears for everyone |
| Save ads, share links, deep link `?ad=<id>` | Link opens the ad detail dialog directly |
| Delete your own ad | Server-side check stops others |
| Rate limiting | 5 posts per device per 10 minutes |
| Automatic refresh | On tab focus, and once a minute |
| Offline / paused project | Banner explains it, with a Retry button |

## Deploying for free

Live at <https://resuramor-oss.github.io/adwall/> — this folder is its own git repo.
After editing:

```bash
git add . && git commit -m "update" && git push
```

Full comparison of free hosts: [`../HOSTING.md`](../HOSTING.md).
