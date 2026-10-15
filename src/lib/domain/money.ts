// Dinero en centavos enteros. Nunca se usan decimales para guardar importes.
export type Currency = "ARS" | "USD";

export interface Money {
  cents: number;
  currency: Currency;
}

export const money = (cents: number, currency: Currency): Money => {
  if (!Number.isSafeInteger(cents)) throw new Error(`Importe inválido: ${cents}`);
  return { cents, currency };
};

export const zero = (currency: Currency): Money => money(0, currency);

function same(a: Money, b: Money) {
  if (a.currency !== b.currency) {
    throw new Error(`No se pueden combinar ${a.currency} y ${b.currency} sin un tipo de cambio explícito`);
  }
}

export const add = (a: Money, b: Money): Money => (same(a, b), money(a.cents + b.cents, a.currency));
export const sub = (a: Money, b: Money): Money => (same(a, b), money(a.cents - b.cents, a.currency));
export const sum = (items: Money[], currency: Currency): Money => items.reduce(add, zero(currency));

export type RoundingMode = "nearest" | "up" | "down";
export interface RoundingRule {
  mode: RoundingMode;
  /** Múltiplo al que se redondea, en centavos. 1 = al centavo, 10000 = a los $100. */
  toCents: number;
  /** true si la regla viene del contrato; false si es el valor por defecto del sistema. */
  fromContract: boolean;
}

export const DEFAULT_ROUNDING: RoundingRule = { mode: "nearest", toCents: 1, fromContract: false };

/** Redondea un valor en centavos (puede tener decimales) según la regla. Half-up para "nearest". */
export function roundCents(value: number, rule: RoundingRule = DEFAULT_ROUNDING): number {
  const step = rule.toCents;
  const q = value / step;
  const r = rule.mode === "up" ? Math.ceil(q - 1e-9) : rule.mode === "down" ? Math.floor(q + 1e-9) : Math.floor(q + 0.5 + 1e-9);
  return r * step;
}

/** Multiplica por una fracción expresada en puntos básicos (1% = 100 bps). */
export function percentOf(m: Money, bps: number, rule: RoundingRule = DEFAULT_ROUNDING): Money {
  return money(roundCents((m.cents * bps) / 10000, rule), m.currency);
}

export function formatMoney(m: Money): string {
  const sign = m.cents < 0 ? "−" : "";
  const abs = Math.abs(m.cents);
  const units = Math.floor(abs / 100).toLocaleString("es-AR");
  const dec = String(abs % 100).padStart(2, "0");
  const symbol = m.currency === "ARS" ? "$" : "US$";
  return `${sign}${symbol} ${units},${dec}`;
}

export function describeRounding(rule: RoundingRule): string {
  const to = rule.toCents === 1 ? "al centavo" : `a múltiplos de ${formatMoney(money(rule.toCents, "ARS")).replace("$ ", "$")}`;
  const mode = rule.mode === "nearest" ? "al más cercano" : rule.mode === "up" ? "hacia arriba" : "hacia abajo";
  return `${to}, ${mode}${rule.fromContract ? " (según contrato)" : " (por defecto: el contrato no define redondeo)"}`;
}
