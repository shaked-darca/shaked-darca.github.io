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
 *
 * התראות: תלמידים ומורים בוחרים באתר שכבות ונושאים (בגרויות, מבחנים, טיולים, חברתי, חופשות, צוות).
 * האתר שולח לכאן "כתובת" של הטלפון (token) עם הבחירה, והסקריפט שומר אותה בגיליון "מנויי התראות"
 * (בלי שמות). פעם ביום, ב-17:00, dailyReminders בודק מה יוצא בקרוב ושולח התראות דרך Firebase.
 * כדי שזה יעבוד צריך להדביק פעם אחת את מפתח השירות של Firebase:
 *   הגדרות הפרויקט (גלגל השיניים) ← מאפייני סקריפט ← הוספה: שם FCM_SA, ערך: כל התוכן של קובץ ה-JSON.
 * בדיקה: אחרי שהפעלתם התראות בטלפון שלכם, מריצים testPush – ההתראה נשלחת לטלפון האחרון שנרשם.
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

/* התראות: הנושאים, וכמה ימים לפני כל אירוע שולחים (חייב להתאים ל-NTOPICS באתר) */
const TOPICS = {
  bagrut:   { days: [30],   icon: "📚", tail: "זה הזמן להתחיל לתכנן למידה." },
  exams:    { days: [7],    icon: "✏️", tail: "" },
  trips:    { days: [7, 1], icon: "🚌", tail: "" },
  social:   { days: [1],    icon: "🎉", tail: "" },
  holidays: { days: [1],    icon: "🌿", tail: "" },
  staff:    { days: [1],    icon: "👥", tail: "" }
};
const REMIND_HOUR = 17;            // באיזו שעה ביום שולחים
const PUSH_GRADES = ["זחבנים", "זחבנות", "ט", "י", "יא", "יב", "staff"];
const SITE_URL = "https://shaked-darca.github.io/";

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
  // התראות: גיליון המנויים ובדיקה יומית
  ScriptApp.getProjectTriggers().forEach(t => { if (["bagrutReminders", "dailyReminders"].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("dailyReminders").timeBased().everyDays(1).atHour(REMIND_HOUR).inTimezone(TZ).create();
  const subs = pushSheet_();
  Logger.log("גיליון מנויי ההתראות: " + subs.getParent().getUrl() + " (" + (subs.getLastRow() - 1) + " מנויים)");
  Logger.log(PropertiesService.getScriptProperties().getProperty("FCM_SA")
    ? "מפתח Firebase קיים – ההתראות יישלחו כל יום ב-" + REMIND_HOUR + ":00"
    : "עוד חסר מפתח Firebase (FCM_SA במאפייני הסקריפט). בלעדיו נרשמים, אבל לא נשלחות התראות.");
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
// הזמנה מודגשת = הזמנה קבועה. הזמנה קבועה באדום = הזמנה מוקפאת (המחשבים פנויים).
function buildComputers_() {
  const ss = SpreadsheetApp.openById(COMPUTERS_SHEET);
  const days = [];
  COMPUTERS_DAYS.forEach((name, wd) => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const rng = sh.getDataRange();
    const vals = rng.getDisplayValues(), bold = rng.getFontWeights(), color = rng.getFontColors();
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
        const frozen = fixed && (isRed_(color[i][c]) || (c + 1 < color[i].length && isRed_(color[i][c + 1])));
        bookings.push({ who, what, fixed, frozen, col: c });
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

// צבע גופן אדום (#ff0000, #cc0000, #e06666 וכו')
function isRed_(hex) {
  const m = String(hex || "").match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return r >= 150 && r - g >= 70 && r - b >= 70;
}

// "4/11/2026" או "04/11/2026" → "2026-11-04"
function isoDate_(s) {
  const m = String(s || "").match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
  if (!m) return "";
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return y + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
}

/* ---------- booking from the site ---------- */

// האתר שולח: {action:"book", wd, rows:[...], who, what, cart, fixed}
//          או {action:"cancel", wd, row, col, who, what}
//          או {action:"edit", wd, row, col, who, what, to:{wd, row, who, what, fixed}}
//          או {action:"freeze", wd, row, col, who, what, frozen, by}
// הזמנה קבועה (fixed) נכתבת במודגש, כמו שאחראי המחשבים מסמן הזמנות קבועות.
function doPost(e) {
  let out;
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    lock.waitLock(15000);
    limit_(req.action === "push-set" ? "push" : "write", req.action === "push-set" ? 60 : 25);
    if (req.action === "push-set") {
      return ContentService.createTextOutput(JSON.stringify(pushSub_(req))).setMimeType(ContentService.MimeType.JSON);
    }
    out = req.action === "cancel" ? cancel_(req) : req.action === "edit" ? edit_(req) : req.action === "freeze" ? {ok:false,error:"הקפאה אפשרית רק בטבלה, על ידי אחראי המחשבים"} : book_(req);
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
  const who = clean_(req.who, 40), what = clean_(req.what, 60), cart = !!req.cart, fixed = !!req.fixed;
  if (!who) throw new Error("חסר שם");
  if (!what && !cart) throw new Error("חסר מה להזמין");
  const rows = (req.rows || []).map(Number).filter((r, i, a) => r > 0 && a.indexOf(r) === i);
  if (!rows.length) throw new Error("לא נבחר שיעור");
  if (rows.length > MAX_ROWS) throw new Error("אפשר להזמין עד " + MAX_ROWS + " שיעורים בהזמנה אחת");
  const key = newKey_();
  const sh = daySheet_(Number(req.wd));
  const vals = sh.getDataRange().getDisplayValues();
  const date = isoDate_(vals[0] && vals[0][0]);
  // הזמנה קבועה חוזרת כל שבוע, ולכן אפשר לרשום אותה גם ביום שכבר עבר השבוע (היא תחול מהשבוע הבא)
  if (!fixed && date && date < fmt_(new Date(), "yyyy-MM-dd")) throw new Error("היום הזה כבר עבר");
  const stamp = SITE_NOTE + " · " + fmt_(new Date(), "d/M HH:mm") + " · #" + key;
  const results = [];
  // שיעורים עוקבים באותה הזמנה נרשמים באותה עמודה – אחד מתחת לשני, כדי שהטבלה תהיה קריאה.
  // מחפשים עמודה שפנויה בכל השיעורים שנבחרו; אם אין כזו – ההזמנה נדחית ולא מפוזרת בין עמודות.
  const isFree = (line, c) => line && !String(line[c] || "").trim() && !String(line[c + 1] || "").trim();
  let shared = -1;
  if (what) {
    for (let c = COMP_FIRST; c <= COMP_LAST; c += 2) {
      if (rows.every(r => isFree(vals[r], c))) { shared = c; break; }
    }
    if (shared < 0) return { ok: false, date, results: rows.map(r => ({ row: r, ok: false, msg: "אין עמודה אחת שפנויה בכל השיעורים שנבחרו – אפשר להזמין כל שיעור בנפרד או לפנות לאחראי המחשבים" })) };
  }
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
    const free = shared;
    if (res.ok) {
      if (what) { put_(sh, r, free, who, what, stamp, fixed); res.refs.push({ col: free, who, what, key }); }
      if (cart) { put_(sh, r, CART_COL, who, "אורן", stamp, fixed); res.refs.push({ col: CART_COL, who, what: "אורן", key }); }
    }
    results.push(res);
  });
  SpreadsheetApp.flush();
  return { ok: results.some(x => x.ok), date, results };
}

// בודק שההזמנה עדיין בטבלה כמו שנעשתה מהאתר (כדי לא לגעת בהזמנות של אחרים)
function ownCell_(req) {
  const sh = daySheet_(Number(req.wd));
  const r = Number(req.row), c = Number(req.col);
  if (!(r > 0) || c < COMP_FIRST || c > CART_COL) throw new Error("הזמנה לא תקינה");
  const rng = sh.getRange(r + 1, c + 1, 1, 2);
  const v = rng.getDisplayValues()[0], note = String(sh.getRange(r + 1, c + 1).getNote() || "");
  // הזמנה חדשה נושאת מפתח סודי (#...) בהערה על התא. רק הטלפון שהזמין קיבל אותו, ולכן רק הוא יכול לערוך או לבטל.
  // הזמנות ישנות בלי מפתח – לפי השם והתוכן, כמו קודם (הן ייעלמו עם הטבלה של השבוע הבא).
  const m = note.match(/#([A-Za-z0-9]{8,})/);
  const keyOk = m ? String(req.key || "") === m[1] : true;
  const ok = keyOk && String(v[0]).trim() === String(req.who || "").trim() && String(v[1]).trim() === String(req.what || "").trim() && note.indexOf(SITE_NOTE) === 0;
  return { sh, r, c, rng, ok };
}

function cancel_(req) {
  const o = ownCell_(req);
  if (!o.ok) return { ok: false, error: "ההזמנה השתנתה בטבלה, אפשר לבטל רק דרך הטבלה" };
  o.rng.clearContent(); o.rng.clearNote(); o.rng.setFontWeight("normal").setFontColor("#000000");
  SpreadsheetApp.flush();
  return { ok: true };
}

// עריכה: באותו שיעור – כותב במקום. ביום/שיעור אחר – מזמין במקום החדש ורק אם הצליח מוחק את הישנה.
function edit_(req) {
  const o = ownCell_(req), to = req.to || {};
  if (!o.ok) return { ok: false, error: "ההזמנה השתנתה בטבלה, אפשר לערוך רק דרך הטבלה" };
  const cart = o.c === CART_COL;
  const who = clean_(to.who, 40), what = cart ? "אורן" : clean_(to.what, 60), fixed = !!to.fixed;
  if (!who) throw new Error("חסר שם");
  if (!what) throw new Error("חסר מה להזמין");
  const toWd = Number(to.wd), toRow = Number(to.row);
  if (toWd === Number(req.wd) && toRow === o.r) {
    const key = newKey_();
    put_(o.sh, o.r, o.c, who, what, SITE_NOTE + " · " + fmt_(new Date(), "d/M HH:mm") + " · #" + key, fixed);
    SpreadsheetApp.flush();
    const vals = o.sh.getRange(1, 1).getDisplayValue();
    return { ok: true, date: isoDate_(vals), refs: [{ wd: toWd, row: o.r, col: o.c, who, what, key }] };
  }
  const b = book_({ wd: toWd, rows: [toRow], who, what: cart ? "" : what, cart, fixed });
  const res = b.results[0];
  if (!res || !res.ok) return { ok: false, error: (res && res.msg) || "לא הצלחנו להזמין במקום החדש, ההזמנה הקודמת נשארה" };
  o.rng.clearContent(); o.rng.clearNote(); o.rng.setFontWeight("normal").setFontColor("#000000");
  SpreadsheetApp.flush();
  return { ok: true, date: b.date, refs: res.refs.map(f => ({ wd: toWd, row: toRow, col: f.col, who: f.who, what: f.what, key: f.key })) };
}

// הקפאה: צובע הזמנה קבועה באדום (מוקפאת – המחשבים פנויים) או מחזיר אותה לשחור.
// כל אחד יכול, עם שם לאישור, ושמו נרשם בהערה על התא כדי שיהיה ברור מי הקפיא.
function freeze_(req) {
  const by = clean_(req.by, 40);
  if (!by) throw new Error("חסר שם");
  const sh = daySheet_(Number(req.wd));
  const r = Number(req.row), c = Number(req.col);
  if (!(r > 0) || !(c >= COMP_FIRST) || c % 2 !== 1) throw new Error("הזמנה לא תקינה");
  const rng = sh.getRange(r + 1, c + 1, 1, 2);
  const v = rng.getDisplayValues()[0], w = rng.getFontWeights()[0];
  if (String(v[0]).trim() !== String(req.who || "").trim() || String(v[1]).trim() !== String(req.what || "").trim())
    return { ok: false, error: "ההזמנה השתנתה בטבלה. כדאי לרענן ולנסות שוב" };
  if (w[0] !== "bold" && w[1] !== "bold") return { ok: false, error: "אפשר להקפיא רק הזמנה קבועה" };
  const on = !!req.frozen;
  rng.setFontColor(on ? "#ff0000" : "#000000");
  const cell = sh.getRange(r + 1, c + 1), note = String(cell.getNote() || "");
  const line = (on ? "הוקפא" : "ההקפאה בוטלה") + " מהאתר על ידי " + by + " · " + fmt_(new Date(), "d/M HH:mm");
  cell.setNote(note ? note + "\n" + line : line);
  SpreadsheetApp.flush();
  return { ok: true };
}

function put_(sh, r, c, who, what, note, fixed) {
  const rng = sh.getRange(r + 1, c + 1, 1, 2);
  // צבע שחור: תא שהתפנה אחרי הזמנה מוקפאת נשאר אדום, ובלי זה הזמנה חדשה הייתה נראית מוקפאת
  rng.setValues([[safe_(who), safe_(what)]]).setFontWeight(fixed ? "bold" : "normal").setFontColor("#000000");
  sh.getRange(r + 1, c + 1).setNote(note);
}
/* ---------- הגנה מפני הצפה ---------- */
const MAX_ROWS = 4;            // כמה שיעורים לכל היותר בהזמנה אחת
const MAX_PUSH_SUBS = 3000;    // כמה טלפונים לכל היותר ברשימת ההתראות
// מגביל כמה פעולות כתיבה יכולות לקרות בכל 10 דקות, מכל המשתמשים יחד.
// מי שמנסה להציף את הטבלה בסקריפט ייעצר אחרי המכסה, והטבלה לא תתמלא בזבל.
function limit_(kind, max) {
  const cache = CacheService.getScriptCache();
  const k = "rate:" + kind + ":" + Math.floor(Date.now() / 600000);
  const n = Number(cache.get(k) || 0) + 1;
  if (n > max) throw new Error("יותר מדי פעולות בזמן קצר. כדאי לנסות שוב בעוד כמה דקות, או להזמין ישירות בטבלה.");
  cache.put(k, String(n), 700);
}
function newKey_() { return Utilities.getUuid().replace(/-/g, "").slice(0, 16); }
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

/* ---------- reminders (push notifications) ---------- */

// הגיליון שבו נשמרים המנויים: token | שכבות | נושאים | נרשם | עודכן. שורה לכל טלפון. נוצר לבד בפעם הראשונה.
function pushSheet_() {
  const p = PropertiesService.getScriptProperties();
  let ss = null;
  const id = p.getProperty("PUSH_SUBS");
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (x) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('מנויי התראות – אתר שק"ד דרכא');
    const sh = ss.getSheets()[0];
    sh.appendRow(["token", "שכבות", "נושאים", "נרשם", "עודכן"]);
    sh.setFrozenRows(1);
    p.setProperty("PUSH_SUBS", ss.getId());
  }
  return ss.getSheets()[0];
}

// האתר שולח {action:"push-set", token, grades:[...], topics:[...]}. בלי נושאים = ביטול ההרשמה.
function pushSub_(req) {
  const token = String(req.token || "").trim();
  if (!/^[A-Za-z0-9_:.\-]{20,500}$/.test(token)) return { ok: false, error: "כתובת התראות לא תקינה" };
  const grades = (req.grades || []).map(String).filter((g, i, a) => PUSH_GRADES.indexOf(g) >= 0 && a.indexOf(g) === i);
  const topics = (req.topics || []).map(String).filter((t, i, a) => TOPICS[t] && a.indexOf(t) === i);
  const sh = pushSheet_(), rows = sh.getDataRange().getValues(), now = new Date();
  let row = 0;
  for (let i = rows.length - 1; i >= 1; i--) if (rows[i][0] === token) { row = i + 1; break; }
  if (!grades.length || !topics.length) { if (row) sh.deleteRow(row); return { ok: true }; }
  if (row) sh.getRange(row, 2, 1, 4).setValues([[grades.join(","), topics.join(","), rows[row - 1][3] || now, now]]);
  else if (rows.length > MAX_PUSH_SUBS) return { ok: false, error: "יותר מדי נרשמים" };
  else sh.appendRow([token, grades.join(","), topics.join(","), now, now]);
  return { ok: true };
}

// לאיזה נושא שייך אירוע (אותו מיון כמו באתר)
function topicOf_(ev) {
  if (ev.grades.length === 1 && ev.grades[0] === "staff") return "staff";
  if (ev.type === "holiday") return "holidays";
  if (/בגר/.test(ev.title) && !/מתכונ/.test(ev.title)) return "bagrut";
  if (ev.type === "exam") return "exams";
  if (ev.type === "trip") return "trips";
  return "social";
}

/** רץ אוטומטית כל יום ב-17:00: שולח לכל טלפון התראה על האירועים בנושאים ובשכבות שבחר (הזמנים ב-TOPICS). */
function dailyReminders() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("FCM_SA")) { Logger.log("חסר FCM_SA – לא נשלח כלום"); return; }
  const sh = pushSheet_();
  const subs = sh.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({
    token: r[0], grades: String(r[1]).split(","), topics: String(r[2]).split(",") }));
  if (!subs.length) { Logger.log("אין עדיין מנויים"); return; }
  const events = JSON.parse(readCache_() || build_()).events;
  const todayS = day_(new Date());
  const gone = {};
  let sent = 0;
  events.forEach(ev => {
    const topic = topicOf_(ev), T = TOPICS[topic];
    const left = daysBetween_(todayS, ev.date);
    T.days.forEach(d => {
      // שולחים ביום הנכון, ואם פספסנו יום (תקלה), גם ביומיים שאחריו
      if (!(left <= d && left > Math.max(d - 3, 0))) return;
      const key = "sent:" + ev.id + ":" + d;
      if (props.getProperty(key)) return;
      const to = subs.filter(s => s.topics.indexOf(topic) >= 0 && (topic === "staff"
        ? s.grades.indexOf("staff") >= 0
        : ev.grades.indexOf("all") >= 0 || ev.grades.some(g => s.grades.indexOf(g) >= 0)));
      const when = left === 30 ? "בעוד חודש" : left === 7 ? "בעוד שבוע" : left === 1 ? "מחר" : "בעוד " + left + " ימים";
      const body = when + " – " + hebDay_(ev.date) + (T.tail ? ". " + T.tail : "");
      to.forEach(s => {
        const res = sendPush_(s.token, T.icon + " " + ev.title, body, SITE_URL, ev.id + "-" + d);
        if (res === "ok") sent++;
        else if (res === "gone") gone[s.token] = true;
      });
      props.setProperty(key, todayS);
      if (to.length) Logger.log("נשלח: " + ev.title + " (" + ev.date + ") ל-" + to.length + " טלפונים");
    });
  });
  // טלפונים שהסירו את האפליקציה או חסמו התראות – מוחקים מהגיליון
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) if (gone[rows[i][0]]) sh.deleteRow(i + 1);
  // ניקוי סימוני "נשלח" ישנים (של אירועים שעברו לפני יותר מחודש)
  const old = day_(new Date(Date.now() - 40 * 86400000));
  Object.keys(props.getProperties()).forEach(k => { if (k.indexOf("sent:") === 0 && props.getProperty(k) < old) props.deleteProperty(k); });
  Logger.log("סה״כ התראות שנשלחו היום: " + sent);
}

