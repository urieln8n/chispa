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

## Modos y packs
- **Con tele**: la portada abre la pantalla de la tele (`/fiesta-tv`) y los demás juegan con el móvil.
- **Solo con móviles**: quien crea la partida entra en `/jugar` como jugador y lleva los mandos (empezar, cerrar ronda, siguiente) desde su móvil; cada móvil enseña la respuesta correcta y la clasificación.
- Packs: **Navidad** y **Quedadas** (para cualquier cena o reunión del año).

- **Enviar a la tele con código**: en la tele se abre `/tv`, que enseña un código de 4 letras; el móvil crea la partida con «Con tele», escribe ese código y la tele carga la partida sola (WebSocket `/ws-tele`). El móvil se queda como jugador y mando.

- **Mando en el móvil**: el primer jugador que entra es el anfitrión y lleva el mando (empezar, adelantar, pausar) desde su móvil. Las rondas pasan solas 10 s después de cada resultado.

## IA
- Si existe el secreto `OPENAI_API_KEY`, las preguntas personalizadas se hacen con OpenAI (modelo `OPENAI_MODEL`, por defecto `gpt-5.5`; si falla el modelo, prueba `gpt-4o-mini`). Si no, usa `ANTHROPIC_API_KEY`.

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
