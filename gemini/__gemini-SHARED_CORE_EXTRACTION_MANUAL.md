# Shared-Core Extraction Manual

> A generic, project-agnostic playbook for consolidating duplicated operational modules into a single maintained source of truth with automated sync and drift detection.

---

## 1  Goal

Find duplicated operational modules across agents or services and replace them with:

1. **One canonical source file** per shared module
2. **A sync script** that generates target copies with provenance banners
3. **A check command** that fails on drift, suitable for CI enforcement

### Success Criteria

| # | Criterion | Measurable Gate |
|---|-----------|-----------------|
| 1 | Zero drift | `<sync-command> --check` exits 0 across all targets |
| 2 | Single owner | No operational module exists outside `shared-core/sources/` that also exists inside a consumer's source tree without a generated-file banner |
| 3 | Build parity | Every consumer passes typecheck and build after extraction |
| 4 | Banner compliance | Every generated target file starts with the `Generated file. Do not edit directly.` banner |
| 5 | Documented mapping | A machine-readable mapping (JSON, JS, or YAML) lists every source → target pair |
| 6 | Automated enforcement | The `--check` command is wired into CI or a pre-commit hook |

### Confidence Score

Rate each extraction candidate on a 1–5 scale before starting:

| Score | Meaning | Action |
|-------|---------|--------|
| 5 | Byte-identical copies, no consumer overrides | Extract immediately |
| 4 | Near-identical; trivial differences (whitespace, comments, import order) | Normalize, then extract |
| 3 | Structurally same; minor parameter divergence (env var names, endpoints) | Parameterize the source, then extract |
| 2 | Shared intent but meaningful logic forks | Refactor into shared base + per-consumer config — high effort, plan carefully |
| 1 | Superficially similar, fundamentally different responsibilities | Do **not** extract — document in `DIVERGENCE-LOG.md` |

> **Rule:** Only proceed with extraction at confidence ≥ 3. Document anything scored 1–2 in `DIVERGENCE-LOG.md` so future auditors skip them.

---

## 2  Effort Estimation

Assign a t-shirt size to each extraction:

| Size | Scope | Typical time |
|------|-------|--------------|
| **XS** | One file, ≤ 3 targets, no parameterization | < 30 min |
| **S** | One file, 4–8 targets, minor normalization | 30–60 min |
| **M** | 2–3 related files forming a module, some parameterization | 1–3 hours |
| **L** | Module cluster with cross-dependencies, requires config injection | 3–8 hours |
| **XL** | Architectural boundary (shared package, workspace refactor) | 1–3 days |

Prioritize by: **impact DESC, effort ASC.**

---

## 3  Candidate Categories

Prioritize operational primitives before domain logic:

| Priority | Category | Examples |
|----------|----------|----------|
| P0 | **Auth & Security** | Webhook HMAC validation, token verification, API key helpers |
| P1 | **Bootstrap & Identity** | Service registry clients, identity loaders, health endpoint boilerplate |
| P2 | **Configuration** | Env parsers, feature-flag readers, secret/vault bootstrap |
| P3 | **Observability** | Tracing wrappers, LLM client factories, structured logging setup |
| P4 | **HTTP Glue** | Health routes, trigger endpoints, common middleware chains |
| P5 | **Domain Utilities** | Shared formatters, validators — only if truly identical across consumers |

> **Skip Rule:** Business-specific logic goes last. Extract operational primitives before domain workflows.

---

## 4  When NOT to Extract

Do **not** extract when:

- **The similarity is cosmetic.** Two files do "the same kind of thing" but diverge in flow (e.g., one uses callbacks, one uses streams). Confidence 1.
- **The module is actively evolving in different directions.** Forcing convergence creates merge conflicts and slows both consumers.
- **Only two copies exist and change rarely.** The overhead of a sync mechanism may exceed the cost of manual sync. Re-evaluate when a third consumer appears.
- **The module encapsulates consumer-specific secrets or credentials.** Env-parsing logic can be shared; actual secret values must never appear in the mapping or shared source.
- **The consumer's build system cannot accommodate generated files** (e.g., a locked vendor directory managed by a package manager). Workaround: document as aspirational and plan for the next build system upgrade.

