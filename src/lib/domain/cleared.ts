import type { Charge } from "./charges";
import { audit } from "./store-ops";
import type { Store } from "./types";

/** Saca de la lista alquileres pagados. No borra pagos ni cambia saldos, liquidaciones o historial. */
export function clearCharges(store: Store, charges: Charge[], actor: string) {
  const unpaid = charges.find((c) => c.status !== "pagado");
  if (unpaid) throw new Error(`${unpaid.contract.code} todavía no está pagado. Registrá y verificá el pago antes de sacarlo de la lista.`);
  const set = new Set(store.clearedCharges ?? []);
  for (const c of charges) {
    if (set.has(c.key)) continue;
    set.add(c.key);
    audit(store, actor, "quitar_de_lista", "cobro", c.key, `${c.contract.code} pagado, quitado de la lista de cobranzas`);
  }
  store.clearedCharges = [...set];
}

/** Vuelve a mostrar alquileres quitados. */
export function restoreCharges(store: Store, keys: string[], actor: string) {
  const drop = new Set(keys);
  for (const k of keys) if (store.clearedCharges?.includes(k)) audit(store, actor, "volver_a_lista", "cobro", k);
  store.clearedCharges = (store.clearedCharges ?? []).filter((k) => !drop.has(k));
}

export const isCleared = (store: Store, key: string) => Boolean(store.clearedCharges?.includes(key));
