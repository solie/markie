/**
 * Markie - High-performance Markdown Editor & Viewer
 * Powered by wooorm/markdown-rs and Tauri v2
 */

const DEFAULT_MARKDOWN = `---
title: Welcome to Markie
author: Rust & Tauri
date: 2026-10-03
---

# 🦀 Welcome to Markie

Markie is a lightweight, blisteringly fast desktop Markdown editor and live viewer powered by **[markdown-rs](https://github.com/wooorm/markdown-rs)** (Titus Wormer's official 100% CommonMark & GFM compliant parser) and **Tauri v2**.

---

## ⚡ Core Highlights

* **100% Safe & Compliant:** Rust state-machine parser handles CommonMark + GFM.
* **AST Inspector:** View and copy the full \`mdast\` syntax tree generated directly by Rust.
* **Live Sync Scroll:** Real-time synchronized reading and editing.
* **Native File I/O:** Fast native file open, save, and standalone HTML export.

---

## 📋 Task List (GFM)

Try clicking these checkboxes directly in the preview pane!

- [x] Integrate \`wooorm/markdown-rs\` v1.0
- [x] Configure Tauri v2 commands
- [x] Implement AST inspector (\`markdown::to_mdast\`)
- [ ] Write your next great document

---

## 📊 GFM Table Support

| Feature | Powered By | Speed | Compliancy |
| :--- | :--- | :--- | :--- |
| **Parser** | \`markdown-rs\` | Instant | 100% CommonMark / GFM |
| **GUI** | Tauri v2 | Ultra-light | Windows / macOS / Linux |
| **AST** | \`mdast\` + Serde | Zero-copy | unist / mdast spec |

---

## 💻 Code Highlighting

Here is an example of Rust calling the \`markdown\` parser:

\`\`\`rust
use markdown::{to_html_with_options, Options};

fn main() -> Result<(), markdown::message::Message> {
    let markdown_input = "# Hello from Rust!";
    let html_output = to_html_with_options(markdown_input, &Options::gfm())?;
    println!("{}", html_output);
    Ok(())
}
\`\`\`

---

## 📐 Math Expressions

Inline math: $E = mc^2$ and Euler's formula $e^{i\\pi} + 1 = 0$.

Display math:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

---

## 📊 Diagrams & Flowcharts

### Mermaid Diagram
\`\`\`mermaid
graph LR
    A[Markdown Input] --> B(markdown-rs Engine)
    B --> C{Tauri View}
    C -->|Formulas| D[KaTeX Math]
    C -->|Charts| E[Mermaid & Graphviz]
\`\`\`

### Graphviz (DOT)
\`\`\`dot
digraph G {
    rankdir=LR;
    node [shape=box, style=rounded];
    Source -> Parser -> AST -> HTML;
}
\`\`\`

> **Note:** Markdown gives you total clarity. Markie keeps your focus where it belongs.
`;

// Application State
const state = {
  currentPath: null,
  currentName: "Untitled.md",
  isModified: false,
  viewMode: "split", // "split", "edit", "preview"
  isFullscreen: false,
  preFullscreenViewMode: "split",
  fontScale: 1,
  spellEnabled: true,
  spellLocale: "en-us",
  spellReady: false,
  spellIssues: [],
  syncScroll: true,
  isScrollingEditor: false,
  isScrollingPreview: false,
  config: {
    gfm: true,
    allowHtml: true,
    enableMath: true,
    enableFrontmatter: true,
    allow_html: true,
    enable_math: true,
    enable_frontmatter: true
  }
};

// DOM Elements
const editor = document.getElementById("markdown-input");
const preview = document.getElementById("preview-output");
const previewWrapper = document.getElementById("preview-wrapper");
const docTitle = document.getElementById("doc-title");
const saveStatus = document.getElementById("save-status");
const statWords = document.getElementById("stat-words");
const statChars = document.getElementById("stat-chars");
const statTime = document.getElementById("stat-time");
const statLines = document.getElementById("stat-lines");
const workspace = document.getElementById("workspace");
const tocDrawer = document.getElementById("toc-drawer");
const tocList = document.getElementById("toc-list");
const astDrawer = document.getElementById("ast-drawer");
const astOutput = document.getElementById("ast-output");
const settingsModal = document.getElementById("settings-modal");
const btnFullscreen = document.getElementById("btn-fullscreen");
const btnExitFullscreen = document.getElementById("btn-exit-fullscreen");
const spellDrawer = document.getElementById("spell-drawer");
const spellList = document.getElementById("spell-list");
const spellBadge = document.getElementById("spell-badge");
const spellLocaleSel = document.getElementById("spell-locale");
const btnSpell = document.getElementById("btn-spell");
const editorPane = document.getElementById("editor-pane");
const editorHighlight = document.getElementById("editor-highlight");
// Dynamic Tauri Invoke Resolution
function getTauriInvoke() {
  if (typeof window !== "undefined") {
    if (window.__TAURI__?.core?.invoke) {
      return window.__TAURI__.core.invoke.bind(window.__TAURI__.core);
    }
    if (window.__TAURI__?.invoke) {
      return window.__TAURI__.invoke.bind(window.__TAURI__);
    }
    if (window.__TAURI_INTERNALS__?.invoke) {
      return window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
    }
  }
  return null;
}

async function invoke(cmd, args = {}) {
  const tauriInvoke = getTauriInvoke();
  if (tauriInvoke) {
    try {
      return await tauriInvoke(cmd, args);
    } catch (err) {
      console.warn(`Tauri command ${cmd} failed, checking fallback:`, err);
      // If error is permission or invocation, allow fallback if useful
      if (cmd === "open_file" || cmd === "save_file" || cmd === "export_html") {
        throw err;
      }
    }
  }
  return mockInvoke(cmd, args);
}

