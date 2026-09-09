#!/usr/bin/env python3
"""Inject the route-override settings UI script into an extracted ZCode asar tree.

Usage: python inject-route-override-ui.py <extracted_out_dir> <ui_route_override.js> [token_file]

The token file is created on first run (random 32-byte hex). The same token must
exist next to wrapper.js (auth-token); the wrapper rejects config-server requests
without it. Embedding the token inside the asar-rendered script keeps random
webpages (even file:// with Origin:null) from writing your route config.
"""
import sys, secrets
from pathlib import Path

RENDERER_MARKER = '<script id="zcode-route-override-ui">'

def read_raw(p: Path) -> str:
    with open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()

def write_raw(p: Path, s: str) -> None:
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)

def load_token(token_file: Path) -> str:
    if token_file.exists():
        t = token_file.read_text(encoding="utf-8").strip()
        if t:
            return t
    t = secrets.token_hex(32)
    token_file.write_text(t, encoding="utf-8")
    print(f"[i] generated auth token -> {token_file.name}")
    return t

def main() -> int:
    if len(sys.argv) not in (3, 4):
        print("[ERROR] usage: inject-route-override-ui.py <extracted_out_dir> <ui_js> [token_file]")
        return 1
    out_dir = Path(sys.argv[1])
    ui_js = Path(sys.argv[2])
    token_file = Path(sys.argv[3]) if len(sys.argv) == 4 else None
    if not out_dir.exists() or not ui_js.exists():
        print(f"[ERROR] missing {out_dir} or {ui_js}")
        return 1
    token = load_token(token_file) if token_file else ""

    html_path = out_dir / "renderer" / "index.html"
    if not html_path.exists():
        print("[ERROR] renderer/index.html not found")
        return 1

    html = read_raw(html_path)
    js = read_raw(ui_js)
    prologue = 'var ZRO_TOKEN=' + repr(token) + ';\n' if token else ""
    tag = RENDERER_MARKER + "\n" + prologue + js + "\n</script>"

    idx = html.find(RENDERER_MARKER)
    if idx >= 0:
        end = html.find("</script>", idx)
        if end < 0:
            print("[ERROR] marker without closing script tag, abort")
            return 1
        html = html[:idx] + tag + html[end + len("</script>"):]
        print("[OK] renderer script updated (replaced previous block)")
    else:
        if "</body>" not in html:
            print("[ERROR] </body> not found")
            return 1
        html = html.replace("</body>", tag + "\n</body>", 1)
        print("[OK] renderer script injected")

    write_raw(html_path, html)
    return 0

if __name__ == "__main__":
    sys.exit(main())
