<!-- PROMPT_METADATA
version: 1.0
iteration_count: 1
last_model: Claude Opus 4
last_date: 2026-04-01
changelog:
  - v1.0 (2026-04-01, Claude Opus 4): Initial creation — 8-phase plugin creation workflow with confidence loops
-->

# Claude Plugin Creation Manual

**A reusable prompt for transforming any existing skill/command into a marketplace-ready Claude plugin.**

Copy this entire document into a new Cowork session alongside your existing skill files. Claude will follow it step-by-step.

---

## Instructions for Claude

You are transforming an existing Claude skill (or set of skills/commands) into a fully structured, marketplace-ready Claude plugin. Follow every phase below in order. Do NOT skip phases. After each phase, run the confidence loop before proceeding.

### Confidence Loop Protocol

After completing each phase, perform a self-audit:

1. Re-read every file you created or modified in this phase
2. Verify against the success criteria listed for that phase
3. Assign a confidence score (0-100%)
4. If < 99.9%: identify gaps, fix them, re-score. Repeat until ≥ 99.9%
5. Log your confidence in the phase summary: `[CONFIDENCE: XX.X% → XX.X% → 99.9%+ ✓]`

Minimum 3 rounds per phase. No exceptions.

---

## Phase 0: Discovery & Inventory

**Goal**: Understand what exists before touching anything.

### Steps

1. **Catalog existing files**: List every file in the skill directory with purpose annotations
2. **Identify sensitive data**: Grep for API keys, URLs, emails, workspace IDs, user IDs, company names, internal ticket patterns — anything that cannot be committed to a public or shared repo
3. **Map dependencies**: Python packages, system tools, external APIs, browser requirements
4. **Identify MCP tools**: If the skill uses MCP tools, document each tool's name, inputs, outputs, and side effects
5. **Identify config surface**: What does the user need to configure? API keys, URLs, user IDs, preferences?
6. **Document the workflow**: What sequence of actions does this skill perform? What triggers it?

### Success Criteria

- [ ] Complete file inventory with annotations
- [ ] Sensitive data inventory (every hardcoded value that must be externalized)
- [ ] Dependency list (Python packages, system tools, APIs)
- [ ] MCP tool catalog (if applicable)
- [ ] Config surface documented
- [ ] Workflow sequence documented

### Output

Create `_AUDIT.md` (temporary, will be gitignored) with all findings.

---

## Phase 1: Plugin Directory Structure

**Goal**: Restructure files into the canonical Claude plugin layout.

### Target Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (REQUIRED)
├── skills/
│   └── plugin-name/
│       ├── SKILL.md             # Full skill prompt (REQUIRED)
│       └── SKILL_SLIM.md        # Compact version for token efficiency (RECOMMENDED)
├── mcp/
│   ├── server.py                # MCP server (if applicable)
│   └── requirements.txt         # Python dependencies for MCP
├── scripts/
│   ├── config_loader.py         # Config loading with data dir isolation
│   ├── persona_config.template.json  # Config template (committed)
│   ├── shell_compat.py          # ZSH compatibility guardrail
│   └── [domain scripts...]      # Your actual logic
├── references/
│   └── [templates, docs...]     # Reference files (HTML templates, etc.)
├── install_plugin.sh            # One-command installer
├── .gitignore                   # Comprehensive (see template below)
├── README.md                    # User-facing documentation
├── CHANGELOG.md                 # Version history
└── LICENSE                      # MIT or your choice
```

### Key Principles

- **Skills go in `skills/plugin-name/`** — not the root. The `plugin.json` references them.
- **MCP servers go in `mcp/`** — with their own `requirements.txt`.
- **Scripts go in `scripts/`** — all Python logic, utilities, config loading.
- **References go in `references/`** — templates, static assets, architecture docs.
- **Internal docs are gitignored** — setup guides, implementation notes with company data stay local.

### plugin.json Template

```json
{
  "name": "your-plugin-name",
  "description": "One-line description of what this plugin does.",
  "version": "0.1.0",
  "author": {
    "name": "your-github-username",
    "email": "your-email@example.com"
  },
  "license": "MIT",
  "homepage": "https://github.com/username/plugin-name",
  "repository": "https://github.com/username/plugin-name",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "category": "productivity",
  "skills": [
    "./skills/your-plugin-name"
  ],
  "mcpServers": {
    "your_mcp_server": {
      "command": "${CLAUDE_PLUGIN_ROOT}/.venv/bin/python3",
      "args": ["${CLAUDE_PLUGIN_ROOT}/mcp/server.py"],
      "env": {}
    }
  }
}
```

**Variables**: `${CLAUDE_PLUGIN_ROOT}` = plugin install directory. `${CLAUDE_PLUGIN_DATA}` = persistent user data directory (outside the plugin tree).

### Success Criteria

- [ ] All files in correct directories
- [ ] `plugin.json` valid and complete
- [ ] Skills in `skills/plugin-name/` with YAML frontmatter
- [ ] No orphaned files

---

## Phase 2: Config Isolation (Multi-User / Multi-Company)

**Goal**: Externalize ALL sensitive and user-specific data so the plugin works for anyone.

### The Data Directory Pattern

All runtime data (configs, API keys, logs, caches, reports) must live OUTSIDE the plugin tree in a persistent "data directory". This is critical for:
- Multi-company use (different configs for different orgs)
- Security (secrets never in the repo)
- Clean updates (pull new plugin version without overwriting user data)

### Implementation: `_get_data_dir()`

Add this to your config loader (or create `scripts/config_loader.py`):

```python
import os

