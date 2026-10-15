"use client";

import Link from "next/link";
import { useActionState } from "react";
import { checkSubscriptionAction, loginAction, registerAction, subscribeAction, type FormState } from "./actions";

const Err = ({ s }: { s: FormState | null }) => (s?.error ? <p className="msg err" role="alert">{s.error}</p> : null);

export function LoginForm() {
  const [s, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="auth-form">
      <label className="field">Mail<input name="email" type="email" autoComplete="email" required defaultValue={s?.email} /></label>
      <label className="field">Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      <Err s={s} />
      <button className="btn big" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
      <p className="small muted">¿No tenés cuenta? <Link href="/registro">Creá una</Link></p>
    </form>
  );
}

export function RegisterForm() {
  const [s, action, pending] = useActionState(registerAction, null);
  return (
    <form action={action} className="auth-form">
      <label className="field">Nombre de tu inmobiliaria<input name="name" required autoComplete="organization" /></label>
      <label className="field">Mail<input name="email" type="email" autoComplete="email" required defaultValue={s?.email} /></label>
      <label className="field">Contraseña (mínimo 8 caracteres)<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <Err s={s} />
      <button className="btn big" disabled={pending}>{pending ? "Creando…" : "Crear cuenta"}</button>
      <p className="small muted">¿Ya tenés cuenta? <Link href="/ingresar">Ingresá</Link></p>
    </form>
  );
}

export function PayButton() {
  const [s, action, pending] = useActionState(subscribeAction, null);
  return (
    <form action={action} className="auth-form">
      <Err s={s} />
      <button className="btn big mp" disabled={pending}>{pending ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}</button>
    </form>
  );
}

export function CheckButton() {
  const [s, action, pending] = useActionState(checkSubscriptionAction, null);
  return (
    <form action={action} className="auth-form">
      <Err s={s} />
      <button className="btn ghost" disabled={pending}>{pending ? "Consultando…" : "Ya pagué, entrar"}</button>
    </form>
  );
}
