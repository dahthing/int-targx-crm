import { describe, it, expect } from 'vitest';
import {
  buildGanttData,
  adjustPhaseStart,
  calculateWorkingDays,
} from '../gantt.functions';

// Monday 2024-01-08
const MONDAY = new Date('2024-01-08T00:00:00.000Z');

// ── TIQS-037: duration_days = hours / daily_capacity ──────────────────────────
describe('TIQS-037: duration calculation 100h ÷ 8h/day = 13 working days', () => {
  it('calculates 13 days for 100h at 8h/day', () => {
    const phases = [{ id: 'p1', name: 'Fase 1', total_hours: 100 }];
    const result = buildGanttData(phases, MONDAY, 8);
    expect(result[0].duration_days).toBe(13); // ceil(100/8) = 13
  });

  it('uses ceil for non-round divisions', () => {
    const phases = [{ id: 'p1', name: 'Fase 1', total_hours: 10 }];
    const result = buildGanttData(phases, MONDAY, 8);
    expect(result[0].duration_days).toBe(2); // ceil(10/8) = 2
  });
});

// ── TIQS-038: phases chained from gantt_start_date ──────────────────────────
describe('TIQS-038: phases chained — phase 2 starts day after phase 1 ends', () => {
  it('phase 2 start is next working day after phase 1 end', () => {
    const phases = [
      { id: 'p1', name: 'Fase 1', total_hours: 8 },  // 1 day
      { id: 'p2', name: 'Fase 2', total_hours: 8 },  // 1 day
    ];
    const result = buildGanttData(phases, MONDAY, 8);

    // Phase 1: Mon Jan 8, lasts 1 day → ends Jan 8
    // Phase 2: starts Jan 9 (Tuesday)
    expect(result[0].start_date.toISOString().slice(0, 10)).toBe('2024-01-08');
    expect(result[0].end_date.toISOString().slice(0, 10)).toBe('2024-01-08');
    expect(result[1].start_date.toISOString().slice(0, 10)).toBe('2024-01-09');
  });

  it('skips weekend between phases when phase 1 ends on Friday', () => {
    const friday = new Date('2024-01-12T00:00:00.000Z'); // Friday
    const phases = [
      { id: 'p1', name: 'Fase 1', total_hours: 8 },  // 1 day → ends Friday
      { id: 'p2', name: 'Fase 2', total_hours: 8 },  // should start Monday
    ];
    const result = buildGanttData(phases, friday, 8);
    expect(result[0].end_date.toISOString().slice(0, 10)).toBe('2024-01-12'); // Friday
    expect(result[1].start_date.toISOString().slice(0, 10)).toBe('2024-01-15'); // Monday
  });
});

// ── TIQS-039: adjusting a phase start cascades subsequent phases ─────────────
describe('TIQS-039: adjust phase start cascades all following phases', () => {
  it('moving phase 1 start shifts phase 2 accordingly', () => {
    const phases = [
      { id: 'p1', name: 'Fase 1', total_hours: 8 },
      { id: 'p2', name: 'Fase 2', total_hours: 8 },
    ];
    const original = buildGanttData(phases, MONDAY, 8);

    // Move phase 1 to Wednesday Jan 10
    const wednesday = new Date('2024-01-10T00:00:00.000Z');
    const adjusted = adjustPhaseStart(original, 'p1', wednesday, 8);

    expect(adjusted[0].start_date.toISOString().slice(0, 10)).toBe('2024-01-10');
    expect(adjusted[0].end_date.toISOString().slice(0, 10)).toBe('2024-01-10');
    expect(adjusted[1].start_date.toISOString().slice(0, 10)).toBe('2024-01-11');
  });

  it('moving phase 2 only shifts phase 2 and later, not phase 1', () => {
    const phases = [
      { id: 'p1', name: 'Fase 1', total_hours: 8 },
      { id: 'p2', name: 'Fase 2', total_hours: 8 },
      { id: 'p3', name: 'Fase 3', total_hours: 8 },
    ];
    const original = buildGanttData(phases, MONDAY, 8);
    const originalP1Start = original[0].start_date.toISOString().slice(0, 10);

    // Move phase 2 to Jan 15 (Monday)
    const jan15 = new Date('2024-01-15T00:00:00.000Z');
    const adjusted = adjustPhaseStart(original, 'p2', jan15, 8);

    // Phase 1 unchanged
    expect(adjusted[0].start_date.toISOString().slice(0, 10)).toBe(originalP1Start);
    // Phase 2 moved
    expect(adjusted[1].start_date.toISOString().slice(0, 10)).toBe('2024-01-15');
    // Phase 3 cascaded
    expect(adjusted[2].start_date.toISOString().slice(0, 10)).toBe('2024-01-16');
  });
});

// ── TIQS-040: weekends excluded ──────────────────────────────────────────────
describe('TIQS-040: weekends excluded from working day calculation', () => {
  it('5 working days from Monday = Friday', () => {
    const monday = new Date('2024-01-08T00:00:00.000Z');
    const result = calculateWorkingDays(monday, 5);
    expect(result.toISOString().slice(0, 10)).toBe('2024-01-12'); // Friday
  });

  it('6 working days from Monday skips weekend → next Monday', () => {
    const monday = new Date('2024-01-08T00:00:00.000Z');
    const result = calculateWorkingDays(monday, 6);
    expect(result.toISOString().slice(0, 10)).toBe('2024-01-15'); // next Monday
  });

  it('1 working day from Friday = Friday (same day)', () => {
    const friday = new Date('2024-01-12T00:00:00.000Z');
    const result = calculateWorkingDays(friday, 1);
    expect(result.toISOString().slice(0, 10)).toBe('2024-01-12');
  });

  it('10 working days from Monday = 2 weeks later (same day)', () => {
    const monday = new Date('2024-01-08T00:00:00.000Z');
    const result = calculateWorkingDays(monday, 10);
    expect(result.toISOString().slice(0, 10)).toBe('2024-01-19'); // Friday of second week
  });
});