/** בדיקה: שולח התראה לטלפון האחרון שנרשם להתראות. */
function testPush() {
  const rows = pushSheet_().getDataRange().getValues();
  if (rows.length < 2) { Logger.log("אין עדיין אף טלפון רשום. קודם מפעילים התראות באתר."); return; }
  const last = rows[rows.length - 1];
  Logger.log("נשלח לטלפון (" + last[1] + " · " + last[2] + "): " +
    sendPush_(last[0], "בדיקה ✓", 'ההתראות של אתר שק"ד דרכא עובדות.', SITE_URL, "test"));
}

// שליחה דרך Firebase Cloud Messaging. מחזיר "ok", "gone" (הטלפון כבר לא רשום) או "error".
function sendPush_(token, title, body, url, tag) {
  const sa = JSON.parse(PropertiesService.getScriptProperties().getProperty("FCM_SA"));
  const r = UrlFetchApp.fetch("https://fcm.googleapis.com/v1/projects/" + sa.project_id + "/messages:send", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + fcmAccess_(sa) },
    payload: JSON.stringify({ message: { token: token,
      data: { title: title, body: body, url: url || SITE_URL, tag: String(tag || "") },
      webpush: { headers: { Urgency: "high", TTL: "172800" } } } }),
    muteHttpExceptions: true
  });
  const code = r.getResponseCode(), text = r.getContentText();
  if (code === 200) return "ok";
  if (code === 404 || /UNREGISTERED/.test(text)) return "gone";
  Logger.log("Firebase " + code + ": " + text);
  return "error";
}

