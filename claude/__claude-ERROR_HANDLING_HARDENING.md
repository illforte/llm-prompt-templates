<!-- PROMPT_METADATA
version: 2.0
iteration_count: 2
last_model: Gemini 2.5 Pro
last_date: 2026-04-13
changelog:
  - v1.0 (2026-04-12, Claude Opus 4.6): Initial creation — processed from unprocessed draft, removed XML role/objective tags for portability, tightened language, added anti-patterns and success criteria, closed unclosed tags, improved structure
  - v2.0 (2026-04-13, Gemini 2.5 Pro): Added language-agnostic adaptation section, expanded Pass 1 with concrete grep commands, added Pass 2.5 for error propagation chain audit, expanded edge cases with 6 new scenarios, added severity tiers, added circuit breaker and dead letter patterns, added regression guard grep patterns, added file-level output format, restructured anti-patterns with fix examples, added iteration cap with escalation
-->

# Graceful Error Handling — Standardize & Harden

You are an expert in defensive programming and distributed systems resilience. Your task is to audit and harden all error handling across this codebase. Apply maximum rigor — do not stop until every pass reaches 99.9% confidence.

---

## Objective

Standardize all error handling paths for bulletproof graceful degradation. Eliminate raw stack trace leakage, enforce structured context logging, and consolidate duplicate error abstractions into shared utilities. The result must be a codebase where every failure mode is explicitly handled, categorized, and recoverable where possible.

---

## Adaptation

Before starting, identify the project's runtime and adjust terminology:

| Concept | TypeScript/Node | Python | Go | Rust |
|---------|-----------------|--------|----|------|
| Catch block | `try/catch` | `try/except` | `if err != nil` | `Result<T, E>` / `?` |
| Error shape | `interface` | `dataclass` | `struct` | `enum` |
| Structured logger | `pino`, `winston` | `structlog`, `loguru` | `slog`, `zap` | `tracing` |
| Error boundary | React `ErrorBoundary` | middleware | `recover()` | `panic` handler |
| Disposable | `finally` / `using` | `with` / `finally` | `defer` | `Drop` trait |

Adapt all rules, grep patterns, and code examples to the detected language(s) before execution.

---

## Rules

### 1. DRY Error Utilities

If a `try/catch`, fallback condition, or mapping pattern appears 2+ times, extract it into a shared utility (e.g., `wrapAsync()`, `handleApiError()`, `safeJsonParse()`). Place these in a canonical utilities directory.

**Canonical utilities to consider creating:**

| Utility | Purpose |
|---------|---------|
| `wrapAsync(fn)` | Wraps async operations with consistent error catching and logging |
| `safeJsonParse(raw)` | Returns `{ ok, data, error }` instead of throwing |
| `withTimeout(promise, ms)` | Wraps a promise with a timeout that rejects cleanly |
| `retryWithBackoff(fn, opts)` | Exponential backoff with jitter, max retries, abort signal |
| `toStandardError(unknown)` | Normalizes any thrown value into the StandardError shape |

### 2. Absolute Graceful Degradation

- End-users must see distinct, actionable messages with an error code and a next step. Never display generic "Something went wrong" or leak raw stack traces.
- **Partial failure isolation**: dataset/component failures must not crash the overarching orchestration. Use bulkhead patterns.
- Network/IO faults should enforce idempotency and retry safely; non-idempotent operations (writes, payments, deletions) must **fail-fast** with a clear refusal, never retry blindly.
- Mandatory cleanup: ensure `finally` blocks or disposable patterns are honored for connections, file handles, and locks.
- **Timeouts on every external call**: no `fetch()`, HTTP request, or DB query may execute without an explicit timeout. Default: 10s for APIs, 30s for batch/reports.

### 3. Strict Error Categorization & Severity Tiers

Classify every error into exactly one tier:

| Tier | Category | Examples | Action |
|------|----------|----------|--------|
| T1 — Transient | Operational, recoverable | Timeout, 429, 503, DNS failure | Retry with backoff (max 3) |
| T2 — Client | Operational, non-recoverable | 400, 401, 403, validation | Return structured error to caller, no retry |
| T3 — Degraded | Operational, partial | One API in a fan-out fails | Continue with partial data, log warning |
| T4 — Fatal | Programmer error | TypeError, null ref, assertion | Log full context + stack, fail the component, alert |

### 4. No Silent Swallows

Zero instances of `catch (e) {}` may exist. Every exception must be:
- **Routed** to the StandardError pipeline, OR
- **Logged** with contextual inputs (operation name, request ID, input parameters), OR
- **Explicitly discarded** with an inline `// INTENTIONAL: <reason>` comment.

