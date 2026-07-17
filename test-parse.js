const fs = require("fs");

function parseICS(icsText) {
  const events = [];
  const blocks = icsText.split(/(?=BEGIN:VEVENT)/);
  for (const block of blocks) {
    if (!block.includes("END:VEVENT")) continue;

    const getVal = (key) => {
      const lines = block.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, "");
        if (line.startsWith(key + ":")) return line.slice(key.length + 1).trim();
        if (line.startsWith(key + ";")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx !== -1) return line.slice(colonIdx + 1).trim();
        }
      }
      return "";
    };

    const uid = getVal("UID") || `ev-${events.length}`;
    const summary = getVal("SUMMARY");
    const description = getVal("DESCRIPTION");
    const location = getVal("LOCATION");

    let dtStart = getVal("DTSTART");
    let dtEnd = getVal("DTEND");

    // Handle folded lines (continuation with whitespace)
    const lines = block.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].replace(/\r$/, "");
      if (!dtStart && l.startsWith("DTSTART")) dtStart = l;
      if (!dtEnd && l.startsWith("DTEND")) dtEnd = l;
    }

    let startDate = "";
    let endDate = "";

    const parseDate = (val) => {
      const afterSemi = val.replace(/^DTSTART(?:;[^:]*)?:/, "").replace(/^DTEND(?:;[^:]*)?:/, "");
      const clean = afterSemi || val;
      const m = clean.match(/(\d{4})(\d{2})(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      if (clean.match(/^\d{4}-\d{2}-\d{2}/)) return clean.slice(0, 10);
      return "";
    };

    startDate = parseDate(dtStart);
    endDate = parseDate(dtEnd) || startDate;

    if (startDate) {
      events.push({
        eventId: uid,
        summary: summary.replace(/\\,/g, ",").replace(/\\n/g, "\n"),
        description: description.replace(/\\,/g, ",").replace(/\\n/g, "\n"),
        startDate,
        endDate,
        location: location.replace(/\\,/g, ","),
      });
    }
  }
  return events;
}

fetch("https://calendar.google.com/calendar/ical/akramabduallh%40gmail.com/private-1dde824bde8a127ccda4191caf0911d0/basic.ics", {
  headers: {
    "User-Agent": "HappyLand/1.0",
    "Accept": "text/calendar"
  }
})
  .then(r => r.text())
  .then(text => {
    console.log("Downloaded size:", text.length);
    try {
      const events = parseICS(text);
      console.log("Successfully parsed events count:", events.length);
      if (events.length > 0) {
        console.log("Sample event 1:", events[0]);
        console.log("Sample event 2:", events[Math.min(1, events.length - 1)]);
      }
    } catch (err) {
      console.error("Parse failed with error:", err);
    }
  })
  .catch(err => console.error("Fetch failed:", err));
