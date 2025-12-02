// Tauri commands providing a filesystem-backed storage adapter for FocosX desktop.
// Commands return JSON strings for structured data so the frontend can JSON.parse them.
//
// Notes:
// - Uses the OS data directory (tauri::api::path::data_dir()) as base storage.
// - Stores vaults, trees, contents, plugins and preferences as JSON files under that base.
// - All commands return Result<..., String> where Err contains a human-readable error.

use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

/// Determine the base directory to store app data.
/// Preferred sources (in order):
/// - XDG_DATA_HOME (if set)
/// - On macOS: $HOME/Library/Application Support
/// - On Windows: %APPDATA%
/// - Fallback: $HOME/.local/share
/// The folder `focosx_desktop` is appended to the chosen base.
fn base_dir() -> Result<PathBuf, String> {
    // Prefer a simple, user-visible central folder per OS so vault metadata
    // is easy to find. On Linux use ~/.focosx, on macOS use
    // ~/Library/Application Support/focosx, on Windows use %APPDATA%/focosx.
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let mut p = PathBuf::from(home);
            p.push(".focosx");
            return Ok(p);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let mut p = PathBuf::from(home);
            p.push("Library");
            p.push("Application Support");
            p.push("focosx");
            return Ok(p);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let mut p = PathBuf::from(appdata);
            p.push("focosx");
            return Ok(p);
        }
    }

    // Fallback: try XDG_DATA_HOME or ~/.local/share/focosx
    if let Some(xdg) = std::env::var_os("XDG_DATA_HOME") {
        let mut p = PathBuf::from(xdg);
        p.push("focosx");
        return Ok(p);
    }

    if let Some(home) = std::env::var_os("HOME") {
        let mut p = PathBuf::from(home);
        p.push(".local");
        p.push("share");
        p.push("focosx");
        return Ok(p);
    }

    Err("couldn't determine OS data_dir".to_string())
}

/// Ensure that a directory exists; create it if necessary.
fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("failed to create dir {}: {}", path.display(), e))
}

/// Write text to a file (overwrites). Ensure parent directory exists.
fn write_text_file(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, content).map_err(|e| format!("write error {}: {}", path.display(), e))
}

/// Read a file into a String. If file missing, return empty string (frontend will treat as empty).
fn read_text_file(path: &Path) -> Result<String, String> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("read error {}: {}", path.display(), e)),
    }
}

/// Convenience: write JSON string to file.
fn write_json_file(path: &Path, json_str: &str) -> Result<(), String> {
    write_text_file(path, json_str)
}

/// Convenience: read JSON file -> String (empty string if not found)
fn read_json_file(path: &Path) -> Result<String, String> {
    read_text_file(path)
}

