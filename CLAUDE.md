# CLAUDE.md — llm-prompt-templates

## Repository Purpose

Curated collection of reusable LLM prompt/instruction templates organized by model family.

## Critical Rules

### Version Tracking (MANDATORY)

Every template file (`__*.md`) MUST have a `PROMPT_METADATA` HTML comment block at the **very top** of the document, before the title. Format:

```markdown
<!-- PROMPT_METADATA
version: 1.3
iteration_count: 3
last_model: Claude Opus 4
last_date: 2026-04-07
changelog:
  - v1.0 (2026-04-01, Claude Opus 4): Initial creation
  - v1.1 (2026-04-05, Gemini 2.5 Pro): Added Phase 3 examples
  - v1.3 (2026-04-07, Claude Opus 4): Major rework, added anti-patterns
-->
```

**Before committing any template change, you MUST:**
1. Verify the `PROMPT_METADATA` block exists (create it if missing)
2. Increment `version` (0.1 for minor, 1.0 for major rework)
3. Increment `iteration_count`
4. Set `last_model` to your model name (e.g., "Claude Opus 4")
5. Set `last_date` to today's ISO date
6. Append a changelog entry: `- vX.Y (DATE, MODEL): description`

**Validate before commit:**
```bash
node scripts/validate-templates.mjs
```

### Legacy Reference Templates

If a template has been demoted into a workspace-owned legacy reference for a canonical workflow, keep it machine-readable.

Required additional metadata fields:

```markdown
canonical_capability_id: post_sprint_cleanup
canonical_source_of_truth: .agents/workflows/post_sprint_cleanup.md
canonical_sync_mode: generated-snapshot
canonical_source_sha256: <64 hex chars>
```

Rules:

1. Treat these files as generated reference snapshots, not author-edited primary prompts.
2. Do not hand-edit the generated snapshot body.
3. Regenerate from the workspace root with:
   `node .ai/bin/sync-legacy-prompt-references.mjs --cwd /Users/florian.scheugenpflug/Projekte`

### File Naming

Templates: `__<model>-<TITLE_IN_CAPS>.md`

### Content Rules

- **Generic only** — No company-specific data, personal info, or project-specific paths
- **Self-contained** — Each template should work when pasted into a fresh session
- **Structured** — Use phases, success criteria, and checklists
