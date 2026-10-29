/** Hours left on an SLA (negative once overdue), rounded towards the user's interest. */
export function slaHours(dueAt: string, now: Date = new Date()): number {
  const hours = (Date.parse(dueAt) - now.getTime()) / 3_600_000;
  return hours >= 0 ? Math.floor(hours) : -Math.ceil(-hours);
}
