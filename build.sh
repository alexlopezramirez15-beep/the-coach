#!/bin/sh
# Genera dist/ para publicar en un hosting estático (Netlify): añade el esqueleto HTML completo.
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist/js
cp js/*.js dist/js/
{ printf '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  sed -n '1,/<\/style>/p' index.html
  printf '</head>\n<body>\n'
  sed '1,/<\/style>/d' index.html
  printf '</body>\n</html>\n'; } > dist/index.html
echo "dist listo"
