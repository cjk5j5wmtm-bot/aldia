import { redirect } from "next/navigation";
import { session } from "@/lib/server/store";
import { Onboarding } from "./onboarding";

export default async function Bienvenida() {
  const ctx = await session();
  if (!ctx) redirect("/ingresar");
  return <Onboarding name={ctx.store.org.name} initial={ctx.store.org.profile} />;
}
