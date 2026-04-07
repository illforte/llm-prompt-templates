# GEMINI.md — llm-prompt-templates

## Repository Purpose

Curated collection of reusable LLM prompt/instruction templates organized by model family.

## Critical Rules

### Version Tracking (MANDATORY)

Every template file (`__*.md`) MUST have a version tracking block at the **very top** of the document, before the title. Format:

```markdown
<!-- PROMPT_METADATA
version: 1.3
iteration_count: 3
last_model: Gemini 2.5 Pro
last_date: 2026-04-07
changelog:
  - v1.0 (2026-04-01, Claude Opus 4): Initial creation
  - v1.1 (2026-04-05, Gemini 2.5 Pro): Added Phase 3 parameterization examples
  - v1.3 (2026-04-07, Gemini 2.5 Pro): 21-point critical review, added anti-patterns section
-->
```

**Rules:**
- `version` — Increment by 0.1 for minor improvements, 1.0 for major structural rework
- `iteration_count` — Total number of LLM improvement passes performed on this template
- `last_model` — Human-readable model name that performed the iteration (e.g., "Claude Opus 4", "Gemini 2.5 Pro", "GPT-4o")
- `last_date` — ISO date of the last iteration
- `changelog` — Append-only log. Each entry: version, date, model, and a short description

### Guardrail: Before Committing Any Template Change

1. **Check** the `PROMPT_METADATA` block exists at the top of the file
2. **Increment** the `version` field
3. **Increment** the `iteration_count`
4. **Update** `last_model` and `last_date`
5. **Append** a new changelog entry describing what changed

If the metadata block is missing, **CREATE IT** before making any other changes.

Run the validation script before committing:

```bash
node scripts/validate-templates.mjs
```

### File Naming Convention

Templates follow: `__<model>-<TITLE_IN_CAPS>.md`

Examples:
- `__claude-PLUGIN_CREATION_MANUAL.md`
- `__gemini-SHARED_CORE_EXTRACTION_MANUAL.md`

### Content Rules

- **Generic only** — No company-specific data, personal info, or project-specific paths
- **Self-contained** — Each template should work when pasted into a fresh session
- **Structured** — Use phases, success criteria, and checklists
