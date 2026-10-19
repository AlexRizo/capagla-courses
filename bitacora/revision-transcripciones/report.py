import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import corr_01,corr_02,corr_03,corr_04,corr_05
log=json.load(open(sys.argv[1]+'/_log.json',encoding='utf-8'))
entries=collections.defaultdict(list)
for x in json.load(open('prisma/data/mapa-videos.json',encoding='utf-8')): entries[x['vimeo_nombre'].lower()].append(x)
def cap(s): s=s.strip().lower(); return s[:1].upper()+s[1:]
def info(name):
    es=entries.get(name.lower())
    if not es: return None
    recetas=[]
    for e in es:
        r=cap(e['leccion'])
        if r not in recetas: recetas.append(r)
    tema=cap(es[0]['tema'] or es[0]['leccion'])
    return ' / '.join(recetas), tema
def title(code):
    v=log.get(code)
    if not v: return code
    i=info(v['name'])
    if not i: return f'{code} · {v["name"]}'
    rec,tema=i
    return f'{code} · {rec} · {tema}' if tema.lower()!=rec.lower() else f'{code} · {tema}'
def label(c): return ' / '.join(title(x.strip()) for x in c.split('/'))
dudas=[d for m in (corr_01,corr_02,corr_03,corr_04,corr_05) for d in m.DUDAS]
cant=[d for d in dudas if 'recetario' in d[1]]; otras=[d for d in dudas if 'recetario' not in d[1]]
tot=collections.Counter(l[4] for v in log.values() for l in v['log'])
L=[]; A=L.append
A('# Revisión de las transcripciones'); A('')
A('Las 52 transcripciones (`.vtt`) venían de una transcripción automática. Se revisaron completas, línea por línea, contra el **recetario PDF** (ingredientes, cantidades, utensilios, glosario y el nombre de la chef) y contra lo que se dice en los demás videos.'); A('')
A('- **Originales:** `bitacora/transcripciones/` (sin tocar).')
A('- **Corregidas:** `prisma/data/transcripciones/` (las que se cargarán a la plataforma).')
A(f'- **Cambios:** {sum(tot.values())} en total ({tot["puntual"]} correcciones puntuales, {tot["regla"]} por regla dentro de un video y {tot["global"]} ortográficas en todo el curso).')
A('- **Lo que NO cambia:** los minutos (marcas de tiempo) y el número de líneas de cada archivo son idénticos a los originales. Solo cambió el texto de 312 de las 2 330 líneas.'); A('')
A('## Criterio'); A('')
A('- Se corrigió solo lo que es **claramente un error de oído** (por ejemplo "no es picada" por "nuez picada") o de ortografía. Cada cambio de ingrediente se comprobó en el recetario.')
A('- **No se cambió ninguna cantidad ni tiempo por cuenta propia.** Cuando el video y el recetario dicen cosas distintas, está en la sección siguiente para que la chef decida.')
A('- Las frases que no se entienden ni por contexto se dejaron como estaban (también abajo).')
A('- El estilo de hablar de la chef (muletillas, frases coloquiales, "nuestro/nuestra") no se tocó.'); A('')
A('## Para la chef: video y recetario no coinciden'); A('')
A('Lo que dice el video y lo que dice el recetario. Alguno puede ser una variación a propósito (por ejemplo, el video prepara media receta) y otros son errores del recetario. **Conviene decidir cuál es el correcto**, porque la IA y las alumnas verán los dos.'); A('')
for c,t in cant: A(f'- **{label(c)}:** {t}')
A(''); A('## Frases que no se entienden'); A('')
for c,t in otras: A(f'- **{label(c) if c!="varios" else "Varios videos"}:** {t}')
A(''); A('## Reglas aplicadas a todo el curso'); A('')
A('| Cambio | Veces |'); A('|---|---|')
gl=collections.Counter(l[3] for v in log.values() for l in v['log'] if l[4]=='global')
for k,n in sorted(gl.items()): A(f'| {k} | {n} |')
A(''); A('## Cambios por video'); A('')
A('Formato: `minuto` · antes → después (motivo). Las correcciones ortográficas de todo el curso (tabla de arriba) no se repiten aquí.'); A('')
def key(l):
    p=l[0].split(':'); return int(p[0])*60+int(p[1])
for code,v in log.items():
    items=[l for l in v['log'] if l[4]!='global']
    if not items: continue
    i=info(v['name'])
    A(f'### {v["name"]}')
    A('_'+(f'{i[0]} · {i[1]}' if i else '(video de la biblioteca anterior, no está en el curso actual)')+'_'); A('')
    for minute,before,after,why,kind in sorted(items,key=key): A(f'- `{minute}` · "{before}" → "{after}" ({why})')
    A('')
open('bitacora/correcciones-transcripciones.md','w',encoding='utf-8').write('\n'.join(L)+'\n')
print('informe listo:',len(L),'líneas')
