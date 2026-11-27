"""Genera public/preguntas/<libro>.html a partir de public/biblia/<libro>.json, con la misma forma que las páginas existentes.
Uso: python3 paginas_preguntas.py <repo> <libro> [--comprobar]   (--comprobar compara con el archivo actual sin escribir)"""
import json, sys, html, urllib.parse

repo, lid = sys.argv[1], sys.argv[2]  # repo: carpeta del repo chispa (p. ej. .)
comprobar = '--comprobar' in sys.argv
ORIGEN = 'https://genesis.andresrendon.com'
cat = json.load(open(f'{repo}/public/biblia/libros.json'))
L = json.load(open(f'{repo}/public/biblia/{lid}.json'))
nombre = L['nombre']
evangelio = lid in ('mateo', 'marcos', 'lucas', 'juan')
del_libro = f'el evangelio de {nombre}' if evangelio else ('el libro de los Hechos' if lid == 'hechos' else f'el libro de {nombre}')
ps = [p for u in L['unidades'] for l in u['lecciones'] for p in l['preguntas']]
n = len(ps)
desc = f'{n} preguntas sobre {del_libro} con su respuesta, una breve explicación y la cita para leerla en la Reina-Valera 1960. Para estudiar, repasar o hacer un concurso bíblico con tu grupo.'
titulo = f'Preguntas de {nombre} con respuestas · {n} preguntas bíblicas'
url = f'{ORIGEN}/preguntas/{lid}'
e = lambda s: html.escape(s, quote=True)
eT = lambda s: html.escape(s, quote=False)

def enlace(ref):
    q = urllib.parse.quote(ref.replace('–', '-'))
    return f'<p class="cita"><a href="https://www.biblegateway.com/passage/?search={q}&amp;version=RVR1960" target="_blank" rel="noopener">📖 {eT(ref)} · Leer en la RV1960 ↗</a></p>'

def enunciado(p):
    if p['t'] == 'completar': return 'Completa el versículo: ' + p['q'].replace('___', '_____')
    if p['t'] == 'vf': return 'Verdadero o falso: ' + p['q']
    return p['q']

def respuesta(p):
    t = p['t']
    if t == 'vf': return 'Verdadero' if p['v'] else 'Falso'
    if t == 'ordenar': return ' → '.join(p['orden'])
    if t == 'emparejar': return ' · '.join(f'{a}: {b}' for a, b in p['pares'])
    return p['ok']

def parte(p):
    if p['t'] == 'vf':
        si, no = ('Verdadero', 'Falso') if p['v'] else ('Falso', 'Verdadero')
        return {"@type": "Question", "eduQuestionType": "Multiple choice", "text": p['q'], "suggestedAnswer": [{"@type": "Answer", "text": no}], "acceptedAnswer": {"@type": "Answer", "text": si}}
    return {"@type": "Question", "eduQuestionType": "Multiple choice", "text": p['q'], "suggestedAnswer": [{"@type": "Answer", "text": m} for m in p['malas']], "acceptedAnswer": {"@type": "Answer", "text": p['ok']}}

ld = {"@context": "https://schema.org", "@graph": [
    {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Lumbrera", "item": ORIGEN + "/"},
        {"@type": "ListItem", "position": 2, "name": "Preguntas bíblicas", "item": ORIGEN + "/preguntas"},
        {"@type": "ListItem", "position": 3, "name": nombre, "item": url}]},
    {"@type": "Quiz", "name": f"Preguntas de {nombre}", "description": desc, "inLanguage": "es", "isAccessibleForFree": True,
     "educationalLevel": "beginner", "url": url, "about": {"@type": "Book", "name": nombre, "isPartOf": {"@type": "Book", "name": "La Biblia"}},
     "author": {"@type": "Person", "name": "Andrés Rendón", "url": "https://www.andresrendon.com/"},
     "hasPart": [parte(p) for p in ps if p['t'] in ('opcion', 'vf')]}]}

