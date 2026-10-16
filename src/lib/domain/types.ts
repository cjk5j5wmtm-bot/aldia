import type { Currency, Money, RoundingRule } from "./money";
import type { ISODate, Period } from "./period";

export type Id = string;

export interface Person {
  id: Id;
  orgId: Id;
  name: string;
  phone?: string;
  email?: string;
}

export interface Property {
  id: Id;
  orgId: Id;
  address: string;
  unit?: string;
}

export type IndexName = "IPC" | "ICL" | "CASA_PROPIA" | "OTRO";

export const INDEX_LABEL: Record<IndexName, string> = {
  IPC: "IPC (INDEC)",
  ICL: "ICL (BCRA)",
  CASA_PROPIA: "Casa Propia",
  OTRO: "Otro índice pactado",
};

/** Cláusula de actualización tal como se cargó del contrato. Los campos faltantes no se inventan. */
export interface AdjustmentClause {
  index: IndexName;
  everyMonths: number;
  /** Primer período en que rige un aumento, "YYYY-MM". */
  firstPeriod: Period;
  /**
   * Cuántos meses antes del período de aumento se toma el último valor del índice.
   * Ej.: 1 = para un aumento de noviembre se usa el índice de octubre. Si el contrato no lo dice, queda undefined.
   */
  referenceLagMonths?: number;
  rounding?: RoundingRule;
  /** Texto de la cláusula, para mostrarlo al revisar. */
  clauseText?: string;
  /** Si alguien marcó la cláusula como ambigua, qué falta resolver. */
  ambiguity?: string;
}

/** Regla de punitorios cargada desde el contrato. Sin regla, no se calculan punitorios. */
export interface LateFeeRule {
  kind: "interes_diario_simple";
  /** Tasa diaria en puntos básicos sobre el saldo vencido. 10 = 0,10% diario. */
  dailyRateBps: number;
  graceDays: number;
  /** Desde cuándo corren los intereses si se pasa la gracia. Debe salir del contrato. */
  accrueFrom: "vencimiento" | "fin_de_gracia";
  clauseText: string;
  reviewedBy?: string;
}

export interface OwnerShare {
  ownerId: Id;
  /** Porcentaje en puntos básicos; la suma de todos debe dar 10000. */
  shareBps: number;
}

export type ContractStatus = "activo" | "finalizado" | "archivado";

export interface Contract {
  id: Id;
  orgId: Id;
  code: string;
  propertyId: Id;
  owners: OwnerShare[];
  tenantIds: Id[];
  startDate: ISODate;
  endDate: ISODate;
  currency: Currency;
  initialRent: Money;
  dueDay: number;
  adjustment: AdjustmentClause | null;
  /** Comisión de administración en puntos básicos sobre el alquiler cobrado. */
  commissionBps: number;
  commissionPaidBy: "propietario" | "inquilino";
  lateFee: LateFeeRule | null;
  deposit?: Money;
  guarantee?: string;
  notes?: string;
  status: ContractStatus;
}

/** Valor de un índice para un período, cargado con su fuente. El sistema no trae ni completa valores solo. */
export interface IndexValue {
  index: IndexName;
  period: Period;
  value: number;
  source: string;
  loadedBy: string;
  loadedAt: string;
}

export type AdjustmentStatus = "pendiente" | "calculado" | "aprobado" | "comunicado" | "en_disputa";

/** Aumento aprobado y congelado: se guardan los valores usados para poder explicarlo después. */
export interface ApprovedAdjustment {
  id: Id;
  contractId: Id;
  period: Period;
  previous: Money;
  result: Money;
  index: IndexName;
  startRef: Period;
  endRef: Period;
  startValue: number;
  endValue: number;
  factor: number;
  rounding: RoundingRule;
  status: "aprobado" | "comunicado";
  approvedBy: string;
  approvedAt: string;
}

export type PaymentMethod = "transferencia" | "efectivo" | "mercado_pago" | "otro";

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  mercado_pago: "Mercado Pago (link externo)",
  otro: "Otro",
};

export interface Allocation {
  id: Id;
  chargeKey: string;
  amount: Money;
  by: string;
  at: string;
  reversed?: { by: string; at: string; reason: string };
}

