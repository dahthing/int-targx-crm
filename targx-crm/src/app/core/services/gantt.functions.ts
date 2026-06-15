export interface GanttPhase {
  id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  duration_days: number;
}

/** Returns true if the given date is a weekend (Sat or Sun). */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Adds `durationDays` working days (Mon–Fri) to `startDate`.
 * The startDate itself counts as day 1 if it is a working day.
 * Returns the end date (last working day).
 */
export function calculateWorkingDays(startDate: Date, durationDays: number): Date {
  const result = new Date(startDate);
  let remaining = durationDays;

  // Advance past any initial weekend on startDate
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
  }

  // Count down working days
  remaining -= 1; // startDate counts as day 1
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      remaining--;
    }
  }

  return result;
}

/**
 * Returns the next working day after `date`.
 */
function nextWorkingDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Builds the full Gantt schedule from a list of phases with hours,
 * a project start date, and a daily capacity in hours.
 * Each phase starts the working day after the previous one ends.
 */
export function buildGanttData(
  phases: Array<{ id: string; name: string; total_hours: number }>,
  startDate: Date,
  dailyCapacityHours: number,
): GanttPhase[] {
  const result: GanttPhase[] = [];
  let currentStart = new Date(startDate);

  // Skip initial weekend on startDate
  while (isWeekend(currentStart)) {
    currentStart.setDate(currentStart.getDate() + 1);
  }

  for (const phase of phases) {
    const duration_days = Math.ceil(phase.total_hours / dailyCapacityHours);
    const end_date = calculateWorkingDays(currentStart, duration_days);

    result.push({
      id: phase.id,
      name: phase.name,
      start_date: new Date(currentStart),
      end_date: new Date(end_date),
      duration_days,
    });

    currentStart = nextWorkingDay(end_date);
  }

  return result;
}

/**
 * Moves a specific phase to a new start date, recomputes its end date,
 * and cascades all subsequent phases forward accordingly.
 */
export function adjustPhaseStart(
  ganttPhases: GanttPhase[],
  phaseId: string,
  newStartDate: Date,
  dailyCapacityHours: number,
): GanttPhase[] {
  const phaseIndex = ganttPhases.findIndex((p) => p.id === phaseId);
  if (phaseIndex === -1) return ganttPhases;

  const result: GanttPhase[] = ganttPhases.map((p) => ({ ...p }));
  let currentStart = new Date(newStartDate);

  // Skip initial weekend
  while (isWeekend(currentStart)) {
    currentStart.setDate(currentStart.getDate() + 1);
  }

  for (let i = phaseIndex; i < result.length; i++) {
    const phase = result[i];
    phase.start_date = new Date(currentStart);
    phase.end_date = calculateWorkingDays(currentStart, phase.duration_days);
    currentStart = nextWorkingDay(phase.end_date);
  }

  return result;
}
