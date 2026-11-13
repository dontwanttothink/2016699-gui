use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Wry};
use tauri_plugin_dialog::DialogExt;

const LOAD_MENU_ID: &str = "load-courses";
const LOAD_EVENT: &str = "load-courses";
const MAIN_WINDOW: &str = "main";
const STRUCTURES_WINDOW: &str = "structures";

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum Algorithm {
    List,
    Heap,
}

#[derive(Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "lowercase")]
enum PlannerError {
    Impossible(String),
    Failed(String),
}

fn planner_path() -> Result<PathBuf, PlannerError> {
    let exe = std::env::current_exe().map_err(|e| PlannerError::Failed(e.to_string()))?;
    let dir = exe
        .parent()
        .ok_or_else(|| PlannerError::Failed("no se pudo ubicar el ejecutable".into()))?;
    Ok(dir.join(format!("graduation{}", std::env::consts::EXE_SUFFIX)))
}

fn run_binary(binary: &Path, args: &[String], input: &str) -> Result<String, PlannerError> {
    let mut child = Command::new(binary)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| PlannerError::Failed(e.to_string()))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(input.as_bytes())
            .map_err(|e| PlannerError::Failed(e.to_string()))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| PlannerError::Failed(e.to_string()))?;
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    match output.status.code() {
        Some(0) => Ok(String::from_utf8_lossy(&output.stdout).into_owned()),
        Some(2) => Err(PlannerError::Impossible(stderr)),
        _ => Err(PlannerError::Failed(stderr)),
    }
}

#[tauri::command]
async fn run_planner(
    input: String,
    algorithm: Algorithm,
    max_credits: u32,
    verbose: bool,
) -> Result<String, PlannerError> {
    if max_credits == 0 {
        return Err(PlannerError::Failed(
            "max_credits debe ser al menos 1".into(),
        ));
    }

    let algorithm = match algorithm {
        Algorithm::List => "0",
        Algorithm::Heap => "1",
    };
    let mut args = vec![
        "--algorithm".to_string(),
        algorithm.to_string(),
        "--max-credits".to_string(),
        max_credits.to_string(),
    ];
    if verbose {
        args.push("--verbose".to_string());
    }
    args.push("-".to_string());

    run_binary(&planner_path()?, &args, &input)
}

#[tauri::command]
async fn pick_courses_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(file) = app.dialog().file().blocking_pick_file() else {
        return Ok(None);
    };
    let path = file.into_path().map_err(|e| e.to_string())?;
    std::fs::read_to_string(path)
        .map(Some)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_structures_window(app: AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(STRUCTURES_WINDOW) {
        return window.set_focus();
    }
    WebviewWindowBuilder::new(
        &app,
        STRUCTURES_WINDOW,
        WebviewUrl::App("structures".into()),
    )
    .title("Estructuras")
    .inner_size(900.0, 600.0)
    .min_inner_size(500.0, 300.0)
    .visible(false)
    .build()?;
    Ok(())
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let load = MenuItem::with_id(
        app,
        LOAD_MENU_ID,
        "Cargar archivo…",
        true,
        Some("CmdOrCtrl+O"),
    )?;

    let file = Submenu::with_items(
        app,
        "Archivo",
        true,
        &[
            &load,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some("Cerrar ventana"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Edición",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("Deshacer"))?,
            &PredefinedMenuItem::redo(app, Some("Rehacer"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("Cortar"))?,
            &PredefinedMenuItem::copy(app, Some("Copiar"))?,
            &PredefinedMenuItem::paste(app, Some("Pegar"))?,
            &PredefinedMenuItem::select_all(app, Some("Seleccionar todo"))?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        "Ventana",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("Minimizar"))?,
            &PredefinedMenuItem::maximize(app, Some("Maximizar"))?,
            &PredefinedMenuItem::fullscreen(app, Some("Pantalla completa"))?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    {
        let name = app.package_info().name.clone();
        let application = Submenu::with_items(
            app,
            &name,
            true,
            &[
                &PredefinedMenuItem::about(app, Some(&format!("Acerca de {name}")), None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, Some("Servicios"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, Some(&format!("Ocultar {name}")))?,
                &PredefinedMenuItem::hide_others(app, Some("Ocultar otros"))?,
                &PredefinedMenuItem::show_all(app, Some("Mostrar todo"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, Some(&format!("Salir de {name}")))?,
            ],
        )?;
        Menu::with_items(app, &[&application, &file, &edit, &window])
    }
    #[cfg(not(target_os = "macos"))]
    {
        Menu::with_items(app, &[&file, &edit, &window])
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .menu(build_menu)
        .on_menu_event(|app, event| {
            if event.id() == LOAD_MENU_ID {
                let _ = app.emit_to(MAIN_WINDOW, LOAD_EVENT, ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            run_planner,
            pick_courses_file,
            open_structures_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
