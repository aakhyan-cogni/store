# 07 — A database row that fails its schema answers 400

Status: needs-triage
Blocked by: —

The general case behind M2. Repositories validate rows on the way out, which is
good discipline — but a row that fails its schema throws a `ZodError`, and the
dispatcher cannot tell that from a request that failed validation. So the client
gets 400 and a Zod tree describing an _internal row schema_, for what is
actually a 500.

Two problems in one: the status is wrong, and the shape of the row schema leaks
to whoever asked.

The cart case the review named is fixed (`updateQuantity` returns `null`, the
route answers 404), and migration 008 removes the nullable columns that were the
likeliest trigger. The seam is still there for every other repository.

Fix by tagging the two directions apart — a `parseRow(schema, value)` helper in
the validation layer that throws something the dispatcher maps to a generic 500,
used everywhere a repository parses a row. Roughly 15 call sites across five
repositories, which is why it was not folded into the review pass.
