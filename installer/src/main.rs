// Markie Desktop Installer & Setup Wizard for Windows
#![windows_subsystem = "windows"]

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const EMBEDDED_EXE: &[u8] = include_bytes!("../../markie.exe");
const EMBEDDED_ICON: &[u8] = include_bytes!("../../src-tauri/icons/icon.ico");
const EMBEDDED_README: &[u8] = include_bytes!("../../README.md");

const APP_NAME: &str = "Markie";
const APP_DISPLAY_NAME: &str = "Markie - Markdown Editor & Viewer";
const APP_VERSION: &str = "0.1.0";

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe fn message_box(title: &str, message: &str, flags: u32) -> i32 {
    let w_title = to_wide(title);
    let w_msg = to_wide(message);
    windows_sys::Win32::UI::WindowsAndMessaging::MessageBoxW(
        core::ptr::null_mut(),
        w_msg.as_ptr(),
        w_title.as_ptr(),
        flags,
    )
}

fn get_install_dir() -> PathBuf {
    let local_app_data = env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let userprofile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".into());
            PathBuf::from(userprofile).join("AppData").join("Local")
        });
    local_app_data.join("Programs").join(APP_NAME)
}

fn get_start_menu_dir() -> PathBuf {
    let app_data = env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let userprofile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".into());
            PathBuf::from(userprofile).join("AppData").join("Roaming")
        });
    app_data.join("Microsoft").join("Windows").join("Start Menu").join("Programs")
}

fn get_desktop_dir() -> PathBuf {
    let userprofile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".into());
    PathBuf::from(userprofile).join("Desktop")
}

