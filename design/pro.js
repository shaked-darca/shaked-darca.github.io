
/* ===================================================================
   תוספות שכבת העיצוב (design/pro.js): לוח היום בעמוד הבית, סרגל תחתון
   בטלפון, וחלון "תצוגה ונגישות". מוטמע על ידי scripts/build_next.py.
   =================================================================== */
/* מספר באותיות: 15 -> ט״ו, 787 -> תשפ״ז */
function gem(n){
  const H=["","ק","ר","ש","ת","תק","תר","תש","תת","תתק"], T=["","י","כ","ל","מ","נ","ס","ע","פ","צ"], U=["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  n=n%1000; let s=H[Math.floor(n/100)]; const r=n%100;
  s+= r===15?"טו": r===16?"טז": T[Math.floor(r/10)]+U[r%10];
  return s.length>1? s.slice(0,-1)+"״"+s.slice(-1) : s+"׳";
}
function hebDate(d){
  try{
    const p=Object.fromEntries(new Intl.DateTimeFormat("he-u-ca-hebrew-nu-latn",{day:"numeric",month:"long",year:"numeric"}).formatToParts(d).map(x=>[x.type,x.value]));
    const day=parseInt(p.day,10), year=parseInt(p.year,10);
    if(!day||!year||!p.month) return "";
    return `${gem(day)} ב${p.month} ${gem(year)}`;
  }catch(e){ return "" }
}
function todayBoard(){
  /* החג או החופשה הבאים בלוח הכללי */
  const t0=iso(today);
  const nx=(DATA.events||[]).filter(e=>e.type==="holiday"&&e.grades.includes("all")&&(e.end||e.date)>=t0).sort((a,b)=>a.date.localeCompare(b.date))[0];
  let next="";
  if(nx){ const diff=Math.round((pd(nx.date)-today)/864e5);
    next=`<p class="tday-next"><b>${esc(nx.title)}</b><span>${diff<=0?"היום":diff===1?"מחר":`בעוד ${diff} ימים`}</span></p>`; }
  const V=DATA.vision||{};
  return `<section class="tday" aria-label="היום">
    <div class="tday-in">
      <div>${next}</div>
      ${V.text?`<figure class="tday-quote"><blockquote>${esc(V.text)}</blockquote>${V.by?`<figcaption>${esc(V.by)}</figcaption>`:""}</figure>`:""}
    </div>
    <svg class="tday-wave" viewBox="0 0 1200 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 16 C150 2 300 30 450 16 S750 2 900 16 S1100 30 1200 14 V30 H0Z" fill="var(--bg)"/></svg>
  </section>`;
}

/* ---- תצוגה ונגישות: נשמר במכשיר הזה בלבד ---- */
const PRO={theme:store.get("theme","auto"),fs:store.get("fs",0),contrast:store.get("contrast",false),motion:store.get("motion",true)};
const darkMq=window.matchMedia?matchMedia("(prefers-color-scheme: dark)"):null;
function proApply(){
  const h=document.documentElement, dark=PRO.theme==="dark"||(PRO.theme==="auto"&&darkMq&&darkMq.matches);
  h.dataset.theme=dark?"dark":"light";
  if(PRO.fs) h.dataset.fs=PRO.fs; else delete h.dataset.fs;
  if(PRO.contrast) h.dataset.contrast="high"; else delete h.dataset.contrast;
  if(PRO.motion) delete h.dataset.motion; else { h.dataset.motion="off"; SL.paused=true; }
  const m=document.querySelector('meta[name="theme-color"]'); if(m) m.content=dark?"#10291f":"#163a32";
}
if(darkMq&&darkMq.addEventListener) darkMq.addEventListener("change",proApply);
proApply();

const ICO={
  me:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  shokdim:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>',
  gallery:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>',
  guides:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5z"/><path d="M12 6v13"/></svg>',
  contacts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>'
};
const MORE=[["me","האזור שלי"],["shokdim","שוקדים"],["gallery","תמונות"],["guides","מדריכים"],["contacts","צור קשר"]];
let sheet=null;
function sheetHtml(){
  const seg=(key,opts,cur)=>`<span class="seg" role="group">${opts.map(([v,l])=>`<button type="button" data-pro-${key}="${v}" aria-pressed="${String(cur)===String(v)}">${l}</button>`).join("")}</span>`;
  const more=sheet.dataset.mode==="more";
  return `<div class="sheet-in">
    <div class="sheet-head"><h2>${more?"עוד":"תצוגה ונגישות"}</h2><button type="button" class="sheet-x" data-pro-close aria-label="סגירה">×</button></div>
    <ul class="sheet-links">${MORE.map(([k,l])=>`<li><a href="#${k}" data-pro-go>${ICO[k]}<span>${l}</span></a></li>`).join("")}</ul>
    <div class="sheet-set">
      ${more?`<h3>תצוגה ונגישות</h3>`:""}
      <div class="set-row"><span>מראה</span>${seg("theme",[["auto","אוטומטי"],["light","בהיר"],["dark","כהה"]],PRO.theme)}</div>
      <div class="set-row"><span>גודל הטקסט</span>${seg("fs",[[0,"רגיל"],[1,"גדול"],[2,"גדול מאוד"]],PRO.fs)}</div>
      <div class="set-row"><span id="lblC">ניגודיות גבוהה</span><button type="button" class="switch" role="switch" aria-labelledby="lblC" aria-checked="${PRO.contrast}" data-pro-toggle="contrast"></button></div>
      <div class="set-row"><span id="lblM">תנועה ואנימציות</span><button type="button" class="switch" role="switch" aria-labelledby="lblM" aria-checked="${PRO.motion}" data-pro-toggle="motion"></button></div>
    </div></div>`;
}
function openSheet(mode){
  if(!sheet){ sheet=document.createElement("dialog"); sheet.className="sheet"; sheet.setAttribute("aria-label","תצוגה ונגישות"); document.body.appendChild(sheet);
    sheet.addEventListener("click",e=>{ if(e.target===sheet) sheet.close() }); }
  sheet.dataset.mode=mode; sheet.innerHTML=sheetHtml();
  if(!sheet.open){ if(sheet.showModal) sheet.showModal(); else sheet.setAttribute("open","") }
}
document.addEventListener("click",e=>{
  const o=e.target.closest("[data-pro-open]"); if(o){ openSheet(o.dataset.proOpen); return }
  if(!sheet||!sheet.contains(e.target)) return;
  const b=e.target.closest("button,a"); if(!b) return; const d=b.dataset;
  if("proClose" in d||"proGo" in d){ sheet.close(); return }
  if(d.proTheme){ PRO.theme=d.proTheme; store.set("theme",PRO.theme) }
  else if(d.proFs!==undefined){ PRO.fs=Number(d.proFs); store.set("fs",PRO.fs) }
  else if(d.proToggle){ PRO[d.proToggle]=!PRO[d.proToggle]; store.set(d.proToggle,PRO[d.proToggle]) }
  else return;
  proApply(); sheet.innerHTML=sheetHtml();
  const again=sheet.querySelector(d.proTheme?`[data-pro-theme="${PRO.theme}"]`:d.proFs!==undefined?`[data-pro-fs="${PRO.fs}"]`:`[data-pro-toggle="${d.proToggle}"]`); if(again) again.focus();
});
/* אחרי כל ציור של העמוד: סימון הלשונית בסרגל התחתון, ובמעבר בין עמודים חזרה לראש הדף */
let proLast=null;
function proSync(t){
  document.body.dataset.tab=t;
  const area=VIEWS[t].area, inMore=MORE.some(([k])=>k===t);
  document.querySelectorAll(".dock [data-dock]").forEach(a=>a.setAttribute("aria-current",(a.dataset.dock==="more"?inMore:(!inMore&&a.dataset.dock===area))?"page":"false"));
  if(proLast!==null&&proLast!==t) window.scrollTo(0,0);
  proLast=t;
}

/* ---- שוקדים כמגזין (מחליף את רשימת החיצים): מכתב פותח, כתבות עם תמונה ותקציר, קריאה במסך מלא ---- */
function issueParts(p){
  const paras=String(p.body||"").split(/\n\s*\n/).filter(Boolean);
  const parts=(p.sections||[]).map(x=>({t:x.t,b:x.b||[],img:x.img||[],links:x.links||[]}));
  if(paras.length) parts.unshift({t:"דבר המנהל",b:paras,img:[],links:[],lead:true});
  return parts;
}
function issueCard(p,mode){
  if(S.editing&&S.editPost===p.id) return issueEditForm(p);
  const parts=issueParts(p), lead=parts[0]&&parts[0].lead?parts[0]:null;
  const stories=parts.map((x,i)=>[x,i]).filter(([x])=>!x.lead);
  /* the big photo: the story named in p.feature, else the first story with a photo that isn't פינת הפירגון */
  const hasImg=([x])=>x.img.length;
  let fi=p.feature?stories.findIndex(([x])=>hasImg([x])&&x.t===p.feature):-1;
  if(fi<0) fi=stories.findIndex(([x])=>hasImg([x])&&!/פירגון/.test(x.t));
  if(fi<0) fi=stories.findIndex(hasImg);
  const feat=fi>=0?stories.splice(fi,1)[0]:null;
  const home=mode==="home", shown=home?stories.slice(0,4):stories, rest=stories.length-shown.length;
  const card=([x,i],big)=>`<button type="button" class="st${big?" feat":""}" data-story="${p.id}:${i}"><span class="st-t"><b>${esc(x.t)}</b><span>${esc((x.b[0]||"").replace(/\s+/g," "))}</span></span>${x.img.length?`<img src="${esc(x.img[0])}" alt="" loading="lazy">`:""}</button>`;
  const fallback=!stories.length&&!feat&&p.toc&&p.toc.length?`<div class="toc"><span class="label">עוד בגיליון</span><ul>${p.toc.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`:"";
  return `<article class="issue mag">
    <header class="issue-head"><span class="kicker">שוקדים על המלאכה</span><span class="meta">${esc(p.heb||"")}${p.heb?", ":""}${fmt(p.date)}</span></header>
    <h2>${esc(p.title)}</h2>
    ${lead?`<div class="mag-lead"><h3>דבר המנהל</h3><p>${esc(lead.b.slice(0,2).join(" "))}</p><button type="button" class="mag-go" data-story="${p.id}:0">להמשך המכתב</button></div>`:""}
    ${feat?card(feat,true):""}
    ${shown.length?`<div class="mag-list${home?"":" all"}">${shown.map(s=>card(s,false)).join("")}</div>`:""}${fallback}
    <div class="row">${home&&rest>0?`<a class="btn" href="#shokdim">עוד ${rest} כתבות בגיליון</a>`:""}${p.pages&&p.pages.length?`<button class="btn ghost" data-issue="${p.id}" data-page="0">הגיליון המקורי</button>`:""}${p.pdf&&S.cap.downloads?`<button class="btn ghost" data-pdf="${p.id}">הורדת PDF</button>`:""}<span class="msg" id="pdfMsg-${p.id}" role="status"></span>${home&&rest<=0?`<a class="btn ghost" href="#shokdim">גיליונות קודמים</a>`:""}${S.editing?`<button class="btn" data-edit-post="${p.id}">עריכת הגיליון</button><button class="btn danger" data-del-post="${p.id}">מחיקה</button>`:""}</div>
  </article>`;
}
let reader=null;
function openStory(pid,i){
  const p=DATA.posts.find(x=>x.id===pid); if(!p) return;
  const parts=issueParts(p), x=parts[i]; if(!x) return;
  if(!reader){ reader=document.createElement("dialog"); reader.className="reader"; document.body.appendChild(reader);
    reader.addEventListener("click",e=>{ if(e.target===reader){reader.close();return}
      const b=e.target.closest("button"); if(!b) return;
      if("rdClose" in b.dataset) reader.close(); else if(b.dataset.rd) openStory(reader.dataset.pid,Number(b.dataset.rd)); }); }
  reader.dataset.pid=pid; reader.setAttribute("aria-label",x.t);
  const prev=parts[i-1], next=parts[i+1];
  reader.innerHTML=`<div class="rd-bar"><span>שוקדים, ${esc(p.title)}</span><button type="button" class="sheet-x" data-rd-close aria-label="סגירה">×</button></div>
    <article class="rd-body" tabindex="-1"><h2>${esc(x.t)}</h2>${x.img[0]?`<img src="${esc(x.img[0])}" alt="">`:""}${x.b.map(paraHtml).join("")}${x.img.slice(1).map(u=>`<img src="${esc(u)}" alt="" loading="lazy">`).join("")}${x.links.length?`<div class="rd-links">${x.links.map(l=>`<a class="btn ghost" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a>`).join("")}</div>`:""}</article>
    <nav class="rd-nav" aria-label="מעבר בין כתבות"><button type="button" ${prev?`data-rd="${i-1}"`:"disabled"}><small>הקודם</small><b>${prev?esc(prev.t):""}</b></button><button type="button" ${next?`data-rd="${i+1}"`:"disabled"}><small>הבא</small><b>${next?esc(next.t):""}</b></button></nav>`;
  if(!reader.open){ if(reader.showModal) reader.showModal(); else reader.setAttribute("open","") }
  const body=reader.querySelector(".rd-body"); body.scrollTop=0; body.focus();
}
document.addEventListener("click",e=>{ const s=e.target.closest("[data-story]"); if(!s) return; const [pid,i]=s.dataset.story.split(":"); openStory(pid,Number(i)); });
