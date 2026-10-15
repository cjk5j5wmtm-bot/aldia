import { redirect } from "next/navigation";
import { billingEnabled, priceLabel, refreshSubscription } from "@/lib/server/billing";
import { saveStore, session } from "@/lib/server/store";
import { logoutAction } from "../actions";
import { CheckButton, PayButton } from "../forms";

export default async function Suscripcion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await session();
  if (!ctx) redirect("/ingresar");
  if (!billingEnabled()) redirect("/");
  const sp = await searchParams;
  // Al volver de Mercado Pago (trae preapproval_id) consultamos el estado en el momento.
  if (sp.preapproval_id || ctx.store.org.subscription?.mpId) {
    const store = structuredClone(ctx.store);
    try {
      if (await refreshSubscription(store)) await saveStore(store);
    } catch { /* si Mercado Pago no responde, se puede reintentar con el botón */ }
    if (store.org.subscription?.status === "activa") redirect("/");
  }
  const status = ctx.store.org.subscription?.status;
  return (
    <>
      <h1>{status === "pausada" || status === "cancelada" ? "Tu suscripción no está activa" : "Activá tu suscripción"}</h1>
      <p className="muted">Hola, {ctx.store.org.name}. Para usar Al Día necesitás la suscripción mensual.</p>
      <div className="price">
        <span className="num">{priceLabel()}</span>
        <span className="muted">por mes</span>
      </div>
      <ul className="small muted bullets">
        <li>Aumentos por índice, cobranzas y liquidaciones en un solo lugar.</li>
        <li>Se cobra todos los meses en tu cuenta de Mercado Pago. Lo podés cancelar cuando quieras desde Mercado Pago.</li>
        <li>Al Día no ve ni guarda los datos de tu tarjeta.</li>
      </ul>
      <PayButton />
      <CheckButton />
      <form action={logoutAction}><button className="link-btn small">Salir</button></form>
    </>
  );
}
