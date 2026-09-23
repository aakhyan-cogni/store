# Stock is reserved by conditional decrement, not by reading it first

Checkout reserves Stock with a single conditional update per line — decrement
only if enough remains — and treats "no row changed" as the authoritative
refusal, rolling the whole Checkout back. Reading Stock and then writing it
would let two concurrent buyers both pass the same check and oversell the last
unit, and locking rows for the duration of a Checkout would serialise every
buyer of a popular Product. The Stock check made while validating a Cart is
therefore advisory only: it exists to give a useful error early, and is never
what actually protects Stock.

## Consequences

The buyer who loses a race sees their Checkout refused with their Cart intact
rather than silently trimmed, so retrying with a smaller quantity is their
decision, not ours.
