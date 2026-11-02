"""Builds draft.html (the design draft) from index.html.

The draft is the live site plus a new look: a real school photo at the top,
Darca's brick red as an accent, calmer shapes and shorter texts.
Run from the repo root:  python3 scripts/make_draft.py
"""
import re

s = open("index.html", encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    assert old in s, "missing: " + old[:70]
    s = s.replace(old, new, count)


# --- draft markers: not indexed, banner on top, title ---
rep("<head>", '<head>\n<meta name="robots" content="noindex">')
s = re.sub(r"<title>(.*?)</title>", r"<title>טיוטה · \1</title>", s, count=1)

# --- photos in the header ---
PHOTOS = ["desert", "crater", "kinneret", "evening"]
imgs = "".join(
    f'<img src="media/hero/{p}-s.jpg" srcset="media/hero/{p}-s.jpg 900w, media/hero/{p}.jpg 1800w" '
    f'sizes="100vw" alt="" {"fetchpriority=\"high\"" if i == 0 else "loading=\"lazy\""} class="{"on" if i == 0 else ""}">'
    for i, p in enumerate(PHOTOS)
)
rep('<header class="top">\n  <div class="hero">',
    '<header class="top">\n  <div class="draft-bar">טיוטת עיצוב – לא האתר החי. <a href="./">לאתר החי</a></div>\n'
    f'  <div class="hero">\n    <div class="hero-photos" aria-hidden="true">{imgs}</div>')

CSS = """
/* ===== draft design: real photo, Darca brick accent, calmer shapes ===== */
:root{--brick:#a12c22;--brick-soft:#f6e7e4}
.draft-bar{background:var(--brick);color:#fff;text-align:center;font:600 .85rem/1.3 var(--f-body);padding:6px 12px calc(6px + 0px)}
.draft-bar a{color:#fff;margin-inline-start:6px}
.hero{background:#163a32;min-height:clamp(300px,46vw,460px);display:flex;flex-direction:column;justify-content:flex-end}
.hero::before{display:none}
.hero-photos{position:absolute;inset:0}
.hero-photos img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.6s ease}
.hero-photos img.on{opacity:1}
.hero::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(to top,rgba(14,38,32,.92) 0%,rgba(14,38,32,.55) 38%,rgba(14,38,32,0) 70%),
             linear-gradient(to bottom,rgba(14,38,32,.35),rgba(14,38,32,0) 22%)}
.hero-in{z-index:1;align-items:end;padding-block:24px 22px}
.waves{display:none}
.emblem{border-color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.brand h1{text-shadow:0 1px 12px rgba(0,0,0,.35)}
.vision{border-inline-start:2px solid var(--brick)}
.vision blockquote{text-shadow:0 1px 8px rgba(0,0,0,.4)}
.vision cite{color:#fff;opacity:.85}
.navbar{border-top:3px solid var(--brick)}
nav.tabs a[aria-current="page"]{border-bottom-color:var(--brick)}
.kicker{color:var(--brick)}
.chip{border-radius:8px}
.chip[aria-pressed="true"]{border-color:var(--palm)}
@media (max-width:700px){
  .hero{min-height:0}
  .hero-photos{position:relative;inset:auto;height:clamp(210px,62vw,300px)}
  .hero::after{background:linear-gradient(to bottom,rgba(14,38,32,.25),rgba(14,38,32,0) 30%)}
  .hero-photos::after{content:"";position:absolute;inset:auto 0 0 0;height:45%;background:linear-gradient(to top,#163a32,rgba(22,58,50,0))}
  .hero-in{grid-template-columns:1fr;margin-top:-64px;padding-block:0 18px}
  .brand{position:relative}
  .vision{justify-self:stretch;max-width:none;padding:4px 12px 2px;border-inline-start-width:3px}
  .vision-label{display:block}
  .vision blockquote{font-size:.95rem;text-shadow:none}
  .vision cite{font-size:.8rem}
}
@media (prefers-reduced-motion:reduce){.hero-photos img{transition:none}}
"""
i = s.index("</style>", s.index('<style id="st">'))
s = s[:i] + CSS + s[i:]

# --- slow change of photos (one every 8 seconds, not when motion is reduced) ---
JS = """<script>
(function(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let i=0;
  setInterval(()=>{const im=document.querySelectorAll(".hero-photos img"); if(im.length<2||document.hidden) return;
    const next=im[(i+1)%im.length]; if(!next.complete) return;
    im[i].classList.remove("on"); i=(i+1)%im.length; next.classList.add("on")},8000);
})();
</script>
"""
rep("<script>\n/* refresh:", JS + "<script>\n/* refresh:")

# --- shorter texts in the school's voice ---
rep('<span class="legend">בחרו את השכבה שלכם, והאתר יזכור אותה</span>', '<span class="legend">באיזו שכבה אתם?</span>')

open("draft.html", "w", encoding="utf-8").write(s)
print("draft.html written,", len(s), "bytes")
