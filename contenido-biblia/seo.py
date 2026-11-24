"""Genera las páginas públicas de preguntas con respuestas (SEO/AEO) a partir de public/biblia/*.json.

  python3 contenido-biblia/seo.py

Escribe:
  public/preguntas.html            índice con todos los libros publicados
  public/preguntas/<libro>.html    las 150 preguntas de cada libro, con respuesta, explicación y cita (enlace a la RV1960)
y actualiza en public/aprender.html el bloque de datos estructurados de los cursos (<script id="ld-cursos">).
Se ejecuta después de construir.py (lo llama él mismo al final).
"""
import json, os, re, html
from urllib.parse import quote

RAIZ = os.path.join(os.path.dirname(__file__), '..', 'public')
WEB = 'https://genesis.andresrendon.com'
VERSO = 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.'
OG = WEB + '/app/og-lumbrera.jpg'
LAMP = ('<svg class="chispa" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#F2C46B"/>'
        '<path d="M16 6c3 4 5 6.5 5 9.5a5 5 0 0 1-10 0C11 12.5 13 10 16 6z" fill="#1B1640"/><path d="M9 22h14l-1.5 4h-11z" fill="#1B1640"/></svg>')
NOMBRE_LARGO = {'genesis': 'el libro de Génesis', 'exodo': 'el libro de Éxodo', 'mateo': 'el evangelio de Mateo',
                'marcos': 'el evangelio de Marcos', 'lucas': 'el evangelio de Lucas', 'juan': 'el evangelio de Juan'}

e = lambda t: html.escape(str(t), quote=True)
def rv(ref): return f'https://www.biblegateway.com/passage/?search={quote(ref.replace("–", "-"))}&version=RVR1960'

def respuesta(q):
    t = q['t']
    if t == 'vf': return 'Verdadero' if q['v'] else 'Falso'
    if t in ('opcion', 'completar'): return q['ok']
    if t == 'ordenar': return ' → '.join(q['orden'])
    if t == 'emparejar': return ' · '.join(f'{a}: {b}' for a, b in q['pares'])
    return ''

def enunciado(q):
    t = q['t']
    if t == 'vf': return f'Verdadero o falso: {q["q"]}'
    if t == 'completar': return 'Completa el versículo: ' + q['q'].replace('___', '_____')
    return q['q']

def cabeza(titulo, desc, ruta, ld):
    return f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1B1640">
