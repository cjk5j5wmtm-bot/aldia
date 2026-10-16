import { unallocated } from "./payments";
import { audit } from "./store-ops";
import type { Store } from "./types";

/** Clave de un pendiente: depende del período porque el mismo pendiente puede volver otro mes. */
export const taskKey = (period: string, taskId: string) => `tarea:${period}:${taskId}`;
export const paymentKey = (id: string) => `pago:${id}`;
export const settlementKey = (id: string) => `liq:${id}`;

export const isHidden = (store: Store, key: string) => Boolean(store.hiddenItems?.includes(key));

/**
 * Saca un elemento de la vista. No borra ni cambia nada: pagos, saldos, liquidaciones e historial quedan iguales.
 * Pagos: solo verificados y asignados del todo, o anulados. Liquidaciones: solo con la transferencia registrada.
 */
export function hideItem(store: Store, key: string, actor: string) {
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "pago") {
    const p = store.payments.find((x) => x.id === id);
    if (!p) throw new Error("No encontramos ese pago.");
    const done = p.status === "anulado" || (p.status === "confirmado" && unallocated(p).cents === 0);
    if (!done) throw new Error("Ese pago todavía tiene algo pendiente (verificarlo o asignarlo). Resolvelo antes de sacarlo de la lista.");
  } else if (kind === "liq") {
    const r = store.settlements.find((x) => x.id === id);
    if (!r) throw new Error("No encontramos esa liquidación.");
    if (r.status !== "pago_registrado") throw new Error("Primero registrá la transferencia al propietario. Después la podés sacar de la lista.");
  } else if (kind !== "tarea") {
    throw new Error("No se puede quitar ese elemento.");
  }
  if (isHidden(store, key)) return;
  store.hiddenItems = [...(store.hiddenItems ?? []), key];
  audit(store, actor, "quitar_de_lista", kind, id);
}

export function showItem(store: Store, key: string, actor: string) {
  if (!isHidden(store, key)) return;
  store.hiddenItems = (store.hiddenItems ?? []).filter((k) => k !== key);
  audit(store, actor, "volver_a_lista", key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1));
}