def _get_data_dir():
    """
    Resolve persistent data directory. 3-tier fallback:
    1. PLUGINNAME_DATA_DIR env var (explicit override)
    2. CLAUDE_PLUGIN_DATA env var (set by Claude plugin system)
    3. ~/.config/plugin-name/ (XDG-style default)
    """
    # Tier 1: Explicit env var (for multi-company setups)
    data_dir = os.environ.get("PLUGINNAME_DATA_DIR")
    if data_dir:
        data_dir = os.path.expanduser(data_dir)
        os.makedirs(data_dir, exist_ok=True)
        return os.path.abspath(data_dir)

    # Tier 2: Claude plugin system
    plugin_data = os.environ.get("CLAUDE_PLUGIN_DATA")
    if plugin_data:
        plugin_data = os.path.expanduser(plugin_data)
        os.makedirs(plugin_data, exist_ok=True)
        return os.path.abspath(plugin_data)

    # Tier 3: XDG default
    xdg_config = os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config"))
    data_dir = os.path.join(xdg_config, "plugin-name")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.abspath(data_dir)
```

### Path Placeholders

In config files, use placeholders instead of absolute paths:

| Placeholder | Resolves To | Use For |
|---|---|---|
| `{data_dir}` | `_get_data_dir()` | Logs, caches, API keys, user config |
| `{workspace}` | User's workspace folder | Reading user files |
| `{skill_dir}` | Plugin installation dir | Reading bundled templates/references |

### Config File Search Order

```
1. ENV: PLUGINNAME_CONFIG → explicit path
2. {data_dir}/config.json → user's persistent config
3. {workspace}/config.json → workspace-local config
4. {skill_dir}/scripts/config.template.json → defaults (READ-ONLY)
```

### Scrubbing Checklist

Search and replace ALL of the following in committed code:

- [ ] Company domain names → `example.com`
- [ ] Internal URLs → `your-instance.example.com`
- [ ] Email addresses → `user@example.com`
- [ ] Slack workspace IDs → empty string or placeholder
- [ ] Slack channel IDs → empty string or placeholder
- [ ] User/colleague IDs → empty arrays `[]`
- [ ] Internal ticket patterns → generic examples
- [ ] API keys / tokens → never committed, loaded from data_dir

### Verification

```bash
# Scan for any remaining sensitive patterns
grep -rn "your-company\|internal-url\|slack-workspace-id" --include="*.py" --include="*.json" --include="*.md" --include="*.sh" .
# Must return ZERO matches in committed files
```

### Success Criteria

- [ ] `_get_data_dir()` implemented with 3-tier fallback
- [ ] All paths in config use `{data_dir}` placeholder
- [ ] Config template committed (with placeholders, no real data)
- [ ] Actual config gitignored
- [ ] API key locations point to `{data_dir}` first
- [ ] Zero company-specific strings in committed code (verified by grep)

---

## Phase 3: Shell Compatibility (macOS/ZSH)

**Goal**: All shell scripts and generated commands must be zsh-safe.

### Why This Matters

macOS Catalina+ defaults to zsh. Bash-only constructs cause cryptic failures:
- `!` in double quotes → `zsh: event not found` (history expansion)
- `${!var}` → syntax error (bash indirect expansion)
- `BASH_SOURCE` → undefined variable
- `read -a` → invalid option

### Fixes

| Bash-only | ZSH-compatible |
|---|---|
| `#!/bin/bash` | `#!/usr/bin/env zsh` |
| `${BASH_SOURCE[0]}` | `$0` |
| `${!ARRAY[@]}` | iterate with `for x in "${ARRAY[@]}"` |
| `[ ! -z "$var" ]` | `[ -n "$var" ]` |
| `echo "Hello!"` | `echo 'Hello!'` or `echo "Hello\!"` |
| `read -a arr` | `read -A arr` |
| `declare -A` | `typeset -A` |

