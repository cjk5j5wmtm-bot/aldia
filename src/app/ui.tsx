"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { ActionResult } from "./actions";

type Action = (prev: ActionResult | null, f: FormData) => Promise<ActionResult>;

/** Formulario que muestra el resultado real del servidor y evita el doble envío. */
export function ActionForm({ action, children, submit, variant = "primary", className, confirm }: {
  action: Action;
  children?: ReactNode;
  submit: string;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  /** Texto de confirmación que se muestra antes de enviar acciones importantes. */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [asking, setAsking] = useState(false);
  return (
    <form action={formAction} className={`aform ${className ?? ""}`} onSubmit={(e) => {
      if (confirm && !asking) { e.preventDefault(); setAsking(true); }
    }}>
      {children}
      {asking && confirm ? (
        <div className="confirm" role="alertdialog" aria-label="Confirmar acción">
          <span>{confirm}</span>
          <button type="submit" className={`btn ${variant}`} disabled={pending} onClick={() => setTimeout(() => setAsking(false), 0)}>Sí, confirmar</button>
          <button type="button" className="btn ghost" onClick={() => setAsking(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="submit" className={`btn ${variant}`} disabled={pending}>{pending ? "Guardando…" : submit}</button>
      )}
      {state && (
        <p className={state.ok ? "msg ok" : "msg err"} role={state.ok ? "status" : "alert"}>
          {state.ok ? "Listo. " : "No se guardó. "}{state.message}
        </p>
      )}
    </form>
  );
}

export function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState<"" | "ok" | "fail">("");
  return (
    <div className="copy">
      <pre className="draft">{text}</pre>
      <button type="button" className="btn ghost" onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone("ok"); } catch { setDone("fail"); }
      }}>Copiar texto</button>
      {done === "ok" && <span className="msg ok" role="status">Copiado. Pegalo en WhatsApp desde tu teléfono.</span>}
      {done === "fail" && <span className="msg err" role="alert">No pude copiar. Seleccioná el texto y copialo a mano.</span>}
    </div>
  );
}

/** Cierra el desplegable (details) que lo contiene. */
export function CloseDetails() {
  return (
    <button type="button" className="pop-close" aria-label="Cerrar" onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}>✕</button>
  );
}

const TRASH = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const RESTORE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>;

/** Botón de ícono (basurero o restaurar) con confirmación en línea y el error real del servidor. */
export function IconAction({ action, fields, label, confirm, kind = "trash" }: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  confirm?: string;
  kind?: "trash" | "restore";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [asking, setAsking] = useState(false);
  return (
    <form action={formAction} className="icon-form" >
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type={confirm ? "button" : "submit"} onClick={confirm ? () => setAsking(!asking) : undefined} className={`icon-btn ${kind === "restore" ? "restore" : ""}`} aria-label={label} title={label} disabled={pending} aria-expanded={confirm ? asking : undefined}>{kind === "restore" ? RESTORE : TRASH}</button>
      {asking && confirm && (
        <div className="confirm-pop" role="alertdialog" aria-label={label}>
          <span>{confirm}</span>
          <div className="btns">
            <button type="button" className="btn ghost" onClick={() => setAsking(false)}>Cancelar</button>
            <button type="submit" className="btn danger" disabled={pending} autoFocus onClick={() => setTimeout(() => setAsking(false), 0)}>{pending ? "Borrando…" : "Sí, borrar"}</button>
          </div>
        </div>
      )}
      {state && !state.ok && <p className="msg err" role="alert">{state.message}</p>}
    </form>
  );
}
