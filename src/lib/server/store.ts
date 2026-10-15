import "server-only";
import fs from "node:fs";
import path from "node:path";
import { demoStore, DEMO_PERIOD, DEMO_TODAY } from "../demo/seed";
import type { Store } from "../domain/types";

/**
 * Persistencia de la v0.1: un archivo JSON local en .data/. Sirve para la demo y para probar en una sola máquina.
 * No es apto para producción (sin usuarios, sin concurrencia, sin respaldo). Ver README → "Próximos pasos".
 */
const FILE = path.join(process.cwd(), ".data", "store.json");

let cache: Store | null = null;

export function getStore(): Store {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
  } catch {
    cache = demoStore();
    save(cache);
  }
  return cache;
}

export function save(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, FILE);
  cache = store;
}

export function resetDemo() {
  const s = demoStore();
  save(s);
  return s;
}

/** En modo demo la fecha de hoy es fija para que los datos ficticios sean coherentes. */
export const today = () => (getStore().org.isDemo ? DEMO_TODAY : new Date().toISOString().slice(0, 10));
export const defaultPeriod = () => (getStore().org.isDemo ? DEMO_PERIOD : today().slice(0, 7));
export const ACTOR = "Usuario demo";

export function periodFrom(sp: Record<string, string | string[] | undefined>) {
  const p = typeof sp.periodo === "string" && /^\d{4}-\d{2}$/.test(sp.periodo) ? sp.periodo : defaultPeriod();
  return p;
}