actual = open(f'{repo}/public/preguntas/juan.html').read()
ini_style = actual.index('<link rel="stylesheet" href="/styles.css">')
estilo = actual[ini_style:actual.index('<body')]
pie = actual[actual.index('<p class="verso">'):]

cuerpo = []
num = 1
for i, u in enumerate(L['unidades']):
    cuerpo.append(f'<h2>Unidad {i + 1}: {eT(u["titulo"])}</h2><p class="caps">{eT(u["capitulos"])}</p><ol class="qs" start="{num}">')
    for l in u['lecciones']:
        for p in l['preguntas']:
            ex = f'<p>{eT(p["exp"])}</p>' if p.get('exp') else ''
            cuerpo.append(f'<li><p>{eT(enunciado(p))}</p><details><summary>Ver respuesta</summary><p><b>{eT(respuesta(p))}</b></p>{ex}{enlace(p["ref"])}</details></li>')
            num += 1
    cuerpo.append('</ol>')
otros = ''.join(f'<a href="/preguntas/{b["id"]}"><b>{eT(b["nombre"])}</b><span>{b["preguntas"]} preguntas</span></a>' for b in cat['libros'] if b.get('preguntas') and b['id'] != lid)
caps = f'{L["capitulos"]} capítulos'
intro = f'{n} preguntas sobre {del_libro} ({caps}), ordenadas en {len(L["unidades"])} unidades. Cada una tiene su respuesta, una breve explicación y la cita para leer el pasaje en la Reina-Valera 1960. Puedes practicarlas jugando, gratis y sin registro, o usarlas para un concurso bíblico con tu grupo de jóvenes, célula o escuela dominical.'

out = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1B1640">
<title>{eT(titulo)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<link rel="icon" href="/app/icono-192.png" type="image/png">
<link rel="apple-touch-icon" href="/app/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lumbrera">
<meta property="og:locale" content="es_ES">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="https://genesis.andresrendon.com/app/og-lumbrera.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
{estilo}<body class="tema-fe">
<div class="envoltura">
<header class="sup"><a class="marca" href="/"><svg class="chispa" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#F2C46B"/><path d="M16 6c3 4 5 6.5 5 9.5a5 5 0 0 1-10 0C11 12.5 13 10 16 6z" fill="#1B1640"/><path d="M9 22h14l-1.5 4h-11z" fill="#1B1640"/></svg><span class="marca-txt"><span>Lumbrera</span><span class="marca-lema">Lámpara es a mis pies tu palabra (Salmo 119:105)</span></span></a>
<a class="btn peq" href="/">Practicar gratis</a></header>
<nav class="migas" aria-label="Migas de pan"><a href="/">Lumbrera</a> › <a href="/preguntas">Preguntas bíblicas</a> › {eT(nombre)}</nav><h1>Preguntas de {eT(nombre)} con respuestas</h1><p class="intro">{eT(intro)}</p><div class="acciones"><a class="btn" href="/aprender?libro={lid}">Practícalas jugando (gratis)</a><a class="btn sec" href="/#grupo">Hacer un concurso con mi grupo</a></div>{''.join(cuerpo)}<div class="cta-final"><h2 style="margin-top:0">¿Cuántas acertarías sin mirar?</h2><p class="intro" style="margin:.4rem 0 1rem">En Lumbrera las juegas en lecciones de 10 preguntas, con racha diaria y liga semanal. Gratis y sin registro.</p><a class="btn" href="/aprender?libro={lid}">Jugar con {eT(nombre)}</a></div><h2>Más preguntas bíblicas</h2><div class="libros-l">{otros}</div>{pie}'''

dest = f'{repo}/public/preguntas/{lid}.html'
if comprobar:
    viejo = open(dest).read()
    if viejo == out: print('IGUAL', lid)
    else:
        i = next(k for k in range(min(len(viejo), len(out))) if viejo[k] != out[k]) if any(a != b for a, b in zip(viejo, out)) else min(len(viejo), len(out))
        print('DIFERENTE', lid, i, '\nviejo:', viejo[i-150:i+200], '\nnuevo:', out[i-150:i+200])
else:
    open(dest, 'w').write(out); print('escrito', dest, len(out))
