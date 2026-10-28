/* AdWall — front-end logic
 *
 * Two modes, chosen automatically from assets/config.js:
 *
 *   shared  Supabase is configured. Ads live in Postgres, photos in Storage, and
 *           everyone sees the same wall. Reads go through the ads_public view;
 *           writes go through the create_ad / delete_ad functions.
 *
 *   local   No credentials. Ads are stored in this browser only, seeded with the
 *           demo list in assets/ads.js. Handy for showing the wall offline.
 */

(() => {
  "use strict";

  const CFG = window.ADWALL_CONFIG || {};
  const BASE = String(CFG.supabaseUrl || "").trim().replace(/\/+$/, "");
  const KEY = String(CFG.supabaseKey || "").trim();
  const TABLE = CFG.table || "ads_public";
  const BUCKET = CFG.storageBucket || "ad-photos";
  const SHARED = /^https?:\/\//i.test(BASE) && KEY.length > 20;

  const LS = {
    posts: "adwall.posts.v1",
    saved: "adwall.saved.v1",
    owner: "adwall.owner.v1",
    mine: "adwall.myids.v1"
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const grid = $("#grid");
  const empty = $("#empty");
  const countEl = $("#result-count");
  const searchEl = $("#search");
  const sortEl = $("#sort");
  const postDialog = $("#post-dialog");
  const adDialog = $("#ad-dialog");
  const adBody = $("#ad-body");
  const form = $("#post-form");
  const formError = $("#form-error");
  const toastEl = $("#toast");
  const noticeEl = $("#notice");
  const storageNote = $("#storage-note");

  const state = { q: "", cat: "all", sort: "newest", ads: [], loading: true, error: null };
  let saved = loadSaved();
  let lastFetch = 0;

  /* ---------------------------------------------------------------- storage */

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      if (SHARED) return; // not fatal: the wall itself is on the server
      toast("This browser is blocking storage, so your post won't be saved.");
    }
  }

  function loadSaved() {
    const ids = readJSON(LS.saved, []);
    return new Set(Array.isArray(ids) ? ids : []);
  }

  function persistSaved() {
    writeJSON(LS.saved, Array.from(saved));
  }

  function ownerToken() {
    let token = localStorage.getItem(LS.owner);
    if (token && /^[0-9a-f-]{36}$/i.test(token)) return token;
    token = crypto.randomUUID();
    try { localStorage.setItem(LS.owner, token); } catch { /* private mode */ }
    return token;
  }

  function myIds() {
    const ids = readJSON(LS.mine, []);
    return new Set(Array.isArray(ids) ? ids : []);
  }

  function addMyId(id) {
    const ids = myIds();
    ids.add(id);
    writeJSON(LS.mine, Array.from(ids));
  }

  function removeMyId(id) {
    const ids = myIds();
    ids.delete(id);
    writeJSON(LS.mine, Array.from(ids));
  }

  /* ------------------------------------------------------------------- data */

  const CATEGORY_STYLE = {
    Food: { emoji: "🍽️", gradient: "linear-gradient(150deg,#fde9c9,#f6cf9a)" },
    Crafts: { emoji: "🎨", gradient: "linear-gradient(150deg,#fbe5d6,#f3c3ab)" },
    Fashion: { emoji: "👗", gradient: "linear-gradient(150deg,#f5dfe8,#e8bccf)" },
    Digital: { emoji: "💾", gradient: "linear-gradient(150deg,#e3e0f7,#c7c0ee)" },
    Services: { emoji: "🛠️", gradient: "linear-gradient(150deg,#dbe7f5,#b9cfe8)" }
  };

  function localAds() {
    const now = Date.now();
    const seeds = (window.SEED_ADS || []).map((ad) => ({
      ...ad,
      createdAt: now - (ad.ageHours || 0) * 36e5,
      mine: false
    }));
    const mine = readJSON(LS.posts, []);
    return (Array.isArray(mine) ? mine.map((ad) => ({ ...ad, mine: true })) : []).concat(seeds);
  }

  function fromRow(row) {
    return {
      id: row.id,
      title: row.title,
      seller: row.seller,
      category: row.category,
      price: Number(row.price),
      unit: row.unit || "",
      description: row.description,
      contact: row.contact,
      photo: row.photo_url || "",
      emoji: row.emoji || "",
      gradient: row.gradient || "",
      createdAt: Date.parse(row.created_at) || Date.now(),
      mine: myIds().has(row.id)
    };
  }

  async function listAds() {
    if (!SHARED) return localAds();
    const rows = await api(`/rest/v1/${TABLE}?select=*&order=created_at.desc&limit=200`);
    return (Array.isArray(rows) ? rows : []).map(fromRow);
  }

  async function createAd(input, photoBlob) {
    if (!SHARED) {
      const ad = {
        ...input,
        id: `post-${Date.now()}`,
        photo: photoBlob ? await blobToDataUrl(photoBlob) : input.photo || "",
        createdAt: Date.now(),
        mine: true
      };
      const posts = readJSON(LS.posts, []);
      posts.unshift(ad);
      writeJSON(LS.posts, Array.isArray(posts) ? posts : [ad]);
      return ad;
    }

    const photoUrl = photoBlob ? await uploadPhoto(photoBlob) : input.photo || "";
    const row = await api("/rest/v1/rpc/create_ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_title: input.title,
        p_seller: input.seller,
        p_category: input.category,
        p_price: input.price,
        p_unit: input.unit || "",
        p_description: input.description,
        p_contact: input.contact,
        p_photo_url: photoUrl || null,
        p_emoji: input.emoji,
        p_gradient: input.gradient,
        p_token: ownerToken()
      })
    });

    const ad = fromRow(Array.isArray(row) ? row[0] : row);
    ad.mine = true;
    addMyId(ad.id);
    return ad;
  }

  async function deleteAd(id) {
    if (!SHARED) {
      const posts = readJSON(LS.posts, []);
      writeJSON(LS.posts, posts.filter((post) => post.id !== id));
      return;
    }
    const ok = await api("/rest/v1/rpc/delete_ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: id, p_token: ownerToken() })
    });
    if (ok !== true) throw new Error("That ad was posted from another device, so it can't be deleted here.");
    removeMyId(id);
  }

  /* --------------------------------------------------------- supabase REST */

  function api(path, options = {}) {
    return fetch(BASE + path, {
      ...options,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        ...(options.headers || {})
      }
    }).then(async (res) => {
      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          message = body.message || body.error_description || body.hint || message;
        } catch { /* not JSON */ }
        throw new Error(message);
      }
      if (res.status === 204) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    });
  }

  async function uploadPhoto(blob) {
    const path = `${crypto.randomUUID()}.jpg`;
    const res = await fetch(`${BASE}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "false"
      },
      body: blob
    });
    if (!res.ok) throw new Error("The photo could not be uploaded. Try posting without it.");
    return `${BASE}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  /* ----------------------------------------------------------------- helpers */

  function peso(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "₱—";
    return "₱" + n.toLocaleString("en-PH");
  }

  function timeAgo(ts) {
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  function safeImage(src) {
    if (typeof src !== "string") return "";
    return /^(https?:\/\/|data:image\/)/i.test(src.trim()) ? src.trim() : "";
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key === "style") node.setAttribute("style", value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2), value);
      } else node.setAttribute(key, value);
    }
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      if (child === null || child === undefined) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-visible");
      setTimeout(() => { toastEl.hidden = true; }, 220);
    }, 2600);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = el("textarea", { style: "position:fixed;opacity:0" });
      area.value = text;
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    }
  }

  /* ---------------------------------------------------------------- filtering */

  function matches(ad) {
    if (state.cat !== "all" && ad.category !== state.cat) return false;
    if (!state.q) return true;
    const haystack = [ad.title, ad.seller, ad.description, ad.category, ad.unit]
      .join(" ")
      .toLowerCase();
    return state.q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => haystack.includes(word));
  }

  function compare(a, b) {
    switch (state.sort) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "price-low":
        return Number(a.price) - Number(b.price);
      case "price-high":
        return Number(b.price) - Number(a.price);
      default:
        return b.createdAt - a.createdAt;
    }
  }

  /* ------------------------------------------------------------------ render */

  function card(ad) {
    const media = el("div", {
      class: "card-media",
      style: `--g1:${ad.gradient || CATEGORY_STYLE[ad.category]?.gradient || "#eef2f5"}`
    });
    const photo = safeImage(ad.photo);
    if (photo) media.append(el("img", { src: photo, alt: "", loading: "lazy" }));
    else media.append(el("span", { text: ad.emoji || CATEGORY_STYLE[ad.category]?.emoji || "🛍️" }));

    media.append(el("span", { class: "card-cat", text: ad.category }));

    const save = el("button", {
      class: "save-btn" + (saved.has(ad.id) ? " is-saved" : ""),
      type: "button",
      "aria-label": saved.has(ad.id) ? `Remove ${ad.title} from saved` : `Save ${ad.title}`,
      "aria-pressed": String(saved.has(ad.id)),
      html: heartIcon(saved.has(ad.id))
    });
    save.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSaved(ad.id);
    });
    media.append(save);

    if (ad.mine) media.append(el("span", { class: "badge-mine", text: "Yours" }));

    const body = el("div", { class: "card-body" }, [
      el("h3", { class: "card-title", text: ad.title }),
      el("p", { class: "card-seller", text: ad.seller }),
      el("div", { class: "card-foot" }, [
        el("p", { class: "price" }, [
          peso(ad.price),
          ad.unit ? el("small", { text: ad.unit }) : null
        ]),
        el("span", { class: "time", text: timeAgo(ad.createdAt) })
      ])
    ]);

    const cardEl = el("button", {
      class: "card",
      type: "button",
      "data-id": ad.id,
      "aria-label": `${ad.title} by ${ad.seller}, ${peso(ad.price)}`
    }, [media, body]);

    cardEl.addEventListener("click", () => openAd(ad.id));
    return cardEl;
  }

  function heartIcon(filled) {
    return filled
      ? '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  }

  function toggleSaved(id) {
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    persistSaved();
    render();
  }

  function skeleton() {
    return el("div", { class: "card skeleton", "aria-hidden": "true" }, [
      el("div", { class: "skeleton-media" }),
      el("div", { class: "skeleton-body" }, [
        el("span", { class: "skeleton-line w70" }),
        el("span", { class: "skeleton-line w45" }),
        el("span", { class: "skeleton-line w55" })
      ])
    ]);
  }

  function setNotice(message, kind = "error", retry = false) {
    if (!message) {
      noticeEl.hidden = true;
      noticeEl.replaceChildren();
      return;
    }
    noticeEl.hidden = false;
    noticeEl.className = `notice notice-${kind}`;
    const text = el("span", { text: message });
    const children = [text];
    if (retry) {
      const button = el("button", { class: "btn btn-ghost btn-sm", type: "button", text: "Try again" });
      button.addEventListener("click", refresh);
      children.push(button);
    }
    noticeEl.replaceChildren(...children);
  }

  function render() {
    const ads = state.ads.filter(matches).sort(compare);

    if (state.loading) {
      grid.replaceChildren(...Array.from({ length: 8 }, skeleton));
      empty.hidden = true;
      countEl.textContent = "Loading the wall…";
      return;
    }

    grid.replaceChildren(...ads.map(card));
    empty.hidden = ads.length > 0 || Boolean(state.error);

    const scope = state.cat === "all" ? "" : ` in ${state.cat.toLowerCase()}`;
    countEl.innerHTML = ads.length
      ? `<strong>${ads.length}</strong> ad${ads.length === 1 ? "" : "s"}${scope}`
      : `No ads${scope}`;

    $("#stat-ads").textContent = state.ads.length;
    $("#stat-sellers").textContent = new Set(state.ads.map((ad) => ad.seller)).size;
    $("#stat-cats").textContent = new Set(state.ads.map((ad) => ad.category)).size;
  }

  async function refresh({ silent = false } = {}) {
    if (!silent) {
      state.loading = true;
      setNotice("");
      render();
    }
    state.error = null;
    try {
      state.ads = await listAds();
      lastFetch = Date.now();
      setNotice("");
    } catch (error) {
      state.error = error;
      setNotice(
        SHARED
          ? `Could not reach the wall: ${error.message}`
          : "Could not load the demo ads.",
        "error",
        true
      );
      if (!state.ads.length) state.ads = [];
    } finally {
      state.loading = false;
      render();
    }
  }

  /* -------------------------------------------------------------- ad dialog */

  function findAd(id) {
    return state.ads.find((ad) => ad.id === id) || null;
  }

  function openAd(id) {
    const ad = findAd(id);
    if (!ad) return;

    const photo = safeImage(ad.photo);
    const hero = el("div", {
      class: "ad-hero",
      style: `background:${ad.gradient || CATEGORY_STYLE[ad.category]?.gradient || "#eef2f5"}`
    });
    if (photo) hero.append(el("img", { src: photo, alt: ad.title }));
    else hero.append(el("span", { text: ad.emoji || "🛍️" }));

    const pills = el("div", { class: "ad-meta" }, [
      el("span", { class: "pill", text: ad.category }),
      el("span", { class: "pill pill-teal", text: SHARED ? "Live on the wall" : "Free to post" }),
      ad.mine ? el("span", { class: "pill", text: "Your ad" }) : null
    ]);

    const messageBtn = el("button", { class: "btn btn-primary", type: "button", text: "Copy contact" });
    messageBtn.addEventListener("click", async () => {
      const ok = await copy(ad.contact);
      toast(ok ? "Contact copied — paste it in Messenger" : "Could not copy, please select it manually");
    });

    const saveBtn = el("button", {
      class: "btn btn-ghost",
      type: "button",
      text: saved.has(ad.id) ? "Saved" : "Save"
    });
    saveBtn.addEventListener("click", () => {
      toggleSaved(ad.id);
      openAd(ad.id);
    });

    const shareBtn = el("button", { class: "btn btn-ghost", type: "button", text: "Share" });
    shareBtn.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}?ad=${encodeURIComponent(ad.id)}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: ad.title, text: `${ad.title} — ${ad.seller}`, url });
          return;
        } catch { /* user cancelled: fall through to copying */ }
      }
      const ok = await copy(url);
      toast(ok ? "Link copied" : "Could not copy the link");
    });

    const actions = [messageBtn, saveBtn, shareBtn];

    if (ad.mine) {
      const del = el("button", { class: "btn btn-ghost", type: "button", text: "Delete my ad" });
      del.addEventListener("click", async () => {
        if (!confirm(`Delete “${ad.title}”? This cannot be undone.`)) return;
        del.disabled = true;
        del.textContent = "Deleting…";
        try {
          await deleteAd(ad.id);
          saved.delete(ad.id);
          persistSaved();
          adDialog.close();
          await refresh({ silent: true });
          toast("Ad deleted");
        } catch (error) {
          del.disabled = false;
          del.textContent = "Delete my ad";
          toast(error.message);
        }
      });
      actions.push(del);
    }

    adBody.replaceChildren(
      hero,
      pills,
      el("h2", { class: "ad-title", id: "ad-title", text: ad.title }),
      el("p", { class: "ad-seller", text: `by ${ad.seller} · ${timeAgo(ad.createdAt)}` }),
      el("p", { class: "ad-price" }, [
        peso(ad.price),
        ad.unit ? el("small", { text: ad.unit }) : null
      ]),
      el("p", { class: "ad-desc", text: ad.description }),
      el("div", { class: "ad-contact" }, [
        el("span", { text: "Contact the seller" }),
        el("strong", { text: ad.contact })
      ]),
      el("div", { class: "ad-actions" }, actions),
      el("p", {
        class: "ad-note",
        text: SHARED
          ? (ad.mine
            ? "You can delete this ad from this browser. Anyone with the link can see it."
            : "AdWall does not handle payments or delivery. Meet in a public place on campus.")
          : "Demo mode: this ad is stored in this browser only. Add Supabase keys to share it."
      })
    );

    const closeRow = el("div", { class: "dialog-head" }, [
      el("p", { class: "eyebrow", text: "Ad details" }),
      el("button", {
        class: "icon-btn",
        type: "button",
        "aria-label": "Close",
        html: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
        onclick: () => adDialog.close()
      })
    ]);
    adBody.prepend(closeRow);

    if (!adDialog.open) adDialog.showModal();
  }

  /* --------------------------------------------------------------- post form */

  const CATEGORY_EMOJI = {
    Food: "🍽️",
    Crafts: "🎨",
    Fashion: "👗",
    Digital: "💾",
    Services: "🛠️"
  };

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  /* Shrink the picture in the browser so uploads stay small and fast. */
  async function compressPhoto(file) {
    const bitmap = await createImageBitmap(file);
    const max = 900;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not read that photo."))),
        "image/jpeg",
        0.82
      );
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read that photo."));
      reader.readAsDataURL(blob);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const seller = String(data.get("seller") || "").trim();
    const category = String(data.get("category") || "Services");
    const priceRaw = String(data.get("price") || "").trim();
    const unit = String(data.get("unit") || "").trim();
    const description = String(data.get("description") || "").trim();
    const contact = String(data.get("contact") || "").trim();
    const photoUrl = String(data.get("photo") || "").trim();

    if (title.length < 3) return showError("Give your ad a title of at least 3 characters.");
    if (!seller) return showError("Add your name or shop name.");
    if (priceRaw === "" || Number(priceRaw) < 0) return showError("Add a price — enter 0 if it is free.");
    if (description.length < 12) return showError("Write a short description (at least 12 characters).");
    if (!contact) return showError("Add a way for buyers to reach you.");

    const fileInput = $("#f-file");
    const file = fileInput?.files?.[0];
    if (file && file.size > 8 * 1024 * 1024) {
      return showError("That photo is too large — pick one under 8 MB.");
    }

    const style = CATEGORY_STYLE[category] || CATEGORY_STYLE.Services;
    const input = {
      title,
      seller,
      category,
      price: Number(priceRaw),
      unit,
      description,
      contact,
      photo: safeImage(photoUrl),
      emoji: CATEGORY_EMOJI[category] || "🛍️",
      gradient: style.gradient
    };

    const submit = form.querySelector("button[type=submit]");
    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = "Posting…";

    try {
      let blob = null;
      if (file) {
        try {
          blob = await compressPhoto(file);
        } catch {
          throw new Error("That photo could not be read. Try a different file.");
        }
      }

      const ad = await createAd(input, blob);

      form.reset();
      $("#desc-count").textContent = "0";
      const uploadLabel = $("#file-label");
      if (uploadLabel) uploadLabel.textContent = "Choose file";
      postDialog.close();

      state.cat = "all";
      $$(".chip").forEach((chip) => chip.classList.toggle("is-active", chip.dataset.cat === "all"));
      state.sort = "newest";
      sortEl.value = "newest";

      state.ads = [ad].concat(state.ads.filter((other) => other.id !== ad.id));
      render();
      toast(SHARED ? "Your ad is live on the wall" : "Your ad is on the wall");
      openAd(ad.id);

      if (SHARED) refresh({ silent: true });
    } catch (error) {
      showError(error.message || "Something went wrong. Please try again.");
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });

  /* ------------------------------------------------------------- interactions */

  searchEl.addEventListener("input", () => {
    state.q = searchEl.value.trim();
    render();
  });

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.cat = chip.dataset.cat;
      $$(".chip").forEach((other) => other.classList.remove("is-active"));
      chip.classList.add("is-active");
      render();
    });
  });

  sortEl.addEventListener("change", () => {
    state.sort = sortEl.value;
    render();
  });

  $$("[data-open-post]").forEach((button) => {
    button.addEventListener("click", () => {
      clearError();
      postDialog.showModal();
      $("#f-title").focus();
    });
  });

  $$("[data-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });

  [postDialog, adDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  const desc = $("#f-desc");
  desc.addEventListener("input", () => {
    $("#desc-count").textContent = String(desc.value.length);
  });

  $("#f-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const label = $("#file-label");
    if (label) label.textContent = file ? file.name.slice(0, 18) : "Choose file";
  });

  /* Keep the wall fresh without websockets: refresh when the tab regains focus,
     and at most once a minute while it stays open. */
  if (SHARED) {
    const maybeRefresh = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > 30000) {
        refresh({ silent: true });
      }
    };
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    setInterval(() => {
      if (document.visibilityState === "visible") refresh({ silent: true });
    }, 60000);
  }

  /* -------------------------------------------------------------------- boot */

  if (storageNote) {
    storageNote.textContent = SHARED
      ? "Shared wall: ads you post are live for everyone, with no accounts, no tracking, and no fees."
      : "Demo mode: ads you post are saved in this browser only. Add Supabase keys (site/SUPABASE.md) to share them.";
  }

  render();
  refresh().then(() => {
    const linked = new URLSearchParams(location.search).get("ad");
    if (linked) openAd(linked);
  });
})();
