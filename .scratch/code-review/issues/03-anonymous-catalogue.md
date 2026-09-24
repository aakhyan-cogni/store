# 03 — Should browsing the catalogue need a token?

Status: needs-info
Blocked by: —

From M13. `GET /api/products/all`, `GET /api/products/[id]` and
`GET /api/categories/all` all declare `auth: { GET: { required: true } }`, so an
anonymous visitor cannot see the catalogue. Unusual for a shop.

Needs a product decision, not a patch: making these public is a deliberate
loosening of access control and a change to who the API is for. If the answer is
yes, the change is one `auth` line per route — and `CONTEXT.md` should say that
the catalogue is public while the cart and orders are not.