### Guardrail: `scripts/shell_compat.py`

Add a shell compatibility checker to your plugin. It scans commands for zsh pitfalls:

```python
# Usage in Python code:
from shell_compat import check_zsh_safe
issues = check_zsh_safe('echo "Hello!"')  # Returns list of issues

# Usage from CLI:
python3 scripts/shell_compat.py scan install_plugin.sh
python3 scripts/shell_compat.py check 'some command'
```

Add this rule to your SKILL.md under "Critical Rules":

> **ZSH guardrail (macOS)**: All shell commands must be zsh-safe. Never use `!` inside double quotes. Never use bash-only constructs (`${!var}`, `BASH_SOURCE`, `read -a`). Validate with `python3 scripts/shell_compat.py check 'command'` before presenting shell snippets.

### Success Criteria

- [ ] All `.sh` files use `#!/usr/bin/env zsh` shebang
- [ ] Zero bash-only constructs in shell scripts
- [ ] `shell_compat.py` passes scan on all `.sh` files
- [ ] SKILL.md includes zsh guardrail rule

---

## Phase 4: SKILL.md Authoring

**Goal**: Write the skill prompt that tells Claude how to use this plugin.

### SKILL.md Structure (Full Version)

```markdown
---
name: plugin-name
description: "One-line description. Include trigger keywords here."
---

# Plugin Name

## When to Use

[Trigger conditions — what user says that should activate this skill.
Include natural language triggers AND keyword triggers.]

## Prerequisites

[What must be in place before the skill runs.]

## Quick Workflow

[Numbered step-by-step sequence. Reference MCP tool names with backticks.]

## Critical Rules

[Non-negotiable constraints. Things Claude must NEVER do.
Things Claude must ALWAYS do. Format as bold statements.]

## [Domain-Specific Sections]

[Evidence tiers, category systems, log formats — whatever your domain needs.]

## First-Time Setup

[How a new user gets started.]

## See Also

[Links to reference docs within the plugin.]
```

### SKILL_SLIM.md (Token-Efficient Version)

Same structure but compressed — remove examples, merge sections, keep only the essential rules and workflow steps. This is what Claude loads by default; the full version is for reference.

### Trigger Design

Your `description` field in the YAML frontmatter is what Claude uses to decide whether to load this skill. Make it specific:

**Bad**: `"A productivity tool"`
**Good**: `"Weekly time tracking gap analysis. Triggers on 'time tracking', 'missing hours', 'Zeiterfassung'. Cross-references Redmine, Slack, Outlook."`

### Success Criteria

- [ ] SKILL.md has YAML frontmatter with name + description
- [ ] Description contains trigger keywords
- [ ] Workflow steps reference actual tool names
- [ ] Critical rules section is present and specific
- [ ] SKILL_SLIM.md exists as compressed version
- [ ] Both files contain zero company-specific data

---

## Phase 5: MCP Server (if applicable)

**Goal**: Wrap your data operations as MCP tools.

### When to Use MCP

Use MCP tools when your plugin needs to:
- Make API calls (Redmine, Jira, Slack, etc.)
- Process data that's too complex for inline Python
- Provide structured tool interfaces to Claude
- Maintain state across operations (caches, logs)

### MCP Server Template (FastMCP + Pydantic)

