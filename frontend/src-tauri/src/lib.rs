use std::sync::Mutex;
use tauri::{
    App, AppHandle, Manager, Runtime, State,
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    WebviewUrl, WebviewWindowBuilder,
};

/// Label for the chat window (compact, mobile view)
const CHAT_WINDOW_LABEL: &str = "chat";

/// Label for the 3D world window (full desktop view)
const WORLD_WINDOW_LABEL: &str = "world";

/// Label for the settings window (small, 420×280)
const SETTINGS_WINDOW_LABEL: &str = "settings";

/// Label for the standalone Zen Mode window
const ZEN_WINDOW_LABEL: &str = "zen-mode";

/// ID for the system tray icon (used for badge updates)
const TRAY_ID: &str = "main-tray";

/// App state: current badge count (used to debounce icon updates)
struct BadgeCount(Mutex<u32>);

/// Returns the backend URL from env var or default.
fn backend_url() -> String {
    std::env::var("VITE_API_URL").unwrap_or_else(|_| "http://localhost:8091".to_string())
}

/// Base init: sets backend URL and skips onboarding (backend handles OpenClaw connection).
fn base_init() -> String {
    format!(
        "window.__CREWHUB_BACKEND_URL__ = '{}'; localStorage.setItem('crewhub-onboarded', 'true');",
        backend_url()
    )
}

/// JavaScript injected into the chat window before page load.
fn chat_init_script() -> String {
    format!("window.__TAURI_VIEW__ = 'mobile'; {}", base_init())
}

/// JavaScript injected into the world window before page load.
fn world_init_script() -> String {
    format!("window.__TAURI_VIEW__ = 'desktop'; {}", base_init())
}

/// JavaScript injected into the settings window before page load.
fn settings_init_script() -> String {
    format!("window.__TAURI_VIEW__ = 'settings'; window.__CREWHUB_BACKEND_URL__ = '{}';", backend_url())
}

/// Show an existing window and explicitly focus it.
///
/// With LSUIElement / ActivationPolicy::Accessory, macOS does NOT automatically
/// focus windows when shown. The explicit set_focus() call is mandatory.
fn show_and_focus<R: Runtime>(window: &tauri::WebviewWindow<R>) {
    let _ = window.show();
    let _ = window.set_focus();
}

/// Open or focus the chat window (390×700, compact mobile chat).
/// - If already open: bring to front.
/// - If hidden: show + focus.
/// - If not yet created: create, then show + focus.
fn open_or_focus_chat<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(CHAT_WINDOW_LABEL) {
        show_and_focus(&window);
        return;
    }

    // Create the chat window with initialization script injected before page load
    let result = WebviewWindowBuilder::new(app, CHAT_WINDOW_LABEL, chat_url())
        .title("CrewHub Chat")
        .inner_size(390.0, 700.0)
        .min_inner_size(320.0, 500.0)
        .resizable(true)
        .fullscreen(false)
        .decorations(true)
        .always_on_top(false)
        .skip_taskbar(true) // Don't show in taskbar/dock
        .initialization_script(&chat_init_script())
        .build();

    match result {
        Ok(window) => show_and_focus(&window),
        Err(e) => eprintln!("[CrewHub] Failed to create chat window: {}", e),
    }
}

/// Open or focus the 3D world window (1280×900, resizable, fullscreen capable).
/// - If already open: bring to front.
/// - If hidden: show + focus.
/// - If not yet created: create, then show + focus.
fn open_or_focus_world<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(WORLD_WINDOW_LABEL) {
        show_and_focus(&window);
        return;
    }

    // Create the world window with initialization script injected before page load
    let result = WebviewWindowBuilder::new(app, WORLD_WINDOW_LABEL, world_url())
        .title("CrewHub 3D World")
        .inner_size(1280.0, 900.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .fullscreen(false)
        .decorations(true)
        .always_on_top(false)
        .initialization_script(&world_init_script())
        .build();

    match result {
        Ok(window) => show_and_focus(&window),
        Err(e) => eprintln!("[CrewHub] Failed to create world window: {}", e),
    }
}

/// Build the WebviewUrl for the chat window.
/// Dev: external dev server URL.
/// Production: bundled app with tauri://localhost.
fn chat_url() -> WebviewUrl {
    #[cfg(debug_assertions)]
    {
        WebviewUrl::External("http://localhost:5180/".parse().unwrap())
    }
    #[cfg(not(debug_assertions))]
    {
        WebviewUrl::App("index.html".into())
    }
}

/// Build the WebviewUrl for the world window.
fn world_url() -> WebviewUrl {
    #[cfg(debug_assertions)]
    {
        WebviewUrl::External("http://localhost:5180/".parse().unwrap())
    }
    #[cfg(not(debug_assertions))]
    {
        WebviewUrl::App("index.html".into())
    }
}

/// Build the WebviewUrl for the settings window.
fn settings_url() -> WebviewUrl {
    #[cfg(debug_assertions)]
    {
        WebviewUrl::External("http://localhost:5180/?view=settings".parse().unwrap())
    }
    #[cfg(not(debug_assertions))]
    {
        WebviewUrl::App("index.html?view=settings".into())
    }
}

/// Build the WebviewUrl for the standalone Zen Mode window.
fn zen_url() -> WebviewUrl {
    #[cfg(debug_assertions)]
    {
        WebviewUrl::External("http://localhost:5180/?mode=zen".parse().unwrap())
    }
    #[cfg(not(debug_assertions))]
    {
        WebviewUrl::App("index.html?mode=zen".into())
    }
}

/// JavaScript injected into the Zen Mode window before page load.
fn zen_init_script() -> String {
    format!(
        "window.__TAURI_VIEW__ = 'zen'; {}",
        base_init()
    )
}

