import json, os, random, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from genesis import GENESIS
from exodo import EXODO
from mateo import MATEO
from marcos import MARCOS
from lucas import LUCAS
from juan import JUAN
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'biblia'); os.makedirs(SALIDA, exist_ok=True)
CAT = [  # (id, nombre, testamento, capítulos)
 ("genesis","Génesis","AT",50),("exodo","Éxodo","AT",40),("levitico","Levítico","AT",27),("numeros","Números","AT",36),("deuteronomio","Deuteronomio","AT",34),
 ("josue","Josué","AT",24),("jueces","Jueces","AT",21),("rut","Rut","AT",4),("1samuel","1 Samuel","AT",31),("2samuel","2 Samuel","AT",24),
 ("1reyes","1 Reyes","AT",22),("2reyes","2 Reyes","AT",25),("1cronicas","1 Crónicas","AT",29),("2cronicas","2 Crónicas","AT",36),("esdras","Esdras","AT",10),
 ("nehemias","Nehemías","AT",13),("ester","Ester","AT",10),("job","Job","AT",42),("salmos","Salmos","AT",150),("proverbios","Proverbios","AT",31),
 ("eclesiastes","Eclesiastés","AT",12),("cantares","Cantares","AT",8),("isaias","Isaías","AT",66),("jeremias","Jeremías","AT",52),("lamentaciones","Lamentaciones","AT",5),
 ("ezequiel","Ezequiel","AT",48),("daniel","Daniel","AT",12),("oseas","Oseas","AT",14),("joel","Joel","AT",3),("amos","Amós","AT",9),
 ("abdias","Abdías","AT",1),("jonas","Jonás","AT",4),("miqueas","Miqueas","AT",7),("nahum","Nahúm","AT",3),("habacuc","Habacuc","AT",3),
 ("sofonias","Sofonías","AT",3),("hageo","Hageo","AT",2),("zacarias","Zacarías","AT",14),("malaquias","Malaquías","AT",4),
 ("mateo","Mateo","NT",28),("marcos","Marcos","NT",16),("lucas","Lucas","NT",24),("juan","Juan","NT",21),("hechos","Hechos","NT",28),
 ("romanos","Romanos","NT",16),("1corintios","1 Corintios","NT",16),("2corintios","2 Corintios","NT",13),("galatas","Gálatas","NT",6),("efesios","Efesios","NT",6),
 ("filipenses","Filipenses","NT",4),("colosenses","Colosenses","NT",4),("1tesalonicenses","1 Tesalonicenses","NT",5),("2tesalonicenses","2 Tesalonicenses","NT",3),
 ("1timoteo","1 Timoteo","NT",6),("2timoteo","2 Timoteo","NT",4),("tito","Tito","NT",3),("filemon","Filemón","NT",1),("hebreos","Hebreos","NT",13),
 ("santiago","Santiago","NT",5),("1pedro","1 Pedro","NT",5),("2pedro","2 Pedro","NT",3),("1juan","1 Juan","NT",5),("2juan","2 Juan","NT",1),
 ("3juan","3 Juan","NT",1),("judas","Judas","NT",1),("apocalipsis","Apocalipsis","NT",22),
]
assert len(CAT) == 66
LIBROS = {"genesis": GENESIS, "exodo": EXODO, "mateo": MATEO, "marcos": MARCOS, "lucas": LUCAS, "juan": JUAN}  # libros publicados en Lumbrera
errores = []
for lid, L in LIBROS.items():
    vistos = set(); citas = 0
    for ui, u in enumerate(L["unidades"]):
        for li, lec in enumerate(u["lecciones"]):
            assert len(lec["preguntas"]) == 10
            for qi, q in enumerate(lec["preguntas"]):
                q["id"] = f"{lid}-{ui+1}-{li+1}-{qi+1}"
                clave = q["q"].lower()
                if clave in vistos: errores.append(f"duplicada: {q['q']}")
                vistos.add(clave)
                if not re.search(r"(Génesis|Éxodo|Mateo|Marcos|Lucas|Juan) \d", q["ref"]): errores.append(f"ref rara: {q['ref']}")
                if q["t"] == "completar": citas += 1
                if q["t"] in ("opcion", "completar") and len({q['ok'], *q['malas']}) != 4: errores.append(f"opciones repetidas: {q['q']}")
                if q["t"] == "emparejar":
                    a = [p[0] for p in q["pares"]]; b = [p[1] for p in q["pares"]]
                    if len(set(a)) < 4 or len(set(b)) < 4: errores.append(f"pares repetidos: {q['q']}")
    tipos = {}
    for u in L["unidades"]:
        for lec in u["lecciones"]:
            for q in lec["preguntas"]: tipos[q["t"]] = tipos.get(q["t"], 0) + 1
    print(f"{L['nombre']}: {L['total']} preguntas · {len(L['unidades'])} unidades · 15 lecciones · tipos {tipos} · completar (citas literales): {citas}")
    json.dump(L, open(f"{SALIDA}/{lid}.json", "w"), ensure_ascii=False, separators=(',', ':'))