Replace `console.log(e)` / `print(e)` with the project's structured logger. Structured log entries must include: `{ operation, error_code, error_message, context, timestamp }`.

### 5. Error Propagation Hygiene

- **Never re-throw without wrapping.** If you catch and re-throw, add context: `throw new AppError('fetch_user_failed', { cause: e, userId })`.
- **Never swallow the original cause.** Always chain via `cause` / `__cause__` / wrapping.
- **Boundary layers** (API handlers, CLI entry points, queue consumers) are the ONLY places that should translate errors into user-facing responses. Inner layers throw/return structured errors upward.

### 6. Simplification

- Prefer early returns and guard clauses over nested `try/catch`.
- Flatten deeply nested error handling (max 2 levels of `try/catch` nesting).
- Use `Result<T, E>` / discriminated union patterns where the language supports them.
- Co-locate error handling with the operation — avoid distant catch blocks that obscure the failure source.

---

## Process

Execute the following passes sequentially. After each pass, evaluate a **confidence score (0–100%)**: "How certain am I that all error paths are gracefully handled?" If confidence < 99.9%, loop back and fix remaining gaps. **Cap at 5 iterations** — if 99.9% is not reached, produce the report with remaining gaps documented and escalate.

### Pass 1 — Inventory & Deficit Discovery

Concrete steps:

