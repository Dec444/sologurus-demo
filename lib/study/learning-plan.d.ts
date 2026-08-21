export type FeasibilityProfile = {
  level: string;
  goal: string;
  date: string;
  dailyHours: number;
  studyDays: number;
  consistency: "steady" | "sometimes" | "starting";
  examExperience: "taken" | "similar" | "first";
  language?: string;
};

export type StudyPlanRow = {
  day: number;
  date: string;
  dateLabel: string;
  phase: string;
  focus: string;
  textbook: string;
  practice: string;
  skill: string;
  durationMinutes: number;
  done: boolean;
};

export function assessFeasibility(profile: FeasibilityProfile, today?: Date): {
  status: "practical" | "tight" | "not-practical";
  title: string;
  advice: string;
  availableHours: number;
  neededHours: number;
  calendarDays: number;
  currentLevel: string;
  targetLevel: string;
  weeklyHours: number;
};

export function buildStudyPlan(profile: FeasibilityProfile, plan: unknown, resources: unknown, today?: Date): StudyPlanRow[];

export function buildProgressSeries(studyPlan: StudyPlanRow[], completedDays: number[], view: "daily" | "weekly" | "monthly"): Array<{
  key: string;
  label: string;
  planned: number;
  completed: number;
  percent: number;
}>;
