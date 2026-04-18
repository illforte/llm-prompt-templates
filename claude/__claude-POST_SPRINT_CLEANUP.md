<!-- PROMPT_METADATA
version: 1.1
iteration_count: 2
last_model: GPT-5.4 Codex
last_date: 2026-04-18
canonical_capability_id: post_sprint_cleanup
canonical_source_of_truth: .agents/workflows/post_sprint_cleanup.md
canonical_sync_mode: generated-snapshot
canonical_source_sha256: 6bb18adafbed3dd102309f3dab7990c7f6190bfff154c033eafd9018d4e32829
changelog:
  - v1.1 (2026-04-18, GPT-5.4 Codex): Converted the template into a generated legacy reference snapshot with canonical source-of-truth metadata
  - v1.0 (2026-04-12, Claude Opus 4.6): Initial creation — processed from unprocessed draft, added fenced code blocks, fixed typos, tightened structure, added success criteria and anti-patterns
-->

# Legacy Reference — post_sprint_cleanup

> Legacy reference only.
> Canonical source of truth: `.agents/workflows/post_sprint_cleanup.md`
> Sync mode: generated snapshot
> Canonical SHA256: `6bb18adafbed3dd102309f3dab7990c7f6190bfff154c033eafd9018d4e32829`
> Do not edit the generated snapshot below by hand.
> Regenerate via: `node .ai/bin/sync-legacy-prompt-references.mjs --cwd <path>`

<!-- LEGACY_CANONICAL_SNAPSHOT_START -->
# Post Sprint Cleanup

Canonical post-sprint cleanup workflow for this workspace.

Use this when a repo needs a real closure pass after implementation, not just a quick polish pass.

## Goal

Close a sprint or implementation slice with:

- manifest-driven scope
- repo-aware docs review
- changelog and version consistency
- real validation using the repo's actual lint, type, test, and build commands
- evidence-backed reporting instead of confidence theater

## Source Of Truth

- Commands: `.agents/workflows/post_sprint_cleanup.md`
- Claude compatibility output: `.claude/commands/post_sprint_cleanup.md`
- Gemini compatibility output: `.gemini/commands/post_sprint_cleanup.toml`
- Codex skill wrapper: `.agents/skills/post-sprint-cleanup/SKILL.md`
- Workspace operator helper: `.ai/bin/run-post-sprint-cleanup.mjs`

Do not evolve a separate Claude-only or Gemini-only version by hand.

## Operator Entry Point

For a workspace-owned entry point that all three tools can share, use:

```bash
node .ai/bin/run-post-sprint-cleanup.mjs --cwd <target-path> --mode fast
```

For release-oriented or broader sweeps:

```bash
node .ai/bin/run-post-sprint-cleanup.mjs --cwd <target-path> --mode deep
```

If you already collected observed results, feed them back in with:

```bash
node .ai/bin/run-post-sprint-cleanup.mjs --cwd <target-path> --mode fast --results-file <cleanup-results.json>
```

## Modes

### Default: `fast`

Use for normal post-sprint closure.

Scope:

- changed files since baseline
- touched docs plus root docs
- version and changelog sources
- repo validation commands that can actually run

### Optional: `deep`

Use for release candidates, migrations, or suspicious drift.

Adds:

- full markdown sweep for the repo
- broader dead-code and dependency checks
- stronger config and environment comparison

## Rules

1. Work from the nearest repo root, not the whole `/Projekte` workspace, unless the user explicitly asks for a workspace-wide audit.
2. Do not invent lint, test, build, or version commands. Detect them from the repo.
3. Do not claim a guardrail passed unless the command was actually run and the result was observed.
4. If a check cannot run, report the blocker explicitly.
5. Prefer changed scope first. Only expand to full-repo sweep when mode or risk justifies it.

## Phase 0 — Detect Scope

Start by running:

```bash
node .ai/bin/detect-post-sprint-cleanup-context.mjs --cwd <target-path> --format pretty
```

Use that detector as the default source for:

- repo root resolution
- baseline selection
- version source discovery
- changelog candidates
- truthful validation-command selection

If the detector returns no selected command for a category, inspect its alternatives manually instead of guessing.

For report generation, use:

```bash
node .ai/bin/generate-post-sprint-cleanup-report.mjs --cwd <target-path> --mode fast --results-file <cleanup-results.json>
```

That generator produces a structured JSON and Markdown report under `.ai/reports/`.

Launcher integration:

- normal session launch prints a small cleanup hint unless disabled
- set `AI_SESSION_PREFLIGHT_CLEANUP_MODE=fast` or `AI_SESSION_PREFLIGHT_CLEANUP_MODE=deep` to run the helper before opening Claude, Gemini, or Codex
- set `AI_SESSION_SHOW_POST_SPRINT_HINT=0` to silence the startup hint

### 0a. Identify the target repo

- Resolve the repo root from the current working directory.
- If no repo root is found, stop and ask for the intended repo path.

### 0b. Choose the baseline

Use the first valid baseline in this order:

1. User-supplied baseline
2. Latest reachable tag
3. Merge-base against the default branch
4. `HEAD~1` as a fallback for small local cleanup passes

Record which baseline was used.

### 0c. Build the manifest

Collect:

