import Link from "next/link";
import { CHARGE_LABEL, type Charge } from "./domain/charges";
import { formatMoney, sum, type Currency, type Money } from "./domain/money";
import { addMonths, formatPeriod, type Period } from "./domain/period";
import type { Store } from "./domain/types";
import type { Step } from "./domain/close";

/** Logo de Al Día: casa con una A, en degradé azul. El mismo dibujo está en src/app/icon.svg (favicon). */
export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="aldia-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#4f46e5" /><stop offset="1" stopColor="#2563eb" /></linearGradient>
      <clipPath id="aldia-c"><path d={HOUSE} /></clipPath>
    </defs>
    <path d={HOUSE} fill="url(#aldia-g)" />
    <g clipPath="url(#aldia-c)" stroke="#fff">
      <path d="M12.5 46 24 15.5 35.5 46" fill="none" strokeWidth="4.4" strokeLinejoin="round" />
      <path d="M18 33h12" strokeWidth="3.8" />
    </g>
  </svg>
);
const HOUSE = "M24 3.5c.9 0 1.7.3 2.4.8l16 12.6c1 .8 1.6 2 1.6 3.3V40a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V20.2c0-1.3.6-2.5 1.6-3.3l16-12.6c.7-.5 1.5-.8 2.4-.8z";

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