---

## 5  Subtasks (Phased)

### Phase 1 — Discovery

**Goal:** Build a complete inventory of duplicated modules.

1. **Enumerate files** — List all source files across all services/agents.
2. **Hash scan** — Identify exact duplicates by content hash.
3. **Fuzzy diff** — For files sharing the same basename, diff pairs to find near-duplicates.
4. **Import graph** — Identify shared utility imports that multiple services vendor locally.
5. **Output** — A candidate list with: file paths, match type (exact / near / divergent), and proposed confidence scores.

**Discovery Commands:**

```bash
# Exact duplicates by checksum (language-agnostic)
find . -type f \( -name '*.ts' -o -name '*.js' -o -name '*.mjs' -o -name '*.py' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' \
  | xargs shasum | awk '{print $1, $2}' | sort | uniq -Dw40

# Near-duplicates by shared basename
find . -type f \( -name '*.ts' -o -name '*.js' -o -name '*.py' \) \
  -not -path '*/node_modules/*' -not -path '*/dist/*' \
  -exec basename {} \; | sort | uniq -d

# Diff two candidate files
diff -u path/to/service-a/src/module.ts path/to/service-b/src/module.ts

# Structural similarity: exported symbol overlap
rg --no-filename -o 'export (function|const|class) \w+' --glob '!node_modules' --glob '!dist' \
  | sort | uniq -c | sort -rn | head -30
```

### Phase 2 — Planning

**Goal:** For each candidate, decide extract / parameterize / skip.

1. Assign a **confidence score** (1–5) per candidate.
2. Assign an **effort size** (XS–XL) per candidate.
3. Choose a **strategy:**
   - **File-copy sync** — For containerized/Docker builds where package-linking breaks. One source generates N target copies.
   - **Package import** — For monorepo/workspace setups where services can `import` from a shared package directly.
4. Define the **mapping** — which source file feeds which target locations.
5. Record decisions in a tracking table.

**Tracking Table Template:**

| # | Module | Confidence | Effort | Strategy | Consumers | Status |
|---|--------|-----------|--------|----------|-----------|--------|
| 1 | `auth-helper` | 5 | XS | file-copy | 4 services | ☐ pending |
| 2 | `config-loader` | 4 | S | file-copy | 6 services | ☐ pending |
| 3 | `logging-setup` | 3 | M | package | 8 services | ☐ pending |

### Phase 3 — Extraction

**Goal:** Create the source of truth and wire up sync.

For each extraction:

1. **Pick the canonical source** — Choose the most complete, best-tested copy.
2. **Move it** to the shared area (see §6 for directory layout).
3. **Normalize** — Strip consumer-specific differences. If modules differ only by a config value (endpoint URL, env var name), extract the config into a parameter:
   ```typescript
   // Before (hardcoded in each copy):
   const API_URL = 'https://service-a.internal/api';

   // After (parameterized in shared source):
   export function createClient(apiUrl: string) { ... }
   ```
4. **Generate targets** — Run the sync script to produce target copies with banners.
5. **Verify the banner** is present on every generated file:
   ```
   // Generated file. Do not edit directly.
   // Source: shared-core/sources/<module>.ts
   // Sync: node scripts/sync.mjs
   ```
6. **Update imports** in consumer services to point to the generated file path.
7. **Delete the old ad-hoc copies** and ensure no orphaned imports remain.

### Phase 4 — Verification

**Goal:** Prove nothing is broken.

For each extraction, complete this checklist:

- [ ] Sync command succeeds without errors
- [ ] Drift check passes (`--check` exits 0)
- [ ] Typecheck passes for every affected consumer
- [ ] Build succeeds for every affected consumer
- [ ] Smoke tests or unit tests pass for every affected consumer
- [ ] Generated output is functionally equivalent to previous behavior
- [ ] No untracked changes: `git diff --exit-code`

