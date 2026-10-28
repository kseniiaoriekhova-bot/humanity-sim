"""Збирає симуляцію в один HTML-файл (dist/index.html).
Запуск: python3 build.py              -> dist/index.html (локально і для Cloudflare)
        python3 build.py --fragment OUT -> без <html>/<head>/<body> (для артефакту Claude)"""
import re, sys, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
              lambda m: '<style>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '\n</style>', html)
html = re.sub(r'<script src="(js/[^"]+)"></script>',
              lambda m: '<script>\n' + (root / m.group(1)).read_text(encoding='utf-8') + '\n</script>', html)
if '--fragment' in sys.argv:
    out = pathlib.Path(sys.argv[sys.argv.index('--fragment') + 1])
    frag = re.sub(r'<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*', '', html)
    frag = frag.replace('<meta charset="utf-8">\n', '').replace('<meta name="viewport" content="width=device-width, initial-scale=1">\n', '')
    out.write_text(frag, encoding='utf-8')
else:
    (root / 'dist').mkdir(exist_ok=True)
    (root / 'dist' / 'index.html').write_text(html, encoding='utf-8')
print('ok')
