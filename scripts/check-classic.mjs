// Verifica que los archivos legados parseen como scripts clásicos (no módulos).
import vm from 'node:vm';
import fs from 'node:fs';
let bad = 0;
for (const f of process.argv.slice(2)) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); console.log('ok  ', f); }
  catch (e) { bad++; console.log('FAIL', f, e.message, e.stack.split('\n')[0]); }
}
process.exit(bad ? 1 : 0);
