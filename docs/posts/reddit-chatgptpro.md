# r/ChatGPTPro Post

**Title:** MCP server that gives AI coding assistants a persistent code index — 50x less context usage

**Body:**

If you're using AI assistants for coding (with MCP support), you've probably noticed how much context gets wasted on code navigation. Every search triggers grep, returns massive results, and your assistant reads through file after file just to find a function definition.

I built **AiDex** to solve this. It's an MCP server that pre-indexes your codebase using Tree-sitter and gives your AI assistant precise, instant access to functions, classes, and method signatures.

**How it compares to grep-based search:**

| | Grep/Ripgrep | AiDex |
|---|---|---|
| Context usage | 2000+ tokens per search | ~50 tokens |
| Results | All text matches | Only identifiers |
| Precision | `log` matches `catalog`, `logarithm` | `log` finds only `log` |
| Persistence | Starts fresh every session | Index survives sessions |
| Structure | Flat text search | Knows methods, classes, types |

**Works with any MCP-compatible client:** Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI, VS Code Copilot — anything that speaks MCP.

**Key features:**
- Tree-sitter parsing (11 languages: C#, TS, JS, Rust, Python, C, C++, Java, Go, PHP, Ruby)
- Method signatures without reading full files
- Time-based filtering ("what changed in the last 2 hours?")
- Cross-project search
- Session notes that persist between chats
- Interactive browser-based viewer
- SQLite-based, zero external dependencies

**Install:**
```bash
npm install -g aidex-mcp
aidex setup  # auto-registers with your installed AI clients
```

Open source, MIT: https://github.com/CSCSoftware/AiDex

The MCP ecosystem is growing fast and I think persistent code indexing is a missing piece. Happy to answer questions!