print('errores:', errores or 'ninguno')
cat = [{"id": i, "nombre": n, "testamento": t, "capitulos": c, "preguntas": LIBROS[i]["total"]} for i, n, t, c in CAT if i in LIBROS]
json.dump({"libros": cat, "creditos": "Citas: Reina-Valera 1960 © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988."},
          open(f"{SALIDA}/libros.json", "w"), ensure_ascii=False, indent=0)

# Packs para usar los libros en partidas en grupo (solo tipos que encajan en el juego en vivo)
random.seed(7)
for lid, L in LIBROS.items():
    rondas = []
    for ui, u in enumerate(L["unidades"]):
        for li, lec in enumerate(u["lecciones"]):
            pq = []
            for q in lec["preguntas"]:
                if q["t"] in ("opcion", "completar"):
                    ops = [q["ok"], *q["malas"]]; random.shuffle(ops)
                    texto = q["q"].replace("___", "_____")
                    pq.append({"texto": f"{texto} ({q['ref']})", "opciones": ops, "correcta": ops.index(q["ok"]), "tiempo": 20,
                               **({"reflexion": {"cita": q["ref"], "texto": q["exp"]}} if q.get("exp") else {})})
                elif q["t"] == "vf":
                    pq.append({"texto": f"Verdadero o falso: {q['q']} ({q['ref']})", "opciones": ["Verdadero", "Falso"], "correcta": 0 if q["v"] else 1, "tiempo": 15,
                               **({"reflexion": {"cita": q["ref"], "texto": q["exp"]}} if q.get("exp") else {})})
            rondas.append({"titulo": f"{L['nombre']} · Lección {ui*3+li+1} ({u['capitulos']})", "categoria": L["nombre"], "preguntas": pq})
    json.dump({"app": "chispa", "version": 1, "cuestionarios": rondas}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "packs", f"libro-{lid}.json"), "w"), ensure_ascii=False, separators=(',', ':'))
    print(f"pack libro-{lid}: {len(rondas)} rondas, {sum(len(r['preguntas']) for r in rondas)} preguntas para jugar en grupo")
idx = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'packs') + '/indice.json'))
idx = [p for p in idx if not p['archivo'].startswith('libro-')]
for lid, L in LIBROS.items():
    idx.append({"archivo": f"libro-{lid}.json", "titulo": f"📖 {L['nombre']}: 15 rondas para jugar en grupo", "descripcion": f"Las preguntas de la sección Aprender de {L['nombre']}, en rondas de 8–10 para partidas en vivo.", "n": 15, "marcas": ["fe"]})
json.dump(idx, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'packs') + '/indice.json', 'w'), ensure_ascii=False, indent=1)

# Páginas públicas de preguntas con respuestas (SEO/AEO) y datos estructurados de los cursos
import seo
seo.main()
