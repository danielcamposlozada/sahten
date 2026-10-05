// Adaptador de respaldo para navegadores sin File System Access (Safari, Firefox): abrir = elegir archivo,
// guardar = descargar. No hay guardado automático en el archivo; la app avisa y pide guardar a mano.
export function createDownloadAdapter(w = window) {
  const doc = w.document;
  return {
    id: 'download', canAutosave: false,
    open() {
      return new Promise(resolve => {
        const input = doc.createElement('input'); input.type = 'file'; input.accept = '.sahten,.json,application/json';
        input.onchange = async () => { const f = input.files && input.files[0]; if (!f) return resolve(null); resolve({ ref: { name: f.name }, name: f.name, text: await f.text() }); };
        input.oncancel = () => resolve(null);
        input.click();
      });
    },
    async read() { throw new Error('Este navegador no puede reabrir archivos solo: usá «Abrir».'); },
    async create(suggested, text) { this.download(suggested, text); return { ref: { name: suggested }, name: suggested }; },
    async write(ref, text) { this.download(ref.name, text); },
    download(name, text) {
      const a = doc.createElement('a'); a.href = w.URL.createObjectURL(new w.Blob([text], { type: 'application/json;charset=utf-8' })); a.download = name; a.click();
      setTimeout(() => w.URL.revokeObjectURL(a.href), 1000);
    },
    async remember() {}, async recall() { return null; }, async forget() {},
  };
}
