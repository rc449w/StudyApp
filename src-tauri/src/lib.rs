use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStoragePaths {
    pub app_data_dir: String,
    pub documents_vault_dir: String,
    pub sqlite_db_path: String,
    pub backups_dir: String,
}

fn ensure_app_dirs(app: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Unable to resolve AppData directory: {e}"))?;
    let docs_dir = base_dir.join("documents");
    let backups_dir = base_dir.join("backups");
    let db_path = base_dir.join("studywise_ai.db");

    fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;

    Ok((base_dir, docs_dir, db_path, backups_dir))
}

#[tauri::command]
fn close_splashscreen(app: AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.show();
        let _ = main_win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn get_app_storage_paths(app: AppHandle) -> Result<DesktopStoragePaths, String> {
    let (base_dir, docs_dir, db_path, backups_dir) = ensure_app_dirs(&app)?;
    Ok(DesktopStoragePaths {
        app_data_dir: base_dir.to_string_lossy().to_string(),
        documents_vault_dir: docs_dir.to_string_lossy().to_string(),
        sqlite_db_path: db_path.to_string_lossy().to_string(),
        backups_dir: backups_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn save_document_to_local_vault(
    app: AppHandle,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let (_base_dir, docs_dir, _db_path, _backups_dir) = ensure_app_dirs(&app)?;
    let sanitized_name: String = file_name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let target_name = if sanitized_name.trim().is_empty() {
        "document.bin".to_string()
    } else {
        sanitized_name
    };
    let target_path = docs_dir.join(target_name);
    fs::write(&target_path, bytes).map_err(|e| format!("Failed writing local file: {e}"))?;
    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_document_from_local_vault(local_vault_path: String) -> Result<Vec<u8>, String> {
    fs::read(&local_vault_path).map_err(|e| format!("Failed reading local vault file: {e}"))
}

#[tauri::command]
async fn pick_local_storage_folder(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().blocking_pick_folder();
    Ok(picked.map(|p| p.to_string()))
}

fn sqlite_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_studywise_ai_core_tables",
        sql: "
            CREATE TABLE IF NOT EXISTS profile (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                grade_level TEXT NOT NULL,
                strand TEXT NOT NULL,
                school_name TEXT NOT NULL,
                preferred_language TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS subjects (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                grade_level TEXT NOT NULL,
                quarter TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                subject_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                extraction_status TEXT NOT NULL,
                local_vault_path TEXT,
                added_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS document_contents (
                document_id TEXT PRIMARY KEY,
                source_file_name TEXT NOT NULL,
                inventory_status TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS topics (
                id TEXT PRIMARY KEY,
                subject_id TEXT NOT NULL,
                title TEXT NOT NULL,
                quarter TEXT NOT NULL,
                mastery_status TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS study_guides (
                id TEXT PRIMARY KEY,
                subject_id TEXT NOT NULL,
                title TEXT NOT NULL,
                source_mode TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS research_notes (
                id TEXT PRIMARY KEY,
                subject_id TEXT NOT NULL,
                query TEXT NOT NULL,
                source_engine TEXT NOT NULL,
                saved_offline_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS mock_exams (
                id TEXT PRIMARY KEY,
                subject_id TEXT NOT NULL,
                title TEXT NOT NULL,
                grade_level TEXT NOT NULL,
                created_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS exam_attempts (
                id TEXT PRIMARY KEY,
                exam_id TEXT NOT NULL,
                subject_id TEXT NOT NULL,
                percentage INTEGER NOT NULL,
                completed_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL
            );
        ",
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:studywise_ai.db", sqlite_migrations())
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            get_app_storage_paths,
            save_document_to_local_vault,
            read_document_from_local_vault,
            pick_local_storage_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running StudyWise AI desktop application");
}
