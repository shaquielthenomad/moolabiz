# Seller photos

The landing page (`src/app/page.tsx`) references three optimised brand photos:

| File | Used in |
|------|---------|
| `baker.jpg` | hero WhatsApp device (avatar, product card), hero "join" avatar stack, testimonial |
| `sneaker.jpg` | hero avatar stack, testimonial |
| `boutique.jpg` | hero avatar stack, testimonial |

Each is a **900×900 progressive JPEG, ~140–180 KB** — deliberately compressed for
South African mobile-data budgets.

> These three binary files are added separately from this PR: the automated tooling
> that opened it can only write UTF‑8 text, not binary blobs. Drop the three JPEGs
> into this folder (they're attached in the design thread) and the landing renders
> complete. A `next/image` pass is a sensible follow-up for automatic responsive
> sizing.
