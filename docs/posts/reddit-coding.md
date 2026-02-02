# r/coding Post

**Title:** I replaced grep-based code search in my dev workflow with a Tree-sitter index — query time went from seconds to milliseconds

**Body:**

I've been working on a tool that brings persistent code indexing to AI-assisted development, and it turned out to be useful beyond just AI workflows.

**The idea:** Instead of grep/ripgrep scanning your entire codebase every time you (or your AI assistant) need to find a function, pre-build an index of all identifiers using Tree-sitter and query that instead.

**Why Tree-sitter instead of grep?**

grep is a text search tool. Search for `log` and you'll match `catalog`, `logarithm`, `blog`, every comment mentioning "log", and every string containing it. Tree-sitter actually parses your code into an AST — it knows what's a function name, what's a class, what's a variable.

**What the index gives you:**

- Every identifier with file + line number
- Method signatures/prototypes without reading full files
- File type classification (code, config, test, doc, asset)
- Time-based queries ("what was modified in the last 2 hours?")
- Cross-project search across linked codebases

**Performance:**

| Project size | Files | Index time | Query time |
|---|---|---|---|
| Small | ~20 | <1s | 1-5ms |
| Medium | ~50 | <1s | 1-5ms |
| Large | ~100 | <1s | 1-5ms |
| XL | ~500+ | ~2s | 1-10ms |

The index lives in a single SQLite file (`.aidex/index.db`). Incremental updates re-index individual files after changes.

**11 languages:** C#, TypeScript, JavaScript, Rust, Python, C, C++, Java, Go, PHP, Ruby

It's implemented as an MCP server (Model Context Protocol), so it plugs into AI coding assistants like Claude Code, Cursor, VS Code Copilot, etc. But the core concept — persistent Tree-sitter index with instant queries — could be useful in other contexts too.

Includes a browser-based viewer (localhost:3333) where you can explore the index visually, see file signatures, and browse your project structure with git status indicators.

Open source, MIT: https://github.com/CSCSoftware/AiDex

Curious what you think — is persistent code indexing something you'd use outside of AI workflows?
