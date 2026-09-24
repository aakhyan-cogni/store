# 06 — Migration runner hardening

Status: needs-triage
Blocked by: —

From L8 and section 6 of the review. The runner is good — forward and rollback
in one file, each applied inside `sql.begin()`, timings printed — with four
sharp edges:

- `down` rolls back exactly one migration with no target, so undoing a
  multi-migration deploy means running it repeatedly and counting carefully.
  Migrations 007–009 landed together, which makes this concrete.
- No advisory lock. Two instances starting concurrently — the normal case in a
  rolling deploy — can both read an empty applied set and both try to apply the
  same file. `pg_advisory_lock` around the run fixes it.
- No checksums. The `migrations` table records only a name, so editing an
  already-applied file is undetectable. Store a hash and fail if it changes.
- `parseMigration`'s `/-- UP([\s\S]*)-- DOWN([\s\S]*)/` is greedy on the up
  section, so it splits on the _last_ `-- DOWN` in the file. A migration whose
  SQL mentions `-- DOWN` in a comment silently takes the wrong split.

The unbraced `case` blocks in `script.js` share one lexical scope. It works; it
is also what `no-case-declarations` exists to catch (issue 05).
