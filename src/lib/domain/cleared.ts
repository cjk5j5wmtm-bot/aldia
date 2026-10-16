import type { Charge } from "./charges";
import { audit } from "./store-ops";
import type { Store } from "./types";

/**
 * Saca alquileres de la lista de Cobranzas (pagados o no). Solo cambia la vista: no borra pagos ni cambia
 * saldos, liquidaciones ni el total "Falta cobrar". Queda registrado en el historial.
 */
export function clearCharges(store: Store, charges: Charge[], actor: string) {
  const set = new Set(store.clearedCharges ?? []);
  for (const c of charges) {
    if (set.has(c.key)) continue;
    set.add(c.key);
    audit(store, actor, "quitó de la lista de cobranzas", "cobro", c.key, `${c.contract.code} (${c.status === "pagado" ? "pagado" : `debía ${c.balance.cents / 100} ${c.balance.currency}`})`);
  }
  store.clearedCharges = [...set];
}

/** Vuelve a mostrar alquileres quitados. */
export function restoreCharges(store: Store, keys: string[], actor: string) {
  const drop = new Set(keys);
  for (const k of keys) if (store.clearedCharges?.includes(k)) audit(store, actor, "volvió a mostrar en cobranzas", "cobro", k);
  store.clearedCharges = (store.clearedCharges ?? []).filter((k) => !drop.has(k));
}

export const isCleared = (store: Store, key: string) => Boolean(store.clearedCharges?.includes(key));
