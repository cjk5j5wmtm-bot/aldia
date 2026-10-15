import "server-only";
import type { Store, SubscriptionStatus } from "../domain/types";

/**
 * Suscripción mensual con Mercado Pago (API de suscripciones / preapproval).
 * Se activa solo si está configurada la variable MP_ACCESS_TOKEN (Access Token de producción
 * de la cuenta de Mercado Pago que cobra). Sin ella, la app no pide pago.
 * Al Día no guarda datos de tarjetas: el pago ocurre en Mercado Pago.
 */
export const billingEnabled = () => !!process.env.MP_ACCESS_TOKEN;
export const PRICE_ARS = Number(process.env.ALDIA_PRECIO_ARS || 29900);
export const priceLabel = () => `$ ${PRICE_ARS.toLocaleString("es-AR")}`;

const MP = "https://api.mercadopago.com";

interface Preapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point?: string;
  external_reference?: string;
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${MP}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new Error("No pudimos conectarnos con Mercado Pago. Probá de nuevo en un rato.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { message?: string }).message ?? `error ${res.status}`;
    throw new Error(`Mercado Pago respondió: ${msg}`);
  }
  return body as T;
}

const STATUS: Record<Preapproval["status"], SubscriptionStatus> = {
  pending: "sin_pagar", authorized: "activa", paused: "pausada", cancelled: "cancelada",
};

/** Crea la suscripción en Mercado Pago y devuelve el link de pago. */
export async function createCheckout(store: Store, payerEmail: string, baseUrl: string) {
  const p = await mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "Al Día · suscripción mensual",
      external_reference: store.org.id,
      payer_email: payerEmail,
      back_url: `${baseUrl}/suscripcion`,
      status: "pending",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: PRICE_ARS, currency_id: "ARS" },
    }),
  });
  if (!p.init_point) throw new Error("Mercado Pago no devolvió el link de pago.");
  return p.init_point;
}

/** Consulta en Mercado Pago el estado de la suscripción de esta inmobiliaria. Devuelve true si cambió. */
export async function refreshSubscription(store: Store): Promise<boolean> {
  const r = await mp<{ results: Preapproval[] }>(`/preapproval/search?external_reference=${encodeURIComponent(store.org.id)}`);
  const list = r.results ?? [];
  const best = list.find((p) => p.status === "authorized") ?? list.find((p) => p.status === "paused") ?? list[0];
  if (!best) return false;
  const status = STATUS[best.status] ?? "sin_pagar";
  if (store.org.subscription?.status === status && store.org.subscription.mpId === best.id) return false;
  store.org.subscription = { status, mpId: best.id, updatedAt: new Date().toISOString() };
  return true;
}

/** Para el aviso automático de Mercado Pago: a qué inmobiliaria pertenece una suscripción. */
export async function orgOfPreapproval(id: string) {
  const p = await mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);
  return p.external_reference ?? null;
}
