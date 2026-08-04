(() => {
  "use strict";

  const CSV_URL = "data/images.csv";
  const PAGE_SIZE = 150;
  const REQUIRED_COLS = ["title", "image-url"];

  const state = {
    all: [],
    filtered: [],
    tags: [],
    activeTag: null,
    query: "",
    shown: 0,
  };

  const el = {
    gallery: document.getElementById("gallery"),
    skeletonGrid: document.getElementById("skeletonGrid"),
    emptyState: document.getElementById("emptyState"),
    errorState: document.getElementById("errorState"),
    statusRow: document.getElementById("statusRow"),
    statusCount: document.getElementById("statusCount"),
    loadMoreBtn: document.getElementById("loadMoreBtn"),
    tagRail: document.getElementById("tagRail"),
    searchInput: document.getElementById("searchInput"),
    headerCount: document.getElementById("headerCount"),
    themeToggle: document.getElementById("themeToggle"),
    lightbox: document.getElementById("lightbox"),
    lightboxClose: document.getElementById("lightboxClose"),
    lightboxImage: document.getElementById("lightboxImage"),
    lightboxTitle: document.getElementById("lightboxTitle"),
    lightboxDesc: document.getElementById("lightboxDesc"),
    lightboxTags: document.getElementById("lightboxTags"),
    lightboxMeta: document.getElementById("lightboxMeta"),
  };

  init();

  function init() {
    renderSkeletons(24);
    initTheme();
    bindGlobalEvents();
    loadStateFromURL();
    loadCSV();
  }

  // ---------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------

  function initTheme() {
    const saved = localStorage.getItem("gallery-theme");
    const theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    el.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
    el.themeToggle.textContent = theme === "dark" ? "◑" : "◐";
    localStorage.setItem("gallery-theme", theme);
  }

  // ---------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------

  async function loadCSV() {
    let res;
    try {
      res = await fetch(CSV_URL);
    } catch (err) {
      return showError("Couldn't reach the CSV file. Check your connection and reload.");
    }
    if (!res.ok) {
      return showError(`Couldn't load ${CSV_URL} (HTTP ${res.status}). Make sure the file exists in docs/data/.`);
    }

    const text = await res.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.data.length) {
      return showError("The CSV file is empty.");
    }

    const headers = parsed.meta.fields || [];
    const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
    if (missing.length) {
      return showError(`CSV is missing required column(s): ${missing.join(", ")}.`);
    }

    const tagSet = new Set();
    state.all = parsed.data
      .filter((row) => row.title && row["image-url"])
      .map((row, i) => {
        const tags = (row.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        tags.forEach((t) => tagSet.add(t));
        return {
          id: i,
          title: row.title.trim(),
          imageUrl: row["image-url"].trim(),
          description: (row.description || "").trim(),
          source: (row.source || "").trim(),
          tags,
        };
      });

    state.tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));

    renderTagRail();
    applyFilters({ resetShown: true, fromInit: true });

    el.skeletonGrid.hidden = true;
    el.gallery.hidden = false;
    el.statusRow.hidden = false;
  }

  function showError(message) {
    el.skeletonGrid.hidden = true;
    el.errorState.textContent = message;
    el.errorState.hidden = false;
  }

  // ---------------------------------------------------------------------
  // Filtering + rendering
  // ---------------------------------------------------------------------

  function applyFilters({ resetShown = true } = {}) {
    const q = state.query.trim().toLowerCase();

    state.filtered = state.all.filter((img) => {
      const matchesTag = !state.activeTag || img.tags.includes(state.activeTag);
      if (!matchesTag) return false;
      if (!q) return true;
      return (
        img.title.toLowerCase().includes(q) ||
        img.description.toLowerCase().includes(q) ||
        img.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    if (resetShown) state.shown = 0;

    el.headerCount.textContent = ` · ${state.all.length}`;

    renderPage();
    syncURL();
  }

  function renderPage() {
    if (state.shown === 0) el.gallery.innerHTML = "";

    const nextSlice = state.filtered.slice(state.shown, state.shown + PAGE_SIZE);
    const frag = document.createDocumentFragment();
    nextSlice.forEach((img) => frag.appendChild(buildTile(img)));
    el.gallery.appendChild(frag);
    state.shown += nextSlice.length;

    const total = state.filtered.length;
    el.emptyState.hidden = total !== 0;
    el.gallery.style.display = total === 0 ? "none" : "";

    el.statusCount.textContent = total === 0 ? "" : `${state.shown} of ${total}`;
    el.loadMoreBtn.hidden = state.shown >= total;
  }

  function buildTile(img) {
    const tile = document.createElement("figure");
    tile.className = "tile";
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    tile.setAttribute("aria-label", `Open ${img.title}`);

    const image = document.createElement("img");
    image.src = img.imageUrl;
    image.alt = img.title;
    image.loading = "lazy";
    image.decoding = "async";
    tile.appendChild(image);

    const label = document.createElement("figcaption");
    label.className = "tile-label";
    const t = document.createElement("div");
    t.className = "tile-label-title";
    t.textContent = img.title;
    label.appendChild(t);
    if (img.source) {
      const s = document.createElement("div");
      s.className = "tile-label-source";
      s.textContent = img.source;
      label.appendChild(s);
    }
    tile.appendChild(label);

    const open = () => openLightbox(img);
    tile.addEventListener("click", open);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    return tile;
  }

  function renderSkeletons(n) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const d = document.createElement("div");
      d.className = "skeleton-tile";
      d.style.height = `${140 + Math.round(Math.random() * 180)}px`;
      frag.appendChild(d);
    }
    el.skeletonGrid.appendChild(frag);
  }

  function renderTagRail() {
    if (!state.tags.length) return;
    el.tagRail.hidden = false;
    const frag = document.createDocumentFragment();
    state.tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.className = "tag-pill";
      btn.textContent = tag;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => toggleTag(tag));
      frag.appendChild(btn);
    });
    el.tagRail.appendChild(frag);
  }

  function toggleTag(tag) {
    state.activeTag = state.activeTag === tag ? null : tag;
    [...el.tagRail.children].forEach((btn) => {
      const isActive = btn.textContent === state.activeTag;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
    applyFilters({ resetShown: true });
  }

  // ---------------------------------------------------------------------
  // Lightbox
  // ---------------------------------------------------------------------

  let lastFocused = null;

  function openLightbox(img) {
    lastFocused = document.activeElement;
    el.lightboxImage.src = img.imageUrl;
    el.lightboxImage.alt = img.title;
    el.lightboxTitle.textContent = img.title;
    el.lightboxDesc.textContent = img.description;
    el.lightboxDesc.hidden = !img.description;

    el.lightboxTags.innerHTML = "";
    img.tags.forEach((tag) => {
      const b = document.createElement("button");
      b.className = "lightbox-tag";
      b.textContent = tag;
      b.addEventListener("click", () => {
        closeLightbox();
        toggleTag(tag);
      });
      el.lightboxTags.appendChild(b);
    });

    el.lightboxMeta.innerHTML = "";
    if (img.source) {
      const label = document.createElement("span");
      const looksLikeUrl = /^https?:\/\//i.test(img.source);
      if (looksLikeUrl) {
        const a = document.createElement("a");
        a.href = img.source;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = img.source;
        label.appendChild(document.createTextNode("Source: "));
        label.appendChild(a);
      } else {
        label.textContent = `Source: ${img.source}`;
      }
      el.lightboxMeta.appendChild(label);
    }

    el.lightbox.hidden = false;
    el.lightboxClose.focus();
    document.addEventListener("keydown", onLightboxKeydown);
  }

  function closeLightbox() {
    el.lightbox.hidden = true;
    document.removeEventListener("keydown", onLightboxKeydown);
    if (lastFocused) lastFocused.focus();
  }

  function onLightboxKeydown(e) {
    if (e.key === "Escape") closeLightbox();
  }

  // ---------------------------------------------------------------------
  // URL state (page depth + tag are shareable; search is not, by design)
  // ---------------------------------------------------------------------

  function loadStateFromURL() {
    const params = new URLSearchParams(location.search);
    const tag = params.get("tag");
    if (tag) state.activeTag = tag;
  }

  function syncURL() {
    const params = new URLSearchParams();
    if (state.activeTag) params.set("tag", state.activeTag);
    const qs = params.toString();
    const url = qs ? `?${qs}` : location.pathname;
    history.replaceState(null, "", url);
  }

  // ---------------------------------------------------------------------
  // Global events
  // ---------------------------------------------------------------------

  function bindGlobalEvents() {
    el.themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });

    el.searchInput.addEventListener("input", debounce((e) => {
      state.query = e.target.value;
      applyFilters({ resetShown: true });
    }, 250));

    el.loadMoreBtn.addEventListener("click", () => renderPage());

    el.lightboxClose.addEventListener("click", closeLightbox);
    el.lightbox.addEventListener("click", (e) => {
      if (e.target === el.lightbox) closeLightbox();
    });
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }
})();
