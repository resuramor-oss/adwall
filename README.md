# AdWall — website

The public site: a free advertising wall where student sellers and small local
businesses post ads and buyers browse them in one place.

Plain HTML, CSS, and JavaScript. **No build step, no dependencies, no backend.**
That is deliberate — it runs on any static host, including the free ones.

```
site/
├── index.html            # the wall
├── 404.html              # fallback page (used by GitHub Pages / Netlify)
├── assets/
│   ├── styles.css        # all styling
│   ├── app.js            # filtering, dialogs, posting, storage
│   ├── ads.js            # the seed ads that show up by default
│   └── favicon.svg
└── README.md
```

## Run it locally

From the folder above `site/`:

```bash
cd site
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Opening `index.html` directly with `file://` mostly works too, but serving it is
closer to how it behaves online.

## Editing the ads

- **Seed ads** (the 12 that ship with the site) live in `assets/ads.js`. Copy a
  block, change the fields, done. `ageHours` only controls the "posted X ago" label.
- **Ads posted on the site** are saved in that browser's `localStorage` under
  `adwall.posts.v1`. They never leave the device.

## How it works right now

| Feature | Status |
|---|---|
| Browse, search, filter by category, sort by price/date | Works |
| Post an ad with photo, price, description, contact | Works (saved in the browser) |
| Save ads, share links, deep link `?ad=<id>` | Works |
| Ads visible to other people/devices | Not yet — needs a backend (see below) |

The "not yet" line is the honest limitation of a static site: there is nowhere to
store a shared list of ads. Two ways out, both free:

1. **Supabase free tier** — Postgres + REST API + image storage. Replace the
   `loadPosts`/`savePosts` functions in `assets/app.js` with fetch calls. This is
   the smallest change that makes the wall genuinely shared.
2. **Google Sheet + Apps Script** — one script publishes a JSON endpoint that the
   site reads, and the post form appends rows. Zero cost, but slower and no images.

For a class demo, the current build is usually enough — the seed ads make the wall
look populated and posting works end to end on one device.

## Deploying for free

Full comparison and step-by-step instructions: [`../HOSTING.md`](../HOSTING.md).
