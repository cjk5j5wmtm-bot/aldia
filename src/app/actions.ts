"use server";

import { revalidatePath } from "next/cache";
import { closePeriod } from "@/lib/domain/close";
import { money, type Currency } from "@/lib/domain/money";
import { addExpense, approveAdjustment, confirmExpense, discardExpense, loadIndexValue } from "@/lib/domain/operations";
import { allocate, confirmPayment, recordPayment, reverseAllocation, voidPayment } from "@/lib/domain/payments";
import { approveSettlement, markSettlementInformed, registerExternalTransfer } from "@/lib/domain/settlements";
import { audit } from "@/lib/domain/store-ops";
import type { Expense, IndexName, PaymentMethod } from "@/lib/domain/types";
import { ACTOR, getStore, resetDemo, save, today } from "@/lib/server/store";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Convierte "1.234,56" o "1234,56" o "1234" en centavos. Rechaza formatos ambiguos como "1,234.56". */
function parseAmount(raw: string): number {
  const v = raw.replace(/\s|\$/g, "");
  if (!v) throw new Error("Ingresá un importe.");
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(v) || /^\d+(,\d{1,2})?$/.test(v)) {
    return Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);
  }
  throw new Error(`No entiendo el importe "${raw}". Usá el formato 1.234,56 (punto para miles, coma para centavos).`);
}

async function run(fn: () => string): Promise<ActionResult> {
  const store = getStore();
  const backup = JSON.stringify(store);
  try {
    const message = fn();
    save(store);
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    // Si algo falla a mitad de camino, no queda nada a medio guardar.
    Object.assign(store, JSON.parse(backup));
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo completar la acción." };
  }
}

export async function approveAdjustmentAction(_: ActionResult | null, f: FormData) {
  return run(() => {
    approveAdjustment(getStore(), str(f, "contractId"), str(f, "period"), ACTOR);
    return "Aumento aprobado. El nuevo importe rige desde este período.";
  });
}

export async function loadIndexAction(_: ActionResult | null, f: FormData) {
  return run(() => {
    const value = Number(str(f, "value").replace(",", "."));
    loadIndexValue(getStore(), str(f, "index") as IndexName, str(f, "period"), value, str(f, "source"), ACTOR);
    return "Valor del índice guardado con su fuente.";
  });
}

export async function setLagAction(_: ActionResult | null, f: FormData) {
  return run(() => {
    const c = getStore().contracts.find((x) => x.id === str(f, "contractId"));
    if (!c?.adjustment) throw new Error("El contrato no tiene cláusula de actualización.");
    const lag = Number(str(f, "lag"));
    if (!Number.isInteger(lag) || lag < 0 || lag > 3) throw new Error("El rezago tiene que ser 0, 1, 2 o 3 meses.");
    if (!str(f, "basis")) throw new Error("Escribí en qué parte del contrato te basaste.");
    c.adjustment.referenceLagMonths = lag;
    c.adjustment.clauseText = `${c.adjustment.clauseText ?? ""} [Rezago definido: ${lag} mes(es). Base: ${str(f, "basis")}]`.trim();
    audit(getStore(), ACTOR, "definió el rezago del índice", "contrato", c.id, `${lag} mes(es)`, str(f, "basis"));
    return "Regla guardada. El aumento ya se puede calcular si están los valores del índice.";
  });
}

export async function recordPaymentAction(_: ActionResult | null, f: FormData) {
  return run(() => {
    const currency = str(f, "currency") as Currency;
    const { payment, duplicate } = recordPayment(getStore(), {
      amount: money(parseAmount(str(f, "amount")), currency),
      method: str(f, "method") as PaymentMethod,
      effectiveDate: str(f, "date"),
      reference: str(f, "reference") || undefined,
      payerNote: str(f, "note") || undefined,
      source: "manual",
      status: str(f, "verified") === "si" ? "confirmado" : "informado",
    }, ACTOR);
    if (duplicate) throw new Error("Ya hay un pago registrado con esos datos. No lo cargué de nuevo para evitar duplicarlo.");
    const contractId = str(f, "contractId");
    if (contractId) {
      const period = str(f, "period");
      const s = getStore();
      const c = s.contracts.find((x) => x.id === contractId);
      allocate(s, payment.id, contractId, period, Math.min(payment.amount.cents, parseAmount(str(f, "amount"))), ACTOR, today());
      return `Pago registrado y asignado a ${c?.code}.`;
    }
    return "Pago registrado. Quedó sin asignar: asignalo a un alquiler en la lista de pagos.";
  });
}

