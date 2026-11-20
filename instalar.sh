#!/usr/bin/env bash
# Instalador de Chispa para una VPS (Ubuntu/Debian) — se pega en la Consola/Terminal de hPanel como root.
#   curl -fsSL https://raw.githubusercontent.com/urieln8n/chispa/main/instalar.sh | bash
# Variables opcionales: DOMINIO=midominio.com  PUERTO=3070  RAMA=main
# Respeta lo que ya hay: si tu dirección ya sirve otra web, Chispa se publica en https://TU-DIRECCION/chispa/
set -euo pipefail

REPO="${REPO:-https://github.com/urieln8n/chispa.git}"
RAMA="${RAMA:-main}"
APP_DIR=/opt/chispa
DATA_DIR=/var/lib/chispa
ENV_FILE=/etc/chispa.env
USUARIO=chispa
DOMINIO="${DOMINIO:-$(hostname -f 2>/dev/null || hostname)}"
PUERTO="${PUERTO:-3070}"

verde(){ printf '\033[1;32m%s\033[0m\n' "$*"; }
ambar(){ printf '\033[1;33m%s\033[0m\n' "$*"; }
rojo(){ printf '\033[1;31m%s\033[0m\n' "$*"; }
paso(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { rojo "Ejecútalo como root (en la Consola de hPanel ya lo eres)."; exit 1; }
command -v apt-get >/dev/null || { rojo "Este instalador es para Ubuntu/Debian."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

paso "1/7 Preparando el sistema"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates nginx certbot python3-certbot-nginx >/dev/null
verde "✅ Herramientas listas"

paso "2/7 Node.js"
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
verde "✅ Node $(node -v)"

paso "3/7 Descargando Chispa"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin "$USUARIO"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch -q origin "$RAMA" && git -C "$APP_DIR" reset -q --hard "origin/$RAMA"
else
  rm -rf "$APP_DIR"; git clone -q --depth 1 -b "$RAMA" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund --silent
mkdir -p "$DATA_DIR" && chown -R "$USUARIO:$USUARIO" "$DATA_DIR"
verde "✅ Código en $APP_DIR (datos en $DATA_DIR)"

paso "4/7 Configuración"
if [ ! -f "$ENV_FILE" ]; then
  # buscar un puerto libre
  while ss -ltn "( sport = :$PUERTO )" | grep -q LISTEN; do PUERTO=$((PUERTO+1)); done
  CLAVE=$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')
  cat > "$ENV_FILE" <<EOF
PORT=$PUERTO
HOST=127.0.0.1
DATA_DIR=$DATA_DIR
ADMIN_PASSWORD=$CLAVE
MAX_PLAYERS=500
# IA opcional: pega tu clave de https://console.anthropic.com y reinicia con: systemctl restart chispa
ANTHROPIC_API_KEY=
AI_DAILY_LIMIT=50
EOF
  chmod 600 "$ENV_FILE"
fi
PUERTO=$(grep '^PORT=' "$ENV_FILE" | cut -d= -f2)
CLAVE=$(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)
verde "✅ Ajustes en $ENV_FILE (puerto interno $PUERTO)"

paso "5/7 Servicio que mantiene Chispa encendida"
cat > /etc/systemd/system/chispa.service <<EOF
[Unit]
Description=Chispa - quiz en vivo
After=network.target

[Service]
User=$USUARIO
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
LimitNOFILE=65536
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q chispa
systemctl restart chispa
sleep 2
curl -fsS "http://127.0.0.1:$PUERTO/api/salud" >/dev/null || { rojo "Chispa no arranca. Mira: journalctl -u chispa -n 50"; exit 1; }
verde "✅ Chispa funcionando por dentro"

paso "6/7 Publicando en https://$DOMINIO"
# ¿Hay otro programa (no nginx) ocupando el puerto 80?
OCUPA=$(ss -ltnp '( sport = :80 )' 2>/dev/null | grep LISTEN | grep -v nginx || true)
if [ -n "$OCUPA" ]; then
  rojo "El puerto 80 lo usa otro programa (no nginx). No toco nada para no romper tu web."
  echo "$OCUPA"; echo "Chispa está funcionando por dentro en el puerto $PUERTO."; exit 1
fi
cat > /etc/nginx/conf.d/chispa-upgrade.conf <<'EOF'
map $http_upgrade $chispa_conexion { default upgrade; '' close; }
EOF
BLOQUE_PROXY="proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$chispa_conexion;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;"

EXISTENTES=$(grep -rlE "server_name[^;]*\b${DOMINIO//./\\.}\b" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | grep -v '/chispa' || true)
if [ -f /etc/nginx/sites-available/chispa ]; then
  RUTA_PUBLICA="/"; ambar "Configuración web de Chispa ya existente: la mantengo"
elif [ -f /etc/nginx/snippets/chispa.conf ] && grep -rq 'snippets/chispa.conf' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null; then
  RUTA_PUBLICA="/chispa/"; ambar "Chispa ya estaba en /chispa/: la mantengo"
elif [ -n "$EXISTENTES" ]; then
  # Ya hay una web en esta dirección: no la pisamos, añadimos /chispa/
  RUTA_PUBLICA="/chispa/"
  cat > /etc/nginx/snippets/chispa.conf <<EOF
location = /chispa { return 301 /chispa/; }
location /chispa/ {
    proxy_pass http://127.0.0.1:$PUERTO/;
    $BLOQUE_PROXY
}
EOF
  BACKUP=/root/chispa-backup-nginx-$(date +%Y%m%d%H%M%S)
  mkdir -p "$BACKUP"
  for f in $EXISTENTES; do
    cp -a "$f" "$BACKUP/"
    grep -q 'snippets/chispa.conf' "$f" || sed -i -E "/server_name[^;]*\b${DOMINIO//./\\.}\b/a\    include snippets/chispa.conf;" "$f"
  done
  if ! nginx -t 2>/dev/null; then
    for f in $EXISTENTES; do cp -a "$BACKUP/$(basename "$f")" "$f"; done
    rojo "No he podido añadir Chispa sin riesgo; he dejado tu nginx como estaba (copia en $BACKUP)."; exit 1
  fi
  ambar "Tu dirección ya tenía otra web: Chispa va en $RUTA_PUBLICA (copia de seguridad en $BACKUP)"
else
  RUTA_PUBLICA="/"
  cat > /etc/nginx/sites-available/chispa <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMINIO;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:$PUERTO;
        $BLOQUE_PROXY
    }
}
EOF
  ln -sf /etc/nginx/sites-available/chispa /etc/nginx/sites-enabled/chispa
  nginx -t
fi
systemctl reload nginx
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 'Nginx Full' >/dev/null || true; fi

paso "7/7 Candado (HTTPS)"
if ! grep -rq "ssl_certificate.*$DOMINIO" /etc/nginx/ 2>/dev/null; then
  certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect -q \
    || ambar "No he podido poner el candado ahora (¿la dirección apunta a esta VPS?). Chispa funciona en http://$DOMINIO$RUTA_PUBLICA"
fi
URL="https://$DOMINIO$RUTA_PUBLICA"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "$URL" || echo 000)

echo
verde "════════════════════════════════════════════"
verde "  🎉 CHISPA ESTÁ PUBLICADA"
verde "════════════════════════════════════════════"
echo "  Jugadores (móvil):   $URL"
echo "  Presentador:         ${URL}panel"
echo "  Contraseña:          $CLAVE"
echo "  Comprobación:        respuesta $CODIGO (200 = todo bien)"
echo
echo "  Activar la IA:  nano $ENV_FILE  → pega tu clave en ANTHROPIC_API_KEY → systemctl restart chispa"
echo "  Actualizar:     vuelve a pegar el mismo comando de instalación"
