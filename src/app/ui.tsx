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
