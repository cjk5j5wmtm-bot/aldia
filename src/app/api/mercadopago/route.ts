import { billingEnabled, orgOfPreapproval, refreshSubscription } from "@/lib/server/billing";
import { loadStore, saveStore } from "@/lib/server/store";

/**
 * Aviso automático de Mercado Pago cuando cambia una suscripción.
 * No confiamos en el contenido del aviso: con el id consultamos a Mercado Pago el estado real.
 */
export async function POST(req: Request) {
  if (!billingEnabled()) return new Response("cobro no configurado", { status: 200 });
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string } };
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (!id || (type && !type.includes("preapproval"))) return new Response("ignorado", { status: 200 });
  try {
    const orgId = await orgOfPreapproval(id);
    const store = orgId ? await loadStore(orgId) : null;
    if (store && (await refreshSubscription(store))) await saveStore(store);
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("error", { status: 500 });
  }
}
