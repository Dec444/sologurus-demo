import assert from "node:assert/strict";
import test from "node:test";
import { assessFeasibility, buildProgressSeries, buildStudyPlan } from "../lib/learning-plan.mjs";

const baseProfile = {
  language: "French",
  level: "B1 · Intermediate",
  goal: "Reach B2 French",
  date: "2027-04-01",
  dailyHours: 1.5,
  studyDays: 6,
  consistency: "steady",
  examExperience: "similar",
};

const resources = {
  recommendation: { name: "TCF" },
  textbooks: [
    { name: "Édito B1" },
    { name: "Grammaire progressive" },
    { name: "Vocabulaire progressif" },
  ],
  mockExams: [{ name: "TV5MONDE TCF mock" }],
  materials: {
    listening: [{ name: "RFI Savoirs" }],
    speaking: [{ name: "TV5MONDE speaking" }],
    reading: [{ name: "Le français facile" }],
    writing: [{ name: "TCF writing practice" }],
  },
};

test("feasibility answers honestly when time is practical or impossible", () => {
  const today = new Date("2026-07-23T00:00:00Z");
  const practical = assessFeasibility(baseProfile, today);
  assert.equal(practical.status, "practical");
  assert.ok(practical.availableHours >= practical.neededHours);
  assert.equal(practical.weeklyHours, 9);

  const impossible = assessFeasibility({ ...baseProfile, date: "2026-08-01", dailyHours: 0.5, studyDays: 2, consistency: "starting" }, today);
  assert.equal(impossible.status, "not-practical");
  assert.match(impossible.advice, /Move the test date|plan about/);

  const expired = assessFeasibility({ ...baseProfile, date: "2026-01-01" }, today);
  assert.equal(expired.status, "not-practical");
  assert.match(expired.title, /already passed/);
});

test("study plan mirrors the workbook structure with dated phases and resources", () => {
  const rows = buildStudyPlan(baseProfile, { name: "Balanced" }, resources, new Date("2026-07-23T00:00:00Z"));
  assert.ok(rows.length >= 14);
  assert.ok(rows.length <= 84);
  assert.deepEqual(new Set(rows.map((row) => row.phase)), new Set(["Foundation", "Skill building", "Exam technique", "Mock & taper"]));
  assert.ok(rows.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date)));
  assert.ok(rows.every((row) => row.textbook && row.practice && row.durationMinutes === 90));
  assert.equal(rows.at(-1).focus, "Light review only · confirm logistics and protect sleep");
});

test("progress series groups completed sessions into daily, weekly, and monthly statistics", () => {
  const rows = buildStudyPlan(baseProfile, { name: "Balanced" }, resources, new Date("2026-07-23T00:00:00Z"));
  const completed = rows.slice(0, 8).map((row) => row.day);
  for (const view of ["daily", "weekly", "monthly"]) {
    const series = buildProgressSeries(rows, completed, view);
    assert.ok(series.length > 0);
    assert.ok(series.every((point) => point.percent >= 0 && point.percent <= 100));
    assert.ok(series.some((point) => point.completed > 0));
  }
});
