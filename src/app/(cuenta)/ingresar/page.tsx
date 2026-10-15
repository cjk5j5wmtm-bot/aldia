import { redirect } from "next/navigation";
import { session } from "@/lib/server/store";
import { LoginForm } from "../forms";

export default async function Ingresar() {
  if (await session()) redirect("/");
  return (
    <>
      <h1>Ingresá a tu cuenta</h1>
      <p className="muted">El cierre de mes de tus alquileres, en una tarde.</p>
      <LoginForm />
    </>
  );
}