fn create_shortcut(target_exe: &Path, shortcut_path: &Path, icon_path: &Path) {
    let script = format!(
        "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{}'); $s.TargetPath = '{}'; $s.IconLocation = '{}'; $s.WorkingDirectory = '{}'; $s.Save()",
        shortcut_path.to_string_lossy().replace('\'', "''"),
        target_exe.to_string_lossy().replace('\'', "''"),
        icon_path.to_string_lossy().replace('\'', "''"),
        target_exe.parent().unwrap_or(Path::new("")).to_string_lossy().replace('\'', "''")
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output();
}

fn register_uninstall(install_dir: &Path, uninstall_exe: &Path, icon_path: &Path) {
    let reg_key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Markie";
    
    let entries = [
        ("DisplayName", APP_DISPLAY_NAME),
        ("DisplayVersion", APP_VERSION),
        ("Publisher", "Markie Team"),
        ("InstallLocation", &install_dir.to_string_lossy()),
        ("UninstallString", &format!("\"{}\" --uninstall", uninstall_exe.display())),
        ("DisplayIcon", &icon_path.to_string_lossy()),
        ("HelpLink", "https://github.com/wooorm/markdown-rs"),
    ];

    for (val, data) in entries {
        let _ = Command::new("reg")
            .args(["add", reg_key, "/v", val, "/t", "REG_SZ", "/d", data, "/f"])
            .output();
    }
}
fn register_file_associations(exe_path: &Path, icon_path: &Path) {
    let exe_str = format!("\"{}\" \"%1\"", exe_path.display());
    let icon_str = icon_path.display().to_string();

    // 1. Register ProgID
    let _ = Command::new("reg")
        .args(["add", r"HKCU\Software\Classes\Markie.Doc", "/ve", "/t", "REG_SZ", "/d", "Markdown Document", "/f"])
        .output();
    let _ = Command::new("reg")
        .args(["add", r"HKCU\Software\Classes\Markie.Doc\DefaultIcon", "/ve", "/t", "REG_SZ", "/d", &icon_str, "/f"])
        .output();
    let _ = Command::new("reg")
        .args(["add", r"HKCU\Software\Classes\Markie.Doc\shell\open\command", "/ve", "/t", "REG_SZ", "/d", &exe_str, "/f"])
        .output();

    // 2. Associate extensions and add 'Edit with Markie' context menu
    for ext in &[".md", ".markdown", ".mdown", ".mkd"] {
        let key = format!(r"HKCU\Software\Classes\{}", ext);
        let _ = Command::new("reg")
            .args(["add", &key, "/ve", "/t", "REG_SZ", "/d", "Markie.Doc", "/f"])
            .output();

        let ctx_key = format!(r"HKCU\Software\Classes\SystemFileAssociations\{}\shell\Edit with Markie\command", ext);
        let _ = Command::new("reg")
            .args(["add", &ctx_key, "/ve", "/t", "REG_SZ", "/d", &exe_str, "/f"])
            .output();
    }
}

fn unregister_file_associations() {
    let _ = Command::new("reg").args(["delete", r"HKCU\Software\Classes\Markie.Doc", "/f"]).output();
    for ext in &[".md", ".markdown", ".mdown", ".mkd"] {
        let _ = Command::new("reg").args(["delete", &format!(r"HKCU\Software\Classes\{}", ext), "/f"]).output();
        let _ = Command::new("reg").args(["delete", &format!(r"HKCU\Software\Classes\SystemFileAssociations\{}\shell\Edit with Markie", ext), "/f"]).output();
    }
}


fn unregister_uninstall() {
    let reg_key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Markie";
    let _ = Command::new("reg")
        .args(["delete", reg_key, "/f"])
        .output();
}

fn run_uninstall() {
    let install_dir = get_install_dir();
    let desktop_lnk = get_desktop_dir().join("Markie.lnk");
    let start_lnk = get_start_menu_dir().join("Markie.lnk");

    unsafe {
        let res = message_box(
            "Uninstall Markie",
            "Are you sure you want to completely uninstall Markie Markdown Editor?",
            windows_sys::Win32::UI::WindowsAndMessaging::MB_YESNO | windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONQUESTION,
        );
        if res != 6 { // IDYES = 6
            return;
        }
    }

    // Remove shortcuts
    let _ = fs::remove_file(desktop_lnk);
    let _ = fs::remove_file(start_lnk);

    // Remove registry entry
    // Remove registry entries and file associations
    unregister_uninstall();
    unregister_file_associations();

    // Schedule deletion of directory using cmd in background
    let script = format!(
        "ping 127.0.0.1 -n 2 > nul & rmdir /s /q \"{}\"",
        install_dir.display()
    );
    let _ = Command::new("cmd")
        .args(["/c", &script])
        .spawn();

    unsafe {
        message_box(
            "Markie Uninstalled",
            "Markie Markdown Editor has been successfully removed from your computer.",
            windows_sys::Win32::UI::WindowsAndMessaging::MB_OK | windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONINFORMATION,
        );
    }
}

fn run_install() {
    let install_dir = get_install_dir();
    let is_silent = env::args().any(|a| a == "/S" || a == "--silent");

    if !is_silent {
        unsafe {
            let msg = format!(
                "Welcome to Markie Setup!\n\nThis will install Markie Markdown Editor (powered by markdown-rs and Tauri) to:\n{}\n\nDo you want to continue?",
                install_dir.display()
            );
            let res = message_box(
                "Markie Setup",
                &msg,
                windows_sys::Win32::UI::WindowsAndMessaging::MB_YESNO | windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONQUESTION,
            );
            if res != 6 { // IDYES = 6
                return;
            }
        }
    }

    // Create directories
    if let Err(e) = fs::create_dir_all(&install_dir) {
        unsafe {
            message_box("Installation Error", &format!("Failed to create directory: {}", e), 0x10);
        }
        return;
    }

    let target_exe = install_dir.join("markie.exe");
    let target_icon = install_dir.join("icon.ico");
    let target_readme = install_dir.join("README.md");
    let target_uninstaller = install_dir.join("uninstall.exe");

    // Write embedded files
    if let Err(e) = fs::write(&target_exe, EMBEDDED_EXE) {
        unsafe {
            message_box("Installation Error", &format!("Failed to extract markie.exe: {}", e), 0x10);
        }
        return;
    }
    let _ = fs::write(&target_icon, EMBEDDED_ICON);
    let _ = fs::write(&target_readme, EMBEDDED_README);

    // Copy current running setup exe as uninstall.exe
    if let Ok(current_exe) = env::current_exe() {
        let _ = fs::copy(current_exe, &target_uninstaller);
    }

    // Create Start Menu Shortcut
    let start_dir = get_start_menu_dir();
    let _ = fs::create_dir_all(&start_dir);
    create_shortcut(&target_exe, &start_dir.join("Markie.lnk"), &target_icon);

    // Create Desktop Shortcut
    let desktop_dir = get_desktop_dir();
    create_shortcut(&target_exe, &desktop_dir.join("Markie.lnk"), &target_icon);

    // Register with Windows Add/Remove Programs
    // Register with Windows Add/Remove Programs and File Associations
    register_uninstall(&install_dir, &target_uninstaller, &target_icon);
    register_file_associations(&target_exe, &target_icon);

    if !is_silent {
        unsafe {
            let res = message_box(
                "Installation Complete",
                "Markie has been successfully installed!\n\nShortcuts created on Desktop and Start Menu.\n\nWould you like to launch Markie now?",
                windows_sys::Win32::UI::WindowsAndMessaging::MB_YESNO | windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONINFORMATION,
            );
            if res == 6 { // IDYES
                let _ = Command::new(&target_exe).spawn();
            }
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|a| a == "--uninstall" || a == "/uninstall" || a == "-uninstall") {
        run_uninstall();
    } else {
        run_install();
    }
}