**Verification Commands (adapt paths to your repo):**

```bash
# Sync and check
node scripts/sync.mjs
node scripts/sync.mjs --check

# Typecheck all affected consumers
for dir in agents/*/; do
  if [ -f "$dir/tsconfig.json" ]; then
    echo "=== $dir ==="
    npx tsc --noEmit -p "$dir/tsconfig.json" || echo "FAIL: $dir"
  fi
done

# Confirm no untracked drift
git diff --exit-code
```

### Phase 5 — Hardening

**Goal:** Prevent re-duplication.

1. **CI gate** — Add `--check` to CI or a pre-commit hook (see §9 for examples).
2. **Documentation** — Update the shared-core README with the full mapping table.
3. **Divergence log** — Create `DIVERGENCE-LOG.md` for intentionally-different files (confidence 1–2) so future auditors skip them.
4. **Periodic audit** — Schedule a recurring review (quarterly or after major feature additions) to catch new duplication. Use the discovery commands from Phase 1.

---

## 6  Recommended Directory Layout

```
repo-root/
├── shared-core/
│   ├── README.md              # Usage instructions and rules
│   ├── sources/               # Canonical source files (edit ONLY here)
│   │   ├── auth-helper.ts
│   │   ├── config-loader.ts
│   │   └── registry-client.ts
│   └── DIVERGENCE-LOG.md      # Intentionally-different modules (confidence 1-2)
├── scripts/
│   └── sync.mjs               # Sync script with --check support
├── services/ (or agents/)
│   ├── service-a/
│   │   └── src/
│   │       └── auth-helper.ts  # ← Generated. Do not edit.
│   └── service-b/
│       └── src/
│           └── auth-helper.ts  # ← Generated. Do not edit.
```

> **Key rule:** Never hand-edit files inside consumer `src/` folders that carry the generated-file banner. Always edit in `shared-core/sources/` and re-run sync.

---

## 7  Sync Script Architecture

The sync script is the backbone. Regardless of language (Node, Python, Bash, Make), it must support:

| Capability | Description |
|------------|-------------|
| **Mapping** | A declarative list of source → target[] pairs |
| **Banner injection** | Prepend provenance headers (source path + sync command) to every target |
| **Sync mode** | Default: overwrite targets from sources |
| **Check mode** | `--check`: compare without writing; exit 1 on any drift |
| **Idempotent** | Running sync twice produces byte-identical output |
| **Directory creation** | Auto-create missing target directories |
| **Missing source guard** | Exit with a clear error if a source file is missing |
| **Summary** | Print a count of synced / skipped / drifted files |

**Minimal Sync Script Template (Node/ESM):**

```javascript
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

// ── Mapping: source → targets[] ──────────────────────────────
const mappings = [
  {
    source: 'shared-core/sources/auth-helper.ts',
    targets: [
      'services/alpha/src/auth-helper.ts',
      'services/beta/src/auth-helper.ts',
    ],
  },
  // Add more mappings here
];

// ── Render with banner ───────────────────────────────────────
function renderGenerated(sourceRelPath) {
  const absPath = path.join(repoRoot, sourceRelPath);
  if (!fs.existsSync(absPath)) {
    console.error(`ERROR: Source file not found: ${sourceRelPath}`);
    process.exit(1);
  }
  const body = fs.readFileSync(absPath, 'utf8').trimEnd();
  return [
    '// Generated file. Do not edit directly.',
    `// Source: ${sourceRelPath}`,
    '// Sync: node scripts/sync.mjs',
    '',
    body,
    '',
  ].join('\n');
}

// ── Sync / Check loop ────────────────────────────────────────
const drifted = [];
let synced = 0;
let skipped = 0;

for (const { source, targets } of mappings) {
  const rendered = renderGenerated(source);
  for (const target of targets) {
    const absTarget = path.join(repoRoot, target);
    const current = fs.existsSync(absTarget)
      ? fs.readFileSync(absTarget, 'utf8')
      : '';

    if (current === rendered) {
      skipped++;
      continue;
    }

    if (checkOnly) {
      drifted.push(target);
      continue;
    }

    fs.mkdirSync(path.dirname(absTarget), { recursive: true });
    fs.writeFileSync(absTarget, rendered);
    synced++;
    console.log(`  synced  ${target}`);
  }
}

