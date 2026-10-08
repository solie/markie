use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct MarkdownConfig {
    pub gfm: bool,
    pub allow_html: bool,
    pub enable_math: bool,
    pub enable_frontmatter: bool,
}

impl Default for MarkdownConfig {
    fn default() -> Self {
        Self {
            gfm: true,
            allow_html: true,
            enable_math: true,
            enable_frontmatter: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TocItem {
    pub level: u32,
    pub text: String,
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenderResult {
    pub html: String,
    pub word_count: usize,
    pub char_count: usize,
    pub reading_time_minutes: f32,
    pub toc: Vec<TocItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilePayload {
    pub path: String,
    pub name: String,
    pub content: String,
}

#[derive(Default)]
pub struct AppState {
    pub initial_file: Mutex<Option<FilePayload>>,
}

pub fn payload_from_path(path: &std::path::Path) -> Option<FilePayload> {
  if path.is_file() {
    if let Ok(content) = fs::read_to_string(path) {
      let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "document.md".into());
      return Some(FilePayload {
        path: path.to_string_lossy().to_string(),
        name,
        content,
      });
    }
  }
  None
}

pub fn parse_cli_file() -> Option<FilePayload> {
    let args: Vec<String> = std::env::args().collect();
    for arg in args.into_iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        let path = std::path::PathBuf::from(&arg);
        if let Some(payload) = payload_from_path(&path) {
            return Some(payload);
        }
    }
    None
}

pub fn generate_slug(text: &str) -> String {
    text.chars()
        .filter_map(|c| {
            if c.is_alphanumeric() {
                Some(c.to_ascii_lowercase())
            } else if c.is_whitespace() || c == '-' || c == '_' {
                Some('-')
            } else {
                None
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn extract_toc(markdown: &str) -> Vec<TocItem> {
    let mut toc = Vec::new();
    let mut in_code_block = false;

    for line in markdown.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        if trimmed.starts_with('#') {
            let hash_count = trimmed.chars().take_while(|&c| c == '#').count();
            if hash_count <= 6 {
                let rest = trimmed[hash_count..].trim();
                if !rest.is_empty() {
                    let id = generate_slug(rest);
                    toc.push(TocItem {
                        level: hash_count as u32,
                        text: rest.to_string(),
                        id,
                    });
                }
            }
        }
    }

    toc
}

pub fn calculate_stats(text: &str) -> (usize, usize, f32) {
    let char_count = text.chars().count();
    let words = text.split_whitespace().count();
    let reading_time = (words as f32 / 200.0).max(0.1);
    (words, char_count, (reading_time * 10.0).round() / 10.0)
}

pub fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub mod commands {
    use super::*;

    #[tauri::command]
    pub fn render_markdown(
        content: String,
        config: Option<MarkdownConfig>,
    ) -> Result<RenderResult, String> {
        let cfg = config.unwrap_or_default();

        let mut options = if cfg.gfm {
            markdown::Options::gfm()
        } else {
            markdown::Options::default()
        };

        options.compile.allow_dangerous_html = cfg.allow_html;
        options.parse.constructs.frontmatter = cfg.enable_frontmatter;
        options.parse.constructs.math_flow = cfg.enable_math;
        options.parse.constructs.math_text = cfg.enable_math;
        options.parse.math_text_single_dollar = cfg.enable_math;
        let html = markdown::to_html_with_options(&content, &options)
            .map_err(|err| format!("Markdown compile error: {}", err))?;

        let (word_count, char_count, reading_time_minutes) = calculate_stats(&content);
        let toc = extract_toc(&content);

        Ok(RenderResult {
            html,
            word_count,
            char_count,
            reading_time_minutes,
            toc,
        })
    }

    #[tauri::command]
    pub fn parse_ast(content: String, config: Option<MarkdownConfig>) -> Result<String, String> {
        let cfg = config.unwrap_or_default();

        let mut parse_options = if cfg.gfm {
            markdown::ParseOptions::gfm()
        } else {
            markdown::ParseOptions::default()
        };

        parse_options.constructs.frontmatter = cfg.enable_frontmatter;
        parse_options.constructs.math_flow = cfg.enable_math;
        parse_options.constructs.math_text = cfg.enable_math;
        parse_options.math_text_single_dollar = cfg.enable_math;
        let node = markdown::to_mdast(&content, &parse_options)
            .map_err(|err| format!("AST parse error: {}", err))?;

        serde_json::to_string_pretty(&node).map_err(|err| format!("Serialization error: {}", err))
    }

    #[tauri::command]
    pub fn open_file() -> Result<Option<FilePayload>, String> {
        let file_path = rfd::FileDialog::new()
            .add_filter("Markdown Files", &["md", "markdown", "mdown", "mkd", "txt"])
            .add_filter("All Files", &["*"])
            .pick_file();

        match file_path {
            Some(path) => {
                let content = fs::read_to_string(&path)
                    .map_err(|err| format!("Failed to read file {}: {}", path.display(), err))?;
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Untitled.md".into());
                let path_str = path.to_string_lossy().to_string();

                Ok(Some(FilePayload {
                    path: path_str,
                    name,
                    content,
                }))
            }
            None => Ok(None),
        }
    }

    #[tauri::command]
    pub fn save_file(path: Option<String>, content: String) -> Result<FilePayload, String> {
        let target_path = match path {
            Some(p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
            _ => match rfd::FileDialog::new()
                .set_file_name("document.md")
                .add_filter("Markdown Files", &["md", "markdown", "txt"])
                .save_file()
            {
                Some(p) => p,
                None => return Err("Save cancelled".to_string()),
            },
        };

        fs::write(&target_path, &content)
            .map_err(|err| format!("Failed to write file {}: {}", target_path.display(), err))?;

        let name = target_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "document.md".into());

        Ok(FilePayload {
            path: target_path.to_string_lossy().to_string(),
            name,
            content,
        })
    }

    #[tauri::command]
    pub fn allow_document_dir(app: tauri::AppHandle, path: String) {
        if path.trim().is_empty() {
            return;
        }
        let p = std::path::PathBuf::from(&path);
        if let Some(parent) = p.parent() {
            let _ = app.asset_protocol_scope().allow_directory(parent, true);
        }
        let _ = app.asset_protocol_scope().allow_file(&p);
    }

    #[tauri::command]
    pub fn get_initial_file(state: tauri::State<AppState>) -> Result<Option<FilePayload>, String> {
        let initial = state.initial_file.lock().map_err(|e| e.to_string())?;
        if let Some(file) = initial.as_ref() {
            return Ok(Some(file.clone()));
        }
        if let Some(file) = parse_cli_file() {
            return Ok(Some(file));
        }
        Ok(None)
    }

    #[tauri::command]
    pub fn export_html(
        path: Option<String>,
        html: String,
        title: String,
    ) -> Result<String, String> {
        let target_path = match path {
            Some(p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
            _ => match rfd::FileDialog::new()
                .set_file_name(&format!("{}.html", generate_slug(&title)))
                .add_filter("HTML Files", &["html", "htm"])
                .save_file()
            {
                Some(p) => p,
                None => return Err("Export cancelled".to_string()),
            },
        };

        let full_document = format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{}</title>
  <style>
    :root {{
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      --color-bg: #ffffff;
      --color-fg: #1f2328;
      --color-muted: #656d76;
      --color-border: #d0d7de;
      --color-code-bg: #f6f8fa;
      --color-accent: #0969da;
    }}
    @media (prefers-color-scheme: dark) {{
      :root {{
        --color-bg: #0d1117;
        --color-fg: #e6edf3;
        --color-muted: #8b949e;
        --color-border: #30363d;
        --color-code-bg: #161b22;
        --color-accent: #2f81f7;
      }}
    }}
    body {{
      font-family: var(--font-sans);
      line-height: 1.6;
      color: var(--color-fg);
      background-color: var(--color-bg);
      max-width: 860px;
      margin: 40px auto;
      padding: 0 20px;
    }}
    pre, code {{
      font-family: var(--font-mono);
      background-color: var(--color-code-bg);
      border-radius: 6px;
    }}
    code {{
      padding: 0.2em 0.4em;
      font-size: 85%;
    }}
    pre code {{
      padding: 0;
      font-size: 100%;
    }}
    pre {{
      padding: 16px;
      overflow: auto;
      border: 1px solid var(--color-border);
    }}
    blockquote {{
      margin: 0;
      padding: 0 1em;
      color: var(--color-muted);
      border-left: 0.25em solid var(--color-border);
    }}
    table {{
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }}
    table th, table td {{
      padding: 8px 12px;
      border: 1px solid var(--color-border);
    }}
    table tr:nth-child(2n) {{
      background-color: var(--color-code-bg);
    }}
    img {{
      max-width: 100%;
      height: auto;
    }}
    hr {{
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 24px 0;
    }}
    a {{
      color: var(--color-accent);
      text-decoration: none;
    }}
    a:hover {{
      text-decoration: underline;
    }}
    .katex-display-container {{
      display: block;
      margin: 1em 0;
      overflow-x: auto;
      text-align: center;
    }}
    .katex-inline-container {{
      display: inline-block;
    }}
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
</head>
<body>
  {}
</body>
</html>"#,
            html_escape(&title),
            html
        );

        fs::write(&target_path, full_document)
            .map_err(|err| format!("Failed to export HTML to {}: {}", target_path.display(), err))?;

        Ok(target_path.to_string_lossy().to_string())
    }

    #[tauri::command]
    pub fn exit_app(app_handle: tauri::AppHandle) {
        app_handle.exit(0);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppState {
            initial_file: Mutex::new(parse_cli_file()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::render_markdown,
            commands::parse_ast,
            commands::open_file,
            commands::save_file,
            commands::get_initial_file,
            commands::export_html,
            commands::exit_app,
            commands::allow_document_dir
        ])
        .build(tauri::generate_context!())
        .expect("error while building Markie application");

    #[allow(unused_variables)]
    app.run(|app_handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        if let tauri::RunEvent::Opened { urls } = event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if let Some(payload) = payload_from_path(&path) {
                        if let Some(state) = app_handle.try_state::<AppState>() {
                            if let Ok(mut initial) = state.initial_file.lock() {
                                *initial = Some(payload.clone());
                            }
                        }
                        let _ = app_handle.emit("open-file", &payload);
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.set_focus();
                        }
                        break;
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dot_rendering() {
        let md = "```dot\ndigraph G { a -> b }\n```\n\n```graphviz\ndigraph G { c -> d }\n```";
        let res = commands::render_markdown(md.to_string(), None).unwrap();
        println!("RENDERED DOT HTML:\n{}", res.html);
    }
    #[test]
    fn test_math_rendering() {
        let md = "Inline math: $E = mc^2$ and $x$.\n\n$$\n\\sum_{i=1}^n x_i\n$$\n\n$$E = mc^2$$\n";
        let res = commands::render_markdown(md.to_string(), None).unwrap();
        println!("RENDERED HTML:\n{}", res.html);
    }
}
