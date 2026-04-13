<!-- PROMPT_METADATA
version: 1.0
iteration_count: 1
last_model: Claude Opus 4.6
last_date: 2026-04-12
changelog:
  - v1.0 (2026-04-12, Claude Opus 4.6): Initial creation — processed from unprocessed draft, added fenced code blocks, fixed typos, tightened structure, added success criteria and anti-patterns
-->

# Post-Sprint Cleanup — Docs, Changelog, Version, Audit

You are performing a full post-sprint cleanup pass on this repository. Apply maximum effort across documentation, versioning, code quality, and dependency health. Do not stop until every phase reaches 99.9% confidence.

---

## Confidence Loop (Applied Per Phase)

After completing each phase, self-assess before moving on:

1. Assign a **confidence score** (0–100%): "How certain am I this area is clean, current, and consistent?"
2. If **< 99.9%**: identify the gaps, fix them, re-assess.
3. If **≥ 99.9%**: move to the next phase.
4. Log each assessment: `Phase N — [Name] → confidence X% → [gaps or "none"]`

---

## Shared Principles

- **Single source of truth** — reference, don't repeat. No duplicated information across docs.
- **Top-down consistency** — parent documents define rules; children inherit. No contradictions.
- **If it changed, document it** — code changes without doc updates are incomplete.
- **Automate verification** — use grep/glob to prove claims. Don't eyeball.

---

## Phase 1 — Inventory Changed Files

Build a manifest of everything that changed since the last release baseline:

```bash
git diff --name-only <baseline>..HEAD
git log --oneline <baseline>..HEAD
```

Categorize into:

- Files added / modified / deleted
- Features added / changed / removed
- Bug fixes applied
- Breaking changes introduced
- Dependencies added / upgraded / removed

This manifest drives every subsequent phase. Keep it accessible throughout the process.

---

## Phase 2 — Hierarchical Markdown Audit

Scan all markdown files top-down through the repository.

### 2a. Root-Level Docs

- **README.md** — Does it reflect current state? Are setup steps still valid? Badges correct?
- **CLAUDE.md / GEMINI.md / equivalent** — Do instructions match current architecture? Any stale file paths or dead references?
- **CONTRIBUTING.md** — Still accurate?
- **LICENSE** — Unchanged unless project scope changed.
- **CHANGELOG.md** — Handled in Phase 3.

### 2b. Nested / Module-Level Docs

Discover all markdown files:

```bash
find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*"
```

For each file, verify:

- [ ] References point to files/paths that still exist
- [ ] Code examples still compile/run
- [ ] No stale feature descriptions (removed or renamed features)
- [ ] Parent ↔ child consistency (no contradictions in hierarchy)
- [ ] Internal links and anchors resolve correctly

### 2c. Inline Documentation

- JSDoc / PHPDoc / docblocks on changed functions — still accurate?
- API endpoint docs match actual routes and payloads?
- Config file comments match actual behavior?

### Audit Function (Apply to Each File)

For every markdown file, check:

1. Dead links (internal refs to deleted files or anchors)
2. Stale version numbers
3. Outdated code examples
4. TODO/FIXME/HACK comments that should have been resolved this sprint
5. Inconsistencies with parent-level documentation

---

## Phase 3 — Changelog

