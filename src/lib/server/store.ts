import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { demoStore, DEMO_PERIOD, DEMO_TODAY } from "../demo/seed";
import type { Store } from "../domain/types";
import { currentUser, type User } from "./auth";
import { billingEnabled } from "./billing";
import { kvGet, kvSet } from "./kv";

/**
 * Cada inmobiliaria tiene su propio Store, guardado aparte (ver kv.ts).
 * Las pantallas y acciones solo acceden al Store de la cuenta con sesión iniciada.
 */
const orgKey = (orgId: string) => `inmobiliarias/${orgId}`;

export async function loadStore(orgId: string): Promise<Store | null> {
  return kvGet<Store>(orgKey(orgId));
}

export async function saveStore(store: Store) {
  await kvSet(orgKey(store.org.id), store);
}

/** Datos de ejemplo para una cuenta nueva, o para reiniciarlos. Conserva el nombre y la suscripción. */
export function sampleStore(orgId: string, name: string, keep?: Store) {
  const s = demoStore(orgId, name);
  if (keep?.org.subscription) s.org.subscription = keep.org.subscription;
  return s;
}

export interface Ctx {
  user: User;
  store: Store;
  actor: string;
}

/** Usuario y datos de la sesión actual, o null. Se calcula una vez por pedido. */
export const session = cache(async (): Promise<Ctx | null> => {
  const user = await currentUser();
  if (!user) return null;
  const store = (await loadStore(user.orgId)) ?? sampleStore(user.orgId, user.name);
  return { user, store, actor: user.name };
});

/** Para las pantallas de la app: exige sesión y suscripción activa (si el cobro está configurado). */
export async function requireApp(): Promise<Ctx> {
  const ctx = await session();
  if (!ctx) redirect("/ingresar");
  if (billingEnabled() && ctx.store.org.subscription?.status !== "activa") redirect("/suscripcion");
  return ctx;
}

/** Con datos de ejemplo la fecha de hoy es fija, para que los vencimientos de prueba tengan sentido. */
export const today = (s: Store) => (s.org.isDemo ? DEMO_TODAY : new Date().toISOString().slice(0, 10));
export const defaultPeriod = (s: Store) => (s.org.isDemo ? DEMO_PERIOD : today(s).slice(0, 7));

export function periodFrom(s: Store, sp: Record<string, string | string[] | undefined>) {
  return typeof sp.periodo === "string" && /^\d{4}-\d{2}$/.test(sp.periodo) ? sp.periodo : defaultPeriod(s);
}
