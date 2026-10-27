import type { LeaveStatus } from "../types";

export const STATUS_ORDER: LeaveStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
export const STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled",
};

export function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function fmtDateRange(start: string, end: string): string {
  return start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** Today as YYYY-MM-DD in the browser's local timezone. */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Mon–Fri count, only for the live preview. The server is the source of truth. */
export function countWorkingDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  if ((last.getTime() - cursor.getTime()) / 86_400_000 > 366) return 0;
  let days = 0;
  while (cursor <= last) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}