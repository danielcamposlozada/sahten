#!/usr/bin/env bash
# Re-renderiza solo el video de delivery y rearma el loop y la versión para la tele.
cd "$(dirname "$0")/../.."
LOG=tools/pantalla/out-todo.log; : > "$LOG"
node tools/pantalla/v2/render-delivery.mjs >> "$LOG" 2>&1 || echo "FALLÓ delivery" >> "$LOG"
cd tools/pantalla/out
printf "file '%s'\n" 01-10-off.mp4 05-los-mas-pedidos.mp4 02-lunes-a-miercoles.mp4 08-como-comprar.mp4 06-para-compartir.mp4 03-tablas-fin-de-semana.mp4 09-delivery.mp4 07-sumale.mp4 04-pedi-online.mp4 > lista.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -c copy -movflags +faststart 00-loop-completo.mp4 && rm lista.txt && echo "LOOP OK" >> "../../../$LOG"
ffmpeg -y -loglevel error -i 00-loop-completo.mp4 -vf "transpose=2" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart 00-loop-completo-tele-1920x1080.mp4 && echo "ROTADO OK" >> "../../../$LOG"
echo "FIN" >> "../../../$LOG"