/// Attempt to locate a vault folder (absolute path) that contains a node
/// with the provided `file_id` in its tree. Returns `Some(PathBuf)` when the
/// vault folder is absolute and contains the node; otherwise `None`.
fn find_vault_folder_for_file(file_id: &str) -> Result<Option<PathBuf>, String> {
    let base = base_dir()?;
    // path to app-managed vaults.json
    let mut vaults_path = base.clone();
    vaults_path.push("vaults.json");
    let vraw = read_json_file(&vaults_path)?;
    if vraw.trim().is_empty() {
        return Ok(None);
    }
    let vs: serde_json::Value = serde_json::from_str(&vraw).map_err(|e| e.to_string())?;
    if let Some(arr) = vs.as_array() {
        for v in arr {
            if let Some(vid) = v.get("id").and_then(|x| x.as_str()) {
                // load the tree for this vault: first try vault/.focosx/tree.json if path absolute,
                // otherwise fall back to app-managed trees/<vaultId>.json
                let tree_json = if let Some(pstr) = v.get("path").and_then(|x| x.as_str()) {
                    let candidate = Path::new(pstr);
                    if candidate.is_absolute() {
                        let mut treefile = candidate.to_path_buf();
                        treefile.push(".focosx");
                        treefile.push("tree.json");
                        match read_json_file(&treefile) {
                            Ok(s) => s,
                            Err(_) => String::new(),
                        }
                    } else {
                        let mut tb = base.clone();
                        tb.push("trees");
                        tb.push(format!("{}.json", vid));
                        match read_json_file(&tb) {
                            Ok(s) => s,
                            Err(_) => String::new(),
                        }
                    }
                } else {
                    String::new()
                };

                if !tree_json.trim().is_empty() {
                    if let Ok(tree_val) = serde_json::from_str::<serde_json::Value>(&tree_json) {
                        if let Some(nodes) = tree_val.as_array() {
                            for n in nodes {
                                if n.get("id").and_then(|x| x.as_str()) == Some(file_id) {
                                    if let Some(pstr) = v.get("path").and_then(|x| x.as_str()) {
                                        let candidate = Path::new(pstr);
                                        if candidate.is_absolute() {
                                            return Ok(Some(candidate.to_path_buf()));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(None)
}

// ----------------- Vaults -----------------

/// Get vaults.json (returns JSON array string). If missing, return an empty array.
#[tauri::command]
fn get_vaults() -> Result<String, String> {
    let mut base = base_dir()?;
    ensure_dir(&base)?;
    base.push("vaults.json");
    let content = read_json_file(&base)?;
    if content.trim().is_empty() {
        // Return empty array - user should create vaults explicitly
        Ok("[]".to_string())
    } else {
        Ok(content)
    }
}

#[tauri::command]
fn save_vaults(json: String) -> Result<(), String> {
    let mut base = base_dir()?;
    ensure_dir(&base)?;
    base.push("vaults.json");
    write_json_file(&base, &json)
}

/// Open a native directory picker and return the chosen absolute path (empty string if cancelled).
#[tauri::command]
fn select_vault_folder() -> Result<String, String> {
    Err("native folder picker is not available in this build. Either enable a dialog API feature or perform folder selection in the frontend and pass the path to a new command.".to_string())
}

/// Create a new vault entry that points to an absolute filesystem path chosen by the user.
/// This registers the vault in the application's `vaults.json` and initializes a
/// backend-compatible tree file under the app-managed `trees/` folder for compatibility.
/// Returns the new vault id on success.
#[tauri::command]
fn create_vault_at_path(name: &str, path: &str) -> Result<String, String> {
    // Update app-managed vaults.json
    let mut base = base_dir()?;
    ensure_dir(&base)?;
    base.push("vaults.json");
    let raw = read_json_file(&base)?;
    let mut arr: Vec<serde_json::Value> = if raw.trim().is_empty() {
        vec![]
    } else {
        serde_json::from_str(&raw).map_err(|e| e.to_string())?
    };

    let id = uuid::Uuid::new_v4().to_string();
    let vault_obj = json!({
        "id": id,
        "name": name,
        "path": path,
        "createdAt": chrono::Utc::now().timestamp_millis()
    });
    arr.push(vault_obj);
    let s = serde_json::to_string_pretty(&arr).map_err(|e| e.to_string())?;
    write_json_file(&base, &s)?;

    // We do NOT initialize a default tree for local vaults.
    // The tree will be built from the filesystem on load.

    Ok(id)
}

// ----------------- Trees -----------------

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct FileSystemNode {
    id: String,
    name: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileSystemNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(rename = "parentId")]
    parent_id: Option<String>,
}

fn scan_directory(root: &Path, current: &Path, parent_id: Option<String>, id_prefix: &str) -> Result<Vec<FileSystemNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(current).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders (like .focosx, .git, .DS_Store)
        if name.starts_with('.') {
            continue;
        }

        let relative_path = path.strip_prefix(root).map_err(|e| e.to_string())?;
        let raw_id = relative_path.to_string_lossy().to_string().replace("\\", "/");
        let id = format!("{}{}", id_prefix, raw_id);
        
        let is_dir = path.is_dir();
        let node_type = if is_dir {
            "FOLDER".to_string()
        } else if name.ends_with(".canvas") {
            "CANVAS".to_string()
        } else {
            "FILE".to_string()
        };

        let mut children = None;
        if is_dir {
            children = Some(scan_directory(root, &path, Some(id.clone()), id_prefix)?);
        }

        nodes.push(FileSystemNode {
            id,
            name,
            node_type,
            children,
            content: None, // We don't load content during tree scan
            parent_id: parent_id.clone(),
        });
    }
    
    // Sort: Folders first, then files, alphabetically
    nodes.sort_by(|a, b| {
        let a_is_folder = a.node_type == "FOLDER";
        let b_is_folder = b.node_type == "FOLDER";
        if a_is_folder && !b_is_folder {
            std::cmp::Ordering::Less
        } else if !a_is_folder && b_is_folder {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(nodes)
}

#[tauri::command]
fn load_tree(vault_id: &str) -> Result<String, String> {
    eprintln!("[load_tree] called with vault_id={}", vault_id);
    
    // If the vault points to an absolute filesystem folder, prefer reading the tree
    // from a file inside that folder (so vault state can live next to the user's files).
    let mut base = base_dir()?;
    let vaults_path = {
        let mut p = base.clone();
        p.push("vaults.json");
        p
    };

    if let Ok(vraw) = read_json_file(&vaults_path) {
        if !vraw.trim().is_empty() {
            if let Ok(vs) = serde_json::from_str::<serde_json::Value>(&vraw) {
                if let Some(arr) = vs.as_array() {
                    for v in arr {
                        if v.get("id").and_then(|x| x.as_str()) == Some(vault_id) {
                            if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
                                let candidate = Path::new(p);
                                eprintln!("[load_tree] Found vault path: {:?}, is_absolute={}, exists={}", candidate, candidate.is_absolute(), candidate.exists());
                                if candidate.is_absolute() {
                                    // Use real filesystem scan
                                    if candidate.exists() {
                                        let nodes = scan_directory(candidate, candidate, None, &format!("{}:", vault_id))?;
                                        let result = serde_json::to_string(&nodes).map_err(|e| e.to_string())?;
                                        eprintln!("[load_tree] Scanned {} nodes, result: {}", nodes.len(), &result[..result.len().min(500)]);
                                        return Ok(result);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback to app-managed trees folder
    eprintln!("[load_tree] Using fallback trees folder");
    base.push("trees");
    ensure_dir(&base)?;
    base.push(format!("{}.json", vault_id));
    read_json_file(&base)
}

#[tauri::command]
fn save_tree(vault_id: &str, json: String) -> Result<(), String> {
    // If the vault points to an absolute filesystem folder, do nothing.
    // The tree is derived from the actual filesystem structure and should
    // not be saved separately.
    let mut base = base_dir()?;
    let vaults_path = {
        let mut p = base.clone();
        p.push("vaults.json");
        p
    };

    if let Ok(vraw) = read_json_file(&vaults_path) {
        if !vraw.trim().is_empty() {
            if let Ok(vs) = serde_json::from_str::<serde_json::Value>(&vraw) {
                if let Some(arr) = vs.as_array() {
                    for v in arr {
                        if v.get("id").and_then(|x| x.as_str()) == Some(vault_id) {
                            if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
                                let candidate = Path::new(p);
                                if candidate.is_absolute() {
                                    // Real filesystem vault - tree is derived from disk, skip saving
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: write to app-managed trees folder (for non-filesystem vaults)
    base.push("trees");
    ensure_dir(&base)?;
    base.push(format!("{}.json", vault_id));
    write_json_file(&base, &json)
}

// ----------------- File Contents -----------------

#[tauri::command]
fn load_file_content(file_id: &str) -> Result<String, String> {
    // Check if file_id contains vault prefix (vaultId:path)
    if let Some((vault_id, path)) = file_id.split_once(':') {
        let mut base = base_dir()?;
        base.push("vaults.json");
        let vraw = read_json_file(&base)?;
        if !vraw.trim().is_empty() {
            let vs: serde_json::Value = serde_json::from_str(&vraw).map_err(|e| e.to_string())?;
            if let Some(arr) = vs.as_array() {
                for v in arr {
                    if v.get("id").and_then(|x| x.as_str()) == Some(vault_id) {
                        if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
                            let mut file_path = PathBuf::from(p);
                            file_path.push(path);
                            return read_text_file(&file_path);
                        }
                    }
                }
            }
        }
    }

    // Legacy/Fallback logic
    // If the file is part of a vault folder on disk, read from that vault's
    // `.focosx/contents/<fileId>.json` so content is co-located with the vault.
    if let Ok(Some(vpath)) = find_vault_folder_for_file(file_id) {
        let mut content_path = vpath;
        content_path.push(".focosx");
        // ensure .focosx/contents exists (read_json_file will tolerate missing file)
        let mut contents_dir = content_path.clone();
        contents_dir.push("contents");
        let _ = ensure_dir(&contents_dir);
        content_path.push("contents");
        content_path.push(format!("{}.json", file_id));
        return read_json_file(&content_path);
    }

    let mut base = base_dir()?;
    base.push("contents");
    ensure_dir(&base)?;
    base.push(format!("{}.json", file_id));
    read_json_file(&base)
}

#[tauri::command]
fn save_file_content(file_id: &str, json: String) -> Result<(), String> {
    // Check if file_id contains vault prefix (vaultId:path)
    if let Some((vault_id, path)) = file_id.split_once(':') {
        let mut base = base_dir()?;
        base.push("vaults.json");
        let vraw = read_json_file(&base)?;
        if !vraw.trim().is_empty() {
            let vs: serde_json::Value = serde_json::from_str(&vraw).map_err(|e| e.to_string())?;
            if let Some(arr) = vs.as_array() {
                for v in arr {
                    if v.get("id").and_then(|x| x.as_str()) == Some(vault_id) {
                        if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
                            let mut file_path = PathBuf::from(p);
                            file_path.push(path);
                            return write_text_file(&file_path, &json);
                        }
                    }
                }
            }
        }
    }

    // Legacy/Fallback logic
    // If the file belongs to a vault folder on disk, write into that vault's
    // `.focosx/contents/<fileId>.json` so user files and metadata live together.
    if let Ok(Some(vpath)) = find_vault_folder_for_file(file_id) {
        let mut content_path = vpath;
        content_path.push(".focosx");
        ensure_dir(&content_path)?;
        content_path.push("contents");
        ensure_dir(&content_path)?;
        content_path.push(format!("{}.json", file_id));
        return write_json_file(&content_path, &json);
    }

    let mut base = base_dir()?;
    base.push("contents");
    ensure_dir(&base)?;
    base.push(format!("{}.json", file_id));
    write_json_file(&base, &json)
}

// ----------------- Plugins (global / workspace / remote) -----------------

#[tauri::command]
fn get_global_plugin_ids() -> Result<String, String> {
    let mut base = base_dir()?;
    base.push("global_plugins.json");
    read_json_file(&base)
}

#[tauri::command]
fn save_global_plugin_ids(json: String) -> Result<(), String> {
    let mut base = base_dir()?;
    base.push("global_plugins.json");
    ensure_dir(base.parent().unwrap_or(Path::new("/")))?;
    write_json_file(&base, &json)
}

#[tauri::command]
fn get_workspace_plugin_ids(vault_id: &str) -> Result<String, String> {
    let mut base = base_dir()?;
    base.push("workspace_plugins");
    ensure_dir(&base)?;
    base.push(format!("{}.json", vault_id));
    read_json_file(&base)
}

#[tauri::command]
fn save_workspace_plugin_ids(vault_id: &str, json: String) -> Result<(), String> {
    let mut base = base_dir()?;
    base.push("workspace_plugins");
    ensure_dir(&base)?;
    base.push(format!("{}.json", vault_id));
    write_json_file(&base, &json)
}

// Remote installed plugin objects: stored as an array in remote_plugins.json
#[tauri::command]
fn get_installed_remote_plugins() -> Result<String, String> {
    let mut base = base_dir()?;
    base.push("remote_plugins.json");
    read_json_file(&base)
}

#[tauri::command]
fn save_installed_remote_plugin(plugin_json: String) -> Result<(), String> {
    // plugin_json is expected to be a JSON object with { id, code, manifestUrl }
    let mut base = base_dir()?;
    base.push("remote_plugins.json");
    ensure_dir(&base.parent().unwrap_or(Path::new("/")))?;
    // read current
    let current = read_json_file(&base)?;
    let mut vec: Vec<serde_json::Value> = if current.trim().is_empty() {
        vec![]
    } else {
        serde_json::from_str(&current).map_err(|e| format!("parse error: {}", e))?
    };
    let plugin_val: serde_json::Value =
        serde_json::from_str(&plugin_json).map_err(|e| format!("invalid plugin json: {}", e))?;
    // replace if exists by id, otherwise push
    if let Some(id) = plugin_val.get("id").and_then(|v| v.as_str()) {
        if let Some(pos) = vec
            .iter()
            .position(|p| p.get("id").and_then(|x| x.as_str()) == Some(id))
        {
            vec[pos] = plugin_val;
        } else {
            vec.push(plugin_val);
        }
    } else {
        return Err("plugin json must include an 'id' field".to_string());
    }
    let s = serde_json::to_string_pretty(&vec).map_err(|e| e.to_string())?;
    write_json_file(&base, &s)
}

#[tauri::command]
fn remove_installed_remote_plugin(id: &str) -> Result<(), String> {
    let mut base = base_dir()?;
    base.push("remote_plugins.json");
    let cur = read_json_file(&base)?;
    if cur.trim().is_empty() {
        return Ok(());
    }
    let mut vec: Vec<serde_json::Value> =
        serde_json::from_str(&cur).map_err(|e| format!("parse error: {}", e))?;
    vec.retain(|p| p.get("id").and_then(|x| x.as_str()) != Some(id));
    let s = serde_json::to_string_pretty(&vec).map_err(|e| e.to_string())?;
    write_json_file(&base, &s)
}

// ----------------- AI Dock Config -----------------

#[tauri::command]
fn get_ai_dock_config() -> Result<String, String> {
    let mut base = base_dir()?;
    base.push("ai_dock.json");
    read_json_file(&base)
}

#[tauri::command]
fn save_ai_dock_config(json: String) -> Result<(), String> {
    let mut base = base_dir()?;
    base.push("ai_dock.json");
    write_json_file(&base, &json)
}

// ----------------- Preferences -----------------

#[tauri::command]
fn get_preference(key: &str) -> Result<String, String> {
    let mut base = base_dir()?;
    base.push("preferences.json");
    let raw = read_json_file(&base)?;
    if raw.trim().is_empty() {
        return Ok(String::new());
    }
    let map: HashMap<String, String> = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(map.get(key).cloned().unwrap_or_default())
}

#[tauri::command]
fn save_preference(key: &str, value: &str) -> Result<(), String> {
    let mut base = base_dir()?;
    base.push("preferences.json");
    ensure_dir(&base.parent().unwrap_or(Path::new("/")))?;
    let raw = read_json_file(&base)?;
    let mut map: HashMap<String, String> = if raw.trim().is_empty() {
        HashMap::new()
    } else {
        serde_json::from_str(&raw).map_err(|e| e.to_string())?
    };
    map.insert(key.to_string(), value.to_string());
    let s = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    write_json_file(&base, &s)
}

// ----------------- Delete Vault (cleanup) -----------------

#[tauri::command]
fn delete_vault(vault_id: &str) -> Result<(), String> {
    let mut base = base_dir()?;
    // remove tree file
    base.push("trees");
    let mut tree_path = base.clone();
    tree_path.push(format!("{}.json", vault_id));
    let _ = fs::remove_file(&tree_path);
    // remove workspace plugins
    let mut wp = base;
    if wp.ends_with("trees") {
        // replace segment "trees" with "workspace_plugins"
        wp.pop();
    }
    wp.push("workspace_plugins");
    let mut wp_path = wp.clone();
    wp_path.push(format!("{}.json", vault_id));
    let _ = fs::remove_file(&wp_path);

    Ok(())
}

// ----------------- Generic filesystem utilities exposed -----------------

/// Read an arbitrary file (absolute or relative) and return its text contents.
/// This is a thin wrapper around the internal `read_text_file` helper.
#[tauri::command]
fn read_text_file_cmd(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    read_text_file(p)
}

/// Write text to an arbitrary file path (absolute or relative). Ensures the
/// parent directory exists before writing.
#[tauri::command]
fn write_text_file_cmd(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    write_text_file(p, &content)
}

/// Create a directory (and parents) at the provided path.
#[tauri::command]
fn create_dir_cmd(path: String) -> Result<(), String> {
    ensure_dir(Path::new(&path))
}

/// List directory contents for a given path.
#[tauri::command]
fn list_dir_cmd(path: String) -> Result<Vec<String>, String> {
    let rd = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut v = Vec::new();
    for e in rd {
        let e = e.map_err(|e| e.to_string())?;
        v.push(e.path().to_string_lossy().to_string());
    }
    Ok(v)
}

/// Remove a file or directory (recursively) at the given path.
#[tauri::command]
fn remove_path_cmd(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

/// --- New helpers for vaults stored as real filesystem folders ---
/// These commands allow the frontend to explicitly read/write tree and file
/// content directly inside a user-specified vault folder (absolute path).
/// This mirrors Obsidian-style behavior where vaults are regular folders on disk.

/// Save a tree.json into the given vault folder under `.focosx/tree.json`.
/// Creates `.focosx` when necessary.
#[tauri::command]
fn save_tree_to_vault_path(vault_folder: String, json: String) -> Result<(), String> {
    let mut dir = PathBuf::from(&vault_folder);
    // Ensure .focosx directory exists
    dir.push(".focosx");
    ensure_dir(&dir)?;
    dir.push("tree.json");
    write_json_file(&dir, &json)
}

/// Load the `.focosx/tree.json` file from a vault folder. If the file doesn't
/// exist this returns an empty string (frontend will treat as missing/empty).
#[tauri::command]
fn load_tree_from_vault_path(vault_folder: String) -> Result<String, String> {
    let mut dir = PathBuf::from(&vault_folder);
    dir.push(".focosx");
    dir.push("tree.json");
    read_json_file(&dir)
}

/// Save arbitrary file content into an absolute path inside the vault (or anywhere).
/// The `path` should be the full absolute file path to write (for example:
/// /home/user/MyVault/.focosx/contents/<fileId>.json or /home/user/MyVault/Notes/foo.md)
#[tauri::command]
fn save_file_to_absolute_path(path: String, json: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        ensure_dir(parent)?;
    }
    write_text_file(p, &json)
}

/// Load arbitrary file content from an absolute path.
#[tauri::command]
fn load_file_from_absolute_path(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    read_text_file(p)
}

#[tauri::command]
fn create_node_cmd(vault_id: &str, parent_id: Option<String>, name: &str, node_type: &str) -> Result<String, String> {
    eprintln!("[create_node_cmd] vault_id={} parent_id={:?} name={} node_type={}", vault_id, parent_id, name, node_type);
    
    let mut base = base_dir()?;
    base.push("vaults.json");
    let vraw = read_json_file(&base)?;
    eprintln!("[create_node_cmd] vaults.json content: {}", vraw);
    
    let vs: serde_json::Value = serde_json::from_str(&vraw).map_err(|e| e.to_string())?;
    
    let mut vault_path = None;
    if let Some(arr) = vs.as_array() {
        for v in arr {
            if v.get("id").and_then(|x| x.as_str()) == Some(vault_id) {
                if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
                    vault_path = Some(PathBuf::from(p));
                    eprintln!("[create_node_cmd] Found vault path: {:?}", vault_path);
                }
            }
        }
    }

    let root = vault_path.ok_or("Vault not found or has no path")?;
    eprintln!("[create_node_cmd] root={:?} exists={}", root, root.exists());
    
    if !root.exists() {
        return Err("Vault path does not exist".to_string());
    }

    let mut target_path = root.clone();
    if let Some(pid) = parent_id {
        if let Some((_, path)) = pid.split_once(':') {
            target_path.push(path);
        } else {
             target_path.push(pid);
        }
    }
    
    target_path.push(name);
    eprintln!("[create_node_cmd] target_path={:?}", target_path);

    if node_type == "FOLDER" {
        ensure_dir(&target_path)?;
        eprintln!("[create_node_cmd] Created folder");
    } else {
        if let Some(parent) = target_path.parent() {
            ensure_dir(parent)?;
        }
        // Create empty file
        fs::write(&target_path, "").map_err(|e| e.to_string())?;
        eprintln!("[create_node_cmd] Created file");
    }

    let relative_path = target_path.strip_prefix(&root).map_err(|e| e.to_string())?;
    let raw_id = relative_path.to_string_lossy().to_string().replace("\\", "/");
    let result = format!("{}:{}", vault_id, raw_id);
    eprintln!("[create_node_cmd] Returning: {}", result);
    Ok(result)
}

#[tauri::command]
fn delete_node_cmd(vault_id: &str, id: &str) -> Result<(), String> {
    let mut base = base_dir()?;
    base.push("vaults.json");
    let vraw = read_json_file(&base)?;
    let vs: serde_json::Value = serde_json::from_str(&vraw).map_err(|e| e.to_string())?;
    
    let mut vault_path = None;
    if let Some(arr) = vs.as_array() {
        for v in arr {
            if v.get("id").and_then(|x| x.as_str()) == Some(vault_id) {
                if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
                    vault_path = Some(PathBuf::from(p));
                }
            }
        }
    }

    let root = vault_path.ok_or("Vault not found or has no path")?;
    let mut target_path = root.clone();
    
    if let Some((_, path)) = id.split_once(':') {
        target_path.push(path);
    } else {
        target_path.push(id);
    }

    if target_path.is_dir() {
        fs::remove_dir_all(target_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(target_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn rename_node_cmd(vault_id: &str, id: &str, new_name: &str) -> Result<String, String> {
    let mut base = base_dir()?;
    base.push("vaults.json");
    let vraw = read_json_file(&base)?;
    let vs: serde_json::Value = serde_json::from_str(&vraw).map_err(|e| e.to_string())?;
    
    let mut vault_path = None;
    if let Some(arr) = vs.as_array() {
        for v in arr {
            if v.get("id").and_then(|x| x.as_str()) == Some(vault_id) {
                if let Some(p) = v.get("path").and_then(|x| x.as_str()) {
                    vault_path = Some(PathBuf::from(p));
                }
            }
        }
    }

    let root = vault_path.ok_or("Vault not found or has no path")?;
    let mut old_path = root.clone();
    
    if let Some((_, path)) = id.split_once(':') {
        old_path.push(path);
    } else {
        old_path.push(id);
    }

    let mut new_path = old_path.parent().ok_or("Invalid path")?.to_path_buf();
    new_path.push(new_name);

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    let relative_path = new_path.strip_prefix(&root).map_err(|e| e.to_string())?;
    let raw_id = relative_path.to_string_lossy().to_string().replace("\\", "/");
    Ok(format!("{}:{}", vault_id, raw_id))
}

// ----------------- Tauri builder -----------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            ping,
            // vaults
            get_vaults,
            save_vaults,
            // vault folder selection / external-path support
            select_vault_folder,
            create_vault_at_path,
            // trees
            load_tree,
            save_tree,
            // trees stored inside user vault folder (absolute path)
            load_tree_from_vault_path,
            save_tree_to_vault_path,
            // contents
            load_file_content,
            save_file_content,
            // arbitrary file read/write inside vault or absolute path
            load_file_from_absolute_path,
            save_file_to_absolute_path,
            // plugins
            get_global_plugin_ids,
            save_global_plugin_ids,
            get_workspace_plugin_ids,
            save_workspace_plugin_ids,
            get_installed_remote_plugins,
            save_installed_remote_plugin,
            remove_installed_remote_plugin,
            // ai dock
            get_ai_dock_config,
            save_ai_dock_config,
            // prefs
            get_preference,
            save_preference,
            // vault cleanup
            delete_vault,
            // generic fs utils
            read_text_file_cmd,
            write_text_file_cmd,
            create_dir_cmd,
            list_dir_cmd,
            remove_path_cmd,
            // granular node ops
            create_node_cmd,
            delete_node_cmd,
            rename_node_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
