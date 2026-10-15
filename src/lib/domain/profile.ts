import { METHOD_LABEL, type Contract, type IndexAnswer, type Pain, type Profile } from "./types";

export interface Question {
  key: keyof Omit<Profile, "answeredAt">;
  title: string;
  hint?: string;
  multi?: boolean;
  options: { value: string; label: string }[];
}

/** Las preguntas de bienvenida, en orden. Una por pantalla. */
export const QUESTIONS: Question[] = [
  { key: "size", title: "¿Cuántos alquileres administrás?", options: [
    { value: "1-20", label: "1 a 20" }, { value: "21-80", label: "21 a 80" }, { value: "81-200", label: "81 a 200" }, { value: "200+", label: "Más de 200" },
  ] },
  { key: "pains", title: "¿Qué es lo que más te cuesta hoy?", hint: "Podés elegir más de una.", multi: true, options: [
    { value: "cobrar", label: "Cobrar a tiempo" }, { value: "aumentos", label: "Calcular los aumentos" }, { value: "liquidar", label: "Liquidar a los dueños" }, { value: "orden", label: "Tener todo ordenado" },
  ] },
  { key: "late", title: "En un mes normal, ¿cuántos inquilinos se atrasan?", options: [
    { value: "pocos", label: "Casi ninguno" }, { value: "algunos", label: "Algunos" }, { value: "muchos", label: "Muchos" },
  ] },
  { key: "pays", title: "¿Cómo te pagan los inquilinos?", options: [
    { value: "transferencia", label: "Transferencia" }, { value: "efectivo", label: "Efectivo" }, { value: "mercado_pago", label: "Mercado Pago" }, { value: "mezcla", label: "Un poco de todo" },
  ] },
  { key: "indices", title: "¿Con qué índices se ajustan tus contratos?", hint: "Podés elegir más de uno.", multi: true, options: [
    { value: "IPC", label: "IPC" }, { value: "ICL", label: "ICL" }, { value: "OTRO", label: "Otro" }, { value: "no_se", label: "No estoy seguro" },
  ] },
  { key: "tool", title: "¿Dónde llevás todo hoy?", options: [
    { value: "excel", label: "Excel" }, { value: "cuaderno", label: "Cuaderno" }, { value: "sistema", label: "Otro sistema" }, { value: "cabeza", label: "En la cabeza" },
  ] },
];

const PAINS: Pain[] = ["cobrar", "aumentos", "liquidar", "orden"];
const INDICES: IndexAnswer[] = ["IPC", "ICL", "OTRO", "no_se"];
const pick = <T extends string>(v: unknown, ok: readonly T[]): T | undefined => (ok as readonly string[]).includes(String(v)) ? (v as T) : undefined;

/** Valida las respuestas que llegan del formulario. Devuelve undefined si falta alguna. */
export function parseProfile(raw: Record<string, unknown>, now: string): Profile | undefined {
  const opts = (k: string) => QUESTIONS.find((q) => q.key === k)!.options.map((o) => o.value);
  const list = <T extends string>(v: unknown, ok: T[]) => Array.isArray(v) ? [...new Set(v.filter((x): x is T => ok.includes(x)))] : [];
  const size = pick(raw.size, opts("size") as Profile["size"][]);
  const late = pick(raw.late, opts("late") as Profile["late"][]);
  const pays = pick(raw.pays, opts("pays") as Profile["pays"][]);
  const tool = pick(raw.tool, opts("tool") as Profile["tool"][]);
  const pains = list(raw.pains, PAINS);
  let indices = list(raw.indices, INDICES);
  if (indices.includes("no_se")) indices = ["no_se"];
  if (!size || !late || !pays || !tool || !pains.length || !indices.length) return undefined;
  return { size, pains, late, pays, indices, tool, answeredAt: now };
}

/** Dónde arranca según lo que más le cuesta. */
export function focusPath(p?: Profile): string {
  switch (p?.pains[0]) {
    case "cobrar": return "/cobranzas";
    case "aumentos": return "/cierre";
    case "liquidar": return "/propietarios";
    default: return "/";
  }
}

const FOCUS_LINE: Record<Pain, string> = {
  cobrar: "Vas a empezar por Cobranzas, con los que deben arriba, porque nos contaste que te cuesta cobrar a tiempo.",
  aumentos: "Vas a empezar por el Cierre del mes: los aumentos vienen calculados y con la cuenta explicada, solo los revisás y aprobás.",
  liquidar: "Vas a empezar por Propietarios: cada liquidación se arma con los pagos verificados y te dice qué falta antes de aprobarla.",
  orden: "Vas a empezar por Inicio, que cada día te dice lo próximo para hacer y cómo va el mes.",
};

/** Frases de la pantalla final, armadas con sus respuestas. Máximo tres. */
export function profileSummary(p: Profile): string[] {
  const out = [FOCUS_LINE[p.pains[0]]];
  if (p.late !== "pocos") out.push("Para los atrasos, cada inquilino que debe tiene su recordatorio de WhatsApp listo para copiar y mandar.");
  if (p.pays !== "mezcla") out.push(`Cuando registres un pago con el botón +, ya va a estar elegido "${p.pays === "mercado_pago" ? "Mercado Pago" : METHOD_LABEL[p.pays]}".`);
  if (p.indices.includes("no_se")) out.push("Como no estás seguro de los índices, te mostramos en cada aumento qué índice tiene cargado el contrato para que lo compares con la cláusula.");
  if (p.tool === "excel") out.push("Pronto vas a poder traer tus contratos desde tu planilla de Excel.");
  return out.slice(0, 3);
}

/** Contratos que usan un índice que no nombró en sus respuestas. */
export function indexMismatches(p: Profile | undefined, contracts: Contract[]): Contract[] {
  if (!p || p.indices.includes("no_se")) return [];
  return contracts.filter((c) => {
    const i = c.adjustment?.index;
    if (!i) return false;
    const answer: IndexAnswer = i === "IPC" || i === "ICL" ? i : "OTRO";
    return !p.indices.includes(answer);
  });
}
