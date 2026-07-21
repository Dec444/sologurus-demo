const pad = (value) => String(value).padStart(2, "0");

const dayStamp = (date) =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;

const utcStamp = (date = new Date()) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escapeIcs = (value) =>
  String(value).replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

const addMinutes = (hhmmss, amount) => {
  const hours = Number(hhmmss.slice(0, 2));
  const minutes = Number(hhmmss.slice(2, 4));
  const total = hours * 60 + minutes + amount;
  return `${pad(Math.floor(total / 60) % 24)}${pad(total % 60)}00`;
};

export function makeCalendarIcs(profile, plan) {
  const timezone = profile.timezone || "Asia/Ho_Chi_Minh";
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const firstDay = addDays(start, 1);
  const stamp = utcStamp();
  const scheduleOffsets = [0, 2, 5];

  const sessions = Array.from({ length: 4 }, (_, week) =>
    scheduleOffsets.map((offset, sessionIndex) => {
      const date = addDays(firstDay, week * 7 + offset);
      const task = plan.sample[sessionIndex % plan.sample.length];
      const parsedMinutes = Number.parseInt(task, 10);
      const duration = Number.isFinite(parsedMinutes) ? parsedMinutes : 60;
      const startTime = sessionIndex === 2 ? "093000" : "183000";
      return [
        "BEGIN:VEVENT",
        `UID:sologurus-${plan.id}-w${week + 1}s${sessionIndex + 1}@sologurus`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${timezone}:${dayStamp(date)}T${startTime}`,
        `DTEND;TZID=${timezone}:${dayStamp(date)}T${addMinutes(startTime, duration)}`,
        `SUMMARY:${escapeIcs(`Sologurus · ${task.split(" · ")[1] || plan.name}`)}`,
        `DESCRIPTION:${escapeIcs(`${task}\nStrategy: ${plan.name}\nGoal: ${profile.goal}`)}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    }),
  ).flat();

  const reminders = [
    ["073000", "Morning start · See today’s study plan"],
    ["123000", "Noon check-in · Choose the full or shortened plan"],
    ["210000", "Night reflection · Mark done + write one line"],
  ].map(([time, label], index) => [
    "BEGIN:VEVENT",
    `UID:sologurus-daily-${index + 1}@sologurus`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${timezone}:${dayStamp(firstDay)}T${time}`,
    `DTEND;TZID=${timezone}:${dayStamp(firstDay)}T${addMinutes(time, 10)}`,
    `RRULE:FREQ=DAILY;UNTIL:${profile.date.replaceAll("-", "")}T235959Z`,
    `SUMMARY:${escapeIcs(label)}`,
    `DESCRIPTION:${escapeIcs(`Goal: ${profile.goal}`)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ].join("\r\n"));

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Sologurus//Study Plan//EN",
    `X-WR-CALNAME:${escapeIcs(`Sologurus · ${plan.name}`)}`,
    `X-WR-TIMEZONE:${timezone}`,
    ...sessions,
    ...reminders,
    "END:VCALENDAR",
  ].join("\r\n");
}