/**
 * Pago que ocurrió fuera del sistema. "informado": alguien dijo que pagó o vino de un archivo.
 * "confirmado": el administrador verificó que la plata está en la cuenta. Al Día no mueve dinero.
 */
export interface Payment {
  id: Id;
  orgId: Id;
  amount: Money;
  method: PaymentMethod;
  effectiveDate: ISODate;
  recordedAt: string;
  recordedBy: string;
  reference?: string;
  source: "manual" | "importado";
  /** Para evitar duplicados al importar o registrar dos veces lo mismo. */
  dedupeKey: string;
  status: "informado" | "confirmado" | "anulado";
  confirmedBy?: string;
  confirmedAt?: string;
  payerNote?: string;
  allocations: Allocation[];
}

export interface Expense {
  id: Id;
  orgId: Id;
  contractId: Id;
  description: string;
  category: "arreglo" | "mantenimiento" | "servicio" | "expensas" | "otro";
  amount: Money;
  date: ISODate;
  /** Quién lo asume en la liquidación. */
  bornBy: "propietario" | "inquilino";
  /** Período en que se descuenta o se cobra. */
  period: Period;
  provider?: string;
  reference?: string;
  status: "pendiente" | "confirmado" | "descartado";
}

export type SettlementStatus = "borrador" | "aprobada" | "informada" | "pago_registrado";

/** Foto de una liquidación al aprobarla. Lo aprobado no cambia aunque cambien los datos después. */
export interface SettlementRecord {
  id: Id;
  ownerId: Id;
  period: Period;
  currency: Currency;
  status: Exclude<SettlementStatus, "borrador">;
  snapshot: SettlementBreakdown;
  approvedBy: string;
  approvedAt: string;
  informedAt?: string;
  externalTransfer?: { date: ISODate; reference: string; by: string; at: string };
}

export interface SettlementLine {
  contractId: Id;
  contractCode: string;
  shareBps: number;
  collected: Money;
  commission: Money;
  expenses: { id: Id; description: string; amount: Money }[];
}

export interface SettlementBreakdown {
  ownerId: Id;
  period: Period;
  currency: Currency;
  lines: SettlementLine[];
  collected: Money;
  commission: Money;
  expenses: Money;
  net: Money;
  blockers: string[];
}

export interface PeriodClose {
  period: Period;
  closedBy: string;
  closedAt: string;
  exceptions: string[];
  exceptionReason?: string;
}

export interface AuditEvent {
  id: Id;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId: Id;
  detail?: string;
  reason?: string;
}

export type SubscriptionStatus = "sin_pagar" | "activa" | "pausada" | "cancelada";

export interface Subscription {
  status: SubscriptionStatus;
  /** Id de la suscripción en Mercado Pago (preapproval). */
  mpId?: string;
  updatedAt: string;
}

export interface Organization {
  id: Id;
  name: string;
  /** true mientras la cuenta use los datos de ejemplo. */
  isDemo: boolean;
  subscription?: Subscription;
  /** Respuestas de las preguntas de bienvenida. */
  profile?: Profile;
  /** true cuando ya pasó por las preguntas de bienvenida (aunque las haya salteado). */
  onboarded?: boolean;
}

export type Pain = "cobrar" | "aumentos" | "liquidar" | "orden";
export type IndexAnswer = "IPC" | "ICL" | "OTRO" | "no_se";

export interface Profile {
  size: "1-20" | "21-80" | "81-200" | "200+";
  /** En el orden en que los eligió: el primero es el foco principal. */
  pains: Pain[];
  late: "pocos" | "algunos" | "muchos";
  pays: PaymentMethod | "mezcla";
  indices: IndexAnswer[];
  tool: "excel" | "cuaderno" | "sistema" | "cabeza";
  answeredAt: string;
}

export interface Store {
  org: Organization;
  people: Person[];
  properties: Property[];
  contracts: Contract[];
  indexValues: IndexValue[];
  adjustments: ApprovedAdjustment[];
  payments: Payment[];
  expenses: Expense[];
  settlements: SettlementRecord[];
  closes: PeriodClose[];
  audit: AuditEvent[];
  /** Alquileres ya pagados que el usuario sacó de la lista de Cobranzas (claves de cobro). Solo afecta la vista. */
  clearedCharges?: string[];
  seq: number;
}