<title>{e(titulo)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{WEB}{ruta}">
<link rel="icon" href="/app/icono-192.png" type="image/png">
<link rel="apple-touch-icon" href="/app/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lumbrera">
<meta property="og:locale" content="es_ES">
<meta property="og:url" content="{WEB}{ruta}">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{OG}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<link rel="stylesheet" href="/styles.css">
<style>
  body{{line-height:1.6}}
  .envoltura{{max-width:820px;margin:0 auto;padding:0 18px 60px}}
  header.sup{{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:16px 0}}
  @media (max-width:520px){{header.sup .btn.peq{{display:none}}}}
  .migas{{font-size:.85rem;color:var(--suave);margin:.4rem 0 1rem}}.migas a{{color:var(--suave)}}
  h1{{font-size:clamp(1.8rem,5vw,2.5rem);line-height:1.12;margin:.2rem 0 .6rem}}
  .intro{{color:var(--suave);font-size:1.06rem;margin:0 0 1.2rem}}
  .acciones{{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 1.6rem}}
  h2{{font-size:1.35rem;margin:2.2rem 0 .2rem}}
  .caps{{color:var(--suave);margin:0 0 .8rem;font-weight:700}}
  ol.qs{{padding-left:1.4rem;margin:0}}
  ol.qs li{{margin:.75rem 0;padding-left:.2rem}}
  ol.qs li > p{{margin:0;font-weight:700}}
  details{{margin-top:.3rem;background:rgba(36,30,82,.6);border:1px solid #362e74;border-radius:12px;padding:.45rem .8rem}}
  summary{{cursor:pointer;color:var(--ambar);font-weight:800;font-size:.9rem}}
  details p{{margin:.35rem 0 0}}
  .cita a{{color:var(--ambar);font-weight:800;text-decoration:none;font-size:.9rem}}
  .libros-l{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:1rem 0 2rem}}
  .libros-l a{{display:block;background:rgba(36,30,82,.85);border:1px solid #433a86;border-radius:16px;padding:1rem;text-decoration:none;color:var(--texto)}}
  .libros-l b{{display:block;font-family:var(--tit);font-size:1.2rem}}.libros-l span{{color:var(--suave);font-size:.9rem}}
  .cta-final{{margin-top:2.6rem;background:linear-gradient(135deg,#2a2163,#1f1850);border:1px solid #5a4fb0;border-radius:20px;padding:1.4rem;text-align:center}}
  .verso{{text-align:center;font-style:italic;color:var(--suave);margin:2.4rem auto .4rem;max-width:28em}}.verso a{{display:block;font-style:normal;font-weight:800;color:var(--ambar);text-decoration:none;font-size:.85rem}}
  footer{{color:var(--suave);font-size:.8rem;text-align:center;margin-top:1rem}}
</style>
</head>
<body class="tema-fe">
<div class="envoltura">
<header class="sup"><a class="marca" href="/">{LAMP}<span class="marca-txt"><span>Lumbrera</span><span class="marca-lema">Lámpara es a mis pies tu palabra (Salmo 119:105)</span></span></a>
<a class="btn peq" href="/">Practicar gratis</a></header>
'''

PIE = f'''<p class="verso">«{VERSO}»<a href="{rv('Salmos 119:105')}" target="_blank" rel="noopener">Salmos 119:105</a></p>
<footer>Citas: Reina-Valera 1960 © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988. · Hecho por Andrés Rendón · <a href="https://www.andresrendon.com/" target="_blank" rel="noopener">Visita mi web</a> · <a href="/privacidad">Privacidad</a></footer>
</div>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "e0ce934667604de6846373325dd96382"}}'></script>
</body>
</html>
'''

def migas(items):
    return {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": WEB + u} for i, (n, u) in enumerate(items)]}

def pagina_libro(L, cat, total_libros):
    lid, nombre = L['id'], L['nombre']
    preguntas = [q for u in L['unidades'] for l in u['lecciones'] for q in l['preguntas']]
    titulo = f'Preguntas de {nombre} con respuestas · {len(preguntas)} preguntas bíblicas'
    desc = (f'{len(preguntas)} preguntas sobre {NOMBRE_LARGO.get(lid, nombre)} con su respuesta, una breve explicación y la cita '
            f'para leerla en la Reina-Valera 1960. Para estudiar, repasar o hacer un concurso bíblico con tu grupo.')
    ruta = f'/preguntas/{lid}'
    # Datos estructurados: cuestionario educativo (Quiz) con preguntas de elección múltiple
    partes = []
    for q in preguntas:
        if q['t'] == 'opcion':
            partes.append({"@type": "Question", "eduQuestionType": "Multiple choice", "text": q['q'],
                           "suggestedAnswer": [{"@type": "Answer", "text": m} for m in q['malas']],
                           "acceptedAnswer": {"@type": "Answer", "text": q['ok']}})
        elif q['t'] == 'vf':
            ok = 'Verdadero' if q['v'] else 'Falso'
            partes.append({"@type": "Question", "eduQuestionType": "Multiple choice", "text": q['q'],
                           "suggestedAnswer": [{"@type": "Answer", "text": 'Falso' if q['v'] else 'Verdadero'}],
                           "acceptedAnswer": {"@type": "Answer", "text": ok}})
    ld = {"@context": "https://schema.org", "@graph": [
        migas([('Lumbrera', '/'), ('Preguntas bíblicas', '/preguntas'), (nombre, ruta)]),
        {"@type": "Quiz", "name": f'Preguntas de {nombre}', "description": desc, "inLanguage": "es", "isAccessibleForFree": True,
         "educationalLevel": "beginner", "url": WEB + ruta,
         "about": {"@type": "Book", "name": nombre, "isPartOf": {"@type": "Book", "name": "La Biblia"}},
         "author": {"@type": "Person", "name": "Andrés Rendón", "url": "https://www.andresrendon.com/"},
         "hasPart": partes}]}
    out = [cabeza(titulo, desc, ruta, ld)]
    out.append(f'<nav class="migas" aria-label="Migas de pan"><a href="/">Lumbrera</a> › <a href="/preguntas">Preguntas bíblicas</a> › {e(nombre)}</nav>')
    out.append(f'<h1>Preguntas de {e(nombre)} con respuestas</h1>')
    out.append(f'<p class="intro">{len(preguntas)} preguntas sobre {e(NOMBRE_LARGO.get(lid, nombre))} ({L["capitulos"]} capítulos), ordenadas en {len(L["unidades"])} unidades. '
               f'Cada una tiene su respuesta, una breve explicación y la cita para leer el pasaje en la Reina-Valera 1960. '
               f'Puedes practicarlas jugando, gratis y sin registro, o usarlas para un concurso bíblico con tu grupo de jóvenes, célula o escuela dominical.</p>')
    out.append(f'<div class="acciones"><a class="btn" href="/aprender?libro={lid}">Practícalas jugando (gratis)</a><a class="btn sec" href="/#grupo">Hacer un concurso con mi grupo</a></div>')
    n = 0
    for ui, u in enumerate(L['unidades']):
        out.append(f'<h2>Unidad {ui + 1}: {e(u["titulo"])}</h2><p class="caps">{e(u["capitulos"])}</p><ol class="qs" start="{n + 1}">')
        for l in u['lecciones']:
            for q in l['preguntas']:
                n += 1
                exp = f'<p>{e(q["exp"])}</p>' if q.get('exp') else ''
                out.append(f'<li><p>{e(enunciado(q))}</p><details><summary>Ver respuesta</summary><p><b>{e(respuesta(q))}</b></p>{exp}'
                           f'<p class="cita"><a href="{e(rv(q["ref"]))}" target="_blank" rel="noopener">📖 {e(q["ref"])} · Leer en la RV1960 ↗</a></p></details></li>')
        out.append('</ol>')
    otros = ''.join(f'<a href="/preguntas/{b["id"]}"><b>{e(b["nombre"])}</b><span>{b["preguntas"]} preguntas</span></a>' for b in cat if b['id'] != lid)
    out.append(f'<div class="cta-final"><h2 style="margin-top:0">¿Cuántas acertarías sin mirar?</h2><p class="intro" style="margin:.4rem 0 1rem">En Lumbrera las juegas en lecciones de 10 preguntas, con racha diaria y liga semanal. Gratis y sin registro.</p>'
               f'<a class="btn" href="/aprender?libro={lid}">Jugar con {e(nombre)}</a></div>')
    out.append(f'<h2>Más preguntas bíblicas</h2><div class="libros-l">{otros}</div>')
    out.append(PIE)
    return ''.join(out), len(preguntas)

def pagina_indice(cat, total):
    titulo = f'Preguntas bíblicas con respuestas · {total} preguntas de {len(cat)} libros'
    desc = (f'{total} preguntas bíblicas con respuestas de {", ".join(b["nombre"] for b in cat[:-1])} y {cat[-1]["nombre"]}, '
            f'con explicación y cita en la Reina-Valera 1960. Para estudiar, repasar o hacer concursos bíblicos en grupo.')
    ld = {"@context": "https://schema.org", "@graph": [
        migas([('Lumbrera', '/'), ('Preguntas bíblicas', '/preguntas')]),
        {"@type": "ItemList", "name": "Preguntas bíblicas por libro", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": f'Preguntas de {b["nombre"]}', "url": f'{WEB}/preguntas/{b["id"]}'} for i, b in enumerate(cat)]}]}
    out = [cabeza(titulo, desc, '/preguntas', ld)]
    out.append('<nav class="migas" aria-label="Migas de pan"><a href="/">Lumbrera</a> › Preguntas bíblicas</nav>')
    out.append('<h1>Preguntas bíblicas con respuestas</h1>')
    out.append(f'<p class="intro">{total} preguntas sobre la Biblia, ordenadas por libro y por unidades, cada una con su respuesta, una breve explicación y la cita '
               'para leer el pasaje en la Reina-Valera 1960. Son las mismas preguntas de las lecciones de Lumbrera: puedes estudiarlas aquí o practicarlas jugando.</p>')
    out.append('<div class="acciones"><a class="btn" href="/">Practicar jugando (gratis)</a><a class="btn sec" href="/grupos">Concursos bíblicos para grupos</a></div>')
    out.append('<div class="libros-l">' + ''.join(f'<a href="/preguntas/{b["id"]}"><b>{e(b["nombre"])}</b><span>{b["preguntas"]} preguntas con respuestas</span></a>' for b in cat) + '</div>')
    out.append('<h2>¿Cómo usar estas preguntas?</h2><p class="intro">Para estudiar solo, abre la respuesta de cada pregunta y lee la cita completa en la Biblia. '
               'Para un grupo, crea una partida en Lumbrera: la pantalla muestra un PIN y cada persona responde desde su móvil, sin instalar nada.</p>')
    out.append(PIE)
    return ''.join(out)

def cursos_ld(cat, libros):
    return {"@context": "https://schema.org", "@graph": [
        {"@type": "Course", "name": f'Aprende {L["nombre"]}', "url": f'{WEB}/preguntas/{L["id"]}',
         "description": f'{sum(len(l["preguntas"]) for u in L["unidades"] for l in u["lecciones"])} preguntas sobre {NOMBRE_LARGO.get(L["id"], L["nombre"])} en {len(L["unidades"])} unidades.',
         "inLanguage": "es", "isAccessibleForFree": True, "provider": {"@id": WEB + "/#app"}, "educationalLevel": "Principiante",
         "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "online", "courseWorkload": "PT10M"},
         "about": {"@type": "Book", "name": L["nombre"], "isPartOf": {"@type": "Book", "name": "La Biblia"}},
         "syllabusSections": [{"@type": "Syllabus", "name": u["titulo"], "description": u["capitulos"]} for u in L["unidades"]]}
        for L in (libros[b["id"]] for b in cat)]}

def main():
    cat = [b for b in json.load(open(os.path.join(RAIZ, 'biblia', 'libros.json'), encoding='utf-8'))['libros'] if b.get('preguntas')]
    libros = {b['id']: json.load(open(os.path.join(RAIZ, 'biblia', b['id'] + '.json'), encoding='utf-8')) for b in cat}
    os.makedirs(os.path.join(RAIZ, 'preguntas'), exist_ok=True)
    total = 0
    for b in cat:
        h, n = pagina_libro(libros[b['id']], cat, len(cat)); total += n
        open(os.path.join(RAIZ, 'preguntas', b['id'] + '.html'), 'w', encoding='utf-8').write(h)
    open(os.path.join(RAIZ, 'preguntas.html'), 'w', encoding='utf-8').write(pagina_indice(cat, total))
    # Datos estructurados de los cursos en la portada
    p = os.path.join(RAIZ, 'aprender.html'); s = open(p, encoding='utf-8').read()
    nuevo = f'<script type="application/ld+json" id="ld-cursos">{json.dumps(cursos_ld(cat, libros), ensure_ascii=False)}</script>'
    s2, k = re.subn(r'<script type="application/ld\+json" id="ld-cursos">.*?</script>', lambda m: nuevo, s, flags=re.S)
    if not k: s2, k = re.subn(r'<script type="application/ld\+json">\{"@context": "https://schema.org", "@type": "Course".*?</script>', lambda m: nuevo, s, count=1, flags=re.S)
    assert k == 1, 'no encuentro el bloque de cursos en aprender.html'
    open(p, 'w', encoding='utf-8').write(s2)
    print(f'SEO: {len(cat)} páginas de libro + índice ({total} preguntas) y cursos en la portada')

if __name__ == '__main__':
    main()
