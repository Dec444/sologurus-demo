const dayMs = 86_400_000;

const levelRank = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const hoursByStep = { 1: 90, 2: 140, 3: 180, 4: 220, 5: 280 };

const parseLevel = (value = "") => value.match(/\b(A1|A2|B1|B2|C1|C2)\b/i)?.[1]?.toUpperCase() ?? "B1";
const parseTargetLevel = (goal = "") => {
  const explicit = goal.match(/\b(A1|A2|B1|B2|C1|C2)\b/i)?.[1]?.toUpperCase();
  if (explicit) return explicit;
  if (/IELTS\s*(7|8|9)|C2|C1|advanced/i.test(goal)) return "C1";
  return "B2";
};

const requiredHours = (currentLevel, targetLevel, examExperience = "first") => {
  const current = levelRank[currentLevel] ?? 3;
  const target = Math.max(current + 1, levelRank[targetLevel] ?? 4);
  let total = 0;
  for (let rank = current; rank < target; rank += 1) total += hoursByStep[rank] ?? 220;
  const examHours = examExperience === "taken" ? 20 : examExperience === "similar" ? 40 : 65;
  return Math.max(100, total + examHours);
};

export function assessFeasibility(profile, today = new Date()) {
  const target = new Date(`${profile.date}T23:59:59Z`);
  const start = new Date(today);
  start.setUTCHours(0, 0, 0, 0);
  const calendarDays = Math.max(0, Math.ceil((target.getTime() - start.getTime()) / dayMs));
  const currentLevel = parseLevel(profile.level);
  const targetLevel = parseTargetLevel(profile.goal);
  const neededHours = requiredHours(currentLevel, targetLevel, profile.examExperience);
  const reliability = profile.consistency === "steady" ? 0.9 : profile.consistency === "sometimes" ? 0.7 : 0.55;
  const dailyHours = Number(profile.dailyHours) || 0;
  const studyDays = Number(profile.studyDays) || 0;
  const availableHours = Math.round(calendarDays / 7 * studyDays * dailyHours * reliability);
  const ratio = neededHours > 0 ? availableHours / neededHours : 0;
  const overload = dailyHours > 4.5;

  let status = "practical";
  let title = "This target looks practical.";
  let advice = `Your schedule provides about ${availableHours} focused hours against an estimated ${neededHours}-hour path.`;
  if (calendarDays <= 0) {
    status = "not-practical";
    title = "This test date has already passed.";
    advice = "Choose a future date before building the study plan.";
  } else if (ratio < 0.78) {
    status = "not-practical";
    title = "This timeline is not practical yet.";
    const recommendedDaily = Math.min(6, Math.ceil((neededHours / Math.max(1, calendarDays / 7 * studyDays * reliability)) * 2) / 2);
    advice = `The plan offers about ${availableHours} effective hours, but the goal is estimated to need ${neededHours}. Move the test date or plan about ${recommendedDaily} hours on each study day.`;
  } else if (ratio < 1.08 || overload) {
    status = "tight";
    title = overload ? "The hours are possible, but hard to sustain." : "The timeline is possible, but tight.";
    advice = overload
      ? `${dailyHours} hours per study day is a high cognitive load. Shorten sessions or spread them across more days to protect consistency.`
      : `You have about ${availableHours} effective hours for an estimated ${neededHours}-hour path. Keep one buffer day each week and review progress often.`;
  }

  return {
    status,
    title,
    advice,
    availableHours,
    neededHours,
    calendarDays,
    currentLevel,
    targetLevel,
    weeklyHours: Math.round(dailyHours * studyDays * 10) / 10,
  };
}

const dateLabel = (date) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);

export function buildStudyPlan(profile, plan, resources, today = new Date()) {
  const start = new Date(today);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() + 1);
  const target = new Date(`${profile.date}T00:00:00Z`);
  const totalCalendarDays = Math.max(1, Math.floor((target.getTime() - start.getTime()) / dayMs) + 1);
  const desiredSessions = Math.max(14, Math.round(totalCalendarDays / 7 * Number(profile.studyDays || 5)));
  const sessionCount = Math.min(84, desiredSessions);
  const textbooks = resources?.textbooks ?? [];
  const skills = ["listening", "speaking", "reading", "writing"];
  const rows = [];

  for (let index = 0; index < sessionCount; index += 1) {
    const position = sessionCount === 1 ? 0 : index / (sessionCount - 1);
    const dateOffset = Math.round(position * Math.max(0, totalCalendarDays - 1));
    const date = new Date(start.getTime() + dateOffset * dayMs);
    const phase = position < 0.2 ? "Foundation" : position < 0.55 ? "Skill building" : position < 0.82 ? "Exam technique" : "Mock & taper";
    const skill = skills[index % skills.length];
    const material = resources?.materials?.[skill]?.[index % Math.max(1, resources.materials[skill].length)];
    const textbook = textbooks[index % Math.max(1, textbooks.length)];
    const mock = resources?.mockExams?.[index % Math.max(1, resources.mockExams.length)];
    const focus = phase === "Foundation"
      ? `${skill[0].toUpperCase() + skill.slice(1)} foundations · core grammar and high-frequency vocabulary`
      : phase === "Skill building"
        ? `${skill[0].toUpperCase() + skill.slice(1)} practice · accuracy, fluency, and error review`
        : phase === "Exam technique"
          ? `${resources?.recommendation?.name ?? "Exam"} ${skill} task · timed method and mistake log`
          : index === sessionCount - 1
            ? "Light review only · confirm logistics and protect sleep"
            : `Timed ${mock?.name ?? "mock exam"} · review weak patterns`;

    rows.push({
      day: index + 1,
      date: date.toISOString().slice(0, 10),
      dateLabel: dateLabel(date),
      phase,
      focus,
      textbook: textbook?.name ?? `${profile.language} coursebook`,
      practice: material?.name ?? `${profile.language} ${skill} practice`,
      skill,
      durationMinutes: Math.max(30, Math.round(Number(profile.dailyHours || 1) * 60)),
      done: false,
    });
  }

  return rows;
}

export function buildProgressSeries(studyPlan, completedDays, view) {
  const completed = new Set(completedDays);
  const groups = new Map();

  for (const row of studyPlan) {
    const date = new Date(`${row.date}T00:00:00Z`);
    let key;
    let label;
    if (view === "monthly") {
      key = row.date.slice(0, 7);
      label = new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
    } else if (view === "weekly") {
      const weekStart = new Date(date);
      weekStart.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      key = weekStart.toISOString().slice(0, 10);
      label = `Wk ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(weekStart)}`;
    } else {
      key = row.date;
      label = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
    }
    const bucket = groups.get(key) ?? { key, label, planned: 0, completed: 0 };
    bucket.planned += 1;
    if (completed.has(row.day)) bucket.completed += 1;
    groups.set(key, bucket);
  }

  const limit = view === "daily" ? 14 : view === "weekly" ? 12 : 8;
  return [...groups.values()].slice(0, limit).map((bucket) => ({
    ...bucket,
    percent: Math.round(bucket.completed / bucket.planned * 100),
  }));
}
