# Shared-Core Extraction Manual

> Generic playbook for eliminating duplicated operational modules across agents or services and replacing them with one maintained source of truth plus a repeatable sync/check workflow.

---

## 1  Goal

**Find duplicated operational modules across agents or services and replace them with one maintained source of truth plus a repeatable sync/check workflow.**

### Success Criteria

| # | Criterion | Measurable Gate |
|---|-----------|-----------------|
| 1 | Zero drift | `sync --check` exits 0 across all targets |
| 2 | Single owner | Every operational primitive has exactly one canonical source file |
| 3 | Build parity | All consumers pass typecheck/build after extraction |
| 4 | Banner compliance | Every generated file starts with the "do not edit" banner |
| 5 | Documented mapping | A machine-readable mapping (JSON/JS/YAML) lists every source → target pair |

### Confidence Score

Rate each extraction on a 1–5 scale before starting:

| Score | Meaning | Action |
|-------|---------|--------|
| 5 | Byte-identical copies, no consumer overrides | Extract immediately |
| 4 | Near-identical, trivial differences (whitespace, comments) | Normalize then extract |
| 3 | Structurally same, minor parameter divergence | Parameterize the source, extract |
| 2 | Shared intent but meaningful logic forks | Refactor into a shared base + per-consumer config |
| 1 | Superficially similar, fundamentally different responsibilities | Do **not** extract — document as "intentional divergence" |

> **Rule:** Only proceed with extraction at confidence ≥ 3. Document anything scored 1–2 in a `DIVERGENCE-LOG.md` so future auditors skip them.

---

## 2  Effort Estimation

Assign a t-shirt size to each extraction:

| Size | Scope | Typical time |
|------|-------|--------------|
| **XS** | One file, ≤ 3 targets, no parameterization needed | < 30 min |
| **S** | One file, 4–8 targets, minor normalization | 30–60 min |
| **M** | 2–3 related files forming a module, some parameterization | 1–3 hours |
| **L** | Module cluster with cross-dependencies, requires config injection | 3–8 hours |
| **XL** | Architectural boundary (shared package, workspace refactor) | 1–3 days |

Use this when prioritizing: **impact DESC, effort ASC**.

---

## 3  Candidate Categories

Prioritize operational primitives before domain logic:

| Priority | Category | Examples |
|----------|----------|----------|
| P0 | **Auth & Security** | Webhook HMAC validation, token verification, API key helpers |
| P1 | **Bootstrap & Identity** | Service registry clients, identity loaders, health endpoint boilerplate |
| P2 | **Configuration** | Env parsers, feature-flag readers, Vault/secret bootstrap |
| P3 | **Observability** | Tracing wrappers, LLM client factories, structured logging setup |
| P4 | **HTTP Glue** | Health routes, trigger endpoints, common middleware chains |
| P5 | **Domain Utilities** | Shared formatters, validators — only if truly identical |

> **Skip Rule:** Business-specific logic goes last. Extract operational primitives before domain workflows.

---

## 4  Subtasks (Phased)

### Phase 1 — Discovery

**Goal:** Build a complete inventory of duplicated modules.

1. **Enumerate files** — List all source files across all services.
2. **Hash scan** — Identify exact duplicates by content hash.
3. **Fuzzy diff** — For files sharing the same name, diff pairs to find near-duplicates.
4. **Import graph** — Identify shared utility imports that multiple services vendor locally.
5. **Output** — A candidate list with file paths, hash match %, and proposed confidence scores.

**Discovery Commands:**

```bash
# Exact duplicates by checksum
find . -path '*/src/*.ts' -type f | xargs shasum | sort | uniq -d -w 40

# Near-duplicates by filename
find . -path '*/src/*.ts' -type f -exec basename {} \; | sort | uniq -d

# Diff two candidate files
diff -u services/alpha/src/auth.ts services/beta/src/auth.ts

# Structural similarity search (function signatures)
rg --no-filename -o 'export (function|const|class) \w+' services/*/src/*.ts | sort | uniq -c | sort -rn
```

### Phase 2 — Planning

**Goal:** For each candidate, decide extract / parameterize / skip.

1. Assign a **confidence score** (1–5) per candidate.
2. Assign an **effort size** (XS–XL) per candidate.
3. Determine whether to use **file-copy sync** (for Docker/containerized builds where package-linking is impractical) or **package import** (for monorepo/workspace setups).
4. Define the **mapping** — which source file feeds which target locations.
5. Record decisions in a tracking table.

**Tracking Table Template:**

