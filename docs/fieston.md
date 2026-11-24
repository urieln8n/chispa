# Fiestón · juego de fiesta (Pack Navidad)

Tercera marca del mismo motor (después de Pulsazo y Lumbrera). La tele es el tablero y cada invitado juega desde su móvil con un código de 6 cifras.

## Qué hay
- `src/fiesta.js`: la lógica de la partida (rondas de trivial y de «¿Quién es más probable…?», puntos, podio). Vive en el mismo Durable Object `Juego`.
- `src/fiesta-packs.js`: el Pack Navidad (26 de trivial, 30 de «más probable» y 13 de «Verdad o mentira») y el montaje de cada partida.
- `public/fiesta.html` (portada y crear partida), `public/fiesta-tv.html` (pantalla de la tele), `public/fiesta-movil.html` (mando del móvil), `public/fiesta.css`.
- API: `POST /api/fiesta/crear` `{ pack, rondas, datos, anfitrion }`. Si hay `datos` y la IA está activada, crea hasta 6 preguntas personalizadas (los datos no se guardan).
- En el entorno `fiesta` solo se expone lo del juego: el panel, el editor y el resto de la API de Pulsazo devuelven 404 o redirigen a la portada.

## Direcciones (entorno `fiesta`)
- `/` portada · `/jugar` entrar desde el móvil · `/fiesta-tv?pin=…` pantalla (la abre la portada al crear la partida).

## Publicar
```bash
npx wrangler deploy --env fiesta
# preguntas personalizadas con IA (opcional):
npx wrangler secret put ANTHROPIC_API_KEY --env fiesta
```
Después, en Cloudflare › Workers › fieston › Dominios, añade `fiesta.andresrendon.com`.

## Probar en local
```bash
npx wrangler dev --env fiesta
node test/fiesta.js   # partida completa con 6 bots
```

## Cobro (Stripe)
- Gratis: partida corta (8 rondas), sin preguntas personalizadas.
- Pack Familia 3,99 €: hasta 16 rondas e IA, 30 días. Evento Empresa 79 €: hasta 50 jugadores, 20 rondas e IA, 30 días.
- `src/fiesta-pagos.js`: Stripe Checkout (precios en el código, no hace falta crear productos) y licencias firmadas que se guardan en el navegador del comprador.
- **Se activa al poner el secreto `STRIPE_SECRET_KEY`** en el worker `fieston`. Sin él, todo es gratis.
- Prueba: `npx wrangler dev --env fiesta --var STRIPE_SECRET_KEY:sk_test_prueba` y `node test/fiesta-pagos.js`.

## Pendiente
- Más minijuegos: «Dibuja y adivina».
- Packs para todo el año: Nochevieja, despedidas, bodas, empresas.
