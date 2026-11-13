use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_planner])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
