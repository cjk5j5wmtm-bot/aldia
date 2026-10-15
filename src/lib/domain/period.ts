// Períodos "YYYY-MM" y fechas "YYYY-MM-DD" en hora de Argentina, sin componente horario.
export type Period = string;
export type ISODate = string;

export function parsePeriod(p: Period): { y: number; m: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(p);
  if (!match) throw new Error(`Período inválido: ${p}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) throw new Error(`Período inválido: ${p}`);
  return { y, m };
}

export function addMonths(p: Period, n: number): Period {
  const { y, m } = parsePeriod(p);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: Period, to: Period): number {
  const a = parsePeriod(from);
  const b = parsePeriod(to);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export const periodOf = (d: ISODate): Period => d.slice(0, 7);

export function daysInMonth(p: Period): number {
  const { y, m } = parsePeriod(p);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Fecha de vencimiento del período. Si el día no existe (31 en febrero), usa el último día del mes. */
export function dueDate(p: Period, dueDay: number): ISODate {
  const d = Math.min(dueDay, daysInMonth(p));
  return `${p}-${String(d).padStart(2, "0")}`;
}

const toUTC = (d: ISODate) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

export const daysBetween = (from: ISODate, to: ISODate) => Math.round((toUTC(to) - toUTC(from)) / 86400000);

export function formatPeriod(p: Period): string {
  const { y, m } = parsePeriod(p);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  return `${name} ${y}`;
}

export function formatDate(d: ISODate): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function addDays(d: ISODate, n: number): ISODate {
  const t = new Date(toUTC(d) + n * 86400000);
  return t.toISOString().slice(0, 10);
}