// Browser Fallback Simulation
function mockInvoke(cmd, args) {
  if (cmd === "render_markdown") {
    const text = args.content || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const readingTime = Math.max(0.1, Math.round((words / 200) * 10) / 10);

    // Client-side markdown renderer for browser dev mode
    let html = parseMarkdownClient(text);

    const lines = text.split("\n");
    const toc = [];
    lines.forEach(l => {
      const match = l.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        toc.push({
          level: match[1].length,
          text: match[2],
          id: match[2].toLowerCase().replace(/[^\w]+/g, "-")
        });
      }
    });

    return Promise.resolve({
      html,
      word_count: words,
      char_count: chars,
      reading_time_minutes: readingTime,
      toc
    });
  } else if (cmd === "parse_ast") {
    return Promise.resolve(JSON.stringify({
      type: "root",
      children: [
        { type: "heading", depth: 1, children: [{ type: "text", value: "Browser Fallback Mode" }] }
      ]
    }, null, 2));
  } else if (cmd === "open_file") {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".md,.markdown,.mdown,.txt";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          resolve({
            path: file.name,
            name: file.name,
            content: ev.target.result
          });
        };
        reader.readAsText(file);
      };
      input.click();
    });
  } else if (cmd === "save_file") {
    const blob = new Blob([args.content], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.currentName || "document.md";
    a.click();
    return Promise.resolve({
      path: a.download,
      name: a.download,
      content: args.content
    });
  } else if (cmd === "export_html") {
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.title || "Document"}</title></head><body>${args.html}</body></html>`;
    const blob = new Blob([doc], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${args.title || "document"}.html`;
    a.click();
    return Promise.resolve(a.download);
  } else if (cmd === "get_initial_file") {
    return Promise.resolve(null);
  }
  return Promise.reject("Unknown command: " + cmd);
}

