# 🦀 Markie — Rust Markdown Editor & Viewer

A high-performance desktop Markdown editor and live viewer built with **[markdown-rs](https://github.com/wooorm/markdown-rs)** and **Tauri v2**.

---

## ⚡ Features

* **Compliant Markdown Engine:** 100% CommonMark & GitHub Flavored Markdown (GFM) powered by Titus Wormer's official Rust port (`markdown` crate v1.0).
* **Live Abstract Syntax Tree (AST):** Real-time `mdast` inspector powered directly by `markdown::to_mdast`.
* **Split-Pane & Synchronized Scrolling:** Edit markdown on the left, live view rendered output on the right with locked scrolling.
* **Interactive Checkboxes:** Click task-list checkboxes in the preview to automatically toggle `- [ ]` and `- [x]` in the editor.
* **Math & Frontmatter:** Built-in math expression support ($...$ and $$...$$) and YAML frontmatter parsing.
* **File Operations:** Native file open, save, and standalone HTML export via native file dialogs.
* **Dark / Light Modes:** Built-in themes with GitHub-styled typography.

---

## 🏗️ Architecture

```
Markie/
├── src/                          # Frontend UI (HTML5, Modern CSS, ES Modules)
│   ├── index.html                # App shell, toolbar, editor/preview split layout
│   ├── style.css                 # Dark/light theme & GitHub Markdown typography
│   └── app.js                    # Tauri IPC, debounced live preview, AST sync
├── src-tauri/                    # Rust Tauri Desktop Backend
│   ├── Cargo.toml                # Dependencies: markdown, tauri v2, serde, rfd
│   ├── tauri.conf.json           # Tauri v2 configuration
│   ├── capabilities/             # Tauri v2 security capabilities
│   └── src/
│       ├── lib.rs                # Tauri commands: render_markdown, parse_ast, file I/O
│       └── main.rs               # Desktop entry point
├── package.json                  # Scripts & Tauri CLI bindings
└── bun.lock                      # Lockfile
```

---

## 🛠️ Tauri Commands (Rust Backend)

| Command | Signature | Description |
| :--- | :--- | :--- |
| `render_markdown` | `(content: String, config: Option<MarkdownConfig>) -> RenderResult` | Parses and compiles Markdown to HTML via `markdown::to_html_with_options` with word counts and TOC. |
| `parse_ast` | `(content: String, config: Option<MarkdownConfig>) -> String` | Produces formatted JSON AST via `markdown::to_mdast`. |
| `open_file` | `() -> Option<FilePayload>` | Prompts native file picker and returns document content. |
| `save_file` | `(path: Option<String>, content: String) -> FilePayload` | Saves markdown file to disk. |
| `export_html` | `(path: Option<String>, html: String, title: String) -> String` | Exports self-contained HTML file. |

---

## 🚀 Quickstart

### 1. Run Browser Preview (Instant)
```bash
bun run preview
```
Open `http://localhost:3000` (or browser port) to test the editor and UI immediately.

### 2. Run Desktop App (Tauri)
```bash
bun run dev
```

### 3. Build Production Executable
```bash
bun run build
```

---

## 📋 Windows Build Requirements

For compiling the desktop binary with MSVC on Windows:
* **Visual Studio Build Tools 2022** with:
  * "Desktop development with C++"
  * Windows 10/11 SDK (`kernel32.lib`, etc.)
* **Rust**: `rustup default stable`
