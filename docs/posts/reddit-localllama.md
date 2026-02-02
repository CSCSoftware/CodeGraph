# r/LocalLLaMA Post

**Title:** Open source MCP server for code indexing — reduces context consumption by ~50x

**Body:**

Context window size matters, especially when you're running local models. Every token counts. So I built an MCP server that eliminates the biggest context waste in AI-assisted coding: code navigation.

**The problem:** When an AI assistant needs to find a function in your codebase, it greps through files, gets hundreds of matches, and reads through them one by one. A single "Where is X?" can consume 2000+ tokens. With smaller context windows, this is devastating.

**AiDex** pre-indexes your codebase using Tree-sitter and serves results through MCP. Instead of 2000 tokens per search, you get ~50. Instead of text matches, you get actual identifiers — functions, classes, methods with exact line numbers.

**Technical details:**

- **Parser:** Tree-sitter (real AST parsing, not regex)
- **Database:** SQLite with WAL mode — single file, zero external deps
- **Protocol:** MCP (stdio transport)
- **Languages:** C#, TypeScript, JavaScript, Rust, Python, C, C++, Java, Go, PHP, Ruby
- **Index time:** ~1 second per 1000 files
- **Query time:** 1-5ms
- **Storage:** Everything in `.aidex/index.db` — portable, self-contained

**What it indexes:**
- All identifiers (functions, variables, classes, types)
- Method signatures/prototypes
- File structure (code, config, docs, assets, tests)
- Timestamps for "what changed recently?" queries

**What it does NOT do:**
- No cloud, no telemetry, no phone-home
- No embedding models or vector DBs
- No API keys needed
- Runs entirely local

Works with any MCP client. I use it with Claude Code but it should work with anything that implements MCP — including local setups with Gemini CLI or custom frontends.

```bash
npm install -g aidex-mcp
aidex setup
```

MIT licensed: https://github.com/CSCSoftware/AiDex

For those of you running local models with limited context — this should help squeeze a lot more actual work into your available tokens.