| # | Module | Confidence | Effort | Strategy | Targets | Status |
|---|--------|-----------|--------|----------|---------|--------|
| 1 | `registry-client.ts` | 5 | S | file-copy | 6 agents | ☐ pending |
| 2 | `webhook-auth.ts` | 4 | XS | file-copy | 4 agents | ☐ pending |

### Phase 3 — Extraction

**Goal:** Create the source of truth and wire up sync.

For each extraction:

1. **Pick the canonical source** — Choose the most complete, most tested copy.
2. **Move it** to a repo-level shared area (e.g., `shared-core/sources/`).
3. **Normalize** — Strip consumer-specific differences. Parameterize where needed (config objects, env var names).
4. **Generate targets** — Run the sync script to produce target copies with banners.
5. **Add the banner** to every generated file:
   ```
   // Generated file. Do not edit directly.
   // Source: <relative-path-to-source>
   // Sync: <sync-command>
   ```
6. **Update imports** in consumer services to point to the generated file (same relative location, just content is now managed).
7. **Delete the old ad-hoc copies.**

### Phase 4 — Verification

**Goal:** Prove nothing is broken.

For each extraction, run this checklist:

- [ ] Sync command succeeds: `<sync-command>`
- [ ] Drift check passes: `<sync-command> --check`
- [ ] Typecheck passes for every affected service
- [ ] Build succeeds for every affected service
- [ ] Smoke test or unit tests pass for every affected service
- [ ] No diff in generated output vs. previous behavior

**Verification Commands:**

```bash
# Sync and check
node scripts/sync-shared-core.mjs
node scripts/sync-shared-core.mjs --check

# Typecheck all affected services
for dir in services/*/; do
  echo "=== $dir ==="
  npx tsc --noEmit -p "$dir/tsconfig.json" || echo "FAIL: $dir"
done

# Confirm no untracked drift
git diff --exit-code
```

### Phase 5 — Hardening

**Goal:** Prevent re-duplication.

1. **CI gate** — Add the `--check` command to CI/pre-commit hooks so drift is caught before merge.
2. **Documentation** — Update the shared-core README with the full mapping table.
3. **Divergence log** — Create `DIVERGENCE-LOG.md` for intentionally-different files (confidence 1–2) so future auditors don't re-investigate them.
4. **Periodic audit** — Schedule a recurring review (quarterly or after major feature additions) to catch new duplication.

---

## 5  Sync Script Architecture

The sync script is the heart of the system. Whether you use Node, Python, Bash, or Make, it must support:

| Capability | Description |
|------------|-------------|
| **Mapping file** | A declarative list of source → target[] pairs |
| **Banner injection** | Prepend provenance headers to every generated file |
| **Sync mode** | Overwrite targets from sources (default) |
| **Check mode** | `--check` — Compare without writing; exit 1 on drift |
| **Idempotent** | Running sync twice produces identical output |
| **Directory creation** | Auto-create missing target directories |

**Minimal Sync Script Template (Node/ESM):**

```javascript
import fs from 'node:fs';
import path from 'node:path';

const checkOnly = process.argv.includes('--check');
const repoRoot = process.cwd();

// Define mappings: source → targets[]
const mappings = [
  {
    source: 'shared-core/sources/example.ts',
    targets: [
      'services/alpha/src/example.ts',
      'services/beta/src/example.ts',
    ],
  },
];

function renderGenerated(sourceRelPath) {
  const body = fs.readFileSync(path.join(repoRoot, sourceRelPath), 'utf8').trimEnd();
  return [
    '// Generated file. Do not edit directly.',
    `// Source: ${sourceRelPath}`,
    `// Sync: node scripts/sync.mjs`,
    '',
    body,
    '',
  ].join('\n');
}

const outOfSync = [];

for (const { source, targets } of mappings) {
  const rendered = renderGenerated(source);
  for (const target of targets) {
    const absTarget = path.join(repoRoot, target);
    const current = fs.existsSync(absTarget) ? fs.readFileSync(absTarget, 'utf8') : '';
    if (current === rendered) continue;
    if (checkOnly) { outOfSync.push(target); continue; }
    fs.mkdirSync(path.dirname(absTarget), { recursive: true });
    fs.writeFileSync(absTarget, rendered);
    console.log(`synced ${target}`);
  }
}

