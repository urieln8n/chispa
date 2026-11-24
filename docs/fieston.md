# Fiestón · juego de fiesta (Pack Navidad)

Tercera marca del mismo motor (después de Pulsazo y Lumbrera). La tele es el tablero y cada invitado juega desde su móvil con un código de 6 cifras.

## Qué hay
- `src/fiesta.js`: la lógica de la partida (rondas de trivial y de «¿Quién es más probable…?», puntos, podio). Vive en el mismo Durable Object `Juego`.
- `src/fiesta-packs.js`: el Pack Navidad (26 preguntas de trivial y 30 de «más probable») y el montaje de cada partida.
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

## Pendiente
- Cobro (Pack Familia / Evento Empresa) con Stripe.
- Más minijuegos: «Verdad o mentira familiar» y «Dibuja y adivina».
- Packs para todo el año: Nochevieja, despedidas, bodas, empresas.
