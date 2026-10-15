import { computeAdjustment } from "./adjustments";
import type { Period } from "./period";
import { assertOpen } from "./payments";
import { audit, nextId, now } from "./store-ops";
import type { ApprovedAdjustment, Expense, IndexName, Store } from "./types";

/** Carga manual del valor de un índice. Exige fuente: el sistema no trae valores oficiales solo. */
export function loadIndexValue(store: Store, index: IndexName, period: Period, value: number, source: string, actor: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error("El valor del índice tiene que ser un número mayor a cero.");
  if (!source.trim()) throw new Error("Indicá de dónde sacaste el valor (por ejemplo, la página del INDEC o del BCRA).");
  const existing = store.indexValues.find((v) => v.index === index && v.period === period);
  if (existing) throw new Error(`Ya hay un valor de ${index} para ${period}: ${existing.value} (${existing.source}).`);
  store.indexValues.push({ index, period, value, source: source.trim(), loadedBy: actor, loadedAt: now() });
  audit(store, actor, "cargó un valor de índice", "índice", `${index}:${period}`, `${value} · ${source}`);
}

export function approveAdjustment(store: Store, contractId: string, period: Period, actor: string): ApprovedAdjustment {
  assertOpen(store, period);
  const contract = store.contracts.find((c) => c.id === contractId);
  if (!contract) throw new Error("No encontré el contrato.");
  const calc = computeAdjustment(store, contract, period);
  if (calc.status === "aprobado" || calc.status === "comunicado") throw new Error("Este aumento ya está aprobado.");
  if (calc.status !== "calculado" || !calc.result || calc.factor === undefined) {
    throw new Error(`Todavía no se puede aprobar: ${calc.missing[0] ?? "faltan datos"}`);
  }
  const rec: ApprovedAdjustment = {
    id: nextId(store, "aum"), contractId, period, previous: calc.previous, result: calc.result, index: calc.index,
    startRef: calc.startRef!, endRef: calc.endRef!, startValue: calc.startValue!, endValue: calc.endValue!, factor: calc.factor,
    rounding: calc.rounding, status: "aprobado", approvedBy: actor, approvedAt: now(),
  };
  store.adjustments.push(rec);
  audit(store, actor, "aprobó un aumento", "contrato", contractId, `${period}: ${calc.previous.cents / 100} → ${calc.result.cents / 100}`);
  return rec;
}

export function confirmExpense(store: Store, expenseId: string, actor: string) {
  const e = getExpense(store, expenseId);
  assertOpen(store, e.period);
  if (e.status !== "pendiente") throw new Error("Solo se confirma un gasto pendiente.");
  e.status = "confirmado";
  audit(store, actor, "confirmó un gasto", "gasto", e.id, e.description);
}

export function discardExpense(store: Store, expenseId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error("Indicá por qué se descarta el gasto.");
  const e = getExpense(store, expenseId);
  assertOpen(store, e.period);
  e.status = "descartado";
  audit(store, actor, "descartó un gasto", "gasto", e.id, e.description, reason);
}

export function addExpense(store: Store, input: Omit<Expense, "id" | "orgId" | "status">, actor: string) {
  assertOpen(store, input.period);
  if (input.amount.cents <= 0) throw new Error("El importe tiene que ser mayor a cero.");
  if (!input.description.trim()) throw new Error("Escribí una descripción del gasto.");
  const e: Expense = { ...input, id: nextId(store, "gas"), orgId: store.org.id, status: "pendiente" };
  store.expenses.push(e);
  audit(store, actor, "cargó un gasto", "gasto", e.id, e.description);
  return e;
}

function getExpense(store: Store, id: string) {
  const e = store.expenses.find((x) => x.id === id);
  if (!e) throw new Error("No encontré el gasto.");
  return e;
}
