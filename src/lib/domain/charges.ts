import { computeAdjustment, isAdjustmentPeriod, rentInForce } from "./adjustments";
import { money, roundCents, sub, sum, type Money } from "./money";
import { addDays, daysBetween, dueDate, monthsBetween, periodOf, type ISODate, type Period } from "./period";
import type { Contract, Payment, Store } from "./types";

export const chargeKey = (contractId: string, period: Period) => `${contractId}:${period}`;

export type ChargeStatus = "pagado" | "parcial" | "vencido" | "por_vencer";

export const CHARGE_LABEL: Record<ChargeStatus, string> = {
  pagado: "Pagado",
  parcial: "Pago parcial",
  vencido: "Vencido",
  por_vencer: "Por vencer",
};

export interface LateFeeCalc {
  amount: Money;
  explanation: string;
  /** Siempre "calculado": no se cobra ni se suma a ningún total hasta que el administrador lo decida. */
  status: "calculado";
}

export interface Charge {
  key: string;
  contract: Contract;
  period: Period;
  dueDate: ISODate;
  amount: Money;
  /** true si hay un aumento de este período sin aprobar: el importe todavía no es definitivo. */
  provisional: boolean;
  /** Pagos verificados por el administrador. */
  confirmed: Money;
  /** Pagos informados, todavía sin verificar. No cuentan como cobrados. */
  informed: Money;
  balance: Money;
  status: ChargeStatus;
  daysLate: number;
  lateFee: LateFeeCalc | null;
  lastPaymentDate?: ISODate;
}

export const contractCoversPeriod = (c: Contract, p: Period) =>
  c.status !== "archivado" && monthsBetween(periodOf(c.startDate), p) >= 0 && monthsBetween(p, periodOf(c.endDate)) >= 0;

function activeAllocations(payments: Payment[], key: string, status: Payment["status"]) {
  return payments
    .filter((p) => p.status === status)
    .flatMap((p) => p.allocations.filter((a) => a.chargeKey === key && !a.reversed).map((a) => ({ a, p })));
}

/**
 * Punitorios sobre el saldo vencido, solo si el contrato tiene una regla cargada.
 * Sin regla devuelve null: el sistema no inventa tasas.
 */
export function lateFeeFor(contract: Contract, amount: Money, due: ISODate, paid: { date: ISODate; cents: number }[], asOf: ISODate): LateFeeCalc | null {
  const rule = contract.lateFee;
  if (!rule) return null;
  const graceEnd = addDays(due, rule.graceDays);
  const chunks = [...paid].sort((a, b) => daysBetween(b.date, a.date));
  // Fecha en que el saldo llegó a cero (o hoy, si sigue debiendo).
  let running = amount.cents;
  let settledOn: ISODate | undefined;
  for (const ch of chunks) {
    running -= ch.cents;
    if (running <= 0) { settledOn = ch.date; break; }
  }
  const until = settledOn ?? asOf;
  if (daysBetween(graceEnd, until) <= 0) return null;

  const start = rule.accrueFrom === "vencimiento" ? due : graceEnd;
  let balance = amount.cents;
  let cursor = start;
  let raw = 0;
  const segs: string[] = [];
  const accrue = (to: ISODate) => {
    const d = daysBetween(cursor, to);
    if (balance > 0 && d > 0) {
      raw += (balance * rule.dailyRateBps * d) / 10000;
      segs.push(`${d} días sobre ${(balance / 100).toLocaleString("es-AR")}`);
    }
  };
  for (const ch of chunks) {
    if (daysBetween(cursor, ch.date) > 0) { accrue(ch.date); cursor = ch.date; }
    balance -= ch.cents;
    if (balance <= 0) break;
  }
  if (balance > 0) accrue(asOf);
  if (raw <= 0) return null;
  const rate = (rule.dailyRateBps / 100).toString().replace(".", ",");
  const from = rule.accrueFrom === "vencimiento" ? "desde el vencimiento" : `desde el fin de la gracia de ${rule.graceDays} días`;
  return {
    amount: money(roundCents(raw), amount.currency),
    explanation: `Interés simple de ${rate}% diario ${from}: ${segs.join("; ")}. Regla cargada del contrato: "${rule.clauseText}".`,
    status: "calculado",
  };
}

export function chargeFor(store: Store, contract: Contract, period: Period, asOf: ISODate): Charge {
  const key = chargeKey(contract.id, period);
  const amount = rentInForce(contract, period, store.adjustments);
  const adj = isAdjustmentPeriod(contract, period) ? computeAdjustment(store, contract, period) : null;
  const provisional = !!adj && adj.status !== "aprobado" && adj.status !== "comunicado";
  const conf = activeAllocations(store.payments, key, "confirmado");
  const inf = activeAllocations(store.payments, key, "informado");
  const confirmed = sum(conf.map((x) => x.a.amount), contract.currency);
  const informed = sum(inf.map((x) => x.a.amount), contract.currency);
  const balance = sub(amount, confirmed);
  const due = dueDate(period, contract.dueDay);
  const late = daysBetween(due, asOf);
  const status: ChargeStatus =
    balance.cents <= 0 ? "pagado" : late > 0 ? "vencido" : confirmed.cents > 0 ? "parcial" : "por_vencer";
  const chunks = conf.map((x) => ({ date: x.p.effectiveDate, cents: x.a.amount.cents }));
  const lastPaymentDate = chunks.map((c) => c.date).sort().at(-1);
  return {
    key, contract, period, dueDate: due, amount, provisional, confirmed, informed, balance, status,
    daysLate: balance.cents > 0 ? Math.max(0, late) : 0,
    lateFee: lateFeeFor(contract, amount, due, chunks, asOf),
    lastPaymentDate,
  };
}

export function chargesFor(store: Store, period: Period, asOf: ISODate): Charge[] {
  return store.contracts.filter((c) => contractCoversPeriod(c, period)).map((c) => chargeFor(store, c, period, asOf));
}