if (checkOnly && outOfSync.length > 0) {
  console.error('Drift detected:');
  outOfSync.forEach(t => console.error(`  - ${t}`));
  process.exit(1);
}
if (checkOnly) console.log('All targets in sync.');
```

---

## 6  Required Checks (Per Extraction)

For each extraction, document:

| Field | Description |
|-------|-------------|
| **Evidence** | File paths and the exact duplicated modules (with line references) |
| **Root cause** | Why duplication happened (e.g., copy-paste bootstrap, Docker isolation, no shared package) |
| **Confidence** | Score 1–5 |
| **Effort** | Size XS–XL |
| **Fix** | Shared source path + sync/check mechanism |
| **Verification** | sync ✓, drift-check ✓, typecheck ✓, build ✓, tests ✓ |
| **Rollback** | Revert generated files and shared-core sources together; re-run sync |
| **Impact** | How many consumers benefit; what class of bug this prevents |

---

## 7  Rollback Procedure

If an extraction causes breakage:

1. `git checkout -- shared-core/sources/<file>` — restore source
2. `git checkout -- <target-1> <target-2> ...` — restore all targets
3. Re-run the sync script to confirm clean state
4. Create a post-mortem entry in the tracking table explaining why it failed

---

## 8  CI/CD Integration Examples

**Pre-commit hook (Husky/lint-staged):**

```bash
node scripts/sync.mjs --check || {
  echo "Shared-core drift detected. Run: node scripts/sync.mjs"
  exit 1
}
```

**GitHub Actions step:**

```yaml
- name: Check shared-core sync
  run: node scripts/sync.mjs --check
```

**Pre-push hook:**

```bash
node scripts/sync.mjs --check && npx tsc --noEmit
```

---

## 9  Check Instruction Quality Guide

When applying this manual to a new project, evaluate these instruction areas for completeness:

| Area | Question to Ask | ⚠ Improvement Needed If… |
|------|----------------|--------------------------|
| **Discovery depth** | Does the scan cover all file extensions and directory layouts? | Scan only checks `*.ts` but project uses `.mjs`, `.py`, or mixed languages |
| **Import rewriting** | Do instructions explain how to update import paths after extraction? | Consumers use different module systems (CJS vs ESM) or aliases |
| **Parameterization** | Is there guidance for handling near-duplicates with minor config differences? | Multiple files share 90% logic but differ in environment variables or API endpoints |
| **Multi-language** | Does the sync support non-TypeScript projects? | Agents/services span multiple languages (Python, Go, Shell scripts) |
| **Docker awareness** | Do instructions address containerized builds where `npm link` or workspace imports fail? | File-copy sync is implicitly assumed but not explicitly justified |
| **Permissions & ownership** | Is it clear who maintains the shared source? | No CODEOWNERS or PR review rules for shared-core changes |
| **Backward compatibility** | What happens when the shared source gains a new parameter? | Consumers break because they do not pass the new required argument |
| **Secret handling** | Are credential/env patterns in scope or explicitly excluded? | Env parsers are extracted but actual secret values are exposed in the mapping |
| **Versioning** | Is there a strategy for breaking changes to shared sources? | No changelog, semver, or deprecation mechanism for shared modules |

---

## 10  Agent Prompt Template

Use this when asking an AI agent to audit any repository:

```text
Audit this repo for shared-core extraction opportunities.
Follow the Shared-Core Extraction Manual methodology.

## Scope

Focus on duplicated OPERATIONAL modules (not business logic):
- Auth and webhook validation
- Bootstrap and identity loading (service registries, config loaders)
- Env / feature-flag parsing
- Tracing / LLM client wrappers
- Health and trigger endpoint glue
- Secret bootstrap / Vault integration

## Discovery

1. Run hash scans and filename-based duplicate detection.
2. Run structural similarity analysis (shared function signatures).
3. Diff all candidate pairs.

## Output Format

For each finding, provide a structured report:

  module:        <name>
  confidence:    <1-5>
  effort:        <XS|S|M|L|XL>
  description:   <what the module does>
  evidence:      <file paths with line references>
  root_cause:    <why duplication exists>
  fix:           <shared source path + sync mechanism>
  verification:  <commands to verify after extraction>
  rollback:      <how to revert safely>
  impact:        <number of consumers, risk class>

## Prioritization

Rank all findings by: impact DESC, effort ASC.
Only include findings with confidence ≥ 3.
List confidence 1-2 items separately under "Intentional Divergences."

## Execution

If instructed to execute (not just audit):
1. Start with the highest-value, lowest-effort extraction.
2. Create the sync script if it does not exist.
3. Add the mapping, run sync, verify all affected services.
4. Commit with a clear message referencing the extraction.
```
