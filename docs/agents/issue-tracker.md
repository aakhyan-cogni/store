# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Why local markdown, and what changes later

This repo is hosted on GitHub (`aakhyan-cogni/store`) but is in an early WIP
build state, so work is **not** tracked in GitHub Issues yet.

Two hard constraints for agents:

- **Do not call the `gh` CLI.** It is not installed on this machine and cannot
  be installed. Never attempt `gh issue create`, `gh issue list`, or any other
  `gh` invocation as part of a skill workflow. The GitHub MCP connector _is_
  authorized, so use its tools if GitHub access is genuinely needed — but for
  issue tracking, see the next point.
- **Do not create or reference GitHub Issues** by number or URL. There are none.

Everything above — specs, issues, wayfinding maps — stays in `.scratch/` on the
local filesystem.

**Future intent:** GitHub Issues will become the tracker once the repo leaves
WIP. At that point, replace the body of this file with the GitHub template
(`issue-tracker-github.md` in the `setup-matt-pocock-skills` skill folder), or
re-run `/setup-matt-pocock-skills` to switch. Note that the GitHub template is
written around the `gh` CLI; since `gh` is unavailable here, route the
equivalent operations through the GitHub MCP connector instead.
