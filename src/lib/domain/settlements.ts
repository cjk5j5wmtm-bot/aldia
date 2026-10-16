import { chargeFor, contractCoversPeriod } from "./charges";
import { money, percentOf, sub, sum, zero, type Currency } from "./money";
import type { ISODate, Period } from "./period";
import type { SettlementBreakdown, SettlementLine, SettlementRecord, Store } from "./types";
import { audit, nextId, now } from "./store-ops";
import { assertOpen } from "./payments";
import { computeAdjustment, isAdjustmentPeriod } from "./adjustments";

/**
 * Liquidación de un propietario para un período y una moneda. Solo usa pagos confirmados y gastos confirmados.
 * Nunca mezcla monedas. Lo que falta revisar aparece en `blockers`.
 */
export function computeSettlement(store: Store, ownerId: string, period: Period, currency: Currency, asOf: ISODate): SettlementBreakdown {
  const lines: SettlementLine[] = [];
  const blockers: string[] = [];
  const contracts = store.contracts.filter(
    (c) => c.currency === currency && contractCoversPeriod(c, period) && c.owners.some((o) => o.ownerId === ownerId),
  );
  for (const c of contracts) {
    const shareBps = c.owners.find((o) => o.ownerId === ownerId)!.shareBps;
    const totalShare = c.owners.reduce((s, o) => s + o.shareBps, 0);
    if (totalShare !== 10000) blockers.push(`${c.code}: los porcentajes de los propietarios suman ${totalShare / 100}% y no 100%.`);
    const charge = chargeFor(store, c, period, asOf);
    if (charge.informed.cents > 0) blockers.push(`${c.code}: hay pagos informados sin confirmar.`);
    if (isAdjustmentPeriod(c, period)) {
      const adj = computeAdjustment(store, c, period);
      if (adj.status !== "aprobado" && adj.status !== "comunicado") blockers.push(`${c.code}: el aumento de este mes no está aprobado.`);
    }
    const collectedFull = charge.confirmed;
    const collected = percentOf(collectedFull, shareBps);
    const commission = c.commissionPaidBy === "propietario" ? percentOf(collected, c.commissionBps) : zero(currency);
    const exps = store.expenses.filter((e) => e.contractId === c.id && e.period === period && e.bornBy === "propietario" && e.amount.currency === currency);
    for (const e of exps.filter((e) => e.status === "pendiente")) blockers.push(`${c.code}: el gasto "${e.description}" está pendiente de revisión y no se descontó.`);
    const confirmedExps = exps
      .filter((e) => e.status === "confirmado")
      .map((e) => ({ id: e.id, description: e.description, amount: percentOf(e.amount, shareBps) }));
    lines.push({ contractId: c.id, contractCode: c.code, shareBps, collected, commission, expenses: confirmedExps });
  }
  const collected = sum(lines.map((l) => l.collected), currency);
  const commission = sum(lines.map((l) => l.commission), currency);
  const expenses = sum(lines.flatMap((l) => l.expenses.map((e) => e.amount)), currency);
  const net = sub(sub(collected, commission), expenses);
  return { ownerId, period, currency, lines, collected, commission, expenses, net, blockers };
}

export function ownersWithContracts(store: Store, period: Period) {
  const out = new Map<string, Set<Currency>>();
  for (const c of store.contracts.filter((c) => contractCoversPeriod(c, period))) {
    for (const o of c.owners) {
      if (!out.has(o.ownerId)) out.set(o.ownerId, new Set());
      out.get(o.ownerId)!.add(c.currency);
    }
  }
  return [...out.entries()].flatMap(([ownerId, cur]) => [...cur].map((currency) => ({ ownerId, currency })));
}

export const findSettlement = (store: Store, ownerId: string, period: Period, currency: Currency) =>
  store.settlements.find((s) => s.ownerId === ownerId && s.period === period && s.currency === currency);

export function approveSettlement(store: Store, ownerId: string, period: Period, currency: Currency, actor: string, asOf: ISODate): SettlementRecord {
  assertOpen(store, period);
  if (findSettlement(store, ownerId, period, currency)) throw new Error("Esta liquidación ya está aprobada.");
  const snapshot = computeSettlement(store, ownerId, period, currency, asOf);
  if (snapshot.blockers.length) throw new Error(`No se puede aprobar: ${snapshot.blockers[0]}`);
  const rec: SettlementRecord = { id: nextId(store, "liq"), ownerId, period, currency, status: "aprobada", snapshot, approvedBy: actor, approvedAt: now() };
  store.settlements.push(rec);
  audit(store, actor, "aprobó una liquidación", "liquidación", rec.id, `${period} ${currency} neto ${snapshot.net.cents / 100}`);
  return rec;
}

export function markSettlementInformed(store: Store, id: string, actor: string) {
  const s = store.settlements.find((x) => x.id === id);
  if (!s) throw new Error("No encontré la liquidación.");
  if (s.status !== "aprobada") throw new Error("Solo se informa una liquidación aprobada.");
  s.status = "informada";
  s.informedAt = now();
  audit(store, actor, "marcó la liquidación como informada al propietario", "liquidación", s.id);
}

/** La inmobiliaria registra una transferencia que hizo por fuera. Aldia no transfiere. */
export function registerExternalTransfer(store: Store, id: string, date: ISODate, reference: string, actor: string) {
  const s = store.settlements.find((x) => x.id === id);
  if (!s) throw new Error("No encontré la liquidación.");
  if (s.status === "pago_registrado") throw new Error("Ya hay una transferencia registrada para esta liquidación.");
  if (!reference.trim()) throw new Error("Cargá la referencia o número de operación de la transferencia.");
  s.status = "pago_registrado";
  s.externalTransfer = { date, reference: reference.trim(), by: actor, at: now() };
  audit(store, actor, "registró la transferencia hecha al propietario", "liquidación", s.id, reference);
}

export const settlementLabel = (s?: SettlementRecord) =>
  !s ? "Borrador" : s.status === "aprobada" ? "Aprobada" : s.status === "informada" ? "Informada al propietario" : "Transferencia registrada";

export const emptyMoney = (c: Currency) => money(0, c);