// ── Report ───────────────────────────────────────────────────
if (checkOnly) {
  if (drifted.length > 0) {
    console.error(`Drift detected in ${drifted.length} file(s):`);
    drifted.forEach(t => console.error(`  ✗ ${t}`));
    console.error(`\nRun: node scripts/sync.mjs`);
    process.exit(1);
  }
  console.log(`All targets in sync (${skipped} file(s) checked).`);
} else {
  console.log(`\nSync complete: ${synced} updated, ${skipped} unchanged.`);
}
```

---

## 8  Required Checks (Per Extraction)

For each extraction, document these fields:

| Field | Description |
|-------|-------------|
| **Evidence** | File paths with line references showing the duplicated code |
| **Root cause** | Why duplication happened (copy-paste bootstrap, Docker isolation, no shared package, etc.) |
| **Confidence** | Score 1–5 (see §1) |
| **Effort** | Size XS–XL (see §2) |
| **Fix** | Shared source path + sync/check command |
| **Verification** | sync ✓, drift-check ✓, typecheck ✓, build ✓, tests ✓ |
| **Rollback** | How to revert (see §10) |
| **Impact** | Number of consumers affected; class of bug this prevents (security, reliability, correctness) |

---

## 9  CI/CD Integration Examples

**Pre-commit hook:**

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

**Pre-push hook (sync + typecheck):**

```bash
node scripts/sync.mjs --check && npx tsc --noEmit
```

**GitLab CI job:**

```yaml
shared-core-check:
  stage: lint
  script:
    - node scripts/sync.mjs --check
