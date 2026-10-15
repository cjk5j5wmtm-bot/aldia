import { adjustmentPeriods, computeAdjustment } from "./adjustments";
import { chargesFor, contractCoversPeriod } from "./charges";
import type { ISODate, Period } from "./period";
import { allocated } from "./payments";
import { computeSettlement, findSettlement, ownersWithContracts } from "./settlements";
import { audit, now } from "./store-ops";
import type { Store } from "./types";

export type StepKey = "preparar" | "cobrar" | "conciliar" | "liquidar" | "cerrar";

export interface Task {
  id: string;
  step: StepKey;
  title: string;
  detail: string;
  href: string;
  severity: "bloquea" | "revisar";
}

export interface Step {
  key: StepKey;
  title: string;
  done: number;
  total: number;
  complete: boolean;
  summary: string;
}

export interface CloseStatus {
  period: Period;
  closed: boolean;
  steps: Step[];
  tasks: Task[];
  blockers: Task[];
}

/** Estado del cierre derivado de datos reales: un paso está completo solo si sus tareas lo están. */
export function closeStatus(store: Store, period: Period, asOf: ISODate): CloseStatus {
  const tasks: Task[] = [];
  const closed = store.closes.some((c) => c.period === period);

  // A. Preparar: aumentos del período y datos incompletos.
  const active = store.contracts.filter((c) => contractCoversPeriod(c, period));
  const adjDue = active.filter((c) => adjustmentPeriods(c, period).includes(period));
  let adjOk = 0;
  for (const c of adjDue) {
    const a = computeAdjustment(store, c, period);
    if (a.status === "aprobado" || a.status === "comunicado") { adjOk++; continue; }
    tasks.push({
      id: `adj:${c.id}`, step: "preparar", severity: "bloquea",
      title: `Revisar el aumento de ${c.code}`,
      detail: a.status === "calculado" ? "Calculado, falta que lo apruebes." : a.missing[0] ?? "Faltan datos.",
      href: `/contratos/${c.id}?periodo=${period}#aumento`,
    });
  }
  const exps = store.expenses.filter((e) => e.period === period);
  const expPending = exps.filter((e) => e.status === "pendiente");
  for (const e of expPending) {
    const c = store.contracts.find((x) => x.id === e.contractId);
    tasks.push({ id: `exp:${e.id}`, step: "preparar", severity: "bloquea", title: `Revisar el gasto "${e.description}"`, detail: `${c?.code ?? ""}: confirmalo o descartalo antes de liquidar.`, href: `/cierre?periodo=${period}#gastos` });
  }

  // B. Cobrar.
  const charges = chargesFor(store, period, asOf);
  const paid = charges.filter((c) => c.status === "pagado");
  for (const ch of charges.filter((c) => c.status === "vencido" || (c.status === "parcial" && c.daysLate > 0))) {
    tasks.push({ id: `late:${ch.key}`, step: "cobrar", severity: "revisar", title: `${ch.contract.code}: alquiler vencido hace ${ch.daysLate} días`, detail: "Mandá un recordatorio o registrá el pago si ya lo hizo.", href: `/cobranzas?periodo=${period}` });
  }

  // C. Conciliar.
  const informed = store.payments.filter((p) => p.status === "informado");
  const unassigned = store.payments.filter((p) => p.status === "confirmado" && allocated(p) < p.amount.cents);
  const reconciled = store.payments.filter((p) => p.status === "confirmado" && allocated(p) === p.amount.cents);
  for (const p of informed) {
    tasks.push({ id: `inf:${p.id}`, step: "conciliar", severity: "bloquea", title: "Verificar un pago informado", detail: `${p.amount.currency} ${(p.amount.cents / 100).toLocaleString("es-AR")} del ${p.effectiveDate}: confirmá que está en la cuenta.`, href: `/cobranzas?periodo=${period}#pagos` });
  }
  for (const p of unassigned) {
    tasks.push({ id: `una:${p.id}`, step: "conciliar", severity: "revisar", title: "Asignar un pago sin identificar", detail: `Quedan ${p.amount.currency} ${((p.amount.cents - allocated(p)) / 100).toLocaleString("es-AR")} sin asignar a ningún alquiler.`, href: `/cobranzas?periodo=${period}#pagos` });
  }

  // D. Liquidar.
  const owners = ownersWithContracts(store, period);
  let liqOk = 0;
  for (const o of owners) {
    if (findSettlement(store, o.ownerId, period, o.currency)) { liqOk++; continue; }
    const s = computeSettlement(store, o.ownerId, period, o.currency, asOf);
    const name = store.people.find((p) => p.id === o.ownerId)?.name ?? o.ownerId;
    // Si lo que la frena ya figura como otra tarea (aumento, gasto, pago), no se repite en la lista.
    const own = s.blockers.filter((b) => !/aumento|gasto|pagos informados/.test(b));
    if (s.blockers.length && !own.length) continue;
    tasks.push({ id: `liq:${o.ownerId}:${o.currency}`, step: "liquidar", severity: "bloquea", title: `Aprobar la liquidación de ${name} (${o.currency})`, detail: own[0] ?? "Lista para revisar y aprobar.", href: `/propietarios?periodo=${period}#${o.ownerId}` });
  }

  const steps: Step[] = [
    { key: "preparar", title: "Preparar el mes", done: adjOk + (exps.length - expPending.length), total: adjDue.length + exps.length, complete: false, summary: `${adjDue.length - adjOk} aumentos y ${expPending.length} gastos por revisar` },
    { key: "cobrar", title: "Cobrar", done: paid.length, total: charges.length, complete: false, summary: `${paid.length} de ${charges.length} alquileres pagados` },
    { key: "conciliar", title: "Conciliar pagos", done: reconciled.length, total: reconciled.length + informed.length + unassigned.length, complete: false, summary: informed.length + unassigned.length ? `${informed.length} por verificar, ${unassigned.length} sin asignar` : "Todos los pagos están verificados y asignados" },
    { key: "liquidar", title: "Liquidar a propietarios", done: liqOk, total: owners.length, complete: false, summary: `${liqOk} de ${owners.length} liquidaciones aprobadas` },
    { key: "cerrar", title: "Revisar y cerrar", done: closed ? 1 : 0, total: 1, complete: closed, summary: closed ? "Mes cerrado" : "Pendiente" },
  ];
  for (const s of steps) if (s.key !== "cerrar") s.complete = !tasks.some((t) => t.step === s.key && t.severity === "bloquea") && (s.key !== "cobrar" || paid.length === charges.length);
  steps[3].complete = liqOk === owners.length;
  const blockers = tasks.filter((t) => t.severity === "bloquea");
  if (liqOk < owners.length && !blockers.some((t) => t.step === "liquidar")) {
    blockers.push({ id: "liq:pendientes", step: "liquidar", severity: "bloquea", title: `${owners.length - liqOk} liquidaciones sin aprobar`, detail: "Se habilitan cuando se resuelvan los pendientes de arriba.", href: `/propietarios?periodo=${period}` });
  }
  return { period, closed, steps, tasks, blockers };
}

/** Cierra el período. Si hay bloqueos, exige un motivo escrito y lo guarda como excepción. */
export function closePeriod(store: Store, period: Period, actor: string, asOf: ISODate, exceptionReason?: string) {
  if (store.closes.some((c) => c.period === period)) throw new Error("Este período ya está cerrado.");
  const st = closeStatus(store, period, asOf);
  const pending = st.tasks.map((t) => t.title);
  if (st.blockers.length && !exceptionReason?.trim()) {
    throw new Error(`Hay ${st.blockers.length} pendientes que bloquean el cierre. Resolvelos o dejá escrito el motivo para cerrar igual.`);
  }
  store.closes.push({ period, closedBy: actor, closedAt: now(), exceptions: pending, exceptionReason: exceptionReason?.trim() || undefined });
  audit(store, actor, "cerró el período", "período", period, pending.length ? `${pending.length} excepciones` : "sin excepciones", exceptionReason);
}