Follow [Keep a Changelog](https://keepachangelog.com/) format or the project's established convention.

### Categories (include only non-empty sections):

- **Added** — new features
- **Changed** — behavior changes to existing features
- **Deprecated** — soon-to-be-removed features
- **Removed** — features removed this sprint
- **Fixed** — bug fixes
- **Security** — vulnerability fixes
- **Breaking** — changes requiring migration (flag prominently)

### Rules

- One entry per user-visible change, not per commit.
- Write for the reader (user or downstream developer), not the author.
- Link to ticket or PR where applicable.
- If an `Unreleased` section exists, move entries under the new version heading.
- No duplicate entries.
- Cross-check against the Phase 1 manifest — every change must appear somewhere.

---

## Phase 4 — Version Bump

### Determine Bump Type from Manifest

- **MAJOR** — breaking changes present
- **MINOR** — new features, no breaking changes
- **PATCH** — bug fixes only

### Update All Version References

Find every version reference in the project:

```bash
grep -rn "version" --include="*.json" --include="*.md" --include="*.yaml" --include="*.yml" --include="*.toml"
```

Checklist:

- [ ] `package.json` / `composer.json` / `pyproject.toml` / version file
- [ ] Lock files regenerated (e.g., `npm install`, `composer update --lock`, `pip freeze`)
- [ ] CHANGELOG heading matches new version + date
- [ ] README badges (if version-pinned)
- [ ] Docker tags / image refs (if applicable)
- [ ] API version headers (if applicable)
- [ ] Zero old-version references remain (verify with grep)

---

## Phase 5 — Audits

Run each audit. Fix all findings before moving on.

### 5a. Code Quality

- [ ] Linter clean (project linter: eslint, phpcs, ruff, etc.)
- [ ] Type check clean (tsc, phpstan, mypy, etc.)
- [ ] No `console.log` / `var_dump` / `print()` debug leftovers in production code
- [ ] No commented-out code blocks (remove or convert to a tracked ticket)

### 5b. Dependency Audit

- [ ] `npm audit` / `composer audit` / `pip audit` — zero critical or high findings
- [ ] No unused dependencies (use `depcheck`, `deptry`, or manual review)
- [ ] No unlocked floating versions in production dependencies

### 5c. Dead Code

- [ ] No unused exports, functions, or classes
- [ ] No orphaned files (not imported anywhere, not entry points)
- [ ] No stale feature flags or environment variables

### 5d. Config & Environment

- [ ] `.env.example` matches all variables actually read by code
- [ ] No secrets committed (grep for patterns: `key=`, `token=`, `password=`, `secret=`)
- [ ] Config defaults are sane for production

### 5e. Test Health

- [ ] All tests pass
- [ ] No skipped/disabled tests that should be re-enabled
- [ ] New features have test coverage
- [ ] No snapshot tests with stale snapshots

---

## Phase 6 — Guardrail Verification

Verify each guardrail is intact and enforced:

| Guardrail | Verified By |
|---|---|
| Lint passes | Run linter → zero errors |
| Types pass | Run type checker → zero errors |
| Tests pass | Run full test suite → zero failures |
| Build succeeds | Run production build → zero errors |
| No secrets in repo | Grep for credential patterns → zero matches |
| Docs current | Phase 2 confidence ≥ 99.9% |
| Changelog current | Phase 3 confidence ≥ 99.9% |
| Version consistent | Phase 4 grep confirms zero stale refs |
| No dead code | Phase 5c complete |
| Dependencies clean | Phase 5b → zero audit findings |

**If any guardrail fails:** fix it, re-run that guardrail, then re-verify all downstream guardrails that may have been affected.

---

## Output Format

Report per phase:

```
Phase N — [Name]
Confidence: X%
Files touched: [list]
Changes: [summary]
Gaps remaining: [list or "none"]
```

Final summary:

```
CLEANUP COMPLETE
Final confidence: X%
Phases completed: N/6
Version: old → new (bump type)
Changelog entries added: N
Docs updated: [file list]
Audit findings fixed: N
Guardrails verified: [all pass / details]
```

---

## Anti-Patterns

- **Skipping the manifest** — jumping straight into docs without knowing what changed leads to missed updates.
- **Eyeballing instead of grepping** — always use automated search to verify claims like "no stale version refs."
- **Documenting implementation details** — changelog entries should describe user-visible impact, not internal refactors.
- **Batching all fixes at the end** — fix issues as you find them, phase by phase. Batching creates cascading rework.

---

## Success Criteria

The cleanup is complete when:

1. Every phase has reached ≥ 99.9% confidence.
2. All guardrails in Phase 6 pass.
3. The final summary report is produced with no gaps remaining.
4. A single commit (or small commit series) captures all cleanup changes.
