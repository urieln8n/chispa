# ⚡ Pulsazo — trivial y bingo musical en vivo (Cloudflare)

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

## Web y SEO
- La portada (`/`) es la web de presentación para bares y empresas: tiene una pregunta jugable, formatos, precios, preguntas frecuentes y un formulario de solicitud (las solicitudes llegan al panel, en 📬 Contactos).
- Los jugadores entran en **`/jugar`**, a donde apuntan los QR. Los enlaces antiguos con `/?pin=` siguen funcionando.
- `robots.txt`, `sitemap.xml`, la dirección canónica y la imagen para redes se generan con el dominio real, así que funcionan igual con `workers.dev` o con un dominio propio.
- Completa los datos entre corchetes de **`/privacidad`** antes de usar el formulario con clientes.

## Biblioteca y noches
- **Categorías, buscador y filtros** para organizar tus rondas.
- **📍 Lugar** (arriba en el panel): escribe dónde juegas hoy (p. ej. «Bar Manolo»). Chispa recuerda qué preguntas se han usado en cada sitio.
- **🎲 Montar noche**: elige cuántas preguntas al azar quieres de cada ronda. Chispa crea la partida sin repetir las que ya salieron en ese lugar.
- **⇅ Importar / Exportar**: copia de seguridad, compartir rondas y cargar los **packs de inicio** (6 rondas para bares y 2 de Biblia, Reina-Valera 1960).
- **Modo automático** (en la pantalla del presentador): enseña resultados y ranking unos segundos y pasa sola a la siguiente pregunta.

## 🎵 Bingo musical
- Listas de canciones (título y artista) en la biblioteca, con packs de inicio: **Navidad**, pop español, latino y reguetón, y éxitos para bailar. También se pueden crear con IA.
- Cada jugador recibe en el móvil **un cartón distinto** (3×3, 4×4 o 5×5 con centro libre) y marca las canciones al sonar.
- Rondas: **línea**, **dos líneas** y **cartón lleno**. Chispa **comprueba cada canto**: solo vale si las canciones marcadas han sonado (un bingo falso deja 10 s sin poder cantar).
- **Pantalla para el proyector**: número de canción, título revelado a los X segundos o al pulsar, jugadores «a una canción de cantar», historial y ganador con su cartón.
- **Mando para el móvil del presentador** (por QR): qué canción poner, buscar y marcar otra, revelar, deshacer y pasar de ronda.
- **Tema Navidad** con nieve.
- **Chispa no reproduce música**: el presentador la pone con el equipo y la licencia del local y marca aquí qué suena.

## ✝️ Lumbrera: la misma app para iglesias, Biblia y evangelismo
El mismo código se publica con otra marca, **Lumbrera** («Lámpara es a mis pies tu palabra», Salmo 119:105), con su propio nombre, logo, colores, contraseña y datos.
- **Serie «Vida de Jesús»** (RV1960) en 5 rondas: nacimiento, milagros, parábolas, muerte y resurrección, y Jesús y tu vida.
- **Reflexión tras cada respuesta** (opcional en cada pregunta): versículo y comentario breve en pantalla y en el móvil.
- **Mensaje final** junto al podio, con botones en el móvil **«Quiero saber más»** y **«Pedir oración»**. Piden consentimiento y llegan al panel en **📬 Contactos**, desde donde se pueden descargar o borrar.
- Texto bíblico: Reina-Valera 1960 © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988. Para un uso comercial amplio, confirma los límites de cita o pide permiso a las Sociedades Bíblicas.

### 📚 Aprender (tipo Duolingo)
En Lumbrera, la portada es **Aprender**: el libro de **Génesis**, en un camino de lecciones de 10 preguntas.
- Cinco tipos de ejercicio: elegir respuesta, verdadero o falso, completar el texto, ordenar hechos y emparejar.
- Cada pregunta enseña su cita. Las falladas vuelven al final de la lección y quedan guardadas para repasar.
- Puntos, estrellas por lección, racha de días y meta diaria. El progreso se guarda en el dispositivo, sin registrarse.
- Libro disponible: **Génesis** (150 preguntas). Es el único que se publica.
- Cada libro se puede usar también en partidas en grupo: en el panel, **⇅ Importar / Exportar** tiene «📖 Génesis: 15 rondas para jugar en grupo».
- El contenido se escribe en `contenido-biblia/` (un archivo `.py` por libro) y se genera con `python3 contenido-biblia/construir.py`.

**Publicarla:** en Cloudflare, **Workers & Pages → Create → Import a repository**, elige este mismo repositorio y ponle de nombre `lumbrera`. En **Deploy command** escribe `npx wrangler deploy --env fe`. Quedará en `https://lumbrera.<tu-subdominio>.workers.dev`.

**Publicación automática:** Lumbrera está conectada con Workers Builds de Cloudflare (repositorio `urieln8n/chispa`, rama `main`, comando `npx wrangler deploy --env fe`): cada subida a `main` se publica sola en uno o dos minutos. El historial está en Cloudflare → Workers y Pages → lumbrera → Implementaciones.

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