// Lightweight client-side parser fallback
function parseMarkdownClient(md) {
  let out = md;
  // Escape HTML if not allowed
  if (!state.config.allowHtml) {
    out = out.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  out = out.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
  });

  // Block Math: $$...$$
  if (state.config.enableMath) {
    out = out.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
      return `<pre><code class="language-math math-display">${escapeHtml(math.trim())}</code></pre>`;
    });
    out = out.replace(/\$([^\$\n]+)\$/g, (match, math) => {
      return `<code class="language-math math-inline">${escapeHtml(math.trim())}</code>`;
    });
  }

  // Headers
  out = out.replace(/^###### (.*$)/gim, '<h6 id="$1">$1</h6>');
  out = out.replace(/^##### (.*$)/gim, '<h5 id="$1">$1</h5>');
  out = out.replace(/^#### (.*$)/gim, '<h4 id="$1">$1</h4>');
  out = out.replace(/^### (.*$)/gim, '<h3 id="$1">$1</h3>');
  out = out.replace(/^## (.*$)/gim, '<h2 id="$1">$1</h2>');
  out = out.replace(/^# (.*$)/gim, '<h1 id="$1">$1</h1>');

  // Blockquotes
  out = out.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Inline formatting
  out = out.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  out = out.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  out = out.replace(/~~(.*?)~~/gim, '<del>$1</del>');
  out = out.replace(/`([^`\n]+)`/gim, '<code>$1</code>');

  // Task list checkboxes
  out = out.replace(/^- \[x\] (.*$)/gim, '<ul><li><input type="checkbox" checked /> $1</li></ul>');
  out = out.replace(/^- \[ \] (.*$)/gim, '<ul><li><input type="checkbox" /> $1</li></ul>');
  out = out.replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>');

  // Horizontal Rules
  out = out.replace(/^---$/gim, '<hr />');

  // Paragraphs
  out = out.replace(/\n\n/g, '<p></p>');

  return out;
}

// Render Debounce & Update
let renderDebounceTimer = null;
function queueRender() {
  markUnsaved();
  clearTimeout(renderDebounceTimer);
  // Scale debounce with document size so large files stay responsive
  const size = editor.value.length;
  const delay = size > 20000 ? 180 : size > 5000 ? 90 : 40;
  renderDebounceTimer = setTimeout(updateRender, delay);
}

// KaTeX Math Rendering Engine
function renderMath(container) {
  if (typeof katex === "undefined" || !state.config.enableMath) return;

  // 1. Process math tags generated by markdown parser
  const mathCodeNodes = container.querySelectorAll("code.language-math, code.math-inline, code.math-display");
  mathCodeNodes.forEach((codeEl) => {
    let tex = codeEl.textContent || "";
    let isDisplay = codeEl.classList.contains("math-display") || codeEl.parentElement?.tagName === "PRE";

    const trimmed = tex.trim();
    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length >= 4) {
      tex = trimmed.slice(2, -2).trim();
      isDisplay = true;
    } else if (trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length >= 2) {
      tex = trimmed.slice(1, -1).trim();
    }

    try {
      const target = document.createElement(isDisplay ? "div" : "span");
      target.className = isDisplay ? "katex-display-container" : "katex-inline-container";
      katex.render(tex, target, {
        displayMode: isDisplay,
        throwOnError: false
      });

      if (isDisplay && codeEl.parentElement?.tagName === "PRE") {
        codeEl.parentElement.replaceWith(target);
      } else {
        codeEl.replaceWith(target);
      }
    } catch (err) {
      console.warn("KaTeX render error:", err);
    }
  });

  // 2. Process any raw mathematical expressions ($...$, $$...$$) that remained in text nodes
  if (typeof renderMathInElement === "function") {
    try {
      renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"]
      });
    } catch (err) {
      console.warn("renderMathInElement error:", err);
    }
  }
}
// Graphviz / Viz.js Engine
let vizInstance = null;
let vizPromise = null;
async function getVizInstance() {
  if (vizInstance) return vizInstance;
  if (!vizPromise) {
    vizPromise = (async () => {
      if (typeof window.Viz !== "undefined" && typeof window.Viz.instance === "function") {
        try {
          return await window.Viz.instance();
        } catch (e) {
          console.warn("window.Viz.instance failed:", e);
        }
      }
      try {
        const mod = await import("./vendor/viz/viz.js");
        if (typeof mod.instance === "function") {
          return await mod.instance();
        }
      } catch (e) {
        console.warn("import('./vendor/viz/viz.js') failed:", e);
      }
      return null;
    })();
  }
  vizInstance = await vizPromise;
  return vizInstance;
}

// Diagram Rendering Engine (Mermaid & Graphviz/DOT)
let diagramCounter = 0;
async function renderDiagrams(container) {
  const allPreCode = container.querySelectorAll("pre > code");

  // 1. Mermaid diagrams
  for (const codeEl of allPreCode) {
    const cls = (codeEl.className || "").toLowerCase();
    if (cls.includes("language-mermaid") && typeof mermaid !== "undefined") {
      const preEl = codeEl.parentElement;
      const code = codeEl.textContent.trim();
      if (!code) continue;

      const isLight = document.body.classList.contains("theme-light");
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: isLight ? "default" : "dark",
          securityLevel: "loose"
        });
        const id = `mermaid-diag-${++diagramCounter}`;
        const { svg } = await mermaid.render(id, code);
        const wrapper = document.createElement("div");
        wrapper.className = "diagram-container mermaid-container";
        wrapper.innerHTML = svg;
        preEl.replaceWith(wrapper);
      } catch (err) {
        console.warn("Mermaid render error:", err);
        preEl.classList.add("diagram-error");
      }
    }
  }

  // 2. Graphviz (DOT) diagrams: matches dot, graphviz, gv
  const dotElements = Array.from(container.querySelectorAll("pre > code")).filter(el => {
    const cls = (el.className || "").toLowerCase();
    return cls.includes("language-dot") || cls.includes("language-graphviz") || cls.includes("language-gv");
  });

  if (dotElements.length > 0) {
    const viz = await getVizInstance();
    for (const codeEl of dotElements) {
      const preEl = codeEl.parentElement;
      const code = codeEl.textContent.trim();
      if (!code) continue;

      if (!viz) {
        const loadingBox = document.createElement("div");
        loadingBox.className = "diagram-container diagram-loading";
        loadingBox.innerHTML = `<span style="color: var(--text-muted); font-size: 12px;">⏳ Initializing Graphviz engine...</span>`;
        preEl.replaceWith(loadingBox);
        continue;
      }

      try {
        const svgString = viz.renderString(code, { format: "svg" });
        const wrapper = document.createElement("div");
        wrapper.className = "diagram-container graphviz-container";
        wrapper.innerHTML = svgString;
        preEl.replaceWith(wrapper);
      } catch (err) {
        console.warn("Graphviz render error:", err);
        const errBox = document.createElement("div");
        errBox.className = "diagram-container diagram-error";
        errBox.innerHTML = `<div style="color: #f85149; font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; text-align: left; width: 100%;">⚠️ Graphviz render error:\n${escapeHtml(err.message || String(err))}</div>`;
        preEl.replaceWith(errBox);
      }
    }
  }
}

// Proofreading Engine (Spelling + Grammar), off-main-thread via worker
const spellEngine = window.MarkieSpell || null;
let spellDictCache = {};
let spellWorker = null;
let spellReqId = 0;
let lastOverlaySignature = "";

function assetUrl(path) {
  return new URL(path, window.location.href).href;
}

function ensureSpellWorker() {
  if (spellWorker || typeof Worker === "undefined") return spellWorker;
  try {
    spellWorker = new Worker("spell.worker.js");
    spellWorker.onmessage = handleSpellWorkerMessage;
    spellWorker.onerror = (err) => {
      console.warn("Spell worker error:", err.message || err);
    };
    spellWorkerReady = true;
  } catch (err) {
    console.warn("Failed to start spell worker:", err);
    spellWorker = null;
  }
  return spellWorker;
}

function handleSpellWorkerMessage(event) {
  const data = event.data || {};
  if (data.id !== spellReqId) return; // stale result
  if (!data.ok) {
    console.warn("Spell check failed:", data.error);
    return;
  }
  assembleSpellIssues(data.spelling || [], data.grammar || []);
}

function positionToOffsetFrom(text, lineStarts, line, column) {
  const ls = lineStarts[line - 1] || 0;
  return ls + (column - 1);
}

function assembleSpellIssues(spelling, grammar) {
  const text = editor.value;
  const lineStarts = computeLineStarts(text);
  const issues = [];
  for (const s of spelling) {
    const start = positionToOffsetFrom(text, lineStarts, s.line, s.column);
    issues.push({
      kind: "spelling",
      reason: s.reason,
      word: s.word,
      suggestions: s.suggestions || [],
      line: s.line,
      column: s.column,
      start,
      end: start + (s.word ? s.word.length : 0)
    });
  }
  for (const g of grammar) {
    const start = positionToOffsetFrom(text, lineStarts, g.line, g.column);
    const expected = Array.isArray(g.expected) ? g.expected : (g.expected ? [g.expected] : []);
    issues.push({
      kind: "grammar",
      reason: g.reason,
      ruleId: g.ruleId,
      suggestions: expected.filter(s => typeof s === "string"),
      line: g.line,
      column: g.column,
      start,
      end: start + (g.actual ? g.actual.length : 0)
    });
  }
  issues.sort((a, b) => a.start - b.start);
  state.spellIssues = issues;
  renderSpellOverlay();
  renderSpellList();
}

function computeLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

async function loadSpellDictionary(locale) {
  if (spellDictCache[locale]) return true;
  if (!spellEngine || typeof spellEngine.loadDictionary !== "function") {
    console.warn("Spell engine unavailable");
    return false;
  }
  try {
    const base = `vendor/spell/dict/${locale}`;
    const [affRes, dicRes] = await Promise.all([fetch(`${base}.aff`), fetch(`${base}.dic`)]);
    if (!affRes.ok || !dicRes.ok) throw new Error(`Dictionary fetch failed for ${locale}`);
    const affBuf = new Uint8Array(await affRes.arrayBuffer());
    const dicBuf = new Uint8Array(await dicRes.arrayBuffer());
    spellEngine.loadDictionary(affBuf, dicBuf);
    spellDictCache[locale] = true;
    state.spellReady = true;
    return true;
  } catch (err) {
    console.warn("Failed to load dictionary:", err);
    return false;
  }
}

function runSpellCheck() {
  if (!state.spellEnabled) {
    state.spellIssues = [];
    renderSpellOverlay();
    renderSpellList();
    return;
  }
  const worker = ensureSpellWorker();
  if (!worker) {
    runSpellCheckOnMainThread();
    return;
  }
  spellReqId++;
  worker.postMessage({
    id: spellReqId,
    type: "check",
    locale: state.spellLocale,
    text: editor.value,
    engineUrl: assetUrl("vendor/spell/spell.min.js"),
    dictBase: assetUrl("vendor/spell/dict/")
  });
}

async function runSpellCheckOnMainThread() {
  if (!state.spellReady) {
    const ok = await loadSpellDictionary(state.spellLocale);
    if (!ok) return;
  }
  try {
    const result = await spellEngine.check(editor.value);
    assembleSpellIssues(result.spelling || [], result.grammar || []);
  } catch (err) {
    console.warn("Spell check failed:", err);
  }
}

function escapeHtmlText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSpellOverlay() {
  if (!editorHighlight) return;
  const issues = state.spellIssues;
  if (!state.spellEnabled || issues.length === 0) {
    if (lastOverlaySignature !== "") {
      editorHighlight.innerHTML = "";
      lastOverlaySignature = "";
    }
    return;
  }

  const signature = `${editor.value.length}:${issues.length}:${issues.map(i => `${i.start}-${i.end}${i.kind[0]}`).join(",")}`;
  if (signature === lastOverlaySignature) return;
  lastOverlaySignature = signature;

  const text = editor.value;
  const parts = [];
  let cursor = 0;
  const visible = issues.filter(i => i.end > i.start).slice(0, 2000);
  for (const issue of visible) {
    const s = Math.max(cursor, Math.min(issue.start, text.length));
    const e = Math.max(s, Math.min(issue.end, text.length));
    if (s > cursor) parts.push(escapeHtmlText(text.slice(cursor, s)));
    if (e > s) {
      const cls = issue.kind === "spelling" ? "spell-mark-spelling" : "spell-mark-grammar";
      parts.push(`<mark class="${cls}">${escapeHtmlText(text.slice(s, e))}</mark>`);
    }
    cursor = e;
  }
  if (cursor < text.length) parts.push(escapeHtmlText(text.slice(cursor)));
  parts.push("\n");
  editorHighlight.innerHTML = parts.join("");
}

function renderSpellList() {
  if (!spellList) return;
  const issues = state.spellIssues;
  if (spellBadge) spellBadge.textContent = String(issues.length);
  if (!state.spellEnabled) {
    spellList.innerHTML = `<p class="empty-state">Proofreading off</p>`;
    return;
  }
  if (issues.length === 0) {
    spellList.innerHTML = `<p class="empty-state">Press <kbd>F7</kbd> to check this document</p>`;
    return;
  }
  spellList.innerHTML = issues.map((issue, idx) => {
    const sug = (issue.suggestions || []).slice(0, 4)
      .map(s => `<button class="spell-suggest" data-idx="${idx}" data-word="${escapeHtmlText(s)}">${escapeHtmlText(s)}</button>`)
      .join("");
    const icon = issue.kind === "spelling" ? "✗" : "⚠";
    return `<div class="spell-item ${issue.kind}" data-idx="${idx}">
      <div class="spell-item-head">
        <span class="spell-icon">${icon}</span>
        <span class="spell-msg">${escapeHtmlText(issue.reason)}</span>
      </div>
      <div class="spell-meta">Line ${issue.line}, Col ${issue.column}${issue.ruleId ? ` · ${escapeHtmlText(issue.ruleId)}` : ""}</div>
      ${sug ? `<div class="spell-suggestions">${sug}</div>` : ""}
    </div>`;
  }).join("");
}

function applySuggestion(idx, word) {
  const issue = state.spellIssues[idx];
  if (!issue) return;
  const text = editor.value;
  const before = text.slice(0, issue.start);
  const after = text.slice(issue.end);
  editor.value = before + word + after;
  const caret = issue.start + word.length;
  editor.selectionStart = editor.selectionEnd = caret;
  editor.focus();
  markUnsaved();
  queueRender();
}

function toggleProofreading() {
  state.spellEnabled = !state.spellEnabled;
  if (btnSpell) btnSpell.classList.toggle("active", state.spellEnabled);
  try { localStorage.setItem("markie.spellEnabled", state.spellEnabled ? "1" : "0"); } catch (_) {}
  if (!state.spellEnabled) {
    state.spellIssues = [];
    lastOverlaySignature = "";
    renderSpellOverlay();
    renderSpellList();
  }
}

// Pre-initialize Graphviz in background immediately on load
getVizInstance().then(() => {
  if (document.querySelector(".diagram-loading, pre > code.language-dot, pre > code.language-graphviz, pre > code.language-gv")) {
    updateRender(true);
  }
}).catch(console.warn);

let lastRenderedContent = null;
async function updateRender(force = false) {
  const content = editor.value;
  if (!force && content === lastRenderedContent) return;
  lastRenderedContent = content;
  try {
    const result = await invoke("render_markdown", {
      content,
      config: state.config
    });

    if (result && result.html !== undefined) {
      preview.innerHTML = result.html;
      renderMath(preview);
      await renderDiagrams(preview);
      statWords.textContent = (result.word_count || 0).toLocaleString();
      statChars.textContent = (result.char_count || 0).toLocaleString();
      statTime.textContent = `${result.reading_time_minutes || 0.1}m`;

      renderToc(result.toc);
      attachPreviewInteractivity();

      if (astDrawer.classList.contains("open")) {
        updateAst();
      }
    }
  } catch (err) {
    console.error("Rendering failed:", err);
  }
}

// Render Table of Contents
function renderToc(toc) {
  if (!toc || toc.length === 0) {
    tocList.innerHTML = `<p class="empty-state">No headings found</p>`;
    return;
  }
  tocList.innerHTML = toc
    .map(item => `
      <a class="toc-item level-${item.level}" href="#${item.id}" data-id="${item.id}">
        ${escapeHtml(item.text)}
      </a>
    `)
    .join("");

  tocList.querySelectorAll(".toc-item").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const targetId = a.getAttribute("data-id");
      const el = preview.querySelector(`[id="${targetId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

// Update AST Output
async function updateAst() {
  try {
    const json = await invoke("parse_ast", {
      content: editor.value,
      config: state.config
    });
    astOutput.textContent = json;
  } catch (err) {
    astOutput.textContent = "// Error parsing AST: " + err;
  }
}

// Rewrite relative/absolute <img> sources to the Tauri asset protocol so local
// files load. Remote and data URLs are left untouched.
function resolvePreviewImages() {
  const convert = window.__TAURI__?.core?.convertFileSrc;
  const docPath = state.currentPath;
  const dir = docPath ? docPath.replace(/[^/\\]+$/, "") : "";
  preview.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || /^(https?:|data:|blob:|asset:|tauri:)/i.test(src)) return;
    let abs;
    if (/^[a-zA-Z]:[\\/]/.test(src)) abs = src;                 // Windows absolute
    else if (src.startsWith("/")) abs = src;                    // POSIX absolute
    else abs = dir ? dir + src : src;                           // relative to doc
    img.setAttribute("data-original-src", src);
    img.src = convert ? convert(abs) : abs;
    img.onerror = () => {
      img.classList.add("image-missing");
      img.alt = img.alt || `Missing image: ${src}`;
    };
  });
}

// Interactive Task List Checkboxes inside Preview
function attachPreviewInteractivity() {
  resolvePreviewImages();
  const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((cb, index) => {
    cb.removeAttribute("disabled");
    cb.style.cursor = "pointer";
    cb.addEventListener("change", () => {
      toggleMarkdownCheckbox(index, cb.checked);
    });
  });
}

function toggleMarkdownCheckbox(targetIndex, isChecked) {
  const text = editor.value;
  const regex = /^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/gm;
  let currentIndex = 0;
  let replaced = false;

  const newText = text.replace(regex, (match, prefix, char, suffix) => {
    if (currentIndex === targetIndex && !replaced) {
      replaced = true;
      currentIndex++;
      return `${prefix}${isChecked ? "x" : " "}${suffix}`;
    }
    currentIndex++;
    return match;
  });

  if (replaced) {
    editor.value = newText;
    queueRender();
  }
}

// Synchronized Scrolling
editor.addEventListener("scroll", () => {
  if (editorHighlight) {
    editorHighlight.scrollTop = editor.scrollTop;
    editorHighlight.scrollLeft = editor.scrollLeft;
  }
  if (!state.syncScroll || state.isScrollingPreview) return;
  state.isScrollingEditor = true;

  const editorScrollable = editor.scrollHeight - editor.clientHeight;
  if (editorScrollable > 0) {
    const scrollRatio = editor.scrollTop / editorScrollable;
    const previewScrollable = previewWrapper.scrollHeight - previewWrapper.clientHeight;
    previewWrapper.scrollTop = scrollRatio * previewScrollable;
  }

  setTimeout(() => { state.isScrollingEditor = false; }, 50);
});

previewWrapper.addEventListener("scroll", () => {
  if (!state.syncScroll || state.isScrollingEditor) return;
  state.isScrollingPreview = true;

  const previewScrollable = previewWrapper.scrollHeight - previewWrapper.clientHeight;
  if (previewScrollable > 0) {
    const scrollRatio = previewWrapper.scrollTop / previewScrollable;
    const editorScrollable = editor.scrollHeight - editor.clientHeight;
    editor.scrollTop = scrollRatio * editorScrollable;
  }

  setTimeout(() => { state.isScrollingPreview = false; }, 50);
});

// Cursor Position Tracking
editor.addEventListener("keyup", updateCursorPos);
editor.addEventListener("click", updateCursorPos);

function updateCursorPos() {
  const text = editor.value.substring(0, editor.selectionStart);
  const lines = text.split("\n");
  const lineNum = lines.length;
  const colNum = lines[lines.length - 1].length + 1;
  statLines.textContent = `Ln ${lineNum}, Col ${colNum}`;
}

// State Modifications
function markSaved(path, name) {
  state.isModified = false;
  if (path) state.currentPath = path;
  if (name) state.currentName = name;
  docTitle.textContent = state.currentName;
  saveStatus.textContent = "Saved";
  saveStatus.className = "save-status saved";
  // Grant the asset protocol read access next to this document so local
  // images resolve. Fire-and-forget: no-op in browser fallback.
  if (path) {
    invoke("allow_document_dir", { path }).catch(() => {});
  }
}

function markUnsaved() {
  if (!state.isModified) {
    state.isModified = true;
    saveStatus.textContent = "Edited";
    saveStatus.className = "save-status unsaved";
  }
}

// File Operations
async function handleNew() {
  if (state.isModified && !confirm("Discard unsaved changes?")) return;
  editor.value = "";
  state.currentPath = null;
  state.currentName = "Untitled.md";
  docTitle.textContent = "Untitled.md";
  markSaved(null, "Untitled.md");
  updateRender(true);
  editor.focus();
}

async function handleOpen() {
  try {
    const result = await invoke("open_file");
    if (result) {
      editor.value = result.content;
      markSaved(result.path, result.name);
      updateRender(true);
    }
  } catch (err) {
    alert("Open file failed: " + err);
  }
}

async function handleSave() {
  try {
    const result = await invoke("save_file", {
      path: state.currentPath,
      content: editor.value
    });
    if (result) {
      markSaved(result.path, result.name);
    }
  } catch (err) {
    if (err !== "Save cancelled") {
      alert("Save failed: " + err);
    }
  }
}

async function handleExport() {
  try {
    const title = state.currentName.replace(/\.[^/.]+$/, "");
    const savedPath = await invoke("export_html", {
      path: null,
      html: preview.innerHTML,
      title
    });
    if (savedPath) {
      alert("Exported standalone HTML: " + savedPath);
    }
  } catch (err) {
    if (err !== "Export cancelled") {
      alert("Export failed: " + err);
    }
  }
}

// Formatting Toolbar Insertions
function insertFormat(type) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.substring(start, end);

  let replacement = "";
  let cursorOffset = 0;

  switch (type) {
    case "bold":
      replacement = `**${selected || "bold text"}**`;
      cursorOffset = selected ? replacement.length : 2;
      break;
    case "italic":
      replacement = `*${selected || "italic text"}*`;
      cursorOffset = selected ? replacement.length : 1;
      break;
    case "strike":
      replacement = `~~${selected || "strikethrough"}~~`;
      cursorOffset = selected ? replacement.length : 2;
      break;
    case "h1":
      replacement = `\n# ${selected || "Heading 1"}\n`;
      cursorOffset = replacement.length;
      break;
    case "h2":
      replacement = `\n## ${selected || "Heading 2"}\n`;
      cursorOffset = replacement.length;
      break;
    case "h3":
      replacement = `\n### ${selected || "Heading 3"}\n`;
      cursorOffset = replacement.length;
      break;
    case "code":
      replacement = `\`${selected || "code"}\``;
      cursorOffset = selected ? replacement.length : 1;
      break;
    case "codeblock":
      replacement = `\n\`\`\`rust\n${selected || "// your code here"}\n\`\`\`\n`;
      cursorOffset = replacement.length;
      break;
    case "quote":
      replacement = `\n> ${selected || "Quote"}\n`;
      cursorOffset = replacement.length;
      break;
    case "link":
      replacement = `[${selected || "link text"}](https://example.com)`;
      cursorOffset = replacement.length;
      break;
    case "ul":
      replacement = `\n- ${selected || "List item"}\n`;
      cursorOffset = replacement.length;
      break;
    case "task":
      replacement = `\n- [ ] ${selected || "New task"}\n`;
      cursorOffset = replacement.length;
      break;
    case "table":
      replacement = `\n| Column 1 | Column 2 |\n| :--- | :--- |\n| Value 1 | Value 2 |\n`;
      cursorOffset = replacement.length;
      break;
    case "math":
      replacement = selected ? `$${selected}$` : `\n$$\n\\sum_{i=1}^{n} x_i\n$$\n`;
      cursorOffset = replacement.length;
      break;
  }

  editor.value = text.substring(0, start) + replacement + text.substring(end);
  editor.selectionStart = editor.selectionEnd = start + cursorOffset;
  editor.focus();
  queueRender();
}

// Tab Indentation Support
editor.addEventListener("keydown", e => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;

    if (!e.shiftKey) {
      editor.value = value.substring(0, start) + "  " + value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
    } else {
      if (start >= 2 && value.substring(start - 2, start) === "  ") {
        editor.value = value.substring(0, start - 2) + value.substring(start);
        editor.selectionStart = editor.selectionEnd = start - 2;
      }
    }
    queueRender();
  }
});