```python
#!/usr/bin/env python3
"""MCP server for plugin-name."""

import asyncio
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

mcp = FastMCP("plugin_name_mcp")

class ToolInput(BaseModel):
    """Input schema — Claude sees these field descriptions."""
    param: str = Field(description="What this parameter does")

@mcp.tool(name="prefix_action", description="What this tool does in one sentence.")
async def tool_action(params: ToolInput) -> str:
    """Implementation."""
    # Use asyncio.to_thread() for blocking I/O
    result = await asyncio.to_thread(blocking_function, params.param)
    return result

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### MCP Best Practices

- **Prefix all tools** with a short namespace (e.g., `tga_`, `jira_`, `crm_`)
- **Pydantic models for all inputs** — Claude sees the field descriptions as tool documentation
- **Return strings** — MCP tools return text that Claude interprets
- **Use `asyncio.to_thread()`** for blocking I/O (httpx, file reads)
- **Config loading**: Import from `scripts/config_loader.py`, use `_get_data_dir()`
- **Error handling**: Return human-readable error strings, not stack traces
- **Idempotency**: Tools that write data should check before writing (deduplication)

### requirements.txt

```
mcp>=1.0.0
pydantic>=2.0.0
httpx>=0.25.0
```

### Success Criteria

- [ ] MCP server compiles: `python3 -c "import py_compile; py_compile.compile('mcp/server.py', doraise=True)"`
- [ ] All tools have Pydantic input models with Field descriptions
- [ ] All tools have meaningful `name` and `description`
- [ ] Config loaded from data_dir, not hardcoded
- [ ] requirements.txt is complete and minimal
- [ ] `plugin.json` mcpServers entry uses `${CLAUDE_PLUGIN_ROOT}`

---

## Phase 6: Installer Script

**Goal**: One-command setup that works on a fresh macOS machine.

### install_plugin.sh Template

```zsh
#!/usr/bin/env zsh
# Plugin Name — Installer
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ... (validate paths, check Python, create venv, install deps,
#      register MCP in Claude config, run setup wizard, verify API keys,
#      run self-test)
```

### Installer Responsibilities

1. Validate directory structure
2. Check Python 3 availability
3. Create venv + install dependencies (with fallback strategies: venv → user → brew)
4. Validate MCP server compiles
5. Register MCP server in Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`)
6. Auto-detect or interactively create user config
7. Verify API key availability (file → keychain → env var)
8. Run post-install self-test
9. Print next steps

### Success Criteria

- [ ] `#!/usr/bin/env zsh` shebang
- [ ] `shell_compat.py scan install_plugin.sh` passes clean
- [ ] Works on fresh macOS with only system Python
- [ ] Idempotent (safe to run multiple times)
- [ ] Provides `--check` and `--uninstall` modes
- [ ] Clear error messages with fix suggestions

---

## Phase 7: Repository Hygiene

**Goal**: Clean, professional repo ready for sharing.

### .gitignore Template

```gitignore
# User config (contains API keys, URLs, user IDs)
scripts/persona_config.json
**/config.json
!scripts/persona_config.template.json
!scripts/config.template.json

# API keys and secrets
**/api_key*.txt
*.key
*.secret
*.token

# Runtime data
logs/
reports/
cache/
*.html
!references/*.html

# Internal docs (contain company-specific setup details)
references/SETUP.md
scripts/IMPLEMENTATION_NOTES.md
_AUDIT.md

# Virtual environment
.venv/

# Python bytecode
__pycache__/
*.pyc
*.pyo
*.egg-info/
dist/
build/

# OS files
.DS_Store
Thumbs.db

# IDE / Editor
.vscode/
.idea/
*.swp
*~

# Temp files
*.tmp
*.bak
*.orig
```

### README.md Structure

```markdown
# Plugin Name

One-line description.

## Features
## Requirements
## Installation
## Usage
## MCP Tools (table: name | description | key params)
## Configuration
## License
```

### CHANGELOG.md

```markdown
# Changelog

## [0.1.0] - YYYY-MM-DD
### Added
- Initial release
- Feature X, Y, Z
```

### LICENSE

Use MIT unless you have a reason not to. Create with:
```
Year, Author Name — MIT License (full text)
```

### Git Setup

```zsh
git init
git config user.name "your-github-username"
git config user.email "ID+username@users.noreply.github.com"  # Use GitHub noreply!
git add -A
git commit -m "feat: initial release of PluginName vX.Y.Z"
git remote add origin git@github.com:username/plugin-name.git
git push -u origin main
```

**Important**: Use your GitHub noreply email to avoid the `GH007: push would publish a private email` error. Find it at https://github.com/settings/emails.

