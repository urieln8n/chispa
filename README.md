# ⚡ Chispa — quiz en vivo (Cloudflare)

Quiz multijugador en tiempo real para clases, empresas y eventos. El presentador proyecta la partida con un **PIN y un QR**; los jugadores entran desde el móvil **sin instalar nada ni registrarse**.

Funciona en **Cloudflare Workers + Durable Objects**: gratis para empezar, siempre encendido, con candado (HTTPS) y aguanta cientos de móviles a la vez. Cada partida vive en su propio Durable Object; los cuestionarios y los informes se guardan de forma permanente.

## Qué incluye
- Panel del presentador con contraseña (la creas la primera vez que entras en `/panel`).
- **Editor de cuestionarios**: guardar, duplicar, reordenar, imágenes y hasta 240 s por pregunta.
- Sala de espera con PIN grande + QR y la lista de jugadores en directo (pulsa un apodo para sacarlo).
- Preguntas de 2 a 4 opciones con color y forma (★ ⚡ ☾ ♥), cuenta atrás y puntos por acierto + rapidez + **racha**.
- Resultados con barras, ranking entre preguntas y **podio** con confeti.
- **Mejoras:**
  - Sin límite artificial de jugadores (500 por defecto, configurable).
  - **Reconexión automática** con los puntos intactos.
  - **Informe final descargable** para Excel, por jugador y por pregunta.
  - Preguntas largas, y la pregunta también se ve en el móvil.
- **IA opcional**: crea un cuestionario a partir de un tema o un texto pegado (API de Anthropic, con tope diario).

## Biblioteca y noches
- **Categorías, buscador y filtros** para organizar tus rondas.
- **📍 Lugar** (arriba en el panel): escribe dónde juegas hoy (p. ej. «Bar Manolo»). Chispa recuerda qué preguntas se han usado en cada sitio.
- **🎲 Montar noche**: elige cuántas preguntas al azar quieres de cada ronda. Chispa crea la partida sin repetir las que ya salieron en ese lugar.
- **⇅ Importar / Exportar**: copia de seguridad, compartir rondas y cargar los **packs de inicio** (6 rondas para bares y 2 de Biblia, Reina-Valera 1960).
- **Modo automático** (en la pantalla del presentador): enseña resultados y ranking unos segundos y pasa sola a la siguiente pregunta.

## Publicar en Cloudflare (gratis)

### Opción A: desde el panel de Cloudflare, con GitHub (sin instalar nada)
1. Crea una cuenta gratis en https://dash.cloudflare.com.
2. Ve a **Workers & Pages → Create → Import a repository**, conecta GitHub y elige `chispa`.
3. Deja los valores por defecto (deploy command `npx wrangler deploy`) y pulsa **Deploy**.
4. Abre la dirección que te da (`https://chispa.<tu-subdominio>.workers.dev`), entra en `/panel` y crea tu contraseña.

Cada vez que cambies el código en GitHub, Cloudflare lo vuelve a publicar solo.

### Opción B: desde tu ordenador (necesitas Node.js)
```bash
npm install
npx wrangler login      # abre el navegador para entrar en tu cuenta de Cloudflare
npx wrangler deploy
```

### Activar la IA (opcional)
En Cloudflare: **Workers & Pages → chispa → Settings → Variables and Secrets → Add**. Crea un secreto `ANTHROPIC_API_KEY` con tu clave de https://console.anthropic.com.

Desde terminal también vale: `npx wrangler secret put ANTHROPIC_API_KEY`.

### Tu propio dominio (opcional)
En **chispa → Settings → Domains & Routes → Add → Custom domain**. El dominio tiene que estar en tu cuenta de Cloudflare.

## Probar en local
```bash
npm install
npm run dev                     # http://127.0.0.1:8787
N=200 CLAVE=prueba123 npm test  # partida simulada con 200 jugadores
```
