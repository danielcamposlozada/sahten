use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Archivos .sahten pendientes de abrir (doble clic antes de que la ventana esté lista).
#[derive(Default)]
struct PendingFiles(Mutex<Vec<String>>);

/// El primer argumento que termine en .sahten (Windows y Linux pasan el archivo como argumento).
fn sahten_path<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".sahten"))
}

/// La interfaz lo pide al arrancar: si la app se abrió con un .sahten, lo devuelve (una sola vez).
#[tauri::command]
fn take_pending_file(state: tauri::State<PendingFiles>) -> Option<String> {
    state.0.lock().ok().and_then(|mut v| v.pop())
}

pub fn run() {
    let builder = tauri::Builder::default()
        .manage(PendingFiles::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init());

    // Una sola ventana: abrir un segundo .sahten lo manda a la ventana que ya está abierta.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        if let Some(path) = sahten_path(args) {
            let _ = app.emit("open-file", path);
        }
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
    }));

    builder
        .invoke_handler(tauri::generate_handler![take_pending_file])
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            if let Some(path) = sahten_path(std::env::args()) {
                if let Ok(mut v) = app.state::<PendingFiles>().0.lock() {
                    v.push(path);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar Sahten")
        .run(|_app, _event| {
            // macOS entrega el doble clic como evento (no como argumento).
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        let p = path.to_string_lossy().to_string();
                        if p.to_lowercase().ends_with(".sahten") {
                            if let Ok(mut v) = _app.state::<PendingFiles>().0.lock() {
                                v.push(p.clone());
                            }
                            let _ = _app.emit("open-file", p);
                        }
                    }
                }
            }
        });
}
