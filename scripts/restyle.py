#!/usr/bin/env python3
"""After editing design/pro.css or design/pro.js, run this to put the new version into the live index.html.
It swaps the previously embedded copy (taken from the last git commit) for the edited one."""
import pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf8")
for name in ("design/pro.css", "design/pro.js"):
    old = subprocess.run(["git", "show", "HEAD:" + name], cwd=ROOT, capture_output=True, text=True, encoding="utf8").stdout
    new = (ROOT / name).read_text(encoding="utf8")
    if old == new: continue
    if html.count(old) != 1: sys.exit("restyle: the embedded copy of " + name + " was not found in index.html")
    html = html.replace(old, new); print("updated", name)
(ROOT / "index.html").write_text(html, encoding="utf8")
