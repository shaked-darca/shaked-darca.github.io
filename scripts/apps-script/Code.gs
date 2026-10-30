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

/* ---------- web app ---------- */

function doGet() {
  let body = readCache_();
  if (!body) {
    try { body = build_(); }
    catch (err) { body = JSON.stringify({ ok: false, error: String(err && err.message || err) }); }
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/** להפעיל פעם אחת: מאשר הרשאות, נרשם ליומנים ומתזמן רענון כל 10 דקות. */
function setup() {
  Object.keys(CALS).forEach(k => getCal_(CALS[k]));
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === "refresh") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("refresh").timeBased().everyMinutes(10).create();
  const out = JSON.parse(build_());
  Logger.log("מוכן: " + out.events.length + " אירועים");
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
  const c = CacheService.getScriptCache(), size = 90000, parts = {};
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
