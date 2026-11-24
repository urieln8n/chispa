# Cambiar Lumbrera a un dominio propio

Todo está preparado y **apagado**: mientras `DOMINIO_NUEVO` esté vacío en `wrangler.jsonc`, nada cambia.

## El día del cambio (unos 15 minutos)
1. **Compra el dominio** (mejor en Cloudflare: Domain Registration → Register).
2. **Conéctalo al worker:** Workers & Pages → `lumbrera` → Settings → Domains & Routes → Add → Custom domain → escribe el dominio.
   Comprueba que `https://TU-DOMINIO/` abre Lumbrera.
3. **Cambia el código y enciende la mudanza:**
   ```bash
   bash scripts/cambiar-dominio.sh lumbrera.app
   git add -A && git commit -m "Lumbrera se muda a lumbrera.app" && git push
   ```
   Cloudflare lo publica solo en unos 2 minutos.
4. **Google Search Console:** añade la propiedad nueva (`https://lumbrera.app/`), verifícala y envía `sitemap.xml`.
   Después, en la propiedad vieja: Ajustes → **Cambio de dirección** → elige la nueva.
5. **Bing Webmaster Tools:** añade el sitio nuevo y usa **Site Move**.

## Qué hace la mudanza
- **Páginas de la app** (`/`, `/aprender`, `/lider`) en la dirección vieja: una página mínima lee el progreso guardado en el navegador (racha, lecciones, ajustes, liga y sesión del panel del líder) y lo lleva a la dirección nueva. Viaja en el fragmento `#` de la URL, que nunca llega al servidor.
- **Dominio nuevo, ruta `/mudanza`:** guarda ese progreso sin pisar uno mejor que ya hubiera allí (se queda el que tenga más puntos) y abre la página que se había pedido.
- **Buscadores y el resto de páginas** (preguntas, /grupos, sitemap…): redirección 301, para no perder posiciones.
- **Lo que no se redirige:**
  - la API, los libros, los estilos y los iconos, para que las apps ya instaladas sigan funcionando;
  - el archivo de verificación de Google.
- **Avisos diarios (push):** cada usuario tiene que volver a activarlos una vez en el dominio nuevo.
- **Apps instaladas:** la app instalada desde la dirección vieja abrirá la nueva. Conviene reinstalarla desde el dominio nuevo.

Mantén `genesis.andresrendon.com` conectado al worker al menos un año para que la redirección siga funcionando.
