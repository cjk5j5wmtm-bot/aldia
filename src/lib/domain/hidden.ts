import { assertOpen, getPayment } from "./payments";
import { now } from "./store-ops";
import { audit } from "./store-ops";
import type { Store } from "./types";

/** Clave de un pendiente: depende del período porque el mismo pendiente puede volver otro mes. */
export const taskKey = (period: string, taskId: string) => `tarea:${period}:${taskId}`;
export const paymentKey = (id: string) => `pago:${id}`;
export const settlementKey = (id: string) => `liq:${id}`;

export const isHidden = (store: Store, key: string) => Boolean(store.hiddenItems?.includes(key));

/**
 * Saca un elemento de la vista. No borra ni cambia nada: pagos, saldos, liquidaciones e historial quedan iguales.
 * Pagos: se borran de verdad (ver deletePayment). Liquidaciones: solo con la transferencia registrada.
 */
export function hideItem(store: Store, key: string, actor: string) {
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "pago") {
    deletePayment(store, id, actor);
  } else if (kind === "liq") {
    const r = store.settlements.find((x) => x.id === id);
    if (!r) throw new Error("No encontramos esa liquidación.");
    if (r.status !== "pago_registrado") throw new Error("Primero registrá la transferencia al propietario. Después la podés sacar de la lista.");
  } else if (kind !== "tarea") {
    throw new Error("No se puede quitar ese elemento.");
  }
  if (isHidden(store, key)) return;
  store.hiddenItems = [...(store.hiddenItems ?? []), key];
  if (kind !== "pago") audit(store, actor, "quitó de la lista", kind, id);
}

export function showItem(store: Store, key: string, actor: string) {
  if (!isHidden(store, key)) return;
  store.hiddenItems = (store.hiddenItems ?? []).filter((k) => k !== key);
  audit(store, actor, "volvió a mostrar", key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1));
}

/**
 * Borra un pago: revierte sus asignaciones (el alquiler vuelve a figurar como impago), lo anula y lo saca de la lista.
 * No se puede si el mes está cerrado o si el pago ya entró en una liquidación aprobada: eso cambiaría lo que se le informó al dueño.
 */
export function deletePayment(store: Store, paymentId: string, actor: string) {
  const p = getPayment(store, paymentId);
  const active = p.allocations.filter((a) => !a.reversed);
  for (const a of active) {
    const [contractId, period] = a.chargeKey.split(":");
    assertOpen(store, period);
    const settled = store.settlements.find((r) => r.period === period && r.snapshot.lines.some((l) => l.contractId === contractId));
    if (settled) throw new Error("Este pago ya está en una liquidación aprobada a un propietario. No se puede borrar sin cambiar lo que se le informó.");
  }
  for (const a of active) a.reversed = { by: actor, at: now(), reason: "Pago borrado" };
  if (p.status !== "anulado") p.status = "anulado";
  audit(store, actor, "borró un pago", "pago", p.id, `${p.amount.cents / 100} ${p.amount.currency}`);
}
