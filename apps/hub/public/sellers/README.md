# Seller photos

The landing page (`src/app/page.tsx`) references six optimised brand photos — a
cast chosen to represent South Africa's diversity (community, gender, region, trade):

| File | Seller | Represents |
|------|--------|-----------|
| `baker.jpg` | Lindiwe M. — home baker, Pretoria | Black South African woman |
| `sneaker.jpg` | Thabo K. — sneaker reseller, Soweto | Black South African man |
| `boutique.jpg` | Fatima A. — fashion boutique, Bo-Kaap | Cape Malay South African woman |
| `farmstall.jpg` | Pieter v.d. Merwe — farm stall, Stellenbosch | White Afrikaans South African man |
| `spice.jpg` | Priya Naidoo — spices & décor, Durban | Indian South African woman |
| `barber.jpg` | Devon A. — barber & grooming, Cape Flats | Coloured South African man |

Each is a **900×900 progressive JPEG, ~140–220 KB** — deliberately compressed for
South African mobile-data budgets.

> These binary files are added separately from the PR: the automated tooling that
> opened it can only write UTF‑8 text, not binary blobs. Drop the six JPEGs into
> this folder (they're attached in the design thread) and the landing renders
> complete. A `next/image` pass is a sensible follow-up.
