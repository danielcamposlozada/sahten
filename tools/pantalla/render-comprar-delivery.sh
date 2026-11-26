#!/usr/bin/env bash
# Re-renderiza en paralelo «Cómo comprar» (tele), el tutorial de la web y el delivery; después arma loop y tele.
cd "$(dirname "$0")/../.."
LOG=tools/pantalla/out-v3.log; : > "$LOG"
{ echo "node tools/pantalla/v2/render-howto.mjs"; echo "node tools/pantalla/v2/render-tutorial-web.mjs"; echo "node tools/pantalla/v2/render-delivery.mjs"; } |
  xargs -P 3 -I{} sh -c '{} >> '"$LOG"' 2>&1 || echo "FALLÓ: {}" >> '"$LOG"
tools/pantalla/armar-entregables.sh >> "$LOG" 2>&1 && echo "ENTREGABLES OK" >> "$LOG"
echo "FIN" >> "$LOG"