// View Modes Switcher
function setViewMode(mode) {
  state.viewMode = mode;
  workspace.classList.remove("view-editor-only", "view-preview-only");

  document.querySelectorAll(".view-toggles .btn-toggle").forEach(btn => btn.classList.remove("active"));

  if (mode === "edit") {
    workspace.classList.add("view-editor-only");
    document.getElementById("view-edit").classList.add("active");
  } else if (mode === "preview") {
    workspace.classList.add("view-preview-only");
    document.getElementById("view-preview").classList.add("active");
  } else {
    document.getElementById("view-split").classList.add("active");
  }
}

// Toggle view mode: viewer -> split -> editor -> viewer
function cycleViewMode() {
  if (state.viewMode === "preview") {
    setViewMode("split");
  } else if (state.viewMode === "split") {
    setViewMode("edit");
  } else {
    setViewMode("preview");
  }
}

// Fullscreen Mode Controller
async function toggleFullscreen(force) {
  const target = force !== undefined ? force : !state.isFullscreen;
  if (target === state.isFullscreen) return;
  state.isFullscreen = target;

  if (state.isFullscreen) {
    state.preFullscreenViewMode = state.viewMode;
    document.body.classList.add("fullscreen-mode");
    // Default view in fullscreen is viewer
    setViewMode("preview");
    try {
      const win = window.__TAURI__?.window?.getCurrentWindow?.();
      if (win?.setFullscreen) {
        await win.setFullscreen(true);
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (_) {}
  } else {
    document.body.classList.remove("fullscreen-mode");
    // Restore previous view mode
    setViewMode(state.preFullscreenViewMode || "split");
    try {
      const win = window.__TAURI__?.window?.getCurrentWindow?.();
      if (win?.setFullscreen) {
        await win.setFullscreen(false);
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (_) {}
  }
}

// Content Font Size Controller (Cmd/Ctrl +/-)
const FONT_SCALE_MIN = 0.6;
const FONT_SCALE_MAX = 2.4;
const FONT_SCALE_STEP = 0.1;

function applyFontScale(scale) {
  state.fontScale = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(scale * 100) / 100));
  document.documentElement.style.setProperty("--content-font-scale", state.fontScale.toFixed(2));
  const zoomEl = document.getElementById("stat-zoom");
  if (zoomEl) zoomEl.textContent = `${Math.round(state.fontScale * 100)}%`;
  try {
    localStorage.setItem("markie.fontScale", String(state.fontScale));
  } catch (_) {}
}

function adjustFontSize(delta) {
  applyFontScale(state.fontScale + delta * FONT_SCALE_STEP);
}

function resetFontSize() {
  applyFontScale(1);
}

// Global Keyboard Shortcuts
window.addEventListener("keydown", e => {
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  // Quit: Cmd/Ctrl + Q
  if (ctrl && key === "q") {
    e.preventDefault();
    invoke("exit_app").catch(() => window.close());
    return;
  }

  // Save: Cmd/Ctrl + S
  if (ctrl && !e.shiftKey && key === "s") {
    e.preventDefault();
    handleSave();
    return;
  }

  // Open: Cmd/Ctrl + O
  if (ctrl && key === "o") {
    e.preventDefault();
    handleOpen();
    return;
  }

  // New: Cmd/Ctrl + N
  if (ctrl && key === "n") {
    e.preventDefault();
    handleNew();
    return;
  }

  // Export: Cmd/Ctrl + E
  if (ctrl && key === "e") {
    e.preventDefault();
    handleExport();
    return;
  }

  // Font size: Cmd/Ctrl + '+' / '=' increase, '-' decrease, '0' reset
  if (ctrl && !e.shiftKey && (key === "=" || key === "+")) {
    e.preventDefault();
    adjustFontSize(1);
    return;
  }
  if (ctrl && e.shiftKey && key === "+") {
    e.preventDefault();
    adjustFontSize(1);
    return;
  }
  if (ctrl && key === "-") {
    e.preventDefault();
    adjustFontSize(-1);
    return;
  }
  if (ctrl && key === "0") {
    e.preventDefault();
    resetFontSize();
    return;
  }

  // Bold: Cmd/Ctrl + B
  if (ctrl && key === "b") {
    e.preventDefault();
    insertFormat("bold");
    return;
  }

  // Italics: Cmd/Ctrl + I
  if (ctrl && key === "i") {
    e.preventDefault();
    insertFormat("italic");
    return;
  }

  // Strike: Cmd/Ctrl + Shift + X or Cmd/Ctrl + Shift + S or Cmd/Ctrl + U
  if ((ctrl && e.shiftKey && (key === "x" || key === "s")) || (ctrl && !e.shiftKey && key === "u")) {
    e.preventDefault();
    insertFormat("strike");
    return;
  }

  // Cycle view mode: Cmd/Ctrl + M (viewer, split, editor)
  if (ctrl && key === "m") {
    e.preventDefault();
    cycleViewMode();
    return;
  }

  // Toggle Fullscreen: F11 or Cmd/Ctrl + Shift + F
  if (e.key === "F11" || (ctrl && e.shiftKey && key === "f")) {
    e.preventDefault();
    toggleFullscreen();
    return;
  }

  // Exit Fullscreen: Esc
  if (e.key === "Escape") {
    if (state.isFullscreen) {
      e.preventDefault();
      toggleFullscreen(false);
      return;
    }
  }

  // Link: Cmd/Ctrl + K
  if (ctrl && key === "k") {
    e.preventDefault();
    insertFormat("link");
    return;
  }

  // Proofreading Drawer: F7 opens the panel and runs a check on demand
  if (e.key === "F7") {
    e.preventDefault();
    if (!spellDrawer.classList.contains("open")) {
      toggleDrawer(spellDrawer);
    }
    runSpellCheck();
    return;
  }

  // Run proofreading now: Cmd/Ctrl + Shift + K
  if (ctrl && e.shiftKey && key === "k") {
    e.preventDefault();
    runSpellCheck();
    return;
  }

  // Toggle proofreading: Cmd/Ctrl + Shift + P
  if (ctrl && e.shiftKey && key === "p") {
    e.preventDefault();
    toggleProofreading();
    return;
  }

  // AST Drawer: Cmd/Ctrl + Shift + A
  if (ctrl && e.shiftKey && key === "a") {
    e.preventDefault();
    toggleDrawer(astDrawer);
    if (astDrawer.classList.contains("open")) updateAst();
    return;
  }
});

// Drawer Toggles
function toggleDrawer(drawer) {
  const isOpen = drawer.classList.contains("open");
  tocDrawer.classList.remove("open");
  astDrawer.classList.remove("open");
  if (!isOpen) {
    drawer.classList.add("open");
  }
}

// Utility Helpers
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Event Bindings
editor.addEventListener("input", () => {
  queueRender();
});

document.getElementById("btn-spell").addEventListener("click", () => toggleDrawer(spellDrawer));
document.getElementById("close-spell").addEventListener("click", () => spellDrawer.classList.remove("open"));
document.getElementById("btn-recheck").addEventListener("click", runSpellCheck);
spellLocaleSel.addEventListener("change", async (e) => {
  state.spellLocale = e.target.value;
  try { localStorage.setItem("markie.spellLocale", state.spellLocale); } catch (_) {}
  await loadSpellDictionary(state.spellLocale);
  runSpellCheck();
});
spellList.addEventListener("click", (e) => {
  const btn = e.target.closest(".spell-suggest");
  if (!btn) return;
  applySuggestion(Number(btn.dataset.idx), btn.dataset.word);
});

document.getElementById("btn-new").addEventListener("click", handleNew);
document.getElementById("btn-open").addEventListener("click", handleOpen);
document.getElementById("btn-save").addEventListener("click", handleSave);
document.getElementById("btn-export").addEventListener("click", handleExport);

document.getElementById("view-split").addEventListener("click", () => setViewMode("split"));
document.getElementById("view-edit").addEventListener("click", () => setViewMode("edit"));
document.getElementById("view-preview").addEventListener("click", () => setViewMode("preview"));
document.getElementById("btn-fullscreen")?.addEventListener("click", () => toggleFullscreen());
document.getElementById("btn-exit-fullscreen")?.addEventListener("click", () => toggleFullscreen(false));
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && state.isFullscreen) {
    toggleFullscreen(false);
  }
});

