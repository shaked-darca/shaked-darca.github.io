"""Builds draft.html (the design draft) from index.html.

The draft keeps everything the live site does (calendars, שוקדים, bookings, guides)
and changes only how it looks:
  - a quiet white bar with the emblem, name and tabs instead of the big green band
  - the home page opens with a real school photo and the motto in large type
  - a row of shortcuts to what people come for
  - Frank Ruhl Libre for headings and for the שוקדים letter, Assistant for everything else
  - colours from the valley: spring-water teal, palm green, and Darca's brick red
  - the vision as a full-width photo band above the footer
Run from the repo root:  python3 scripts/make_draft.py
"""
import re

s = open("index.html", encoding="utf-8").read()


def rep(old, new, count=1):
    global s
    assert old in s, "missing: " + old[:80]
    s = s.replace(old, new, count)


# ---------- draft markers ----------
rep("<head>", '<head>\n<meta name="robots" content="noindex">')
s = re.sub(r"<title>(.*?)</title>", r"<title>טיוטה · \1</title>", s, count=1)

# ---------- fonts ----------
# the live site now ships Frank Ruhl Libre itself (fonts/); add the Google font only for older pages
if "frank-ruhl-libre" not in s and "family=Noto+Serif+Hebrew:wght@700" in s:
    rep("family=Noto+Serif+Hebrew:wght@700", "family=Noto+Serif+Hebrew:wght@700&family=Frank+Ruhl+Libre:wght@500;700;900")

# ---------- header: one white bar ----------
a = s.index('<header class="top">')
b = s.index("</header>", a) + len("</header>")
old_header = s[a:b]
emblem = re.search(r'<img src="(data:image/[^"]+)" alt="סמל בית ספר שק״ד">', old_header).group(1)
tabs = re.search(r'<nav class="tabs".*?</nav>', old_header, re.S).group(0)
buttons = re.search(r'<button class="edit-link".*?</button>\s*(?:<button type="button" class="refresh-btn bell-btn".*?</button>\s*)?<button type="button" class="refresh-btn" id="refreshBtn".*?</button>', old_header, re.S).group(0)
new_header = f'''<header class="top">
  <div class="draft-bar">טיוטת עיצוב – לא האתר החי. <a href="./">לאתר החי</a></div>
  <div class="navbar"><div class="wrap nav-in">
    <a class="brand" href="#home" aria-label="שק״ד דרכא – דף הבית"><img class="emblem" src="{emblem}" alt=""><span class="brand-text"><b>שק״ד דרכא</b><small>תיכון בעמק המעיינות</small></span></a>
    {tabs}
    <div class="nav-tools">{buttons}</div>
  </div></div>
</header>'''
s = s[:a] + new_header + s[b:]

# ---------- vision: a photo band above the footer (keeps the ids render() fills) ----------
rep('<footer class="foot">',
    '<section class="vband"><div class="wrap"><figure class="vband-q"><figcaption>החזון שלנו</figcaption>'
    '<blockquote id="visionText"></blockquote><cite id="visionBy"></cite></figure></div></section>\n<footer class="foot">')

# ---------- home: photo hero + shortcuts before "השבוע שלי" ----------
HERO_PHOTOS = ["desert", "kinneret", "evening"]
home_js = r'''
/* ---------- draft: home hero and shortcuts ---------- */
const HERO_PH = ["desert","kinneret","evening"];
function homeHero(){
  return `<section class="hh" aria-label="שק״ד דרכא">
    <div class="hero-photos" aria-hidden="true">${HERO_PH.map((p,i)=>`<img src="media/hero/${p}-s.jpg" srcset="media/hero/${p}-s.jpg 900w, media/hero/${p}.jpg 1800w" sizes="(min-width:1100px) 1040px, 100vw" alt="" ${i?'loading="lazy"':'fetchpriority="high"'} class="${i?"":"on"}">`).join("")}</div>
    <div class="hh-text"><p class="hh-name">תיכון שק״ד דרכא, עמק המעיינות</p><p class="hh-motto">בְּכָל דְּרָכֶיךָ דָעֵהוּ</p></div>
  </section>`;
}
function homeDoors(){
  const d=[["#students","לוח השנה","מבחנים, טיולים ואירועים לפי שכבה"],["#shokdim","שוקדים","המכתב השבועי של המנהל"],
           ["https://web.mashov.info/students/login","משו״ב","ציונים, נוכחות והודעות",1],["#staff","הזמנת מחשבים","למורים: ניידים ועגלת אורן"]];
  return `<nav class="doors" aria-label="קיצורים">${d.map(([u,t,x,ext])=>`<a href="${u}"${ext?' target="_blank" rel="noopener"':""}><b>${t}</b><span>${x}</span></a>`).join("")}</nav>`;
}
'''
rep("/* ---------- home ---------- */\nfunction homeView(){", home_js + "\n/* ---------- home ---------- */\nfunction homeView(){")
s, n = re.subn(r'return ((?:todayBoard\(\)\+)?myWeek\(\)\+`<div class="home">)', r'return homeHero()+homeDoors()+\1', s, count=1)
assert n == 1, "missing: home return line"

