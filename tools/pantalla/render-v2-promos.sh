#!/usr/bin/env bash
# Re-renderiza los videos de promos con los marcos v2 (uno por tipo de promoción).
set -e
cd "$(dirname "$0")/../.."
for v in 01-10-off 02-lunes-a-miercoles 03-tablas-fin-de-semana 05-los-mas-pedidos 07-sumale; do
  NODE_USE_ENV_PROXY=1 node tools/pantalla/render.mjs --only "$v"
done