// כניסה ל-Firebase עם מפתח השירות (חתימה דיגיטלית), לשעה. נשמר בזיכרון כדי לא לבקש בכל שליחה.
function fcmAccess_(sa) {
  const c = CacheService.getScriptCache(), hit = c.get("fcm-access");
  if (hit) return hit;
  const now = Math.floor(Date.now() / 1000);
  const b64 = s => Utilities.base64EncodeWebSafe(s).replace(/=+$/, "");
  const input = b64(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = b64(Utilities.computeRsaSha256Signature(input, sa.private_key));
  const r = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", { method: "post", muteHttpExceptions: true,
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: input + "." + sig } });
  const j = JSON.parse(r.getContentText());
  if (!j.access_token) throw new Error("כניסה ל-Firebase נכשלה: " + r.getContentText());
  c.put("fcm-access", j.access_token, 3000);
  return j.access_token;
}

function daysBetween_(a, b) {
  const p = s => { const x = s.split("-").map(Number); return Date.UTC(x[0], x[1] - 1, x[2]); };
  return Math.round((p(b) - p(a)) / 86400000);
}
function hebDay_(s) {
  const x = s.split("-").map(Number), d = new Date(Date.UTC(x[0], x[1] - 1, x[2]));
  return "יום " + "אבגדהוש"[d.getUTCDay()] + "׳, " + x[2] + "." + x[1];
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
