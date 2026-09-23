# Money is held as integer minor units, never as a float

Prices live in the database as `NUMERIC(10,2)` and arrive in the application as
strings, and we keep them that way: every sum is computed in whole minor units
(cents) and rendered back to a two-decimal string. Parsing a price into a
JavaScript `number` would make totals subject to binary floating-point drift —
three items at `0.01` must total exactly `0.03` — and the drift would be written
to an Order that can never be corrected without contradicting what the buyer
was charged.