1. **Grep for existing handlers** (adapt patterns for the project's language):
   ```bash
   # TypeScript/JavaScript
   grep -rn "\.catch\|try\s*{\|catch\s*(" src/ --include="*.ts" --include="*.tsx"
   grep -rn "catch\s*(\s*)" src/ --include="*.ts"  # empty catch
   grep -rn "console\.\(log\|error\|warn\)" src/ --include="*.ts" --include="*.tsx"

   # Python
   grep -rn "except\s*:" src/ --include="*.py"  # bare except
   grep -rn "except.*pass$" src/ --include="*.py"  # swallowed

   # Go
   grep -rn "_ = .*err" src/ --include="*.go"  # discarded errors
   ```

2. **Identify unprotected boundaries** — any of these without error handling is a defect:
   - External API calls (`fetch`, `requests`, `http.Get`)
   - Disk I/O (file read/write, temp files)
   - JSON/YAML/XML parsing
   - Database queries and transactions
   - IPC / message queue publish/consume
   - Environment variable reads (missing vars)
   - Child process spawning

3. **Map repetitive patterns** — list all duplicate error handling blocks for consolidation.

4. **Catalog existing error shapes** — find all custom error classes/types and check for fragmentation.

### Pass 2 — Consolidation & Shared Utilities

- Design shared error utilities and place them in the project's utilities layer.
- Establish a uniform error shape:

```typescript
interface StandardError {
  code: string;           // Machine-readable: 'FETCH_TIMEOUT', 'AUTH_EXPIRED'
  message: string;        // Human-readable with actionable next step
  context: Record<string, unknown>;  // Operation, inputs, request ID
  recoverable: boolean;   // Can the caller retry?
  tier: 'T1' | 'T2' | 'T3' | 'T4';  // Severity classification
  cause?: unknown;        // Original error, preserved for debugging
}
```

- Adapt the shape to the project's language and conventions.
- Create a `toStandardError(unknown)` normalizer that handles: `Error`, `string`, `null`, `undefined`, plain objects, and HTTP response objects.

### Pass 2.5 — Error Propagation Chain Audit

For each boundary layer (API route handler, queue consumer, CLI command, cron job):

1. Trace the error from throw site → catch site → user response.
2. Verify: does the original cause survive the chain? Is context accumulated, not lost?
3. Check: does the boundary layer map internal errors to appropriate HTTP status codes / exit codes?
4. Verify: are internal implementation details (file paths, SQL queries, stack frames) stripped before reaching the user?

### Pass 3 — Refactoring Execution

- Replace fragmented error handling with the shared utilities from Pass 2.
- Add missing handlers to ALL unprotected boundaries from Pass 1.
- Flatten complex nesting and prune dead catch blocks.
- Add circuit breakers for external dependencies that fail repeatedly:

```typescript
// Circuit breaker pattern — prevent cascading failures
const breaker = createCircuitBreaker({
  failureThreshold: 5,     // Open after 5 consecutive failures
  resetTimeout: 30_000,    // Try again after 30s
  monitor: (state) => logger.info({ circuit: name, state }),
});
```

- Add dead-letter handling for queue consumers — failed messages must be routed, not dropped.

### Pass 4 — Edge-Case & Boundary Stress Testing

Validate logic against ALL of these scenarios:

**Network & API:**
- Empty 200 OK responses with no body
- Corrupted or malformed JSON payloads
- Authentication token expiry mid-request
- Upstream service returning HTML error pages instead of JSON
- DNS resolution failure
- TLS handshake timeout
- HTTP 429 with `Retry-After` header

**Filesystem & I/O:**
- Race conditions on file system operations (write during read)
- Permission denied errors
- Disk full / quota exceeded
- File locked by another process
- Symlink loops

**Data & State:**
- Database connection pool exhaustion
- Transaction deadlocks
- Partial write (crash mid-batch)
- Integer overflow in counters
- Encoding mismatches (UTF-8 vs Latin-1)

**Process & System:**
- Out of memory during large payload processing
- SIGTERM during graceful shutdown
- Environment variable missing or malformed
- Dependency service version mismatch (breaking API change)

Verify that boundary layers strictly mask internals from outward-facing responses.

### Pass 5 — Verification & Confidence Assessment

1. **Automated checks:**
   ```bash
   # Anti-pattern grep (zero results expected)
   grep -rn "catch\s*(\s*)\s*{}" src/          # empty catch
   grep -rn "catch.*{\s*}" src/                 # single-line no-op catch
   grep -rn "console\.\(log\|error\)" src/      # raw console instead of logger
   grep -rn "// TODO.*error\|// FIXME.*error" src/  # deferred error work
   grep -rn "catch.*{\_s*return;" src/           # catch-and-return-nothing
   ```

2. **Run linter and test suite** to confirm no regressions.

3. **Manual review** of every boundary layer handler.

4. Re-assess confidence. If < 99.9%, trigger another iteration (up to cap of 5).

---

## Output Format

Per pass, include file-level detail:

```
Pass N — [Phase Name]
Confidence: X%
Files touched:
  - src/utils/errors.ts (created) — StandardError shape + toStandardError()
  - src/api/handler.ts (modified, L42-67) — replaced bare catch with wrapAsync
Modifications applied: [summary]
Gaps remaining: [list or "none"]
```

Final summary (once 99.9% is reached or iteration cap hit):

```
FINAL ERROR AUDIT
Final confidence: X%
Iterations required: N
Shared utilities created:
  - wrapAsync()       → src/utils/errors.ts
  - safeJsonParse()   → src/utils/json.ts
  - withTimeout()     → src/utils/async.ts
  - retryWithBackoff() → src/utils/retry.ts
Total files hardened: [count]
Anti-pattern grep results: 0 matches
Key improvements:
  - [item 1]
  - [item 2]
Remaining gaps (if cap hit):
  - [item or "none"]
```

---

## Anti-Patterns (with fixes)

| Anti-Pattern | Why It's Bad | Fix |
|---|---|---|
| `catch (e) {}` | Hides failures, makes debugging impossible | Log with context or add `// INTENTIONAL: <reason>` |
| `"Something went wrong"` | No actionable path for users | Include error code + next step: `"Upload failed (ERR_SIZE_LIMIT). Max file size is 10MB."` |
| `logger.error(e.message)` | No context for debugging | `logger.error({ operation: 'fetchUser', userId, err: e })` |
| Retry without backoff | Amplifies failures, triggers rate limits | `retryWithBackoff(fn, { maxRetries: 3, baseDelay: 1000 })` |
| `catch (e) { throw e }` | Re-throw without adding context is noise | `throw new AppError('op_failed', { cause: e, context })` |
| `catch (e) { return null }` | Caller can't distinguish "not found" from "error" | Return `Result<T, E>` or throw typed error |
| Nested try/catch > 2 levels | Obscures which operation actually failed | Extract inner operations into named functions |
| `fetch()` without timeout | Hangs indefinitely on network issues | `fetch(url, { signal: AbortSignal.timeout(10_000) })` |
| Catching `Error` base class | Catches programmer errors alongside operational ones | Catch specific error types or check `error.code` |

---

## Success Criteria

The audit is complete when:

1. Every pass has reached ≥ 99.9% confidence (or iteration cap reached with gaps documented).
2. Zero anti-pattern grep matches remain in the codebase.
3. All error paths route through shared utilities or have explicit `// INTENTIONAL:` justification.
4. Every external call has an explicit timeout.
5. Every boundary layer (API handler, queue consumer, CLI entry) has a top-level error handler.
6. The test suite passes with no regressions.
7. The final summary report is produced with file-level detail.
