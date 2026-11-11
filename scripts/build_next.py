#!/usr/bin/env python3
"""Builds the upgraded site from the current one.

    python3 scripts/build_next.py              -> writes next.html (a preview, the live site is untouched)
    python3 scripts/build_next.py --live       -> upgrades index.html itself

The design lives in design/pro.css, design/pro.js and design/shell-dock.html.
This script only puts those pieces in the right places inside the page.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MARK = "<!-- pro-upgrade -->"
live = "--live" in sys.argv
src = (ROOT / "index.html").read_text(encoding="utf8")
if MARK in src:
    sys.exit("index.html is already upgraded - nothing to do.")

def swap(text, old, new, count=1):
    if text.count(old) < 1:
        sys.exit("build_next: could not find this piece of the page:\n  " + old[:90])
    return text.replace(old, new, count)

css = (ROOT / "design/pro.css").read_text(encoding="utf8")
js = (ROOT / "design/pro.js").read_text(encoding="utf8")
dock = (ROOT / "design/shell-dock.html").read_text(encoding="utf8")
html = src

# head: no Google Fonts request any more (the fonts are served from /fonts), theme set before first paint
html = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]+">\n?', "", html)
head = MARK + """
<meta name="color-scheme" content="light dark">
<link rel="preload" href="fonts/assistant-hebrew-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/frank-ruhl-libre-hebrew-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<script>(function(){try{var g=function(k,d){var v=localStorage.getItem("shaked:"+k);return v==null?d:JSON.parse(v)},h=document.documentElement,t=g("theme","auto");
h.dataset.theme=(t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches))?"dark":"light";
var f=g("fs",0);if(f)h.dataset.fs=f;if(g("contrast",false))h.dataset.contrast="high";if(!g("motion",true))h.dataset.motion="off"}catch(e){}})()</script>
"""
html = swap(html, '<link rel="manifest"', head + '<link rel="manifest"')
html = swap(html, 'property="og:image" content="https://shaked-darca.github.io/icons/icon-512.png"',
            'property="og:image" content="https://shaked-darca.github.io/icons/share.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image"')
if not live:
    html = swap(html, '<link rel="canonical"', '<meta name="robots" content="noindex">\n<link rel="canonical"')

# styles: appended to the site's own stylesheet
i = html.index("</style>", html.index('<style id="st">'))
html = html[:i] + css + html[i:]

# shell: skip link, display button in the header, bottom bar for phones, footer line
html = swap(html, '<template id="shell">\n', '<template id="shell">\n<a class="skip" href="#view">דילוג לתוכן</a>\n')
html = swap(html, '<button type="button" class="refresh-btn" id="refreshBtn"',
            '<button type="button" class="refresh-btn" data-pro-open="display" aria-haspopup="dialog" aria-label="תצוגה ונגישות" title="תצוגה ונגישות"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 7a5 5 0 0 0 0 10z" fill="currentColor" stroke="none"/></svg></button>\n    <button type="button" class="refresh-btn" id="refreshBtn"')
html = swap(html, '<div id="view"></div>', '<div id="view" tabindex="-1"></div>')
html = swap(html, '</div></footer>\n</template>',
            '<p class="foot-legal"><span>תיכון שק״ד דרכא עמק המעיינות, רשת דרכא</span><button type="button" data-pro-open="display">תצוגה ונגישות</button></p>\n</div></footer>\n' + dock + '</template>')

# app: today board on the home page, blurred photo backdrop, hooks
html = swap(html, 'return myWeek()+`<div class="home">', 'return todayBoard()+myWeek()+`<div class="home">')
html = swap(html, '<figure class="slide ${k===cur?"on":""}"', '<figure class="slide ${k===cur?"on":""}" style="--ph:url(\'${esc(p.url)}\')"')
html = swap(html, '  renderSig();\n  const V=DATA.vision', '  renderSig(); proSync(t);\n  const V=DATA.vision')
html = swap(html, '\nrender();\n\n/* ---------- light up capabilities', js + '\nrender();\n\n/* ---------- light up capabilities')

out = ROOT / ("index.html" if live else "next.html")
out.write_text(html, encoding="utf8")
print("wrote", out.name, len(html) // 1024, "KB")
