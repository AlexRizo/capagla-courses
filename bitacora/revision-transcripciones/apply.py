import glob, os, re, sys, json, collections
sys.path.insert(0, os.path.dirname(__file__))
import corr_01, corr_02, corr_03, corr_04, corr_05

SRC = 'bitacora/transcripciones'
OUT = sys.argv[1] if len(sys.argv) > 1 else None   # sin carpeta de salida: solo comprueba (modo seco)

def code_of(name):
    m = re.match(r'([0-9]{2}-[0-9]{2}(?:[-_][0-9]{2})?|00-INTRO(?:-AD)?)', name)
    return m.group(1).replace('_', '.')

TS = re.compile(r'(?m)^((?:\d+:)?\d+:\d+)[.,]\d+\s+-->')
def minute_at(text, pos):
    last = None
    for m in TS.finditer(text, 0, pos):
        last = m.group(1)
    if not last: return '0:00'
    p = last.split(':')
    mm = int(p[-2]) + (60 * int(p[-3]) if len(p) == 3 else 0)
    return f'{mm}:{int(p[-1]):02d}'

files = {}
for f in sorted(glob.glob(f'{SRC}/*.vtt')):
    name = os.path.basename(f)[:-4]
    files[code_of(name)] = {'name': name, 'path': f, 'text': open(f, encoding='utf-8').read().replace('\r\n', '\n'), 'log': []}

SPECIFIC = corr_01.C + corr_02.C + corr_03.C + corr_04.C + corr_05.C
errors = []

def flex(old):
    return r'\s+'.join(re.escape(w) for w in old.split())

# 1) Correcciones puntuales: cada una debe caer EXACTAMENTE una vez.
for code, old, new, why in SPECIFIC:
    if code not in files:
        errors.append(f'{code}: no existe ese archivo'); continue
    f = files[code]
    ms = list(re.finditer(flex(old), f['text']))
    if len(ms) != 1:
        errors.append(f'{code}: "{old}" → {len(ms)} coincidencias (se esperaba 1)'); continue
    m = ms[0]
    f['log'].append((minute_at(f['text'], m.start()), re.sub(r'\s+', ' ', m.group(0)), new, why, 'puntual'))
    f['text'] = f['text'][:m.start()] + new + f['text'][m.end():]

# 2) Reglas por archivo.
for code, rx, new, label in corr_04.FILE_RULES:
    f = files[code]
    def sub(m, f=f, new=new):
        f['log'].append((minute_at(f['text'], m.start()), m.group(0), new, label, 'regla'))
        return new
    # se anotan con el minuto del texto actual; el reemplazo se hace en una sola pasada
    pos = [(m.start(), m.group(0)) for m in re.finditer(rx, f['text'])]
    for p, g in pos: f['log'].append((minute_at(f['text'], p), g, new, label, 'regla'))
    f['text'] = re.sub(rx, new, f['text'])

# 3) Reglas globales (ortografía y términos que se repiten en todo el curso).
def keep_case(prefix_map):
    return lambda m: prefix_map(m)
GLOBAL = [
 (r'\bgrajea(s?)\b',  lambda m: 'gragea' + m.group(1), 'grajea → gragea'),
 (r'\bGrajea(s?)\b',  lambda m: 'Gragea' + m.group(1), 'grajea → gragea'),
 (r'\bgrajeit(as?)\b', lambda m: 'grageit' + m.group(1), 'grajeitas → grageitas'),
 (r'\bgrejitas\b',    lambda m: 'grageitas', 'grejitas → grageitas'),
 (r'\bdulla(s?)\b',   lambda m: 'duya' + m.group(1), 'dulla → duya'),
 (r'\bDulla(s?)\b',   lambda m: 'Duya' + m.group(1), 'dulla → duya'),
 (r'\bchantillier\b', lambda m: 'chantilly', 'chantillier → chantilly'),
 (r'\bvet[uúoó]n\b',   lambda m: 'betún', 'vetún / vetón → betún'),
 (r'\bbet[oó]n\b',    lambda m: 'betún', 'betón → betún'),
 (r'\bcapasillos\b',  lambda m: 'capacillos', 'capasillos → capacillos'),
 (r'\bchocobainilla(s?)\b', lambda m: 'chocovainilla' + m.group(1), 'chocobainilla → chocovainilla'),
 (r'\bboat\b',        lambda m: 'bowl', 'boat → bowl'),
 (r'\bLaunch Box\b',  lambda m: 'Lunch Box', 'launch box → lunch box'),
 (r'\blaunch box\b',  lambda m: 'lunch box', 'launch box → lunch box'),
 (r'\bde lactosada\b', lambda m: 'deslactosada', 'de lactosada → deslactosada'),
 (r'\bEncapagla\b',   lambda m: 'En Capagla', 'Encapagla → En Capagla'),
 (r'\baliz(ar|ada|ado|amos)\b', lambda m: 'alis' + m.group(1), 'alizar → alisar'),
 (r'\bgengibre\b',    lambda m: 'jengibre', 'gengibre → jengibre'),
 (r'\bGengibre\b',    lambda m: 'Jengibre', 'gengibre → jengibre'),
 (r'\bgingibre\b',    lambda m: 'jengibre', 'gingibre → jengibre'),
 (r'\bgingive\b',     lambda m: 'jengibre', 'gingive → jengibre'),
 (r'\bpapel fil\b',   lambda m: 'papel film', 'papel fil → papel film'),
 (r'\bm[ao]scavado\b', lambda m: 'mascabado', 'mascavado / moscavado → mascabado'),
 (r'\bsernid(as?|os?)\b', lambda m: 'cernid' + m.group(1), 'sernida → cernida'),
]
glob_counts = collections.Counter()
for code, f in files.items():
    for rx, fn, label in GLOBAL:
        def sub(m, f=f, fn=fn, label=label):
            new = fn(m)
            f['log'].append((minute_at(f['text'], m.start()), m.group(0), new, label, 'global'))
            glob_counts[label] += 1
            return new
        # el minuto se calcula sobre el texto antes de este reemplazo
        out, last = [], 0
        for m in re.finditer(rx, f['text']):
            new = fn(m)
            f['log'].append((minute_at(f['text'], m.start()), m.group(0), new, label, 'global'))
            glob_counts[label] += 1
            out.append(f['text'][last:m.start()]); out.append(new); last = m.end()
        out.append(f['text'][last:]); f['text'] = ''.join(out)

print(f'archivos: {len(files)} | correcciones puntuales pedidas: {len(SPECIFIC)} | reglas por archivo: {len(corr_04.FILE_RULES)}')
if errors:
    print('\nERRORES (no se escribió nada):')
    for e in errors: print('  -', e)
    sys.exit(1)
tot = collections.Counter(l[4] for f in files.values() for l in f['log'])
print('cambios aplicados:', dict(tot), '| total', sum(tot.values()))
print('reglas globales:', {k: v for k, v in sorted(glob_counts.items())})

if OUT:
    os.makedirs(OUT, exist_ok=True)
    for code, f in files.items():
        open(f'{OUT}/{f["name"]}.vtt', 'w', encoding='utf-8').write(f['text'])
    json.dump({c: {'name': f['name'], 'log': f['log']} for c, f in files.items()}, open(f'{OUT}/_log.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('escrito en', OUT)
