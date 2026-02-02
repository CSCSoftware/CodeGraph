# r/ClaudeAI Post

**Title:** I built an MCP server that cuts Claude's context usage by 50x for code searches

**Body:**

I got frustrated watching Claude Code burn through context tokens every time it searched my codebase. A simple "Where is X defined?" would trigger grep, return hundreds of matches, and eat 2000+ tokens. Do that 10 times and half your context is gone — just on navigation.

So I built **AiDex** — an MCP server that indexes your codebase once using Tree-sitter, then gives Claude instant access to every function, class, and method signature through the index.

**The difference:**

```
# Before: grep flooding the context
Claude: grep "PlayerHealth" → 200 hits in 40 files
Claude: read File1.cs, File2.cs, File3.cs...
→ 2000+ tokens consumed, 5+ tool calls

# After: AiDex
Claude: aidex_query({ term: "PlayerHealth" })
→ Engine.cs:45, Player.cs:23, UI.cs:156
→ ~50 tokens, 1 tool call
```

**What it does:**

- Parses your code with Tree-sitter (not regex) — indexes identifiers, not text
- Persistent SQLite index — survives between sessions
- Structure-aware: knows methods, classes, types
- `aidex_signature` shows all methods in a file without reading the whole thing
- Time-based filtering: "What changed in the last 2 hours?"
- Cross-project queries: search across linked projects
- Session notes that persist between chats
- Interactive browser-based viewer for exploring the index

**Setup takes 30 seconds:**

```bash
npm install -g aidex-mcp
aidex setup
```

`aidex setup` auto-detects and registers with Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI, and VS Code Copilot.

**11 languages supported:** C#, TypeScript, JavaScript, Rust, Python, C, C++, Java, Go, PHP, Ruby

Open source, MIT licensed: https://github.com/CSCSoftware/AiDex

I've been using it daily and it dramatically changes how Claude works with larger codebases. Instead of reading file after file, it gets precise answers immediately. The context savings are real — more room for actual coding, less wasted on navigation.

Would love to hear your experience if you try it!