- changed files
- commit log since baseline
- files added, modified, deleted
- user-visible features changed
- fixes applied
- breaking changes
- dependency changes

This manifest drives every later phase.

## Phase 1 — Repo Context

Before running cleanup, inspect the repo's real shape.

Read only what is needed:

- root `README.md`
- root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`, `Makefile`, `justfile`, or equivalent
- repo `.ai/repo/**` if present
- changed module docs and config files

Determine:

- package manager
- monorepo vs single package
- changelog location
- version source(s)
- real validation commands
- docs that act as parent sources of truth

The detector should provide the first pass for this. Manual review is only for categories it leaves unresolved or warns about.

### Repo Overlay Support

The detector also reads an optional repo-local cleanup overlay at:

```text
.ai/repo/post-sprint-cleanup.json
```

Use that file only when the repo needs cleanup-specific truth that generic detection cannot infer cleanly, for example:

- extracted repos whose root `package.json` still looks monorepo-shaped
- mixed stacks with one intended primary validation surface
- repos that keep changelogs or primary docs below the root
- repos that should explicitly behave as `release-strict` or `utility-light`

Allowed overlay concerns:

- `docs.rootDocs`
- `docs.changelogCandidates`
- `docs.docsRoots`
- `version.sources`
- `validation.commands.<category>`
- `policy.profile`

Profiles:

- `default`: normal behavior
- `release-strict`: docs, changelog, and version guardrails should not remain implicit
- `utility-light`: changelog may legitimately be absent unless the repo declares one

Do not use the overlay as a dumping ground for generic repo metadata. Keep it narrow and capability-specific.

## Phase 2 — Documentation Audit

### Default scope

Audit:

- root docs: `README.md`, `CLAUDE.md`, `GEMINI.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` when present
- every changed markdown file
- changed config comments or inline docs that were touched by the sprint

### Deep scope

If mode is `deep`, audit all repo markdown files except ignored directories such as:

- `node_modules`
- `.git`
- build output
- vendored third-party code

### Checks

For each relevant doc:

- referenced files and paths still exist
- code samples still match current commands and file paths
- feature descriptions match current behavior
- parent and child docs do not contradict each other
- version strings are current
- internal links and anchors resolve

## Phase 3 — Changelog

Use the repo's established format.

If there is no established format, use a simple Keep a Changelog structure.

Rules:

- write one entry per user-visible change, not per commit
- write for downstream readers
- avoid internal-refactor noise unless it changes usage or operations
- ensure every manifest item appears in docs, changelog, or both

## Phase 4 — Version Consistency

Determine bump type from the manifest:

- major for breaking change
- minor for new non-breaking feature work
- patch for fixes only

Update only the version sources that actually exist in the repo.

Typical sources:

- `package.json`
- lockfiles when required by the package manager
- `pyproject.toml`
- `Cargo.toml`
- `composer.json`
- image tags or release metadata
- versioned docs or badges

Verify stale references with search after changes.

## Phase 5 — Validation

### 5a. Detect commands from the repo

Use the repo's actual scripts and tools.

Examples:

- `package.json` scripts
- workspace task runners
- `make` targets
- language-native test and lint commands
- documented validation commands in repo docs

### 5b. Run the narrowest truthful validation set

Minimum target:

- lint if defined
- type check if defined
- tests if defined
- production build if defined

Prefer repo-native commands over generic fallback tools.

### 5c. Supplemental audits

Run when they are already supported by the repo or clearly cheap and relevant:

- dependency audit
- dead-code detection
- env example parity
- debug statement grep
- commented-out code grep
- secrets grep

## Phase 6 — Guardrail Verification

Only mark a guardrail as passed when there is direct evidence.

Guardrails:

- docs reviewed
- changelog reviewed
- version consistency checked
- lint status known
- types status known
- test status known
- build status known
- secret scan status known
- dependency audit status known when supported

If any item is unknown, report it as unknown, not passed.

## Output

Return a structured report with:

- target repo
- cleanup overlay path and profile
- mode
- baseline used
- manifest summary
- files touched
- docs updated
- changelog changes
- version changes
- validation commands run
- pass/fail/blocked status per guardrail
- remaining gaps

When the repo matters enough to preserve an audit trail, materialize the report with:

```bash
node .ai/bin/generate-post-sprint-cleanup-report.mjs --cwd <target-path> --mode <fast|deep> --results-file <cleanup-results.json>
```

Minimal `cleanup-results.json` shape:

```json
{
  "docs": { "status": "passed", "files": ["README.md"] },
  "changelog": { "status": "passed", "files": ["CHANGELOG.md"] },
  "version": { "status": "blocked", "notes": "Version bump deferred." },
  "commands": [
    { "category": "lint", "status": "passed", "command": "pnpm run lint", "exitCode": 0 },
    { "category": "test", "status": "failed", "command": "pnpm run test", "exitCode": 1 }
  ],
  "filesTouched": ["README.md", "CHANGELOG.md"],
  "blockers": ["Typecheck not defined at repo root."]
}
```

## Decision Standard

This workflow is complete when:

- the manifest is explicit
- docs, changelog, and version sources were actually checked
- validation claims are evidence-backed
- unresolved blockers are named clearly
- no parallel Claude-only or Gemini-only cleanup logic was introduced
<!-- LEGACY_CANONICAL_SNAPSHOT_END -->
