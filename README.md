# LLM Prompt/Instruction Templates

A curated collection of reusable prompts, instruction templates, and workflow manuals for working with large language models.

Organized by LLM family — each folder contains templates optimized for that model's strengths and conventions.

## Structure

```
claude/      — Anthropic Claude (Claude Code, Cowork, Desktop, API)
gemini/      — Google Gemini
openai/      — OpenAI GPT / ChatGPT / o-series
llama/       — Meta LLaMA / open-weight models
mistral/     — Mistral AI
```

## How to Use

1. Browse the folder for your target LLM
2. Copy the template into a new session or system prompt
3. Follow the instructions inside — they are self-contained

## Templates

| Template | LLM | Description |
|---|---|---|
| `__claude-PLUGIN_CREATION_MANUAL.md` | Claude | Transform existing skills/commands into marketplace-ready Claude plugins. Covers directory structure, config isolation, MCP servers, zsh compatibility, security audits, and confidence loops. |

## Contributing

PRs welcome. Each template should be:
- Self-contained (paste into a session and it works)
- Generic (no company-specific data)
- Well-structured (phases, success criteria, checklists)

## License

MIT
