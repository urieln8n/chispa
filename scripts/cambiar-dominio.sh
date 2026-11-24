#!/usr/bin/env bash
# Cambia Lumbrera a un dominio nuevo y enciende la mudanza desde genesis.andresrendon.com.
# Uso (desde la carpeta del repo):  bash scripts/cambiar-dominio.sh lumbrera.app
# ANTES: conecta el dominio al worker «lumbrera» en Cloudflare (Settings → Domains & Routes → Add → Custom domain)
#        y comprueba que https://NUEVO/ ya abre Lumbrera.
# DESPUÉS: git add -A && git commit -m "Lumbrera se muda a NUEVO" && git push   (Cloudflare lo publica solo)
set -euo pipefail
NUEVO="${1:-}"
ANTIGUO="genesis.andresrendon.com"
if [[ ! "$NUEVO" =~ ^([a-z0-9-]+\.)+[a-z]{2,}$ ]]; then echo "Escribe el dominio nuevo, por ejemplo: bash scripts/cambiar-dominio.sh lumbrera.app"; exit 1; fi
if [[ "$NUEVO" == "$ANTIGUO" ]]; then echo "Ese ya es el dominio actual"; exit 1; fi
cd "$(dirname "$0")/.."

# 1. Direcciones escritas a mano: canonical, imágenes para redes, datos estructurados, páginas de preguntas y contacto push
ARCHIVOS=$(grep -rl "$ANTIGUO" public contenido-biblia/seo.py src/index.js --include='*.html' --include='*.py' --include='*.js' --include='*.json' --include='*.webmanifest' || true)
for f in $ARCHIVOS; do sed -i "s#https://$ANTIGUO#https://$NUEVO#g" "$f"; done
echo "Direcciones cambiadas en $(echo "$ARCHIVOS" | grep -c . ) archivos"

# 2. Encender la mudanza (la dirección vieja lleva a la nueva con el progreso de cada usuario)
sed -i "s#\"DOMINIO_NUEVO\": \"[^\"]*\"#\"DOMINIO_NUEVO\": \"$NUEVO\"#" wrangler.jsonc
grep -q "\"DOMINIO_NUEVO\": \"$NUEVO\"" wrangler.jsonc && echo "Mudanza encendida: $ANTIGUO → $NUEVO"

# 3. Comprobación: no debe quedar la dirección vieja fuera de la configuración de la mudanza
RESTO=$(grep -rl "https://$ANTIGUO" public contenido-biblia src || true)
[[ -z "$RESTO" ]] && echo "Listo. Revisa con: git diff --stat" || { echo "Aún aparece la dirección vieja en:"; echo "$RESTO"; }
