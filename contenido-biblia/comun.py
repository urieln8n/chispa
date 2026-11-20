# Ayudas para escribir los libros de Lumbrera · Aprender
# Tipos: opcion, vf, completar, ordenar, emparejar. Cada pregunta lleva su referencia bíblica.
def O(q, ok, malas, ref, exp=''):
    assert len(malas) == 3 and ok not in malas, q
    return {"t": "opcion", "q": q, "ok": ok, "malas": malas, "ref": ref, **({"exp": exp} if exp else {})}

def VF(q, v, ref, exp=''):
    return {"t": "vf", "q": q, "v": bool(v), "ref": ref, **({"exp": exp} if exp else {})}

def C(q, ok, malas, ref, exp=''):
    assert '___' in q and len(malas) == 3 and ok not in malas, q
    return {"t": "completar", "q": q, "ok": ok, "malas": malas, "ref": ref, **({"exp": exp} if exp else {})}

def ORD(q, orden, ref, exp=''):
    assert len(orden) == 4, q
    return {"t": "ordenar", "q": q, "orden": orden, "ref": ref, **({"exp": exp} if exp else {})}

def EMP(q, pares, ref, exp=''):
    assert len(pares) == 4, q
    return {"t": "emparejar", "q": q, "pares": [list(p) for p in pares], "ref": ref, **({"exp": exp} if exp else {})}

def libro(id, nombre, testamento, capitulos, unidades):
    out = {"id": id, "nombre": nombre, "testamento": testamento, "capitulos": capitulos, "unidades": []}
    total = 0
    for titulo, caps, preguntas in unidades:
        assert len(preguntas) == 30, (titulo, len(preguntas))
        out["unidades"].append({"titulo": titulo, "capitulos": caps,
                                "lecciones": [{"preguntas": preguntas[i:i + 10]} for i in range(0, 30, 10)]})
        total += len(preguntas)
    out["total"] = total
    return out