### Success Criteria

- [ ] `.gitignore` covers all sensitive/runtime files
- [ ] `git status` shows no untracked sensitive files
- [ ] README.md is complete and contains no company-specific data
- [ ] CHANGELOG.md exists
- [ ] LICENSE exists
- [ ] All committed files pass: `grep -rn "SENSITIVE_PATTERN" .` returns 0 matches
- [ ] Git user email is GitHub noreply address

---

## Phase 8: Final Verification (Deep Audit)

**Goal**: Comprehensive quality check across all dimensions.

### Launch parallel verification agents

Use this exact prompt structure to launch verification agents in parallel:

```
Launch 3 agents in a single message:

Agent 1 — SECURITY AUDIT:
Scan every committed file for: hardcoded credentials, API keys, internal URLs,
company names, email addresses, Slack/user IDs. Must find ZERO matches.
Check .gitignore covers all sensitive patterns. Verify config template has
only placeholders.

Agent 2 — ARCHITECTURE AUDIT:
Verify plugin.json is valid. Verify all paths in plugin.json resolve.
Verify MCP server compiles. Verify all imports resolve. Check for unused
imports, bare exceptions, inconsistent path resolution. Verify _get_data_dir()
is used consistently (not hardcoded paths).

Agent 3 — COMPATIBILITY AUDIT:
Run shell_compat.py scan on all .sh files. Check all Python files for
subprocess calls that generate shell commands — verify they're zsh-safe.
Verify shebang lines. Check install_plugin.sh works idempotently.
Test: python3 -c "import py_compile; py_compile.compile('mcp/server.py')"
```

### Per-Finding Format

Each agent must report findings in this format:

```
### Finding N: [Title]
- **Evidence**: [exact file:line or command output]
- **Impact**: [what breaks if unfixed]
- **Effort**: [S/M/L]
- **Fix**: [specific action]
- **Verification**: [command to confirm fix]
```

### Final Confidence Loop

After all agents report and fixes are applied:

1. Re-run all 3 audit scans
2. Verify zero findings remain
3. Final confidence score must be ≥ 99.9%
4. Document: `[FINAL CONFIDENCE: XX.X% ✓]`

### Success Criteria

- [ ] Security audit: 0 sensitive data in committed files
- [ ] Architecture audit: 0 broken paths, 0 import errors
- [ ] Compatibility audit: 0 zsh issues, MCP compiles
- [ ] All quick-win findings (effort=S) fixed
- [ ] Final confidence ≥ 99.9%

---

## Quick Reference: Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| `!` in double quotes | `zsh: event not found` | Use single quotes or `\!` |
| `#!/bin/bash` on macOS | Script fails silently or with zsh errors | `#!/usr/bin/env zsh` |
| Hardcoded API URL | Plugin only works for one company | Use `{data_dir}` + config |
| Config in plugin dir | Overwritten on plugin update | Externalize to `_get_data_dir()` |
| GitHub noreply email | `GH007: push declined` | Use `ID+user@users.noreply.github.com` |
| `${!var}` bash expansion | `bad substitution` in zsh | Rewrite loop without indirect |
| Sensitive data in commit | Leaked credentials | Scrub + `.gitignore` + `git filter-branch` |
| Missing `requirements.txt` | MCP server fails to start | List all pip dependencies |
| No YAML frontmatter in SKILL.md | Skill not discovered by Claude | Add `---\nname:\ndescription:\n---` |

---

## Checklist: "Am I Done?"

Copy this into your session as the final gate:

```
PLUGIN READINESS CHECKLIST:

[ ] plugin.json valid, version set, skills array populated
[ ] SKILL.md + SKILL_SLIM.md in skills/plugin-name/ with YAML frontmatter
[ ] MCP server compiles, all tools documented
[ ] Config externalized to _get_data_dir(), template committed
[ ] Zero sensitive data in any committed file (verified by grep)
[ ] All .sh files use #!/usr/bin/env zsh, pass shell_compat scan
[ ] install_plugin.sh works with --check, --uninstall modes
[ ] .gitignore covers: configs, keys, logs, caches, internal docs
[ ] README.md, CHANGELOG.md, LICENSE present
[ ] Git remote set, noreply email configured, pushed successfully
[ ] Deep audit passed with ≥99.9% confidence
```