document.getElementById("btn-toc").addEventListener("click", () => toggleDrawer(tocDrawer));
document.getElementById("close-toc").addEventListener("click", () => tocDrawer.classList.remove("open"));

document.getElementById("btn-ast").addEventListener("click", () => {
  toggleDrawer(astDrawer);
  if (astDrawer.classList.contains("open")) updateAst();
});
document.getElementById("close-ast").addEventListener("click", () => astDrawer.classList.remove("open"));

document.getElementById("copy-ast").addEventListener("click", () => {
  navigator.clipboard.writeText(astOutput.textContent);
  const btn = document.getElementById("copy-ast");
  const oldText = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => { btn.textContent = oldText; }, 1500);
});

// Format Toolbar Buttons
document.querySelectorAll(".fmt-btn[data-fmt]").forEach(btn => {
  btn.addEventListener("click", () => {
    insertFormat(btn.getAttribute("data-fmt"));
  });
});

// Sync Scroll Checkbox
document.getElementById("sync-scroll-chk").addEventListener("change", e => {
  state.syncScroll = e.target.checked;
});

// Theme Toggle
const themeBtn = document.getElementById("btn-theme");
const iconDark = document.getElementById("theme-icon-dark");
const iconLight = document.getElementById("theme-icon-light");

themeBtn.addEventListener("click", () => {
  const isDark = document.body.classList.contains("theme-dark");
  if (isDark) {
    document.body.classList.replace("theme-dark", "theme-light");
    iconDark.classList.add("hidden");
    iconLight.classList.remove("hidden");
  } else {
    document.body.classList.replace("theme-light", "theme-dark");
    iconLight.classList.add("hidden");
    iconDark.classList.remove("hidden");
  }
});

