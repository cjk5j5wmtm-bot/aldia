import type { Store } from "./types";

export const now = () => new Date().toISOString();

export function nextId(store: Store, prefix: string) {
  store.seq += 1;
  return `${prefix}_${store.seq}`;
}

export function audit(store: Store, actor: string, action: string, entity: string, entityId: string, detail?: string, reason?: string) {
  store.audit.push({ id: nextId(store, "aud"), at: now(), actor, action, entity, entityId, detail, reason });
}
