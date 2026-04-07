<!-- PROMPT_METADATA
version: 1.1
iteration_count: 2
last_model: Claude Opus 4.6
last_date: 2026-04-07
changelog:
  - v1.0 (2026-04-01, Claude Opus 4): Initial creation — 8-phase plugin creation workflow with confidence loops
  - v1.1 (2026-04-07, Claude Opus 4.6): Real-world fixes — SKILL.md root symlink, Claude Code registration, Python 3.10+ venv, workspace data dir routing, workspace symlink pattern
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
├── SKILL.md                     # Symlink → skills/plugin-name/SKILL.md (REQUIRED for Claude Code)
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (REQUIRED)
├── skills/
│   └── plugin-name/
│       ├── SKILL.md             # Full skill prompt (REQUIRED)
│       └── SKILL_SLIM.md        # Compact version for token efficiency (RECOMMENDED)
├── mcp/
│   ├── server.py                # MCP server (if applicable)
│   └── requirements.txt         # Python dependencies for MCP (needs Python 3.10+)
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

### Critical: SKILL.md Root Symlink

Claude Code discovers skills by looking for `SKILL.md` at `<skill-root>/SKILL.md`. Since your actual SKILL.md lives in `skills/plugin-name/SKILL.md`, you must create a symlink at the plugin root:

```zsh
# From inside the plugin directory:
ln -s skills/plugin-name/SKILL.md SKILL.md
```

This symlink IS committed to the repo (it's safe — it only contains a relative path). The installer script should create it automatically (see Phase 6).

**Without this symlink, the skill will not appear in Claude Code's skill list.**

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

### Multi-Skill Plugins

Some plugins contain multiple sub-skills (e.g., a pipeline with distinct phases). In this case:

```
plugin-name/
├── SKILL.md                    # Symlink to the MAIN orchestrator skill
├── skills/
│   ├── main-skill/             # Orchestrator (referenced by root SKILL.md)
│   │   └── SKILL.md
│   ├── sub-skill-a/            # Phase/module skill
│   │   └── SKILL.md
│   └── sub-skill-b/
│       └── SKILL.md
```

The root `SKILL.md` symlink should point to the **main orchestrator** skill, which then references sub-skills in its workflow. The sub-skills are loaded by Claude when the orchestrator's instructions reference them — they don't need individual root symlinks.

In `plugin.json`, list all skills:

```json
"skills": [
    "./skills/main-skill",
    "./skills/sub-skill-a",
    "./skills/sub-skill-b"
]
```

### Workspace Integration Pattern

Plugins are typically stored in a development repo (`~/dev-repos/plugin-name/`) and linked into one or more Claude Code workspaces:

```zsh
# Link plugin into a workspace
ln -s ~/dev-repos/plugin-name ~/my-workspace/.claude/skills/plugin-name
```

This symlink means:
- The dev repo stays in `~/dev-repos/` and can be committed to git
- The workspace sees the plugin in `.claude/skills/plugin-name/`
- Runtime data must NOT go into the dev repo (covered in Phase 2)

### Success Criteria

- [ ] All files in correct directories
- [ ] `plugin.json` valid and complete
- [ ] Skills in `skills/plugin-name/` with YAML frontmatter
- [ ] `SKILL.md` symlink created at plugin root: `SKILL.md → skills/plugin-name/SKILL.md`
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

**Important**: The `mcp` package requires Python 3.10+. On macOS, the system Python is 3.9 and cannot install this package. See Phase 6 for the multi-strategy installer pattern that handles this.

### Success Criteria

- [ ] MCP server compiles: `python3 -c "import py_compile; py_compile.compile('mcp/server.py', doraise=True)"`
- [ ] All tools have Pydantic input models with Field descriptions
- [ ] All tools have meaningful `name` and `description`
- [ ] Config loaded from data_dir, not hardcoded
- [ ] requirements.txt is complete and minimal
- [ ] `plugin.json` mcpServers entry uses `${CLAUDE_PLUGIN_ROOT}`

---

## Phase 6: Installer Script

**Goal**: One-command setup that works on a fresh macOS machine, for both Claude Desktop and Claude Code, with workspace-local data routing.

### install_plugin.sh Template

```zsh
#!/usr/bin/env zsh
# Plugin Name — Installer
# Version: X.Y.Z
# Usage:
#   zsh install_plugin.sh                          # Full install
#   zsh install_plugin.sh --workspace /path/to/ws  # Install with workspace data dir
#   zsh install_plugin.sh --check                  # Verify installation
#   zsh install_plugin.sh --uninstall              # Remove from Claude config
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_NAME="your-plugin-name"
MCP_KEY="your_mcp_server"
MCP_SERVER="$SCRIPT_DIR/mcp/server.py"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Claude Desktop config
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
# Claude Code config (different location!)
CLAUDE_CODE_CONFIG="$HOME/.claude/settings.json"
```

### Installer Responsibilities (in order)

1. **Validate paths** — confirm `mcp/`, `scripts/`, MCP server file exist
2. **Detect workspace** — find which Claude Code workspace links to this plugin
3. **Set data dir** — route runtime data to workspace (not dev repo)
4. **Check Python** — detect version, warn if < 3.10 (macOS system Python is 3.9)
5. **Install dependencies** — multi-strategy: venv → user → brew (critical, see below)
6. **Create SKILL.md symlink** — ensure skill is discoverable by Claude Code
7. **Validate MCP server** — compile check
8. **Register in Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`
9. **Register in Claude Code** — `~/.claude/settings.json` with `"trust": true`
10. **Both registrations must include `PLUGINNAME_DATA_DIR` env var** pointing to workspace data dir
11. **Setup config** — auto-detect or create user config in data dir
12. **Verify API keys** — file → keychain → env var
13. **Run self-test** — with `PLUGINNAME_DATA_DIR` set to the workspace data dir
14. **Print next steps** — include data dir path

### Python Version: Critical Detail

The `mcp` Python package requires **Python 3.10+**. macOS ships with Python 3.9 as system Python, which cannot install `mcp`. The installer MUST handle this:

```zsh
PY_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)

