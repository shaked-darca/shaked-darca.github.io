/**
 * יומני שק"ד דרכא → האתר
 *
 * סקריפט קטן שרץ בחשבון ה-Google של בית הספר. הוא קורא את יומני בית הספר
 * והשכבות, ממיין כל אירוע (לאיזו שכבה, האם הוא של הצוות, מבחן/טיול/חופשה),
 * ומחזיר לאתר רשימה מוכנה בפורמט JSON.
 *
 * הקמה (פעם אחת):
 *   1. script.google.com ← פרויקט חדש ← להדביק את כל הקובץ הזה במקום מה שיש.
 *   2. לבחור למעלה את הפונקציה setup וללחוץ "הפעלה" (Run). לאשר את ההרשאות.
 *   3. פריסה (Deploy) ← פריסה חדשה ← סוג: אפליקציית אינטרנט (Web app)
 *        הפעלה בתור: אני   |   מי יכול לגשת: כל אחד (Anyone)
 *   4. להעתיק את כתובת ה-Web app (מסתיימת ב-/exec) ולשלוח אותה.
 *
 * עדכון הקוד (כמו עכשיו):
 *   1. להדביק את כל הקובץ במקום הקוד הישן ולשמור.
 *   2. להריץ שוב את setup ולאשר את ההרשאה החדשה (קריאת גיליונות).
 *   3. פריסה ← ניהול פריסות ← עריכה (עיפרון) ← גרסה: "גרסה חדשה" ← פריסה.
 *      הכתובת נשארת אותה כתובת.
 *
 * הסקריפט גם קורא את טבלת הזמנת המחשבים (‎/exec?what=computers), ומקבל הזמנות מהאתר:
 * כותב כל הזמנה בזוג העמודות הפנוי הראשון, ומפתח עגלת אורן בעמודות שלו.
 */

const TZ = "Asia/Jerusalem";

const CALS = {
  "school": "c_classroom654c05dc@group.calendar.google.com",
  "זחבנים": "c_1ab311a0ce5af90942e92705395c8e691e0487d77aa7b04b100e6ac1784bd89c@group.calendar.google.com",
  "זחבנות": "c_4c29255ffa835f2de6b601ebadf5e0776dd3c02ef088362aefa1d9a7a312582b@group.calendar.google.com",
  "ט": "c_0667df03d8fe8b986641f31c7fd3efc2ecaaf2bf8dc4119cedf60fb9e9683dcf@group.calendar.google.com",
  "י": "c_5f99702a099537f8902a3319bfff6379931e4025d9955cf9c68f2b91bae93f1a@group.calendar.google.com",
  "יא": "c_ba7fff33dbc65a400ff9c8ef75eb4b1c6200c7cb39c71f97673b5212e6c0f62e@group.calendar.google.com",
  "יב": "c_25d34f2a16f3fb478a4857886c79d908720dc5b7dc24b89b0805457b441f5bb9@group.calendar.google.com",
  "holidays": "iw.judaism#holiday@group.v.calendar.google.com"
};

const HEB = {"Rosh Hashana Eve":"ערב ראש השנה","Rosh Hashana":"ראש השנה","Gedaliah Fast":"צום גדליה",
  "Yom Kippur Eve":"ערב יום כיפור","Yom Kippur":"יום כיפור","Sukkot Eve":"ערב סוכות","Sukkot":"סוכות",
  "Hoshanah Rabah":null,"Shemini Atzeret":"שמיני עצרת / שמחת תורה","Simchat Torah":null,"Sigd":"סיגד",
  "Hanukkah":"חנוכה","Asarah B'Tevet":"עשרה בטבת","Tu Bishvat":"ט״ו בשבט","Fast of Esther":"תענית אסתר",
  "Purim Eve":"ערב פורים","Purim":"פורים","Shushan Purim":"שושן פורים","Passover Eve":"ערב פסח",
  "Passover":"פסח","Yom HaShoah":"יום השואה","Yom HaZikaron":"יום הזיכרון","Yom HaAtzmaut":"יום העצמאות",
  "Lag BaOmer":"ל״ג בעומר","Jerusalem Day":"יום ירושלים","Memorial Day for Ethiopian Jews":null,
  "Shavuot Eve":"ערב שבועות","Shavuot":"שבועות","17th of Tammuz":"י״ז בתמוז","Tisha B'Av Eve":"ערב תשעה באב",
  "Tisha B'Av":"תשעה באב","Pesach Sheni":null,"Tu B'Av":"ט״ו באב","Yom Kippur Katan":null};

