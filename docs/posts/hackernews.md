# Hacker News Post

**Title:** Show HN: AiDex – Tree-sitter code index as MCP server (50x less AI context usage)

**URL:** https://github.com/CSCSoftware/AiDex

**Comment (optional first comment by author):**

I built this because AI coding assistants waste enormous amounts of context on code navigation. Every grep returns hundreds of text matches that the AI reads through — consuming 2000+ tokens for a simple "Where is function X?" question.

AiDex pre-indexes your codebase with Tree-sitter and serves results via MCP (Model Context Protocol). A search returns ~50 tokens instead of 2000+. It knows the difference between identifiers and text — searching for `log` won't match `catalog`.

Technical stack: Tree-sitter for parsing, SQLite (WAL mode) for storage, MCP stdio transport. Supports 11 languages. Index time is ~1s per 1000 files, queries take 1-5ms.

It's not a vector DB or embedding-based search — it's a plain identifier index with exact matches, prefix/substring search, and method signature extraction. Simple, fast, deterministic.

Works with Claude Code, Cursor, Windsurf, Gemini CLI, VS Code Copilot, and anything else that speaks MCP.
