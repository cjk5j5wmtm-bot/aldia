import { redirect } from "next/navigation";
import { billingEnabled, priceLabel } from "@/lib/server/billing";
import { session } from "@/lib/server/store";
import { RegisterForm } from "../forms";

export default async function Registro() {
  if (await session()) redirect("/");
  return (
    <>
      <h1>Creá tu cuenta</h1>
      <p className="muted">
        Arrancás con datos de ejemplo para conocer la app.
        {billingEnabled() && ` La suscripción cuesta ${priceLabel()} por mes y se paga con Mercado Pago.`}
      </p>
      <RegisterForm />
    </>
  );
}