```

---

## 10  Rollback Procedure

### Uncommitted changes

```bash
# Restore source and all targets to last committed state
git restore shared-core/sources/<file>
git restore services/*/src/<file>

# Confirm clean state
node scripts/sync.mjs --check
```

### Already committed

```bash
# Option A: Revert the extraction commit
git revert <commit-hash>

# Option B: Reset to the commit before extraction (destructive)
git reset --soft HEAD~1
git restore --staged .
```

After any rollback:
1. Re-run the sync script to confirm consistency.
2. Add a post-mortem entry to the tracking table explaining why the extraction failed.
3. Downgrade the candidate's confidence score to prevent re-attempts without addressing the root cause.

---

## 11  Anti-Patterns

Avoid these common mistakes:

| Anti-pattern | Why it fails | What to do instead |
|--------------|--------------|--------------------|
| **Extract too early** | Module is still evolving in different directions; every sync causes merge conflicts | Wait until the interface stabilizes; track it as confidence 2 |
| **Shared module becomes a bottleneck** | Every team/consumer's PR touches the same file, creating review congestion | Keep the shared source small and focused; split into granular modules |
| **Shared source without a sync mechanism** | A `shared/` directory exists but has no sync script — consumers copy files manually and drift silently | A shared directory without automation is worse than no shared directory; always wire up sync + check |
| **Over-parameterization** | Source becomes a configurable framework rather than a simple module; complexity exceeds the duplicated code | Parameterize only the values that actually differ (usually ≤ 3 config keys) |
| **Extracting secrets/env values** | Shared source includes hardcoded credentials or environment-specific URLs | Extract the **parsing logic**, never the **values**. Values come from env vars at runtime |
| **Ignoring dist/build artifacts** | Sync targets sit inside `src/` but built copies in `dist/` are stale | Add `dist/` to `.gitignore` or include a post-sync build step |

---

## 12  Instruction Quality Checklist

When applying this manual to a new project, evaluate each area:

| Area | Question | ⚠ Improvement Needed If… |
|------|----------|--------------------------|
| **Discovery depth** | Does the scan cover all relevant file extensions and directory layouts? | Scan only checks `*.ts` but project uses `.mjs`, `.py`, `.go`, or mixed languages |
| **Import rewriting** | Do instructions explain how to update import paths after extraction? | Consumers use different module systems (CJS vs ESM), path aliases, or bundler rewrites |
| **Parameterization** | Is there guidance for handling near-duplicates with minor config differences? | Files share 90%+ logic but differ in environment variables or API endpoints |
| **Multi-language** | Does the sync script support non-TypeScript projects? | Services span multiple languages (Python, Go, Shell scripts) |
| **Docker awareness** | Do instructions address containerized builds where `npm link` or workspace imports fail? | File-copy sync is implicitly assumed but not explicitly justified |
| **Ownership** | Is it clear who can modify the shared source and who reviews changes? | No CODEOWNERS, PR review rules, or designated maintainer for shared-core |
| **Backward compatibility** | What happens when the shared source adds a new required parameter? | Consumers break because they don't pass the new argument |
| **Secret handling** | Are credential/env patterns in scope or explicitly excluded? | Env-parsing logic is extracted but actual secret values appear in the source or mapping |
| **Versioning** | Is there a strategy for breaking changes to shared sources? | No changelog, semver, or deprecation period for shared modules |
| **Testing** | Does the shared module have its own tests, or does it rely entirely on consumer-level tests? | A change to the shared source passes sync but breaks consumer behavior with no test catching it |
| **Sync mechanism exists** | Does the `shared/` or `shared-core/` directory actually have an automated sync and check workflow? | A shared directory exists but files are copied manually — giving a false sense of safety |

---

## 13  Agent Prompt Template

Use this prompt when instructing an AI agent to audit any repository. The prompt is **self-contained** — no external manual reference required.

```text
You are auditing this repository for shared-core extraction opportunities.

## Objective

Find duplicated operational modules and recommend consolidation into a
single source of truth with an automated sync/check workflow.

## Scope (Operational Modules Only)

Focus on operational primitives, NOT business logic:
- Auth and webhook validation (HMAC, tokens, API keys)
- Bootstrap and identity loading (service registries, config loaders)
- Env / feature-flag parsing
- Tracing / LLM client wrappers
- Health and trigger endpoint glue
- Secret bootstrap / credential loading
- Structured logging setup

## Discovery Steps

1. Hash scan: identify byte-identical files by content checksum.
2. Basename scan: find files with the same name across services.
3. Structural analysis: look for repeated exported function/class signatures.
4. Diff all candidate pairs to assess similarity.

## Confidence Scoring

Rate each candidate 1–5:
  5 = byte-identical copies → extract immediately
  4 = near-identical (whitespace/comments differ) → normalize, extract
  3 = structurally same, minor parameter divergence → parameterize, extract
  2 = shared intent, meaningful logic forks → document, plan carefully
  1 = superficially similar, different responsibilities → skip, log in DIVERGENCE-LOG

Only recommend extraction for confidence ≥ 3.

## Output Format

For each finding, provide:

  module:        <descriptive name>
  confidence:    <1-5>
  effort:        <XS|S|M|L|XL>
  description:   <what the module does>
  evidence:      <file paths with line references for each duplicate>
  root_cause:    <why duplication happened>
  fix:           <proposed shared source path + sync mechanism>
  verification:  <exact commands to verify after extraction>
  rollback:      <how to revert safely>
  impact:        <number of consumers; risk class: security|reliability|correctness>

## Prioritization

- Rank by: impact DESC, effort ASC.
- Group findings with confidence ≥ 3 under "Extraction Candidates."
- Group findings with confidence 1–2 under "Intentional Divergences" (no action needed).

## Execution (if instructed to execute, not just audit)

1. Start with the highest-impact, lowest-effort candidate.
2. Create or update the sync script (must support --check mode).
3. Add the source → target mapping.
4. Run sync, verify all affected consumers (typecheck, build, tests).
5. Ensure every generated file has the provenance banner:
     // Generated file. Do not edit directly.
     // Source: <path>
     // Sync: <command>
6. Commit with a descriptive message referencing the extraction.
```
