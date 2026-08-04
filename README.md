# Gallery

A masonry image gallery that reads from a CSV file and deploys to GitHub Pages automatically.

## Structure

```
docs/                  ← GitHub Pages serves from here
  index.html
  assets/
    style.css
    gallery.js
  data/
    images.csv          ← replace with your own data
  CNAME                  ← custom domain (delete if not using one)
.github/workflows/deploy.yml
```

## Setup

1. Push this repo to GitHub.
2. In **Settings → Pages**, set Source to **GitHub Actions**.
3. Replace `docs/data/images.csv` with your own data — same five columns:
   `title, image-url, description, source, tags` (tags comma-separated).
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and deploys automatically.
5. If you're not using a custom domain, delete `docs/CNAME`. Otherwise point your domain's DNS
   (a CNAME record) at `<username>.github.io`, and set the same domain in Settings → Pages.

## Notes

- 150 images render per page, with a "Load more" button underneath — happy to move that to
  auto-infinite-scroll if you'd rather.
- The tag rail is generated from whatever appears in the `tags` column, so it updates itself
  as your CSV grows.
- Search matches title, description, and tags, debounced client-side — no backend needed.
- Selecting a tag updates the URL (`?tag=nature`) so filtered views are shareable; free-text
  search intentionally isn't part of the URL.
- Papa Parse loads from cdnjs in `index.html`. If you want it fully self-hosted instead, download
  it into `docs/assets/lib/` and swap the `<script src>` in `index.html`.
