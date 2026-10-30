#!/usr/bin/env python3
"""Pull the school's public Google Calendars into index.html.

Usage: python3 scripts/sync_calendars.py index.html
Prints CHANGED, UNCHANGED or FAILED. On CHANGED the file is rewritten in place;
only the "events" and "syncedAt" fields of the page's data block change.
"""
import sys, time, re, json, hashlib, datetime as dt, urllib.request, urllib.parse
from zoneinfo import ZoneInfo
import icalendar, recurring_ical_events

TZ = ZoneInfo("Asia/Jerusalem")
CALS = {
    "school": "c_classroom654c05dc@group.calendar.google.com",
    "זחבנים": "c_1ab311a0ce5af90942e92705395c8e691e0487d77aa7b04b100e6ac1784bd89c@group.calendar.google.com",
    "זחבנות": "c_4c29255ffa835f2de6b601ebadf5e0776dd3c02ef088362aefa1d9a7a312582b@group.calendar.google.com",
    "ט": "c_0667df03d8fe8b986641f31c7fd3efc2ecaaf2bf8dc4119cedf60fb9e9683dcf@group.calendar.google.com",
    "י": "c_5f99702a099537f8902a3319bfff6379931e4025d9955cf9c68f2b91bae93f1a@group.calendar.google.com",
    "יא": "c_ba7fff33dbc65a400ff9c8ef75eb4b1c6200c7cb39c71f97673b5212e6c0f62e@group.calendar.google.com",
    "יב": "c_25d34f2a16f3fb478a4857886c79d908720dc5b7dc24b89b0805457b441f5bb9@group.calendar.google.com",
    "holidays": "iw.judaism#holiday@group.v.calendar.google.com",
}
HEB = {"Rosh Hashana Eve": "ערב ראש השנה", "Rosh Hashana": "ראש השנה", "Gedaliah Fast": "צום גדליה",
    "Yom Kippur Eve": "ערב יום כיפור", "Yom Kippur": "יום כיפור", "Sukkot Eve": "ערב סוכות", "Sukkot": "סוכות",
    "Hoshanah Rabah": None, "Shemini Atzeret": "שמיני עצרת / שמחת תורה", "Simchat Torah": None, "Sigd": "סיגד",
    "Hanukkah": "חנוכה", "Asarah B'Tevet": "עשרה בטבת", "Tu Bishvat": "ט״ו בשבט", "Fast of Esther": "תענית אסתר",
    "Purim Eve": "ערב פורים", "Purim": "פורים", "Shushan Purim": "שושן פורים", "Passover Eve": "ערב פסח",
    "Passover": "פסח", "Yom HaShoah": "יום השואה", "Yom HaZikaron": "יום הזיכרון", "Yom HaAtzmaut": "יום העצמאות",
    "Lag BaOmer": "ל״ג בעומר", "Jerusalem Day": "יום ירושלים", "Memorial Day for Ethiopian Jews": None,
    "Shavuot Eve": "ערב שבועות", "Shavuot": "שבועות", "17th of Tammuz": "י״ז בתמוז", "Tisha B'Av Eve": "ערב תשעה באב",
    "Tisha B'Av": "תשעה באב", "Pesach Sheni": None, "Tu B'Av": "ט״ו באב", "Yom Kippur Katan": None}
G9 = ["ט", "י", "יא", "יב"]


def heb(t):
    out = []
    for part in [p.strip() for p in t.split("/")]:
        if part.startswith("Rosh Chodesh"):
            continue
        base = re.sub(r"\s*\(.*?\)", "", part).strip()
        if base in HEB:
            if HEB[base]:
                out.append(HEB[base])
        elif re.search(r"[֐-׿]", base):
            out.append(base)
    return " / ".join(dict.fromkeys(out))


def school_grades(t):
    if t.startswith("מחנכים") or "יום עיון למורים" in t:
        return ["staff"]
    t = re.sub(r"[׳״'\"`’‘”“]", "", t)
    t = re.sub(r"\s*[-–—‑]\s*", "-", t)
    if re.search(r"ז[.\-\s]*ח\s*בנים", t): return ["זחבנים"]
    if re.search(r"ז[.\-\s]*ח\s*בנות", t): return ["זחבנות"]
    if re.search(r"(?:^|\s)ז[.\-\s]*ח(?:\s|$)", t): return ["זחבנים", "זחבנות"]
    if "חטיבה" in t: return ["זחבנים", "זחבנות"]
    if "תיכון" in t: return G9
    m = re.search(r"(?:^|[\s,(])(יב|יא|י|ט)-(יב|יא|י|ט)(?=$|[\s,).])", t)
    if m:
        a, b = G9.index(m.group(1)), G9.index(m.group(2))
        if a <= b:
            return G9[a:b + 1]
    m = re.search(r"(?:^|\s)(יב|יא|י|ט)(?:\s|$)", t)
    return [m.group(1)] if m else ["all"]


