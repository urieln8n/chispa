# ⚡ Chispa — quiz en vivo

Quiz multijugador en tiempo real para clases, empresas y eventos. El presentador proyecta la partida con un **PIN y un QR**; los jugadores entran desde el móvil **sin instalar nada ni registrarse**.

## Qué incluye
- Panel del presentador con contraseña y **editor de cuestionarios** (guardar, duplicar, reordenar, imágenes, hasta 240 s por pregunta).
- Sala de espera con PIN grande + QR y lista de jugadores en directo (pulsa un apodo para sacarlo).
- Preguntas de 2–4 opciones con color y forma (★ ⚡ ☾ ♥), cuenta atrás y puntos por acierto + rapidez + **racha**.
- Resultados con barras, ranking entre preguntas y **podio** con confeti.
- **Mejoras:** sin límite artificial de jugadores (500 por defecto, configurable) · **reconexión automática** con los puntos intactos · **informe final descargable** para Excel (por jugador y por pregunta, y cuál fue la más difícil) · preguntas largas · la pregunta también se ve en el móvil.
- **IA opcional:** crea un cuestionario a partir de un tema o un texto pegado (API de Anthropic, con tope diario).

## Instalar en una VPS (Ubuntu/Debian), como root
```bash
curl -fsSL https://raw.githubusercontent.com/urieln8n/chispa/main/instalar.sh | bash
```
Lo deja publicado en `https://<nombre-de-tu-vps>/` con candado. Si esa dirección ya sirve otra web, no la toca y publica en `/chispa/`. Al final muestra la URL y la **contraseña del presentador**.

- Usar tu dominio: `DOMINIO=quiz.midominio.com bash instalar.sh` (el dominio debe apuntar ya a la IP de la VPS).
- Activar la IA: edita `/etc/chispa.env`, pon `ANTHROPIC_API_KEY=...` y ejecuta `systemctl restart chispa`.
- Actualizar: vuelve a ejecutar el mismo comando.
- Ver errores: `journalctl -u chispa -n 50`.

## En local
```bash
npm install
npm start            # http://127.0.0.1:3070  (contraseña en data/contrasena-presentador.txt)
CLAVE=$(cat data/contrasena-presentador.txt) N=300 npm test   # partida simulada con 300 jugadores
```
