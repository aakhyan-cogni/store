# 05 — CI, a linter, and tests inside typecheck

Status: ready-for-agent
Blocked by: —

The remainder of M10. `npm test` now runs `vitest run` and exits, so the suite
can be gated. Still missing:

- `tsconfig.json` excludes `tests`, so `npm run typecheck` never checks them.
  `tests/middleware.test.ts` leans on `as IncomingMessage` casts that nothing
  verifies. Add a second tsconfig that includes `tests` and run both.
- No ESLint. `no-case-declarations` would have caught the unbraced `case` blocks
  in `migrations/script.js`, and `noUnusedLocals` — commented out in
  `tsconfig.json` along with `noImplicitReturns` and
  `noFallthroughCasesInSwitch` — would have caught the dead import this pass
  removed by hand.
- No CI workflow. Nothing above is worth much unless it runs on every push.

Also from M9: coverage now counts every file under `src/`, which makes the real
number visible but sets no floor. Add a threshold once there is something to
defend, and prefer tests over the dispatch path — every High finding in the
review sat in code no test touched.
