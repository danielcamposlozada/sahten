#!/usr/bin/env bash
# Renderiza los 9 videos en paralelo (4 a la vez) y arma el loop completo.
cd "$(dirname "$0")/../.."
export NODE_USE_ENV_PROXY=1
LOG=tools/pantalla/out-todo.log; : > "$LOG"
{ echo "node tools/pantalla/v2/render-delivery.mjs"; echo "node tools/pantalla/v2/render-howto.mjs";
  for v in 05-los-mas-pedidos 02-lunes-a-miercoles 06-para-compartir 07-sumale 04-pedi-online 01-10-off 03-tablas-fin-de-semana; do echo "node tools/pantalla/render.mjs --only $v"; done; } |
  xargs -P 4 -I{} sh -c '{} >> '"$LOG"' 2>&1 || echo "FALLÓ: {}" >> '"$LOG"
cd tools/pantalla/out
printf "file '%s'\n" 01-10-off.mp4 05-los-mas-pedidos.mp4 02-lunes-a-miercoles.mp4 08-como-comprar.mp4 06-para-compartir.mp4 03-tablas-fin-de-semana.mp4 09-delivery.mp4 07-sumale.mp4 04-pedi-online.mp4 > lista.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -c copy -movflags +faststart 00-loop-completo.mp4 && rm lista.txt && echo "LOOP OK" >> "../../../$LOG"
# Tele del local: girada con el lado DERECHO hacia abajo (giro horario de la pantalla).
# El video se pre-gira 90° antihorario (transpose=2) para que se vea derecho.
ffmpeg -y -loglevel error -i 00-loop-completo.mp4 -vf "transpose=2" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart 00-loop-completo-tele-1920x1080.mp4 && echo "ROTADO OK" >> "../../../$LOG"
echo "FIN" >> "../../../$LOG"
