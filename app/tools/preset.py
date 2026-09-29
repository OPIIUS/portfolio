"""Build one business's own copy of the app: web/index.html + presets/<name>/preset.js
(with its photos inlined as data URIs) -> <name>/index.html.  Usage: python3 tools/preset.py realdrive"""
import base64, os, re, sys

name = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pdir = os.path.join(root, 'presets', name)

def photo(m):
    with open(os.path.join(pdir, m.group(1)), 'rb') as f:
        return 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode()

preset = re.sub(r'@@photo:([\w.-]+)@@', photo, open(os.path.join(pdir, 'preset.js')).read())
page = open(os.path.join(root, 'web', 'index.html')).read()
marker = '<script>\n/* ====='
assert page.count(marker) == 1, 'main script marker not found'
page = page.replace(marker, '<script>\n' + preset + '</script>\n' + marker)
os.makedirs(os.path.join(root, name), exist_ok=True)
with open(os.path.join(root, name, 'index.html'), 'w') as f:
    f.write(page)
print('wrote', os.path.join(name, 'index.html'), len(page) // 1024, 'KB')
