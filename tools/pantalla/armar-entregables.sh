#!/usr/bin/env bash
# Arma los entregables a partir de los videos de out/: loop completo, versión para la tele
# (girada 90° antihorario: tele con el lado derecho hacia abajo) y versión web del tutorial.
set -e
cd "$(dirname "$0")/out"
printf "file '%s'\n" 01-10-off.mp4 05-los-mas-pedidos.mp4 02-lunes-a-miercoles.mp4 08-como-comprar.mp4 06-para-compartir.mp4 03-tablas-fin-de-semana.mp4 09-delivery.mp4 07-sumale.mp4 04-pedi-online.mp4 > lista.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i lista.txt -c copy -movflags +faststart 00-loop-completo.mp4 && rm lista.txt
ffmpeg -y -loglevel error -i 00-loop-completo.mp4 -vf "transpose=2" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart 00-loop-completo-tele-1920x1080.mp4
# Web: 540×960 como el video actual de sahten.online, liviano y con inicio rápido.
mkdir -p web
ffmpeg -y -loglevel error -i 08-como-comprar.mp4 -vf "scale=540:960:flags=lanczos" -c:v libx264 -profile:v high -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart -an web/tutorial.mp4
ffmpeg -y -loglevel error -ss 2.2 -i 08-como-comprar.mp4 -frames:v 1 -vf "scale=540:960:flags=lanczos" -q:v 3 web/tutorial.jpg
echo "entregables listos"