// Settings Modal
const settingsBtn = document.getElementById("btn-settings");
const closeSettings = document.getElementById("close-settings");
const saveSettings = document.getElementById("btn-save-settings");

settingsBtn.addEventListener("click", () => settingsModal.classList.remove("hidden"));
closeSettings.addEventListener("click", () => settingsModal.classList.add("hidden"));

saveSettings.addEventListener("click", () => {
  state.config.gfm = document.getElementById("cfg-gfm").checked;
  state.config.enableMath = document.getElementById("cfg-math").checked;
  state.config.enableFrontmatter = document.getElementById("cfg-frontmatter").checked;
  state.config.allowHtml = document.getElementById("cfg-html").checked;
  settingsModal.classList.add("hidden");
  updateRender(true);
});

function loadFilePayload(file) {
  if (!file || file.content === undefined) return;
  editor.value = file.content;
  markSaved(file.path, file.name);
  updateRender(true);
  updateCursorPos();
}

async function setupFileOpenListener() {
  const listen = window.__TAURI__?.event?.listen;
  if (typeof listen === "function") {
    try {
      await listen("open-file", (event) => {
        loadFilePayload(event.payload);
      });
    } catch (err) {
      console.warn("Failed to listen for open-file events:", err);
    }
  }
}

// Initialize on DOM load (load CLI argument file or OS file-open event)
async function initDocument() {
  try {
    const savedScale = parseFloat(localStorage.getItem("markie.fontScale"));
    if (!Number.isNaN(savedScale)) applyFontScale(savedScale);
    const savedLocale = localStorage.getItem("markie.spellLocale");
    if (savedLocale) {
      state.spellLocale = savedLocale;
      if (spellLocaleSel) spellLocaleSel.value = savedLocale;
    }
    const savedEnabled = localStorage.getItem("markie.spellEnabled");
    if (savedEnabled === "0") {
      state.spellEnabled = false;
      if (btnSpell) btnSpell.classList.remove("active");
    }
  } catch (_) {}

  await setupFileOpenListener();
  try {
    const file = await invoke("get_initial_file");
    if (file && file.content !== undefined) {
      loadFilePayload(file);
      return;
    }
  } catch (err) {
    console.warn("get_initial_file error:", err);
  }

  editor.value = DEFAULT_MARKDOWN;
  markSaved(null, "Untitled.md");
  updateRender(true);
  updateCursorPos();
}

initDocument();

// Drag & Drop markdown file into editor
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", async e => {
  e.preventDefault();
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    const text = await file.text();
    editor.value = text;
    markSaved(file.path || file.name, file.name);
    updateRender(true);
    updateCursorPos();
  }
});