# ---------- texts ----------
rep('<span class="legend">בחרו את השכבה שלכם, והאתר יזכור אותה</span>', '<span class="legend">באיזו שכבה אתם?</span>')

# ---------- no emoji icons on the links and guides pages ----------
a = s.index("function linksView(){")
b = s.index("/* ---------- render ---------- */", a)
part = s[a:b]
part = re.sub(r'<span(?: class="gi")? aria-hidden="true">[^<]{1,4}</span>', "", part)
part = re.sub("<h4>[\U0001F300-\U0001FAFF☀-➿]️?\\s*", "<h4>", part)
s = s[:a] + part + s[b:]

# ---------- photos change slowly (every 8 s; never when motion is reduced) ----------
JS = """<script>
(function(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  setInterval(()=>{ if(document.hidden) return;
    const im=[...document.querySelectorAll(".hero-photos img")]; if(im.length<2) return;
    const i=Math.max(0,im.findIndex(x=>x.classList.contains("on"))), next=im[(i+1)%im.length];
    if(!next.complete) return; im[i].classList.remove("on"); next.classList.add("on");
  },8000);
})();
</script>
"""
rep("<script>\n/* refresh:", JS + "<script>\n/* refresh:")

# ---------- the new look ----------
CSS = r"""
/* ================= draft design ================= */
:root{
  --bg:#f3f5f1; --surface:#ffffff; --sunk:#e9ece7; --ink:#1b2421; --muted:#5b6862; --line:#d9ded8;
  --water:#1c6e7d; --water-soft:#ddeef0; --palm:#3e6b3a; --palm-soft:#e3ede0;
  --brick:#a12c22; --brick-soft:#f7e6e3;
  --f-display:"Frank Ruhl Libre","Noto Serif Hebrew",serif;
  --r:4px;
}
h1,h2,h3{font-weight:700;letter-spacing:-.005em}
.draft-bar{background:var(--brick);color:#fff;text-align:center;font:600 .82rem/1.3 var(--f-body);padding:5px 12px}
.draft-bar a{color:#fff;margin-inline-start:6px}

/* bar */
.top{background:var(--surface);border-bottom:1px solid var(--line)}
.navbar{background:var(--surface);border:0;position:relative;z-index:15}
.navbar .wrap.nav-in{display:flex;align-items:center;gap:6px 18px;flex-wrap:wrap;min-height:64px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);padding-block:8px}
.navbar .emblem{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);box-shadow:none;object-fit:cover;background:#fff}
.brand-text{display:grid;line-height:1.05}
.brand-text b{font-family:var(--f-display);font-weight:900;font-size:1.35rem}
.brand-text small{color:var(--muted);font-size:.8rem;font-weight:600}
.navbar nav.tabs{flex:1;justify-content:flex-start;gap:2px;align-self:stretch}
.navbar nav.tabs a{display:flex;align-items:center;padding:0 12px;font-size:1rem;color:var(--muted);border-bottom:3px solid transparent;border-top:3px solid transparent}
.navbar nav.tabs a:hover{color:var(--ink)}
nav.tabs a[aria-current="page"]{color:var(--ink);border-bottom-color:var(--brick);font-weight:700}
.nav-tools{display:flex;align-items:center;gap:8px}
.refresh-btn{border-radius:4px}
@media (max-width:760px){
  .navbar .wrap.nav-in{min-height:0;gap:0}
  .brand{flex:1}
  .navbar nav.tabs{order:3;flex:1 0 100%;margin-inline:-6px;border-top:1px solid var(--line)}
  .navbar nav.tabs a{padding:11px 7px;font-size:.92rem}
  .refresh-btn{display:grid!important;width:36px;height:36px}
}

/* home hero */
main.wrap{padding-top:18px}
.hh{position:relative;overflow:hidden;background:#1b2421;color:#fff;height:clamp(240px,40vw,420px);display:flex;align-items:flex-end;margin-bottom:0}
.hh .hero-photos{position:absolute;inset:0}
.hh .hero-photos img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.6s ease}
.hh .hero-photos img.on{opacity:1}
.hh::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(20,28,25,.82),rgba(20,28,25,.25) 45%,rgba(20,28,25,0) 70%);pointer-events:none}
.hh-text{position:relative;z-index:1;padding:0 28px 24px;display:grid;gap:2px}
.hh-name{margin:0;font-weight:700;font-size:.95rem;opacity:.92}
.hh-motto{margin:0;font-family:var(--f-display);font-weight:900;font-size:clamp(2.1rem,6.4vw,4.2rem);line-height:1.1;text-shadow:0 2px 18px rgba(0,0,0,.35)}
@media (max-width:760px){
  main.wrap{padding-top:0}
  .hh{margin-inline:calc(-1 * max(16px, env(safe-area-inset-left,0px)))}
  .hh-text{padding:0 16px 18px}
}
@media (prefers-reduced-motion:reduce){.hh .hero-photos img{transition:none}}

/* shortcuts */
.doors{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:var(--surface);border:1px solid var(--line);border-top:0;margin-bottom:34px}
.doors a{display:grid;gap:2px;align-content:start;padding:14px 18px 16px;text-decoration:none;color:var(--ink);border-inline-start:1px solid var(--line)}
.doors a:first-child{border-inline-start:0}
.doors a b{font-family:var(--f-display);font-weight:700;font-size:1.25rem;color:var(--water)}
.doors a span{color:var(--muted);font-size:.86rem;line-height:1.35}
.doors a:hover b{text-decoration:underline;text-underline-offset:4px}
@media (max-width:760px){
  .doors{grid-template-columns:1fr 1fr;margin-inline:calc(-1 * max(16px, env(safe-area-inset-left,0px)));border-inline:0;margin-bottom:26px}
  .doors a:nth-child(odd){border-inline-start:0}
  .doors a:nth-child(n+3){border-top:1px solid var(--line)}
  .doors a{padding:12px 16px 14px}
}

/* section openings: a heavy rule and a serif heading, no boxes */
.myweek,.issue{background:none;border:0;border-top:3px solid var(--ink);border-radius:0;padding:12px 0 0;box-shadow:none}
.myweek{margin-bottom:34px;gap:14px}
.mw-head h2,.sec-h h2,.issue h2,.masthead h2{font-family:var(--f-display);color:var(--ink)}
.mw-head h2{font-size:1.7rem}
.mw-head .legend{font-size:1rem}
.chip{border-radius:4px;border-color:#c9d0ca;font-weight:700}
.chip:hover{border-color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--ink);color:#fff;border-color:var(--ink)}
.mw-days{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0 22px}
.mw-day{border:0;border-top:1px solid var(--line);border-radius:0;padding:10px 0}
.mw-day.is-today{border:0;border-top:2px solid var(--brick);background:none}
.mw-day.is-today .mw-dn{color:var(--brick)}
.mw-dn{font-family:var(--f-display);font-size:1.05rem}
.mw-count{border-radius:4px}
.home{gap:34px}
.sec-h{border-top:3px solid var(--ink);padding-top:12px}
.sec-h h2{font-size:1.5rem}
.issue{gap:10px}
.issue h2{font-size:clamp(1.7rem,3.4vw,2.3rem)}
.issue .kicker{color:var(--brick);font-weight:800}
.issue .letter{font-family:var(--f-display);font-weight:500;font-size:1.12rem;line-height:1.8}
.slide-stage{border-radius:0;background:var(--ink)}
.read-more{border-radius:4px}
.page-thumb{border-radius:4px}
.slide-ctl .slide-dot[aria-current="true"]{background:var(--ink)}
.news-item{border-radius:0}
.btn{border-radius:4px}
.masthead{border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:18px}
.masthead h2{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:900}
.place,.panel,.lcard,.guide{border-radius:4px}
.cp-item{border-radius:4px}

/* vision band */
.vband{position:relative;margin-top:48px;color:#fff;background:#1b2421 url(media/hero/crater-s.jpg) center 35%/cover}
.vband::before{content:"";position:absolute;inset:0;background:rgba(20,28,25,.72)}
.vband .wrap{position:relative;padding-block:clamp(40px,8vw,84px)}
.vband-q{margin:0;max-width:30ch;display:grid;gap:12px}
.vband-q figcaption{font-weight:700;font-size:.95rem;color:#e9b7b1}
.vband-q blockquote{margin:0;font-family:var(--f-display);font-weight:700;font-size:clamp(1.45rem,3.6vw,2.3rem);line-height:1.3;text-wrap:balance}
.vband-q blockquote::before{content:"״"}.vband-q blockquote::after{content:"״"}
.vband-q cite{font-style:normal;font-weight:600;opacity:.85}
@media (min-width:1100px){.vband{background-image:url(media/hero/crater.jpg)}}

/* footer */
.foot{background:var(--ink);margin-top:0}
.foot-brand b{font-family:var(--f-display);font-weight:900}
"""
i = s.index("</style>", s.index('<style id="st">'))
s = s[:i] + CSS + s[i:]

open("draft.html", "w", encoding="utf-8").write(s)
print("draft.html written,", len(s), "bytes")