/// Open or focus the standalone Zen Mode window (800×900, resizable, no decorations).
/// - If already open: bring to front.
/// - If hidden: show + focus.
/// - If not yet created: create, then show + focus.
fn open_or_focus_zen<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(ZEN_WINDOW_LABEL) {
        show_and_focus(&window);
        return;
    }

    let result = WebviewWindowBuilder::new(app, ZEN_WINDOW_LABEL, zen_url())
        .title("Zen Mode")
        .inner_size(820.0, 920.0)
        .min_inner_size(600.0, 500.0)
        .resizable(true)
        .fullscreen(false)
        .decorations(true)
        .always_on_top(false)
        .skip_taskbar(false)
        .initialization_script(&zen_init_script())
        .build();

    match result {
        Ok(window) => show_and_focus(&window),
        Err(e) => eprintln!("[CrewHub] Failed to create Zen Mode window: {}", e),
    }
}

/// Tauri command: open or focus the standalone Zen Mode window.
/// Called from the frontend via `invoke('open_zen_window')`.
#[tauri::command]
fn open_zen_window(app: AppHandle) {
    open_or_focus_zen(&app);
}

/// Open or focus the settings window (420×280, not resizable).
/// - If already open: bring to front.
/// - If hidden: show + focus.
/// - If not yet created: create, then show + focus.
fn open_or_focus_settings<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        show_and_focus(&window);
        return;
    }

    let result = WebviewWindowBuilder::new(app, SETTINGS_WINDOW_LABEL, settings_url())
        .title("CrewHub Settings")
        .inner_size(420.0, 280.0)
        .resizable(false)
        .fullscreen(false)
        .decorations(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .initialization_script(&settings_init_script())
        .build();

    match result {
        Ok(window) => show_and_focus(&window),
        Err(e) => eprintln!("[CrewHub] Failed to create settings window: {}", e),
    }
}

/// Set up the system tray with the CrewHub menu.
fn setup_tray(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let chat_item = MenuItem::with_id(handle, "chat", "Chat", true, None::<&str>)?;
    let world_item = MenuItem::with_id(handle, "world", "3D World", true, None::<&str>)?;
    let zen_item = MenuItem::with_id(handle, "zen", "🧘 Zen Mode", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(handle, "settings", "⚙️ Settings", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(handle)?;
    let quit_item = MenuItem::with_id(handle, "quit", "Quit CrewHub", true, None::<&str>)?;

    let menu = Menu::with_items(handle, &[&chat_item, &world_item, &zen_item, &settings_item, &separator, &quit_item])?;

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("CrewHub")
        // On menu item click
        .on_menu_event(|app, event| match event.id.as_ref() {
            "chat" => open_or_focus_chat(app),
            "world" => open_or_focus_world(app),
            "zen" => open_or_focus_zen(app),
            "settings" => open_or_focus_settings(app),
            "quit" => {
                println!("[CrewHub] Quitting...");
                app.exit(0);
            }
            other => eprintln!("[CrewHub] Unknown menu event: {}", other),
        })
        // On direct tray icon left-click: open/focus chat (useful on Windows/Linux)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_or_focus_chat(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Tauri command: update the tray icon badge.
///
/// - count = 0 → normal tray icon
/// - count = 1 → tray-badge-1.png
/// - count = 2 → tray-badge-2.png
/// - count ≥ 3 → tray-badge-3plus.png
///
/// Called from the frontend via `invoke('update_tray_badge', { count })`.
#[tauri::command]
fn update_tray_badge(
    count: u32,
    app: AppHandle,
    badge_state: State<BadgeCount>,
) -> Result<(), String> {
    // Debounce: skip if count hasn't changed
    {
        let mut current = badge_state.0.lock().map_err(|e| e.to_string())?;
        if *current == count {
            return Ok(());
        }
        *current = count;
    }

    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Tray icon not found".to_string())?;

    let icon = if count == 0 {
        // Restore default icon
        app.default_window_icon()
            .ok_or_else(|| "No default icon".to_string())?
            .clone()
    } else {
        // Pick the appropriate badge icon
        let icon_name = match count {
            1 => "tray-badge-1.png",
            2 => "tray-badge-2.png",
            _ => "tray-badge-3plus.png",
        };
        Image::from_path(
            app.path()
                .resource_dir()
                .map_err(|e| e.to_string())?
                .join("icons")
                .join(icon_name),
        )
        .map_err(|e| format!("Failed to load badge icon '{}': {}", icon_name, e))?
    };

    tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(if count == 0 {
        "CrewHub".to_string()
    } else {
        format!("CrewHub — {} unread", count)
    }))
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(BadgeCount(Mutex::new(0)))
        .invoke_handler(tauri::generate_handler![update_tray_badge, open_zen_window])
        .setup(|app| {
            // ── macOS: Accessory activation policy ──────────────────────────
            // Accessory = no Dock icon, no App Switcher (Cmd+Tab).
            // Better than Prohibited: windows still receive proper focus when
            // set_focus() is called explicitly.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // ── Set up system tray ───────────────────────────────────────────
            setup_tray(app)?;

            Ok(())
        })
        // ── Window close → hide (not destroy) ───────────────────────────────
        // Prevents expensive Three.js re-initialization on reopen (500ms+).
        // The app stays alive via the tray icon even when all windows are hidden.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == CHAT_WINDOW_LABEL
                    || label == WORLD_WINDOW_LABEL
                    || label == SETTINGS_WINDOW_LABEL
                    || label == ZEN_WINDOW_LABEL
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running CrewHub application");
}
