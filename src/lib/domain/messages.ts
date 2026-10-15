import type { Charge } from "./charges";
import { formatMoney } from "./money";
import { formatDate, formatPeriod } from "./period";
import type { SettlementBreakdown, Store } from "./types";

export interface MessageDraft {
  to: string;
  phone?: string;
  text: string;
  /** Por qué no conviene mandarlo todavía. Si hay algo acá, la pantalla no ofrece enviarlo. */
  warnings: string[];
}

const firstName = (n: string) => n.split(" ")[0];

export function reminderDraft(store: Store, ch: Charge): MessageDraft {
  const tenant = store.people.find((p) => p.id === ch.contract.tenantIds[0]);
  const prop = store.properties.find((p) => p.id === ch.contract.propertyId);
  const warnings: string[] = [];
  if (!tenant) warnings.push("El contrato no tiene inquilino cargado.");
  if (!tenant?.phone) warnings.push("El inquilino no tiene teléfono cargado.");
  if (ch.provisional) warnings.push("El aumento de este mes no está aprobado: el importe todavía no es definitivo.");
  if (ch.informed.cents > 0) warnings.push("Hay un pago informado sin verificar. Revisalo antes de reclamar.");
  const late = ch.daysLate > 0;
  const lines = [
    `Hola ${tenant ? firstName(tenant.name) : "{inquilino}"}, te escribimos de ${store.org.name}.`,
    late
      ? `El alquiler de ${formatPeriod(ch.period)} de ${prop?.address ?? "{propiedad}"} venció el ${formatDate(ch.dueDate)} y figura un saldo de ${formatMoney(ch.balance)}.`
      : `Te recordamos que el alquiler de ${formatPeriod(ch.period)} de ${prop?.address ?? "{propiedad}"} vence el ${formatDate(ch.dueDate)}. El importe es ${formatMoney(ch.balance)}.`,
    "Si ya pagaste, respondé este mensaje con el comprobante y lo registramos. ¡Gracias!",
  ];
  // Los punitorios calculados no se mencionan como deuda: el administrador decide si los reclama.
  return { to: tenant?.name ?? "Sin inquilino", phone: tenant?.phone, text: lines.join("\n\n"), warnings };
}

export function ownerSummaryDraft(store: Store, s: SettlementBreakdown, approved: boolean): MessageDraft {
  const owner = store.people.find((p) => p.id === s.ownerId);
  const warnings: string[] = [];
  if (!approved) warnings.push("La liquidación no está aprobada. Aprobala antes de mandarle el resumen al propietario.");
  if (!owner?.phone && !owner?.email) warnings.push("El propietario no tiene teléfono ni email cargados.");
  const lines = s.lines.map((l) => `• ${l.contractCode}: cobrado ${formatMoney(l.collected)}`);
  const text = [
    `Hola ${owner ? firstName(owner.name) : "{propietario}"}, este es el resumen de ${formatPeriod(s.period)} (${s.currency}):`,
    lines.join("\n"),
    `Cobrado: ${formatMoney(s.collected)}\nComisión de administración: −${formatMoney(s.commission)}\nGastos a tu cargo: −${formatMoney(s.expenses)}\nNeto a transferirte: ${formatMoney(s.net)}`,
    `Te avisamos cuando hagamos la transferencia.`,
  ].join("\n\n");
  return { to: owner?.name ?? s.ownerId, phone: owner?.phone, text, warnings };
}