def typ(t):
    if re.search(r"חופש", t): return "holiday"
    if re.search(r'מבחן|מבחני|מבדק|בגרות|מתכונת|מינימתכונת|בוחן|מפמ"ר|יום הערכה|cobe|הגשה', t, re.I): return "exam"
    if re.search(r"סיור|טיול|מסע|קמפוס|סמינר|שבוע נגב|נטיעות", t): return "trip"
    return "event"


def as_date(v):
    v = v.dt
    if isinstance(v, dt.datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=dt.timezone.utc)
        return v.astimezone(TZ).date(), True
    return v, False


def main(path):
    today = dt.datetime.now(TZ).date()
    y = today.year if today.month >= 8 else today.year - 1
    start, end = dt.date(y, 8, 25), dt.date(y + 1, 8, 31)
    raw = []
    for grade, cid in CALS.items():
        url = "https://calendar.google.com/calendar/ical/" + urllib.parse.quote(cid, safe="") + "/public/basic.ics"
        cal, err = None, None
        for attempt in range(6):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (school-site-sync)"})
                cal = icalendar.Calendar.from_ical(urllib.request.urlopen(req, timeout=60).read())
                break
            except Exception as e:
                err = e
                if attempt < 5:
                    time.sleep(min(10 * 2 ** attempt, 120))
        if cal is None:
            print("FAILED fetch", grade, err); sys.exit(1)
        time.sleep(2)
        for ev in recurring_ical_events.of(cal).between(start, end):
            if str(ev.get("STATUS", "")).upper() == "CANCELLED":
                continue
            t = re.sub(r"\s+", " ", str(ev.get("SUMMARY", "")).strip())
            if not t:
                continue
            s, timed = as_date(ev["DTSTART"])
            e = as_date(ev["DTEND"])[0] if ev.get("DTEND") else s
            last = s if timed else max(s, e - dt.timedelta(days=1))
            desc = str(ev.get("DESCRIPTION", "") or "").strip()
            desc = re.sub(r"<br\s*/?>", "\n", desc); desc = re.sub(r"<[^>]+>", "", desc).strip()
            if grade == "holidays":
                t = heb(t)
                if not t:
                    continue
            t = re.sub(r"^(יא|יב|י|ט)\s*-\s+", "", t) if grade not in ("school", "holidays") else t
            raw.append((grade, s.isoformat(), last.isoformat(), t, desc))
    hol = sorted([r for r in raw if r[0] == "holidays"], key=lambda r: (r[3], r[1]))
    raw = [r for r in raw if r[0] != "holidays"]
    for r in hol:
        if raw and raw[-1][0] == "holidays" and raw[-1][3] == r[3] and \
           dt.date.fromisoformat(raw[-1][2]) + dt.timedelta(days=1) == dt.date.fromisoformat(r[1]):
            raw[-1] = (r[0], raw[-1][1], r[2], r[3], r[4])
        else:
            raw.append(r)
    merged = {}
    for grade, s, last, t, desc in raw:
        gs = school_grades(t) if grade == "school" else (["all"] if grade == "holidays" else [grade])
        k = (s, t)
        if k in merged:
            for g in gs:
                if g not in merged[k]["grades"]:
                    merged[k]["grades"].append(g)
            if grade not in merged[k]["cals"]:
                merged[k]["cals"].append(grade)
            continue
        o = {"id": "c" + hashlib.md5((s + "|" + t).encode()).hexdigest()[:10], "date": s, "title": t,
             "type": "holiday" if grade == "holidays" else typ(t), "grades": gs, "note": desc, "src": "gcal", "cals": [grade]}
        if last != s:
            o["end"] = last
        merged[k] = o
    fresh = sorted(merged.values(), key=lambda x: (x["date"], x["title"]))
    if len(fresh) < 30:
        print("FAILED too few events", len(fresh)); sys.exit(1)

    html = open(path, encoding="utf8").read()
    m = re.search(r'(<script type="application/json" id="data">)(.*?)(</script>)', html, re.S)
    if not m:
        print("FAILED no data block"); sys.exit(1)
    data = json.loads(m.group(2))
    is_cal = lambda e: e.get("src") == "gcal"
    manual = [e for e in data.get("events", []) if not is_cal(e)]
    old_cal = sorted([e for e in data.get("events", []) if is_cal(e)], key=lambda x: (x["date"], x["title"]))
    strip = lambda L: [{k: v for k, v in e.items() if k != "id"} for e in L]
    if strip(old_cal) == strip(fresh):
        print("UNCHANGED", len(fresh)); return
    data["events"] = manual + fresh
    data["syncedAt"] = dt.datetime.now(TZ).strftime("%Y-%m-%d %H:%M")
    blob = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    open(path, "w", encoding="utf8").write(html[:m.start(2)] + blob + html[m.end(2):])
    print("CHANGED", len(fresh), "calendar events,", len(manual), "manual")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "index.html")
