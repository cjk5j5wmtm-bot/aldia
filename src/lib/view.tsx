import Link from "next/link";
import { CHARGE_LABEL, type Charge } from "./domain/charges";
import { formatMoney, sum, type Currency, type Money } from "./domain/money";
import { addMonths, formatPeriod, type Period } from "./domain/period";
import type { Store } from "./domain/types";
import type { Step } from "./domain/close";

export const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#2443d6" /><path d="M8 15.5l4.5 4.5L22 10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const M = ({ m }: { m: Money }) => <span className="num">{formatMoney(m)}</span>;

export const personName = (s: Store, id: string) => s.people.find((p) => p.id === id)?.name ?? "Sin nombre";
export const propertyLabel = (s: Store, id: string) => {
  const p = s.properties.find((x) => x.id === id);
  return p ? `${p.address}${p.unit ? `, ${p.unit}` : ""}` : "Sin inmueble";
};

export function PeriodPicker({ period, base }: { period: Period; base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="period" aria-label="Período activo">
      <Link href={`${base}${sep}periodo=${addMonths(period, -1)}`} aria-label="Mes anterior">←</Link>
      <span>{formatPeriod(period)}</span>
      <Link href={`${base}${sep}periodo=${addMonths(period, 1)}`} aria-label="Mes siguiente">→</Link>
    </div>
  );
}

export function ChargeChip({ c }: { c: Charge }) {
  const cls = c.status === "pagado" ? "ok" : c.status === "vencido" ? "bad" : "warn";
  const text = c.status === "vencido" ? `${CHARGE_LABEL.vencido} hace ${c.daysLate} días` : CHARGE_LABEL[c.status];
  return <span className={`chip ${cls}`}>{text}</span>;
}

/** Totales por moneda: nunca se suman pesos con dólares. */
export function totalsByCurrency(charges: Charge[]) {
  const cur = [...new Set(charges.map((c) => c.contract.currency))] as Currency[];
  return cur.map((currency) => {
    const cs = charges.filter((c) => c.contract.currency === currency);
    return {
      currency,
      expected: sum(cs.map((c) => c.amount), currency),
      received: sum(cs.map((c) => c.confirmed), currency),
      pending: sum(cs.map((c) => (c.balance.cents > 0 ? c.balance : { cents: 0, currency })), currency),
      provisional: cs.some((c) => c.provisional),
    };
  });
}

/** Los 5 pasos del cierre en una fila compacta. El actual es el primero sin completar. */
export function Stepper({ steps, period, current }: { steps: Step[]; period: Period; current?: string }) {
  const active = current ?? steps.find((s) => !s.complete)?.key;
  return (
    <ol className="stepper" aria-label="Pasos del cierre">
      {steps.map((s, i) => (
        <li key={s.key} className={`${s.complete ? "done" : ""} ${s.key === active ? "now" : ""}`}>
          <Link href={`/cierre?periodo=${period}&paso=${s.key}`} aria-current={s.key === active ? "step" : undefined}>
            <span className="dot" aria-hidden="true">{s.complete ? "✓" : i + 1}</span>
            <span className="name">{s.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
