//! Silent receipts are opt-in, local to this workstation. No files or customer data are logged.
use serde::Serialize;
use std::sync::{atomic::{AtomicU64, Ordering}, Arc, Mutex};
use tauri::{webview::PageLoadEvent, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::oneshot;

type Completion = Arc<Mutex<Option<oneshot::Sender<Result<(), String>>>>>;
struct Job {
    label: String,
    printer: String,
    width: u16,
    started: bool,
    done: Completion,
}
static JOB_SEQUENCE: AtomicU64 = AtomicU64::new(1);
#[derive(Default)]
pub struct ReceiptPrinting(Mutex<Option<Job>>);
#[derive(Serialize)]
pub struct Printers {
    supported: bool,
    printers: Vec<String>,
}
fn finish(done: &Completion, result: Result<(), String>) {
    if let Ok(mut slot) = done.lock() {
        if let Some(tx) = slot.take() { let _ = tx.send(result); }
    }
}
fn require_main(window: &WebviewWindow) -> Result<(), String> {
    if window.label() == "main" { Ok(()) } else { Err("Operación no disponible en esta ventana.".into()) }
}
fn validate(html: &str, printer: &str, width: u16) -> Result<(), String> {
    if html.is_empty() || html.len() > 4 * 1024 * 1024 { return Err("El ticket está vacío o es demasiado grande.".into()); }
    if printer.trim().is_empty() || printer.len() > 1024 || printer.contains('\0') { return Err("Elegí una impresora válida.".into()); }
    if ![48, 58, 80, 210, 216].contains(&width) { return Err("Tamaño de papel no válido.".into()); }
    Ok(())
}
fn page_height(width: u16, height_px: f64) -> Result<f64, String> {
    if !height_px.is_finite() || height_px <= 0.0 || height_px > 11000.0 { return Err("El ticket supera el largo admitido. Usá la impresión con diálogo.".into()); }
    Ok(match width { 210 => 297.0, 216 => 279.4, _ => (height_px * 25.4 / 96.0 + 3.0).ceil().max(50.0) })
}
async fn installed(app: &tauri::AppHandle) -> Result<Vec<String>, String> {
    let (tx, rx) = oneshot::channel();
    app.run_on_main_thread(move || { let _ = tx.send(platform_printers()); }).map_err(|e| e.to_string())?;
    rx.await.map_err(|_| "No se pudieron consultar las impresoras.".to_string())?
}
#[tauri::command]
pub async fn receipt_printers(window: WebviewWindow, app: tauri::AppHandle) -> Result<Printers, String> {
    require_main(&window)?;
    Ok(Printers { supported: cfg!(any(target_os="macos",target_os="windows")), printers: installed(&app).await? })
}
#[tauri::command]
pub async fn receipt_print(window: WebviewWindow, app: tauri::AppHandle, html: String, printer: String, paper_width_mm: u16) -> Result<(), String> {
    require_main(&window)?;
    validate(&html, &printer, paper_width_mm)?;
    if !installed(&app).await?.contains(&printer) { return Err("La impresora elegida ya no está disponible. Revisá Ajustes → Impresión.".into()); }
    let (tx, rx) = oneshot::channel();
    let done = Arc::new(Mutex::new(Some(tx)));
    let label = format!("receipt-print-{}", JOB_SEQUENCE.fetch_add(1, Ordering::Relaxed));
    {
        let state = app.state::<ReceiptPrinting>();
        let mut slot = state.0.lock().map_err(|_| "No se pudo preparar la impresión.")?;
        if slot.is_some() { return Err("Hay otra comanda en proceso de impresión.".into()); }
        *slot = Some(Job { label: label.clone(), printer, width: paper_width_mm, started: false, done: done.clone() });
    }
    // The bundled page has its own CSP and sanitizes the receipt before rendering.
    let script = format!("window.renderReceipt({});", serde_json::to_string(&html).map_err(|e| e.to_string())?);
    let load_done = done.clone();
    let built = WebviewWindowBuilder::new(&app, label, WebviewUrl::App("receipt-print.html".into()))
        .title("Comanda de Sahten").visible(false).focused(false).skip_taskbar(true).incognito(true)
        .inner_size(f64::from(paper_width_mm) * 96.0 / 25.4, 800.0)
        .on_navigation(|url| url.path() == "/receipt-print.html" && matches!(url.host_str(), Some("localhost") | Some("tauri.localhost")))
        .on_page_load(move |view, payload| {
            if payload.event() == PageLoadEvent::Finished {
                if let Err(e) = view.eval(&script) { finish(&load_done, Err(e.to_string())); }
            }
        }).build();
    let result = match built {
        Err(e) => Err(format!("No se pudo preparar el ticket: {e}")),
        Ok(receipt) => {
            let result = match tokio::time::timeout(std::time::Duration::from_secs(60), rx).await {
                Ok(Ok(result)) => result,
                _ => Err("No se pudo confirmar el envío. Comprobá la impresora antes de reimprimir para evitar duplicados.".into()),
            };
            let _ = receipt.destroy();
            result
        }
    };
    if let Ok(mut slot) = app.state::<ReceiptPrinting>().0.lock() { *slot = None; }
    result
}
#[tauri::command]
pub async fn receipt_ready(window: WebviewWindow, app: tauri::AppHandle, height_px: f64, error: Option<String>) -> Result<(), String> {
    if !window.label().starts_with("receipt-print-") { return Err("Ventana de impresión no válida.".into()); }
    let (printer, width, done) = {
        let state = app.state::<ReceiptPrinting>();
        let mut slot = state.0.lock().map_err(|_| "Impresión no disponible.")?;
        let job = slot.as_mut().ok_or("No hay una comanda pendiente.")?;
        if window.label() != job.label { return Err("La comanda ya no está vigente.".into()); }
        if job.started { return Err("La comanda ya fue enviada.".into()); }
        job.started = true;
        (job.printer.clone(), job.width, job.done.clone())
    };
    if let Some(error) = error { finish(&done, Err(error)); return Ok(()); }
    let height = match page_height(width, height_px) { Ok(h) => h, Err(e) => { finish(&done, Err(e)); return Ok(()); } };
    let fallback = done.clone();
    window.with_webview(move |view| platform_print(view, printer, width, height, done)).map_err(|e| { finish(&fallback, Err(e.to_string())); e.to_string() })
}

#[cfg(target_os="macos")]
fn platform_printers() -> Result<Vec<String>, String> {
    Ok(objc2_app_kit::NSPrinter::printerNames().iter().map(|s| s.to_string()).collect())
}
#[cfg(target_os="macos")]
fn platform_print(view: tauri::webview::PlatformWebview, printer: String, width: u16, height: f64, done: Completion) {
    use objc2_app_kit::{NSPrintInfo, NSPrintSpoolJob, NSPrinter, NSPrintingPaginationMode, NSPaperOrientation, NSPrintCopies, NSPrintAllPages, NSPrintScalingFactor, NSPrintHeaderAndFooter, NSPrintPagesAcross, NSPrintPagesDown, NSPrintSelectionOnly};
    use objc2_foundation::{NSCopying, NSSize, NSString, NSNumber};
    // with_webview runs on the main thread and owns the view for this closure.
    unsafe {
        let web: &objc2_web_kit::WKWebView = &*view.inner().cast();
        let Some(printer) = NSPrinter::printerWithName(&NSString::from_str(&printer)) else { finish(&done, Err("La impresora elegida no está disponible.".into())); return; };
        let info = NSPrintInfo::sharedPrintInfo().copy();
        // Do not inherit copies, ranges or scale from the last system print dialog.
        let dictionary = info.dictionary();
        for key in [NSPrintCopies, NSPrintPagesAcross, NSPrintPagesDown] { dictionary.insert(key, &NSNumber::new_u32(1)); }
        dictionary.insert(NSPrintAllPages, &NSNumber::new_bool(true));
        dictionary.insert(NSPrintSelectionOnly, &NSNumber::new_bool(false));
        dictionary.insert(NSPrintHeaderAndFooter, &NSNumber::new_bool(false));
        dictionary.insert(NSPrintScalingFactor, &NSNumber::new_f64(1.0));
        info.setPrinter(&printer);
        info.setJobDisposition(NSPrintSpoolJob);
        info.setOrientation(NSPaperOrientation::Portrait);
        info.setPaperSize(NSSize::new(f64::from(width) * 72.0 / 25.4, height * 72.0 / 25.4));
        info.setLeftMargin(0.0); info.setRightMargin(0.0); info.setTopMargin(0.0); info.setBottomMargin(0.0);
        info.setHorizontallyCentered(false); info.setVerticallyCentered(false);
        info.setHorizontalPagination(NSPrintingPaginationMode::Clip);
        info.setVerticalPagination(NSPrintingPaginationMode::Automatic);
        let operation = web.printOperationWithPrintInfo(&info);
        operation.setShowsPrintPanel(false); operation.setShowsProgressPanel(false);
        finish(&done, if operation.runOperation() { Ok(()) } else { Err("El sistema no pudo enviar el ticket a la impresora elegida.".into()) });
    }
}
#[cfg(target_os="windows")]
fn platform_printers() -> Result<Vec<String>, String> {
    use windows::{core::PCWSTR, Win32::Graphics::Printing::*};
    unsafe {
        let mut bytes = 0; let mut count = 0;
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut bytes, &mut count);
        if bytes == 0 { return Ok(vec![]); }
        if bytes > 16 * 1024 * 1024 { return Err("La lista de impresoras es demasiado grande.".into()); }
        // Align storage for PRINTER_INFO_4W, while passing its complete byte slice to Win32.
        let mut data = vec![0usize; (bytes as usize).div_ceil(std::mem::size_of::<usize>())];
        let buffer = std::slice::from_raw_parts_mut(data.as_mut_ptr().cast::<u8>(), bytes as usize);
        EnumPrintersW(flags, PCWSTR::null(), 4, Some(buffer), &mut bytes, &mut count).map_err(|e| e.to_string())?;
        if count as usize > buffer.len() / std::mem::size_of::<PRINTER_INFO_4W>() { return Err("La lista de impresoras no es válida.".into()); }
        let rows = std::slice::from_raw_parts(data.as_ptr().cast::<PRINTER_INFO_4W>(), count as usize);
        let mut names = rows.iter().filter_map(|r| if r.pPrinterName.is_null() { None } else { r.pPrinterName.to_string().ok() }).collect::<Vec<_>>();
        names.sort(); names.dedup(); Ok(names)
    }
}
#[cfg(target_os="windows")]
fn platform_print(view: tauri::webview::PlatformWebview, printer: String, width: u16, height: f64, done: Completion) {
    use webview2_com::{PrintCompletedHandler, Microsoft::Web::WebView2::Win32::*};
    use windows::core::{HSTRING, Interface};
    let failed = done.clone();
    let result = (|| -> windows::core::Result<()> { unsafe {
        let web: ICoreWebView2_16 = view.controller().CoreWebView2()?.cast()?;
        let env: ICoreWebView2Environment6 = view.environment().cast()?;
        let settings = env.CreatePrintSettings()?;
        settings.SetPageWidth(f64::from(width) / 25.4)?; settings.SetPageHeight(height / 25.4)?;
        settings.SetMarginTop(0.0)?; settings.SetMarginBottom(0.0)?; settings.SetMarginLeft(0.0)?; settings.SetMarginRight(0.0)?;
        settings.SetScaleFactor(1.0)?; settings.SetShouldPrintHeaderAndFooter(false)?; settings.SetShouldPrintBackgrounds(true)?;
        let extra: ICoreWebView2PrintSettings2 = settings.cast()?;
        extra.SetPrinterName(&HSTRING::from(printer))?; extra.SetCopies(1)?;
        extra.SetMediaSize(COREWEBVIEW2_PRINT_MEDIA_SIZE_CUSTOM)?;
        web.Print(&settings, &PrintCompletedHandler::create(Box::new(move |error, status| {
            finish(&done, if error.is_ok() && status == COREWEBVIEW2_PRINT_STATUS_SUCCEEDED { Ok(()) } else if status == COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE { Err("La impresora no está disponible. Revisá su conexión y la cola del sistema.".into()) } else { Err("No se pudo confirmar el envío a la impresora. Comprobá si salió el ticket antes de reimprimir.".into()) });
            Ok(())
        })))
    }})();
    if let Err(e) = result { finish(&failed, Err(format!("No se pudo iniciar la impresión directa. Revisá la impresora y que WebView2 esté actualizado. {e}"))); }
}
#[cfg(not(any(target_os="macos",target_os="windows")))]
fn platform_printers() -> Result<Vec<String>, String> { Ok(vec![]) }
#[cfg(not(any(target_os="macos",target_os="windows")))]
fn platform_print(_view: tauri::webview::PlatformWebview, _printer: String, _width: u16, _height: f64, done: Completion) { finish(&done, Err("La impresión directa está disponible en Windows y Mac.".into())); }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reject_invalid_or_oversized_jobs() {
        assert!(validate("", "IT01", 48).is_err());
        assert!(validate("ticket", "", 48).is_err());
        assert!(validate("ticket", "IT01", 49).is_err());
        assert!(validate(&"x".repeat(4 * 1024 * 1024 + 1), "IT01", 48).is_err());
        for w in [48, 58, 80, 210, 216] { assert!(validate("ticket", "IT01", w).is_ok()); }
    }
    #[test]
    fn real_size_and_bounded_length() {
        assert_eq!(page_height(48, 960.0).unwrap(), 257.0);
        assert_eq!(page_height(210, 960.0).unwrap(), 297.0);
        assert_eq!(page_height(216, 960.0).unwrap(), 279.4);
        for n in [f64::NAN, f64::INFINITY, -1.0, 0.0, 11001.0] { assert!(page_height(48, n).is_err()); }
    }
}
