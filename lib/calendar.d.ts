export type CalendarProfile = { goal: string; date: string; hours: number; timezone?: string };
export type CalendarPlan = { id: string; name: string; sample: string[] };
export function makeCalendarIcs(profile: CalendarProfile, plan: CalendarPlan): string;
