import re

with open('index.html', 'r') as f:
    html = f.read()

# Replace touch events with pointer events to support both mouse and touch
html = html.replace("addEventListener('touchstart'", "addEventListener('pointerdown'")
html = html.replace("addEventListener('touchmove'", "addEventListener('pointermove'")
html = html.replace("addEventListener('touchend'", "addEventListener('pointerup'")
html = html.replace("addEventListener('touchcancel'", "addEventListener('pointercancel'")

# Fix pointer events touch extraction
html = html.replace("const touch = e.touches ? e.touches[0] : e;", "const touch = (e.touches && e.touches.length > 0) ? e.touches[0] : e;")

with open('index.html', 'w') as f:
    f.write(html)
