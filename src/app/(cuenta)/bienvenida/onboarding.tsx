"use client";

import { useActionState, useState } from "react";
import { parseProfile, profileSummary, QUESTIONS } from "@/lib/domain/profile";
import type { Profile } from "@/lib/domain/types";
import { saveProfileAction } from "../actions";

type Answers = Record<string, string | string[]>;

/** Preguntas de bienvenida: una por pantalla, se responden tocando botones. */
export function Onboarding({ name, initial }: { name: string; initial?: Profile }) {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Answers>(() => (initial ? { ...initial } : {}));
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const total = QUESTIONS.length;

  const skip = (
    <form action={action}>
      <input type="hidden" name="skip" value="1" />
      <button className="link-btn small" disabled={pending}>Saltear por ahora</button>
    </form>
  );

  if (step === -1) {
    return (
      <div className="onb">
        <p className="eyebrow">Bienvenida</p>
        <h1>Hola, {name}</h1>
        <p className="muted">Antes de empezar, contanos cómo trabajás. Son {total} preguntas que se responden tocando, y con eso armamos Aldia a tu medida.</p>
        <button className="btn big" onClick={() => setStep(0)}>Empezar</button>
        {skip}
      </div>
    );
  }

  if (step >= total) {
    const profile = parseProfile(answers, "");
    return (
      <div className="onb">
        <p className="eyebrow">Listo</p>
        <h1>Armamos Aldia para vos</h1>
        {profile ? (
          <ul className="onb-summary">{profileSummary(profile).map((l) => <li key={l}>{l}</li>)}</ul>
        ) : <p className="msg err">Falta alguna respuesta. Volvé atrás para completarla.</p>}
        <form action={action} className="onb-actions">
          <input type="hidden" name="answers" value={JSON.stringify(answers)} />
          <button type="button" className="btn ghost" onClick={() => setStep(total - 1)}>Atrás</button>
          <button className="btn big" disabled={pending || !profile}>{pending ? "Guardando…" : "Entrar a Aldia"}</button>
        </form>
        {state?.error && <p className="msg err">{state.error}</p>}
        <p className="small muted">Podés cambiar estas respuestas cuando quieras desde el menú.</p>
      </div>
    );
  }

  const q = QUESTIONS[step];
  const value = answers[q.key];
  const chosen = (v: string) => (q.multi ? Array.isArray(value) && value.includes(v) : value === v);
  const choose = (v: string) => {
    if (!q.multi) {
      setAnswers({ ...answers, [q.key]: v });
      setStep(step + 1);
      return;
    }
    const list = Array.isArray(value) ? value : [];
    let next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    // "No estoy seguro" no se combina con índices concretos.
    if (q.key === "indices") next = v === "no_se" && next.includes("no_se") ? ["no_se"] : next.filter((x) => x !== "no_se" || v === "no_se");
    setAnswers({ ...answers, [q.key]: next });
  };
  const canGo = q.multi ? Array.isArray(value) && value.length > 0 : Boolean(value);

  return (
    <div className="onb">
      <div className="onb-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label={`Pregunta ${step + 1} de ${total}`}>
        {QUESTIONS.map((x, i) => <i key={x.key} className={i <= step ? "on" : ""} />)}
      </div>
      <p className="eyebrow">Pregunta {step + 1} de {total}</p>
      <h1>{q.title}</h1>
      {q.hint && <p className="muted small">{q.hint}</p>}
      <div className="onb-options" role={q.multi ? "group" : "radiogroup"} aria-label={q.title}>
        {q.options.map((o) => (
          <button key={o.value} type="button" className="onb-option" aria-pressed={chosen(o.value)} onClick={() => choose(o.value)}>
            <span className="onb-check" aria-hidden="true" />{o.label}
          </button>
        ))}
      </div>
      <div className="onb-actions">
        <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Atrás</button>
        {(q.multi || value) && <button type="button" className="btn big" disabled={!canGo} onClick={() => setStep(step + 1)}>Seguir</button>}
      </div>
    </div>
  );
}
