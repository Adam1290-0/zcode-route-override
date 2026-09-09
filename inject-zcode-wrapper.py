#!/usr/bin/env python3
"""Inject the route-override wrapper require into zcode.cjs (idempotent, binary-safe).

Usage: python inject-zcode-wrapper.py [zcode.cjs path] [wrapper.js path]
Defaults: H:/Zcode/resources/glm/zcode.cjs, <repo>/wrapper.js

The injected line is try/catch-wrapped: if wrapper.js is missing or broken,
zcode.cjs still boots normally (worst case = feature silently off).
"""
import sys, shutil
from pathlib import Path

MARKER = b"/*zro*/"
ANCHOR = b'"use strict";'

def main() -> int:
    # forward slashes only: avoid backslash-escape corruption in defaults
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("H:/Zcode/resources/glm/zcode.cjs")
    wrapper = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent / "wrapper.js"
    if not target.exists():
        print(f"[ERROR] not found: {target}"); return 1
    if not wrapper.exists():
        print(f"[ERROR] wrapper missing: {wrapper}"); return 1
    wrapper_uri = str(wrapper.resolve().as_posix())
    require_line = b'try{require("' + wrapper_uri.encode() + b'")}catch(e){}/*zro*/'
    data = target.read_bytes()

    if require_line in data:
        print("[OK] already injected (safe form), skip"); return 0
    if MARKER in data:
        print("[WARN] a /*zro*/ injection with unknown form exists; abort to avoid stacking."); return 1

    idx = data.find(ANCHOR)
    if idx < 0 or idx > 500:
        print("[ERROR] 'use strict' anchor not found near head"); return 1
    backup = Path(str(target) + ".robak")
    if backup.exists() and backup.stat().st_size != target.stat().st_size:
        # app updated since last patch: refresh backup so uninstall can never
        # roll back to an outdated binary
        shutil.copy2(target, backup)
        print(f"[i] zcode.cjs changed (app updated) -> backup refreshed")
    if not backup.exists():
        shutil.copy2(target, backup)
        print(f"[1/2] backup -> {backup.name}")
    insert_at = idx + len(ANCHOR)
    target.write_bytes(data[:insert_at] + require_line + data[insert_at:])
    print("[2/2] injected require after 'use strict'")
    return 0

if __name__ == "__main__":
    sys.exit(main())