# Warn on system Python 3.9 — will need venv with newer Python
if [ "$PY_MINOR" -lt 10 ]; then
    warn "System Python $PY_VERSION — need 3.10+ for 'mcp' package"
fi
```

**Multi-strategy dependency installation** (handles system Python 3.9):

```zsh
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON_CMD="python3"

install_deps() {
    local method=$1
    case $method in
        "venv")
            python3 -m venv "$VENV_DIR" 2>/dev/null || return 1
            source "$VENV_DIR/bin/activate"
            pip install -q mcp pydantic httpx 2>&1 || { deactivate; return 1; }
            PYTHON_CMD="$VENV_DIR/bin/python3"
            deactivate; return 0 ;;
        "user")
            pip3 install --user -q mcp pydantic httpx && return 0 || return 1 ;;
        "brew")
            # Try installed Homebrew Pythons (3.13, 3.12, 3.11)
            for ver in python@3.13 python@3.12 python@3.11; do
                BREW_PY="$(brew --prefix $ver 2>/dev/null)/bin/python3"
                [ -f "$BREW_PY" ] || continue
                "$BREW_PY" -m venv "$VENV_DIR" && \
                source "$VENV_DIR/bin/activate" && \
                pip install -q mcp pydantic httpx && \
                PYTHON_CMD="$VENV_DIR/bin/python3" && \
                deactivate && return 0
                deactivate 2>/dev/null
            done
            return 1 ;;
    esac
}

# Try in order until one works
for strategy in venv user brew; do
    install_deps "$strategy" && break
done
```

### Workspace Detection

The plugin dir is typically in a dev repo (`~/dev-repos/plugin-name/`) and symlinked into Claude Code workspaces. The installer should auto-detect which workspace links to it:

```zsh
detect_workspace() {
    # Search common workspace locations for a symlink pointing to this plugin
    for ws in "$HOME/workspace" "$HOME/Workspace" "$HOME/Projects" "$HOME/myproject"; do
        local link="$ws/.claude/skills/$PLUGIN_NAME"
        if [ -L "$link" ] && [ "$(cd "$(readlink "$link")" 2>/dev/null && pwd)" = "$SCRIPT_DIR" ]; then
            echo "$ws"; return 0
        fi
    done
    return 1
}

