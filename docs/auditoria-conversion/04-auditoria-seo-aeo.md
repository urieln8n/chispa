# Auditoría final: errores, SEO y AEO (24 nov 2026)

## Errores encontrados y corregidos
| Problema | Dónde | Arreglo |
|---|---|---|
| La cabecera se salía de la pantalla en el móvil | /grupos | Los enlaces secundarios se ocultan por debajo de 640 px |
| No había título principal (h1) | /jugar | "Escribe el PIN de la partida" |
| /favicon.ico daba 404 | todas | El worker sirve el icono de Lumbrera |
| "Crea tu partida" llevaba al panel con contraseña | /jugar | Ahora lleva a /#grupo |
| Logros y pregunta del día solo usaban Génesis | portada | Cuentan y rotan los 6 libros |
| /privacidad mostraba en redes la imagen de Pulsazo | worker | Imagen propia de Lumbrera |
| La vista previa en WhatsApp usaba un icono pequeño | todas | Imagen 1200×630 (`/app/og-lumbrera.jpg`) con tarjeta grande |

## SEO
- **Páginas nuevas indexables:** `/preguntas` y `/preguntas/<libro>`, con las 900 preguntas, sus respuestas, una explicación breve y un enlace a la RV1960 en cada una. Responden a búsquedas reales como "preguntas bíblicas con respuestas", "preguntas de Génesis", "concurso bíblico para jóvenes". Las genera `contenido-biblia/seo.py` cada vez que se ejecuta `construir.py`.
- **El sitemap y llms.txt se actualizan solos:** se leen de `/biblia/libros.json`, así que un libro nuevo aparece sin tocar el código.
- **Datos estructurados (JSON validado):**
  - Portada: WebApplication, WebSite, FAQPage (2 preguntas nuevas) y 6 Course.
  - Páginas de libro: Quiz y BreadcrumbList.
  - Índice: ItemList.
  - /grupos: FAQPage.
- **Enlaces internos:** la portada y /grupos enlazan a las páginas de preguntas.
- **Pulsazo no sirve estas páginas:** las rutas /preguntas* redirigen a su portada.

## AEO (respuestas en buscadores con IA)
- Las preguntas con respuesta en texto plano y la cita bíblica son el formato que más reutilizan ChatGPT, Perplexity y Google AI.
- llms.txt describe la app e incluye la lista de páginas de preguntas.
- Las preguntas frecuentes responden en una frase quién la usa, cuánto cuesta y qué traducción usa.

## Lo que tiene que hacer Andrés (requiere su cuenta)
1. **Google Search Console:** añadir `genesis.andresrendon.com`, verificar el dominio (registro DNS en Cloudflare) y enviar `https://genesis.andresrendon.com/sitemap.xml`.
2. **Bing Webmaster Tools:** importar desde Search Console. Bing alimenta a ChatGPT y Copilot.
3. Al cabo de una o dos semanas, revisar en Search Console qué búsquedas traen visitas y escribir más preguntas de esos libros.

## Límites de uso de la RV1960
Hay 33 versículos citados de forma literal, lejos del límite de 500. Todas las demás preguntas son de redacción propia y enlazan al texto en Bible Gateway.
