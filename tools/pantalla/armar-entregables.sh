#!/usr/bin/env bash
# Arma los entregables a partir de los videos de out/: loop completo, versión para la tele
# (girada 90° antihorario: tele con el lado derecho hacia abajo) (la versión web del tutorial sale de v2/render-tutorial-web.mjs).
set -e
cd "$(dirname "$0")/out"
printf "file '%s'\n" 01-10-off.mp4 05-los-mas-pedidos.mp4 02-lunes-a-miercoles.mp4 08-como-comprar.mp4 06-para-compartir.mp4 03-tablas-fin-de-semana.mp4 09-delivery.mp4 07-sumale.mp4 04-pedi-online.mp4 > lista.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -c copy -movflags +faststart 00-loop-completo.mp4 && rm lista.txt
ffmpeg -y -loglevel error -i 00-loop-completo.mp4 -vf "transpose=2" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart 00-loop-completo-tele-1920x1080.mp4
# El tutorial de la web (con la voz original) lo genera v2/render-tutorial-web.mjs.
echo "entregables listos"