WORKSPACE="${1:-}"  # Allow --workspace argument
[ -z "$WORKSPACE" ] && WORKSPACE="$(detect_workspace 2>/dev/null)" || true

if [ -n "$WORKSPACE" ]; then
    DATA_DIR="$WORKSPACE/.claude/data/$PLUGIN_NAME"
    mkdir -p "$DATA_DIR/logs" "$DATA_DIR/cache"
else
    DATA_DIR="$HOME/.config/$PLUGIN_NAME"
    mkdir -p "$DATA_DIR/logs" "$DATA_DIR/cache"
fi
```

### SKILL.md Symlink (Step Added in Installer)

```zsh
# Create SKILL.md symlink at root so Claude Code can discover the skill
if [ ! -e "$SCRIPT_DIR/SKILL.md" ]; then
    ln -s "skills/$PLUGIN_NAME/SKILL.md" "$SCRIPT_DIR/SKILL.md"
    ok "SKILL.md symlink created"
else
    ok "SKILL.md symlink exists"
fi
```

This symlink is committed to git (it's just a relative path). Without it, the skill won't appear in Claude Code.

### Claude Code Registration (Different from Claude Desktop!)

Claude Desktop uses `~/Library/Application Support/Claude/claude_desktop_config.json`. Claude Code uses `~/.claude/settings.json`. Both need the MCP server, and both must include `PLUGINNAME_DATA_DIR`:

```python
# Claude Code registration (Python snippet used in installer)
import json, os

code_config_path = os.path.expanduser("~/.claude/settings.json")
if os.path.isfile(code_config_path):
    with open(code_config_path) as f:
        config = json.load(f)
    config.setdefault("mcpServers", {})["your_mcp_server"] = {
        "command": "/path/to/.venv/bin/python3",  # or python3 if system
        "args": ["/path/to/mcp/server.py"],
        "env": {"PLUGINNAME_DATA_DIR": "/path/to/workspace/.claude/data/plugin-name"},
        "trust": True   # Required for Claude Code, not needed for Desktop
    }
    with open(code_config_path, "w") as f:
        json.dump(config, f, indent=2)
```

**Key difference**: Claude Code entries need `"trust": True`. Claude Desktop does not.

### Data Dir Env Var in MCP Registration

Both registrations must include the data dir env var so the MCP server routes all runtime files to the workspace, not the dev repo:

```json
{
  "command": "python3",
  "args": ["/path/to/mcp/server.py"],
  "env": {
    "PLUGINNAME_DATA_DIR": "/path/to/workspace/.claude/data/plugin-name"
  }
}
```

This is what makes the data isolation work at runtime — without it, even if your config loader supports `PLUGINNAME_DATA_DIR`, the MCP server won't have it set.

### --check Mode (What to Verify)

```zsh
# In --check mode, verify ALL of these:
ok/warn "Python3: $(python3 --version)"
ok/warn "Virtual env: $VENV_DIR"
ok/warn "Package mcp: installed" / fail
ok/warn "MCP server: compiles"
ok/warn "SKILL.md symlink: exists"
ok/warn "Persona config: $DATA_DIR/persona_config.json"
ok/warn "Claude Desktop: MCP registered"
ok/warn "Claude Code: MCP registered"
ok/warn "Claude Code: PLUGINNAME_DATA_DIR configured"
```

### --uninstall Mode

Must remove from BOTH configs:

```python
for config_path in [CLAUDE_CONFIG, CLAUDE_CODE_CONFIG]:
    if os.path.isfile(config_path):
        config = json.load(open(config_path))
        config.get("mcpServers", {}).pop("your_mcp_server", None)
        json.dump(config, open(config_path, "w"), indent=2)
