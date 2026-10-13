#!/usr/bin/env python3
"""Genera netlify/index.html: un unico file autonomo (librerie, font, filigrana e database inclusi).

Uso:  python3 build.py
Per aggiornare il database esercizi sostituisci data/esercizi.csv e rilancia.
"""
import base64, csv, io, json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
p = lambda *a: os.path.join(ROOT, *a)


def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def fonts_css():
    faces = [
        ('Gelasio', 700, 'normal', 'gelasio-latin-700-normal'),
        ('Gelasio', 700, 'italic', 'gelasio-latin-700-italic'),
        ('Carlito', 400, 'normal', 'carlito-latin-400-normal'),
        ('Carlito', 400, 'italic', 'carlito-latin-400-italic'),
        ('Carlito', 700, 'normal', 'carlito-latin-700-normal'),
        ('Carlito', 700, 'italic', 'carlito-latin-700-italic'),
    ]
    return '\n'.join(
        "@font-face{font-family:'%s';font-weight:%d;font-style:%s;font-display:swap;"
        "src:url(data:font/woff2;base64,%s) format('woff2')}" % (fam, w, st, b64(p('assets', 'fonts', f + '.woff2')))
        for fam, w, st, f in faces)


def database():
    with open(p('data', 'esercizi.csv'), encoding='utf-8-sig') as f:
        rows = list(csv.reader(f))
    out = []
    for r in rows:
        if not r or not r[0].strip():
            continue
        name, link = r[0].strip(), (r[1].strip() if len(r) > 1 else '')
        if name.lower().startswith('nome') and 'link' in link.lower():
            continue
        out.append([name, link])
    return out


def lib(name):
    with open(p('assets', 'lib', name), encoding='utf-8') as f:
        return f.read().replace('</script', '<\\/script')


def main():
    with open(p('src', 'index.html'), encoding='utf-8') as f:
        html = f.read()
    db = database()
    repl = {
        '/*__FONTS_CSS__*/': fonts_css(),
        '/*__LIB_HTML2CANVAS__*/': lib('html2canvas.min.js'),
        '/*__LIB_JSPDF__*/': lib('jspdf.umd.min.js'),
        '/*__DB__*/[]': json.dumps(db, ensure_ascii=False),
        '__WATERMARK__': 'data:image/png;base64,' + b64(p('assets', 'watermark.png')),
    }
    for k, v in repl.items():
        assert html.count(k) == 1, k
        html = html.replace(k, v)
    os.makedirs(p('netlify'), exist_ok=True)
    with open(p('netlify', 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    print('netlify/index.html: %d KB, %d esercizi' % (len(html.encode()) // 1024, len(db)))


if __name__ == '__main__':
    main()