const G9 = ["ט", "י", "יא", "יב"];
const CACHE_KEY = "events-v1";
const CACHE_SECONDS = 15 * 60;

/* טבלת הזמנת המחשבים של אחראי המחשבים (הסקריפט קורא ממנה, וכותב רק הזמנות שנעשו באתר) */
const COMPUTERS_SHEET = "1G5HX87_mRlXUQucfQqe5XjRH5_ISvXze1W08eeYrdRw";
const COMPUTERS_DAYS = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'"];
const COMPUTERS_KEY = "computers-v1";
const COMPUTERS_SECONDS = 2 * 60;
// מספרי העמודות (A=0): זוגות רגילים B..AA, מפתח עגלת אורן AB:AC, CRT5 AD:AE (האתר לא כותב ל-CRT5)
const COMP_FIRST = 1, COMP_LAST = 25, CART_COL = 27, CRT5_COL = 29;
const SITE_NOTE = "הוזמן מהאתר";

/* ---------- web app ---------- */

// ‎/exec            → אירועי היומנים
// ‎/exec?what=computers → הזמנות המחשבים של השבוע
function doGet(e) {
  const what = e && e.parameter && e.parameter.what;
  let body;
  if (what === "computers") {
    body = CacheService.getScriptCache().get(COMPUTERS_KEY);
    if (!body) {
      try { body = buildComputers_(); }
      catch (err) { body = JSON.stringify({ ok: false, error: String(err && err.message || err) }); }
    }
  } else {
    body = readCache_();
    if (!body) {
      try { body = build_(); }
      catch (err) { body = JSON.stringify({ ok: false, error: String(err && err.message || err) }); }
    }
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/** להפעיל פעם אחת (ושוב אחרי כל עדכון של הקוד): מאשר הרשאות, נרשם ליומנים ומתזמן רענון כל 10 דקות. */
function setup() {
  Object.keys(CALS).forEach(k => getCal_(CALS[k]));
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === "refresh") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("refresh").timeBased().everyMinutes(10).create();
  const out = JSON.parse(build_());
  Logger.log("מוכן: " + out.events.length + " אירועים");
  try {
    const c = JSON.parse(buildComputers_());
    Logger.log("טבלת המחשבים: " + c.days.length + " ימים, " +
      c.days.reduce((n, d) => n + d.lessons.reduce((m, l) => m + l.bookings.length, 0), 0) + " הזמנות");
  } catch (err) {
    Logger.log("אין גישה לטבלת המחשבים. צריך לשתף אותה עם החשבון הזה, עם הרשאת עריכה. " + err);
  }
}

/** רץ אוטומטית כל 10 דקות, כדי שהאתר תמיד יקבל תשובה מהירה ועדכנית. */
function refresh() { build_(); }

/* ---------- building the list ---------- */

function build_() {
  const now = new Date();
  const y = Number(fmt_(now, "yyyy")), m = Number(fmt_(now, "M"));
  const year = m >= 8 ? y : y - 1;
  const start = new Date(year, 7, 25), end = new Date(year + 1, 8, 1);

  let raw = [];
  Object.keys(CALS).forEach(grade => {
    const cal = getCal_(CALS[grade]);
    if (!cal) throw new Error("אין גישה ליומן: " + grade);
    cal.getEvents(start, end).forEach(ev => {
      let t = String(ev.getTitle() || "").replace(/\s+/g, " ").trim();
      if (!t) return;
      let s, last;
      if (ev.isAllDayEvent()) {
        s = day_(ev.getAllDayStartDate());
        const e = new Date(ev.getAllDayEndDate().getTime() - 86400000);
        last = day_(e) > s ? day_(e) : s;
      } else {
        s = last = day_(ev.getStartTime());
      }
      let desc = String(ev.getDescription() || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
      if (grade === "holidays") { t = heb_(t); if (!t) return; }
      if (grade !== "school" && grade !== "holidays") t = t.replace(/^(יא|יב|י|ט)\s*-\s+/, "");
      raw.push({ grade, s, last, t, desc });
    });
  });

  // join consecutive holiday days with the same name into one range
  const hol = raw.filter(r => r.grade === "holidays").sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : a.s < b.s ? -1 : 1);
  raw = raw.filter(r => r.grade !== "holidays");
  hol.forEach(r => {
    const p = raw[raw.length - 1];
    if (p && p.grade === "holidays" && p.t === r.t && nextDay_(p.last) === r.s) p.last = r.last;
    else raw.push(Object.assign({}, r));
  });

  const merged = {};
  raw.forEach(r => {
    let gs = r.grade === "school" ? schoolGrades_(r.t) : (r.grade === "holidays" ? ["all"] : [r.grade]);
    if (/מופ"?ד/.test(r.t)) gs = ["staff"];
    const k = r.s + "|" + r.t;
    if (merged[k]) {
      const o = merged[k];
      if (!(o.grades.length === 1 && o.grades[0] === "staff")) gs.forEach(g => { if (o.grades.indexOf(g) < 0) o.grades.push(g); });
      if (o.cals.indexOf(r.grade) < 0) o.cals.push(r.grade);
      return;
    }
    const o = { id: "c" + md5_(k).slice(0, 10), date: r.s, title: r.t,
      type: r.grade === "holidays" ? "holiday" : type_(r.t), grades: gs, note: r.desc, src: "gcal", cals: [r.grade] };
    if (r.last !== r.s) o.end = r.last;
    merged[k] = o;
  });

  const events = Object.keys(merged).map(k => merged[k])
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
  if (events.length < 30) throw new Error("מעט מדי אירועים (" + events.length + ")");

  const body = JSON.stringify({ ok: true, syncedAt: fmt_(now, "yyyy-MM-dd HH:mm"), events });
  writeCache_(body);
  return body;
}

/* ---------- computer bookings ---------- */

// כל לשונית היא יום. A1 = התאריך, עמודה A = השיעורים, ואחריה זוגות "מורה | מס' מחשבים וציוד".
// הזמנה מודגשת = הזמנה קבועה.
function buildComputers_() {
  const ss = SpreadsheetApp.openById(COMPUTERS_SHEET);
  const days = [];
  COMPUTERS_DAYS.forEach((name, wd) => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const rng = sh.getDataRange();
    const vals = rng.getDisplayValues(), bold = rng.getFontWeights();
    let start = vals.findIndex(r => String(r[0]).trim() === "שיעורים");
    if (start < 0) start = vals.findIndex(r => /^שיעור\s*\d/.test(String(r[0]).trim())) - 1;
    const lessons = [];
    for (let i = Math.max(start + 1, 1); i < vals.length; i++) {
      const label = String(vals[i][0] || "").replace(/\s+/g, " ").trim();
      if (!label) continue;
      const num = label.match(/שיעור\s*(\d+)/), time = label.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      const bookings = [];
      for (let c = 1; c < vals[i].length; c += 2) {
        const who = String(vals[i][c] || "").trim(), what = String(vals[i][c + 1] || "").trim();
        if (!who && !what) continue;
        const fixed = bold[i][c] === "bold" || (c + 1 < bold[i].length && bold[i][c + 1] === "bold");
        bookings.push({ who, what, fixed, col: c });
      }
      lessons.push({ row: i, name: num ? "שיעור " + num[1] : label, time: time ? time[1] + "–" + time[2] : "", bookings });
    }
    days.push({ wd, name, date: isoDate_(vals[0] && vals[0][0]), lessons });
  });
  if (!days.length) throw new Error("לא נמצאו לשוניות הימים בטבלת המחשבים");
  const body = JSON.stringify({ ok: true, syncedAt: fmt_(new Date(), "yyyy-MM-dd HH:mm"), days });
  if (body.length < 95000) CacheService.getScriptCache().put(COMPUTERS_KEY, body, COMPUTERS_SECONDS);
  return body;
}

// "4/11/2026" או "04/11/2026" → "2026-11-04"
function isoDate_(s) {
  const m = String(s || "").match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
  if (!m) return "";
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return y + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
}

/* ---------- booking from the site ---------- */

// האתר שולח: {action:"book", wd, rows:[...], who, what, cart}  או  {action:"cancel", wd, row, col, who, what}
function doPost(e) {
  let out;
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    lock.waitLock(15000);
    out = req.action === "cancel" ? cancel_(req) : book_(req);
    CacheService.getScriptCache().remove(COMPUTERS_KEY);
    out.data = JSON.parse(buildComputers_());
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function daySheet_(wd) {
  const name = COMPUTERS_DAYS[wd];
  const sh = name && SpreadsheetApp.openById(COMPUTERS_SHEET).getSheetByName(name);
  if (!sh) throw new Error("היום לא נמצא בטבלה");
  return sh;
}

function book_(req) {
  const who = clean_(req.who, 40), what = clean_(req.what, 60), cart = !!req.cart;
  if (!who) throw new Error("חסר שם");
  if (!what && !cart) throw new Error("חסר מה להזמין");
  const rows = (req.rows || []).map(Number).filter(r => r > 0);
  if (!rows.length) throw new Error("לא נבחר שיעור");
  const sh = daySheet_(Number(req.wd));
  const vals = sh.getDataRange().getDisplayValues();
  const date = isoDate_(vals[0] && vals[0][0]);
  if (date && date < fmt_(new Date(), "yyyy-MM-dd")) throw new Error("היום הזה כבר עבר");
  const stamp = SITE_NOTE + " · " + fmt_(new Date(), "d/M HH:mm");
  const results = [];
  rows.forEach(r => {
    const line = vals[r];
    if (!line || !/שיעור/.test(line[0])) { results.push({ row: r, ok: false, msg: "השיעור לא נמצא" }); return; }
    const name = String(line[0]).replace(/\s+/g, " ").trim().match(/שיעור\s*\d+/);
    const res = { row: r, lesson: name ? name[0] : "", ok: true, refs: [] };
    if (cart) {
      if (String(line[CART_COL] || "").trim() || String(line[CART_COL + 1] || "").trim()) {
        res.ok = false; res.msg = "העגלה באורן כבר תפוסה";
      }
    }
    let free = -1;
    if (res.ok && what) {
      for (let c = COMP_FIRST; c <= COMP_LAST; c += 2) {
        if (!String(line[c] || "").trim() && !String(line[c + 1] || "").trim()) { free = c; break; }
      }
      if (free < 0) { res.ok = false; res.msg = "אין מקום פנוי בשורה של השיעור"; }
    }
    if (res.ok) {
      if (what) { put_(sh, r, free, who, what, stamp); res.refs.push({ col: free, who, what }); }
      if (cart) { put_(sh, r, CART_COL, who, "אורן", stamp); res.refs.push({ col: CART_COL, who, what: "אורן" }); }
    }
    results.push(res);
  });
  SpreadsheetApp.flush();
  return { ok: results.some(x => x.ok), date, results };
}

function cancel_(req) {
  const sh = daySheet_(Number(req.wd));
  const r = Number(req.row), c = Number(req.col);
  if (!(r > 0) || c < COMP_FIRST || c > CART_COL) throw new Error("הזמנה לא תקינה");
  const rng = sh.getRange(r + 1, c + 1, 1, 2);
  const v = rng.getDisplayValues()[0], note = String(sh.getRange(r + 1, c + 1).getNote() || "");
  if (String(v[0]).trim() !== String(req.who || "").trim() || String(v[1]).trim() !== String(req.what || "").trim() || note.indexOf(SITE_NOTE) !== 0) {
    return { ok: false, error: "ההזמנה השתנתה בטבלה, אפשר לבטל רק דרך הטבלה" };
  }
  rng.clearContent(); rng.clearNote();
  SpreadsheetApp.flush();
  return { ok: true };
}

function put_(sh, r, c, who, what, note) {
  const rng = sh.getRange(r + 1, c + 1, 1, 2);
  rng.setValues([[safe_(who), safe_(what)]]).setFontWeight("normal");
  sh.getRange(r + 1, c + 1).setNote(note);
}
function clean_(s, max) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }
// מונע מטקסט שמתחיל ב-= או + להפוך לנוסחה בגיליון
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

/* ---------- sorting rules ---------- */

function schoolGrades_(t) {
  if (t.indexOf("מחנכים") === 0 || t.indexOf("יום עיון למורים") >= 0) return ["staff"];
  t = t.replace(/[׳״'"`’‘”“]/g, "").replace(/\s*[-–—‑]\s*/g, "-");
  if (/ז[.\-\s]*ח\s*בנים/.test(t)) return ["זחבנים"];
  if (/ז[.\-\s]*ח\s*בנות/.test(t)) return ["זחבנות"];
  if (/(?:^|\s)ז[.\-\s]*ח(?:\s|$)/.test(t)) return ["זחבנים", "זחבנות"];
  if (t.indexOf("חטיבה") >= 0) return ["זחבנים", "זחבנות"];
  if (t.indexOf("תיכון") >= 0) return G9.slice();
  let m = t.match(/(?:^|[\s,(])(יב|יא|י|ט)-(יב|יא|י|ט)(?=$|[\s,).])/);
  if (m) {
    const a = G9.indexOf(m[1]), b = G9.indexOf(m[2]);
    if (a <= b) return G9.slice(a, b + 1);
  }
  m = t.match(/(?:^|\s)(יב|יא|י|ט)(?:\s|$)/);
  return m ? [m[1]] : ["all"];
}

function type_(t) {
  if (/חופש/.test(t)) return "holiday";
  if (/מבחן|מבחני|מבדק|בגרות|מתכונת|מינימתכונת|בוחן|מפמ"ר|יום הערכה|cobe|הגשה/i.test(t)) return "exam";
  if (/סיור|טיול|מסע|קמפוס|סמינר|שבוע נגב|נטיעות/.test(t)) return "trip";
  return "event";
}

function heb_(t) {
  const out = [];
  t.split("/").map(p => p.trim()).forEach(part => {
    if (part.indexOf("Rosh Chodesh") === 0 || part.indexOf("ראש חודש") === 0) return;
    const base = part.replace(/\s*\(.*?\)/g, "").trim();
    if (Object.prototype.hasOwnProperty.call(HEB, base)) { if (HEB[base]) out.push(HEB[base]); }
    else if (/[֐-׿]/.test(base)) out.push(base);
  });
  return out.filter((v, i) => out.indexOf(v) === i).join(" / ");
}

/* ---------- helpers ---------- */

function getCal_(id) {
  let cal = CalendarApp.getCalendarById(id);
  if (!cal) { try { cal = CalendarApp.subscribeToCalendar(id, { hidden: true, selected: false }); } catch (e) { cal = null; } }
  return cal;
}
function fmt_(d, p) { return Utilities.formatDate(d, TZ, p); }
function day_(d) { return fmt_(d, "yyyy-MM-dd"); }
function nextDay_(s) {
  const p = s.split("-").map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1));
  return Utilities.formatDate(d, "UTC", "yyyy-MM-dd");
}
function md5_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}

// the script cache holds at most 100KB per entry, so long lists are split into parts
function writeCache_(body) {
  const c = CacheService.getScriptCache(), size = 40000, parts = {};
  const n = Math.ceil(body.length / size);
  for (let i = 0; i < n; i++) parts[CACHE_KEY + ":" + i] = body.slice(i * size, (i + 1) * size);
  parts[CACHE_KEY] = String(n);
  c.putAll(parts, CACHE_SECONDS);
}
function readCache_() {
  const c = CacheService.getScriptCache(), n = Number(c.get(CACHE_KEY) || 0);
  if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push(CACHE_KEY + ":" + i);
  const got = c.getAll(keys);
  if (keys.some(k => got[k] == null)) return null;
  return keys.map(k => got[k]).join("");
}
