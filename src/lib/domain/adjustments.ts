import { DEFAULT_ROUNDING, money, roundCents, type Money, type RoundingRule } from "./money";
import { addMonths, monthsBetween, periodOf, type Period } from "./period";
import type { ApprovedAdjustment, Contract, IndexName, IndexValue, Store } from "./types";

/** Períodos en los que corresponde un aumento, desde el primero hasta `until` inclusive, dentro del contrato. */
export function adjustmentPeriods(contract: Contract, until: Period): Period[] {
  const clause = contract.adjustment;
  if (!clause || clause.everyMonths <= 0) return [];
  const end = periodOf(contract.endDate);
  const out: Period[] = [];
  for (let p = clause.firstPeriod; monthsBetween(p, until) >= 0 && monthsBetween(p, end) >= 0; p = addMonths(p, clause.everyMonths)) {
    out.push(p);
  }
  return out;
}

export const isAdjustmentPeriod = (contract: Contract, period: Period) => adjustmentPeriods(contract, period).includes(period);

export function findIndexValue(values: IndexValue[], index: IndexName, period: Period) {
  return values.find((v) => v.index === index && v.period === period);
}

export interface AdjustmentCalc {
  contractId: string;
  period: Period;
  status: "pendiente" | "calculado" | "aprobado" | "comunicado";
  previous: Money;
  /** Solo existe si se pudo calcular. */
  result?: Money;
  index: IndexName;
  startRef?: Period;
  endRef?: Period;
  startValue?: number;
  endValue?: number;
  factor?: number;
  rounding: RoundingRule;
  /** Por qué no se puede calcular o aprobar todavía. */
  missing: string[];
  approved?: ApprovedAdjustment;
}

/** Alquiler vigente en un período según los aumentos aprobados. Los aumentos no aprobados no se aplican. */
export function rentInForce(contract: Contract, period: Period, approved: ApprovedAdjustment[]): Money {
  const mine = approved
    .filter((a) => a.contractId === contract.id && monthsBetween(a.period, period) >= 0)
    .sort((a, b) => monthsBetween(b.period, a.period));
  return mine.length ? mine[mine.length - 1].result : contract.initialRent;
}

/** Calcula, sin guardar nada, el aumento de un contrato para un período de aumento. */
export function computeAdjustment(store: Store, contract: Contract, period: Period): AdjustmentCalc {
  const clause = contract.adjustment;
  if (!clause) throw new Error("El contrato no tiene cláusula de actualización");
  const approved = store.adjustments.find((a) => a.contractId === contract.id && a.period === period);
  const previous = rentInForce(contract, addMonths(period, -1), store.adjustments);
  const rounding = clause.rounding ?? DEFAULT_ROUNDING;
  if (approved) {
    return {
      contractId: contract.id, period, status: approved.status, previous: approved.previous, result: approved.result,
      index: approved.index, startRef: approved.startRef, endRef: approved.endRef, startValue: approved.startValue,
      endValue: approved.endValue, factor: approved.factor, rounding: approved.rounding, missing: [], approved,
    };
  }
  const base: AdjustmentCalc = { contractId: contract.id, period, status: "pendiente", previous, index: clause.index, rounding, missing: [] };
  if (clause.ambiguity) base.missing.push(`Cláusula marcada como ambigua: ${clause.ambiguity}`);
  if (clause.referenceLagMonths === undefined) {
    base.missing.push("El contrato no indica qué mes del índice se toma (rezago). Revisá la cláusula y cargalo.");
    return base;
  }
  const endRef = addMonths(period, -clause.referenceLagMonths);
  const startRef = addMonths(endRef, -clause.everyMonths);
  base.startRef = startRef;
  base.endRef = endRef;
  const s = findIndexValue(store.indexValues, clause.index, startRef);
  const e = findIndexValue(store.indexValues, clause.index, endRef);
  if (!s) base.missing.push(`Falta el valor de ${clause.index} de ${startRef}. Cargalo con su fuente.`);
  if (!e) base.missing.push(`Falta el valor de ${clause.index} de ${endRef}. Cargalo con su fuente.`);
  if (!s || !e) return base;
  const factor = e.value / s.value;
  const result = money(roundCents(previous.cents * factor, rounding), previous.currency);
  return { ...base, status: base.missing.length ? "pendiente" : "calculado", startValue: s.value, endValue: e.value, factor, result };
}

export function explainAdjustment(c: AdjustmentCalc): string | undefined {
  if (c.factor === undefined || c.startValue === undefined || c.endValue === undefined) return undefined;
  const pct = ((c.factor - 1) * 100).toFixed(2).replace(".", ",");
  return `${c.index} ${c.endRef} (${c.endValue}) ÷ ${c.index} ${c.startRef} (${c.startValue}) = ${c.factor.toFixed(6).replace(".", ",")} → +${pct}%`;
}
