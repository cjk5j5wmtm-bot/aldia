import { chargeFor } from "./charges";
import { money, type Money } from "./money";
import type { ISODate, Period } from "./period";
import type { Payment, PaymentMethod, Store } from "./types";
import { audit, nextId, now } from "./store-ops";

export interface RecordPaymentInput {
  amount: Money;
  method: PaymentMethod;
  effectiveDate: ISODate;
  reference?: string;
  source: "manual" | "importado";
  status: "informado" | "confirmado";
  payerNote?: string;
}

export function dedupeKeyOf(i: RecordPaymentInput) {
  return i.reference?.trim()
    ? `${i.method}:ref:${i.reference.trim().toLowerCase()}`
    : `${i.method}:${i.effectiveDate}:${i.amount.currency}:${i.amount.cents}:${(i.payerNote ?? "").trim().toLowerCase()}`;
}

/** Registra un pago. Si ya existe uno con la misma clave (misma referencia), no lo duplica y devuelve el existente. */
export function recordPayment(store: Store, input: RecordPaymentInput, actor: string): { payment: Payment; duplicate: boolean } {
  if (input.amount.cents <= 0) throw new Error("El importe tiene que ser mayor a cero.");
  const key = dedupeKeyOf(input);
  const existing = store.payments.find((p) => p.dedupeKey === key && p.status !== "anulado");
  if (existing) return { payment: existing, duplicate: true };
  const payment: Payment = {
    id: nextId(store, "pag"), orgId: store.org.id, amount: input.amount, method: input.method, effectiveDate: input.effectiveDate,
    recordedAt: now(), recordedBy: actor, reference: input.reference?.trim() || undefined, source: input.source, dedupeKey: key,
    status: input.status, payerNote: input.payerNote, allocations: [],
    ...(input.status === "confirmado" ? { confirmedBy: actor, confirmedAt: now() } : {}),
  };
  store.payments.push(payment);
  audit(store, actor, "registró un pago", "pago", payment.id, `${input.amount.currency} ${input.amount.cents / 100} · ${input.status}`);
  return { payment, duplicate: false };
}

export function confirmPayment(store: Store, paymentId: string, actor: string) {
  const p = getPayment(store, paymentId);
  if (p.status !== "informado") throw new Error("Solo se puede confirmar un pago informado.");
  p.status = "confirmado";
  p.confirmedBy = actor;
  p.confirmedAt = now();
  audit(store, actor, "confirmó que el pago está en la cuenta", "pago", p.id);
}

export function voidPayment(store: Store, paymentId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error("Indicá el motivo para anular el pago.");
  const p = getPayment(store, paymentId);
  if (p.allocations.some((a) => !a.reversed)) throw new Error("Primero revertí las asignaciones del pago.");
  p.status = "anulado";
  audit(store, actor, "anuló un pago", "pago", p.id, undefined, reason);
}

export const allocated = (p: Payment) => p.allocations.filter((a) => !a.reversed).reduce((s, a) => s + a.amount.cents, 0);
export const unallocated = (p: Payment): Money => money(p.amount.cents - allocated(p), p.amount.currency);

/** Asigna parte o todo un pago a un alquiler. No permite pasarse del saldo ni del pago. */
export function allocate(store: Store, paymentId: string, contractId: string, period: Period, cents: number, actor: string, asOf: ISODate) {
  const p = getPayment(store, paymentId);
  if (p.status === "anulado") throw new Error("El pago está anulado.");
  assertOpen(store, period);
  const contract = store.contracts.find((c) => c.id === contractId);
  if (!contract) throw new Error("No encontré el contrato.");
  if (contract.currency !== p.amount.currency) throw new Error(`El pago es en ${p.amount.currency} y el contrato en ${contract.currency}.`);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("El importe a asignar tiene que ser mayor a cero.");
  if (cents > unallocated(p).cents) throw new Error("Ese importe supera lo que queda sin asignar del pago.");
  const charge = chargeFor(store, contract, period, asOf);
  const available = charge.balance.cents - charge.informed.cents;
  if (cents > available) {
    throw new Error("Ese importe supera el saldo del alquiler. Asigná solo el saldo y dejá el resto sin asignar para revisarlo.");
  }
  const alloc = { id: nextId(store, "asg"), chargeKey: charge.key, amount: money(cents, p.amount.currency), by: actor, at: now() };
  p.allocations.push(alloc);
  audit(store, actor, "asignó un pago a un alquiler", "pago", p.id, `${contract.code} ${period}: ${cents / 100}`);
  return alloc;
}

export function reverseAllocation(store: Store, paymentId: string, allocationId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new Error("Indicá el motivo para revertir la asignación.");
  const p = getPayment(store, paymentId);
  const a = p.allocations.find((x) => x.id === allocationId);
  if (!a || a.reversed) throw new Error("No encontré esa asignación activa.");
  assertOpen(store, a.chargeKey.split(":")[1]);
  a.reversed = { by: actor, at: now(), reason };
  audit(store, actor, "revirtió una asignación", "pago", p.id, a.chargeKey, reason);
}

export function getPayment(store: Store, id: string) {
  const p = store.payments.find((x) => x.id === id);
  if (!p) throw new Error("No encontré el pago.");
  return p;
}

export function assertOpen(store: Store, period: Period) {
  if (store.closes.some((c) => c.period === period)) {
    throw new Error(`El período ${period} está cerrado. Los cambios se registran como ajuste en el período siguiente.`);
  }
}