```

### Success Criteria

- [ ] `#!/usr/bin/env zsh` shebang
- [ ] `shell_compat.py scan install_plugin.sh` passes clean
- [ ] Handles Python 3.9 (system macOS) via multi-strategy venv installation
- [ ] Creates `SKILL.md` symlink at plugin root
- [ ] Registers MCP in **both** Claude Desktop and Claude Code
- [ ] Both registrations include `PLUGINNAME_DATA_DIR` env var pointing to workspace
- [ ] Data dir created in workspace, not in dev repo
- [ ] Idempotent (safe to run multiple times)
- [ ] Provides `--check`, `--uninstall`, `--workspace` modes
- [ ] Clear error messages with fix suggestions
- [ ] Self-test runs with `PLUGINNAME_DATA_DIR` set

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
plans/
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
git status                    # Review what will be committed — verify .gitignore is working
git add -A                    # Only after confirming no sensitive files are staged
git commit -m "feat: initial release of PluginName vX.Y.Z"
git remote add origin git@github.com:username/plugin-name.git
git push -u origin main
```

**Important**: Use your GitHub noreply email to avoid the `GH007: push would publish a private email` error. Find it at https://github.com/settings/emails.

### Success Criteria

- [ ] `.gitignore` covers all sensitive/runtime files (configs, keys, logs, caches, `.venv/`)
- [ ] `SKILL.md` symlink at root is committed: `git ls-files SKILL.md` shows it
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
| No `SKILL.md` at plugin root | Skill invisible to Claude Code | `ln -s skills/plugin-name/SKILL.md SKILL.md` |
| Python 3.9 can't install `mcp` | `No matching distribution found` | Multi-strategy install: detect < 3.10, use Homebrew Python + venv |
| MCP only in Claude Desktop | Works in Desktop, not Claude Code | Register in BOTH `claude_desktop_config.json` AND `~/.claude/settings.json` |
| Claude Code entry missing `trust` | Permission prompts on every MCP call | Add `"trust": True` to Claude Code MCP entry |
| No `PLUGINNAME_DATA_DIR` in MCP env | Runtime data saved to dev repo or XDG | Add env var to MCP server registration pointing to workspace data dir |
| Data dir in dev repo | Runtime files get committed | Set `PLUGINNAME_DATA_DIR=<workspace>/.claude/data/<plugin>` and use `_get_data_dir()` |
| Plugin dir is a symlink | `SCRIPT_DIR` resolves to real path, not symlink | Use `cd "$(dirname "$0")" && pwd` — this is correct, workspace detection needs symlink search |

---

## Checklist: "Am I Done?"

Copy this into your session as the final gate:

```
PLUGIN READINESS CHECKLIST:

[ ] plugin.json valid, version set, skills array populated
[ ] SKILL.md + SKILL_SLIM.md in skills/plugin-name/ with YAML frontmatter
[ ] SKILL.md symlink at plugin root → skills/plugin-name/SKILL.md (committed to git)
[ ] MCP server compiles, all tools documented
[ ] Config externalized to _get_data_dir(), template committed
[ ] _get_data_dir() supports PLUGINNAME_DATA_DIR env var (3-tier: env → CLAUDE_PLUGIN_DATA → XDG)
[ ] Zero sensitive data in any committed file (verified by grep)
[ ] All .sh files use #!/usr/bin/env zsh, pass shell_compat scan
[ ] install_plugin.sh handles Python 3.9 via multi-strategy install (venv/user/brew)
[ ] install_plugin.sh creates SKILL.md symlink at plugin root
[ ] install_plugin.sh registers MCP in Claude Desktop (claude_desktop_config.json)
[ ] install_plugin.sh registers MCP in Claude Code (~/.claude/settings.json, trust: true)
[ ] Both MCP registrations include PLUGINNAME_DATA_DIR env var → workspace/.claude/data/plugin/
[ ] install_plugin.sh supports --check, --uninstall, --workspace modes
[ ] --check verifies both Desktop and Claude Code registrations + PLUGINNAME_DATA_DIR
[ ] --uninstall removes from both Desktop and Claude Code
[ ] .gitignore covers: configs, keys, logs, caches, internal docs, .venv/
[ ] README.md, CHANGELOG.md, LICENSE present
[ ] Git remote set, noreply email configured, pushed successfully
[ ] Deep audit passed with ≥99.9% confidence
```