export async function confirmPaymentAction(_: ActionResult | null, f: FormData) {
  return run(() => (confirmPayment(getStore(), str(f, "paymentId"), ACTOR), "Pago confirmado: ahora cuenta como cobrado."));
}

export async function allocateAction(_: ActionResult | null, f: FormData) {
  return run(() => {
    const [contractId, period] = str(f, "chargeKey").split(":");
    if (!contractId) throw new Error("Elegí a qué alquiler corresponde.");
    allocate(getStore(), str(f, "paymentId"), contractId, period, parseAmount(str(f, "amount")), ACTOR, today());
    return "Pago asignado.";
  });
}

export async function reverseAllocationAction(_: ActionResult | null, f: FormData) {
  return run(() => (reverseAllocation(getStore(), str(f, "paymentId"), str(f, "allocationId"), ACTOR, str(f, "reason")), "Asignación revertida. Queda en el historial."));
}

export async function voidPaymentAction(_: ActionResult | null, f: FormData) {
  return run(() => (voidPayment(getStore(), str(f, "paymentId"), ACTOR, str(f, "reason")), "Pago anulado. Queda en el historial."));
}

export async function addExpenseAction(_: ActionResult | null, f: FormData) {
  return run(() => {
    const s = getStore();
    const c = s.contracts.find((x) => x.id === str(f, "contractId"));
    if (!c) throw new Error("Elegí el contrato.");
    addExpense(s, {
      contractId: c.id, description: str(f, "description"), category: str(f, "category") as Expense["category"],
      amount: money(parseAmount(str(f, "amount")), c.currency), date: str(f, "date"), bornBy: str(f, "bornBy") as Expense["bornBy"],
      period: str(f, "period"), provider: str(f, "provider") || undefined,
    }, ACTOR);
    return "Gasto cargado como pendiente. Confirmalo para que se descuente.";
  });
}

export async function confirmExpenseAction(_: ActionResult | null, f: FormData) {
  return run(() => (confirmExpense(getStore(), str(f, "expenseId"), ACTOR), "Gasto confirmado."));
}

export async function discardExpenseAction(_: ActionResult | null, f: FormData) {
  return run(() => (discardExpense(getStore(), str(f, "expenseId"), ACTOR, str(f, "reason")), "Gasto descartado."));
}

export async function approveSettlementAction(_: ActionResult | null, f: FormData) {
  return run(() => (approveSettlement(getStore(), str(f, "ownerId"), str(f, "period"), str(f, "currency") as Currency, ACTOR, today()), "Liquidación aprobada. Quedó guardada tal como está ahora."));
}

export async function informSettlementAction(_: ActionResult | null, f: FormData) {
  return run(() => (markSettlementInformed(getStore(), str(f, "id"), ACTOR), "Marcada como informada al propietario."));
}

export async function transferAction(_: ActionResult | null, f: FormData) {
  return run(() => (registerExternalTransfer(getStore(), str(f, "id"), str(f, "date"), str(f, "reference"), ACTOR), "Transferencia registrada. Al Día no la ejecuta: solo deja constancia."));
}

export async function closePeriodAction(_: ActionResult | null, f: FormData) {
  return run(() => (closePeriod(getStore(), str(f, "period"), ACTOR, today(), str(f, "reason") || undefined), "Mes cerrado. Queda guardado quién y cuándo lo cerró."));
}

export async function resetDemoAction() {
  resetDemo();
  revalidatePath("/", "layout");
}
