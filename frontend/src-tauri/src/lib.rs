use tauri::{
    App, AppHandle, Manager, Runtime,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    WebviewUrl, WebviewWindowBuilder,
};

/// Label for the chat window (compact, mobile view)
const CHAT_WINDOW_LABEL: &str = "chat";

/// Label for the 3D world window (full desktop view)
const WORLD_WINDOW_LABEL: &str = "world";

/// JavaScript injected into the chat window before page load.
/// This is more reliable than query params: survives navigation, works in
/// both dev and production, has no routing side effects.
const CHAT_INIT_SCRIPT: &str = "window.__TAURI_VIEW__ = 'mobile';";

/// JavaScript injected into the world window before page load.
const WORLD_INIT_SCRIPT: &str = "window.__TAURI_VIEW__ = 'desktop';";

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
        .initialization_script(CHAT_INIT_SCRIPT)
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
        .initialization_script(WORLD_INIT_SCRIPT)
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

/// Set up the system tray with the CrewHub menu.
fn setup_tray(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    let chat_item = MenuItem::with_id(handle, "chat", "Chat", true, None::<&str>)?;
    let world_item = MenuItem::with_id(handle, "world", "3D World", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(handle)?;
    let quit_item = MenuItem::with_id(handle, "quit", "Quit CrewHub", true, None::<&str>)?;

    let menu = Menu::with_items(handle, &[&chat_item, &world_item, &separator, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("CrewHub")
        // On menu item click
        .on_menu_event(|app, event| match event.id.as_ref() {
            "chat" => open_or_focus_chat(app),
            "world" => open_or_focus_world(app),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
                if label == CHAT_WINDOW_LABEL || label == WORLD_WINDOW_LABEL {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running CrewHub application");
}
