"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createUser, endSession, findUser, startSession } from "@/lib/server/auth";
import { billingEnabled, createCheckout, refreshSubscription } from "@/lib/server/billing";
import { focusPath, parseProfile } from "@/lib/domain/profile";
import { sampleStore, saveStore, session } from "@/lib/server/store";

export interface FormState {
  error?: string;
  email?: string;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function registerAction(_: FormState | null, f: FormData): Promise<FormState> {
  const name = str(f, "name");
  const email = str(f, "email");
  const password = String(f.get("password") ?? "");
  if (!name) return { error: "Escribí el nombre de tu inmobiliaria.", email };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Ese mail no parece válido.", email };
  if (password.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres.", email };
  try {
    const orgId = `org_${randomBytes(8).toString("hex")}`;
    const user = await createUser({ id: `usr_${randomBytes(8).toString("hex")}`, email, name, orgId, createdAt: new Date().toISOString() }, password);
    const store = sampleStore(orgId, name);
    store.org.subscription = { status: "sin_pagar", updatedAt: new Date().toISOString() };
    await saveStore(store);
    await startSession(user);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear la cuenta.", email };
  }
  redirect("/bienvenida");
}

export async function loginAction(_: FormState | null, f: FormData): Promise<FormState> {
  const email = str(f, "email");
  const user = await findUser(email);
  // Mismo mensaje si el mail no existe o la contraseña es incorrecta: no revela qué cuentas existen.
  if (!user || !checkPassword(String(f.get("password") ?? ""), user)) return { error: "El mail o la contraseña no coinciden.", email };
  await startSession(user);
  redirect("/");
}

export async function logoutAction() {
  await endSession();
  redirect("/ingresar");
}

export async function subscribeAction(): Promise<FormState> {
  const ctx = await session();
  if (!ctx) redirect("/ingresar");
  let url: string;
  try {
    const h = await headers();
    const base = process.env.URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    url = await createCheckout(ctx.store, ctx.user.email, base);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo abrir Mercado Pago." };
  }
  redirect(url);
}

export async function checkSubscriptionAction(): Promise<FormState> {
  const ctx = await session();
  if (!ctx) redirect("/ingresar");
  try {
    const store = structuredClone(ctx.store);
    if (await refreshSubscription(store)) await saveStore(store);
    if (store.org.subscription?.status !== "activa") return { error: "Mercado Pago todavía no nos confirmó el pago. Si recién pagaste, esperá un minuto y probá de nuevo." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo consultar Mercado Pago." };
  }
  redirect("/");
}

/** Guarda las respuestas de bienvenida (o que las salteó) y lo lleva a la pantalla de su foco. */
export async function saveProfileAction(_: FormState | null, f: FormData): Promise<FormState> {
  const ctx = await session();
  if (!ctx) redirect("/ingresar");
  const store = structuredClone(ctx.store);
  if (f.get("skip") !== "1") {
    let raw: Record<string, unknown> = {};
    try { raw = JSON.parse(String(f.get("answers") ?? "{}")); } catch { /* queda vacío */ }
    const profile = parseProfile(raw, new Date().toISOString());
    if (!profile) return { error: "Faltan respuestas. Volvé atrás y completalas, o salteá este paso." };
    store.org.profile = profile;
  }
  store.org.onboarded = true;
  await saveStore(store);
  redirect(focusPath(store.org.profile));
}
