# Al Día · v0.2

Cierre de mes guiado para inmobiliarias que administran alquileres en Argentina: aumentos por índice, cobranzas, punitorios (solo si el contrato los define), conciliación, liquidación a propietarios y cierre con historial.

**Al Día nunca cobra, retiene ni mueve dinero.** Registra lo que pasó y calcula lo que el administrador revisa y aprueba.

## Cómo ejecutarlo

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 29 pruebas del núcleo de cálculo
npm run typecheck
npm run build && npm start   # versión optimizada
```

Entrá a `/registro` y creá una cuenta (nombre de la inmobiliaria, mail y contraseña). Cada cuenta nueva arranca con **datos de ejemplo**: 8 contratos ficticios, fecha fija 15/10/2026 y período octubre 2026. "Reiniciar datos de ejemplo" en la barra lateral los vuelve al inicio.

## Cuentas y datos

- Cada inmobiliaria tiene su cuenta con mail y contraseña. Solo ve sus propios datos.
- Las contraseñas se guardan con `scrypt` y sal, nunca en texto plano. La sesión es una cookie firmada que dura 30 días.
- En Netlify, los datos se guardan en **Netlify Blobs** (viene incluido y no hay que configurarlo). En la compu se guardan en `.data/`.
- Todavía no hay recuperación de contraseña ni varios usuarios por inmobiliaria.

## Suscripción con Mercado Pago

El cobro se activa solo cuando configurás `MP_ACCESS_TOKEN`. Sin esa variable, la app no pide pago.

1. En Mercado Pago (Tus integraciones), creá una aplicación y copiá el **Access Token de producción**. La cuenta tiene que ser de un adulto, porque es donde cae la plata.
2. En Netlify, en Project configuration > Environment variables, agregá:
   - `MP_ACCESS_TOKEN` = el token. **Es secreto: nunca lo pongas en el código ni lo compartas.**
   - Opcional: `ALDIA_PRECIO_ARS`, si querés otro precio (por defecto, 29900).
3. En Mercado Pago, en Webhooks, configurá la URL `https://TU-SITIO.netlify.app/api/mercadopago` con el evento de suscripciones (preapproval).
4. Volvé a publicar el sitio (Deploys > Trigger deploy).

Cómo funciona:
- Al crear la cuenta, la persona va a `/suscripcion` y toca "Pagar con Mercado Pago". Ahí Al Día crea una suscripción mensual (preapproval) y la manda al checkout de Mercado Pago.
- Cuando vuelve, o cuando Mercado Pago avisa por el webhook, se consulta el estado real y se habilita el acceso.
- Si pausa o cancela la suscripción, el acceso se corta.
- Mercado Pago pide que el mail de la cuenta de Al Día sea el mismo con el que se paga en Mercado Pago.

## Qué se puede hacer hoy

1. **Inicio**: lo próximo para hacer, avance de los 5 pasos del cierre, lista de pendientes y totales por moneda.
2. **Cierre del mes**:
   - aprobar aumentos, con el cálculo explicado;
   - cargar valores de índice con su fuente;
   - definir el rezago del índice cuando el contrato no lo dice;
   - confirmar, descartar o agregar gastos;
   - cerrar el período, y si quedan pendientes el cierre pide un motivo escrito;
   - ver el historial.
3. **Contratos**: búsqueda, alquiler vigente, próximo aumento, datos faltantes y ficha con la tabla de actualizaciones.
4. **Cobranzas**:
   - alquileres del mes con estado y saldo;
   - borrador del recordatorio de WhatsApp para copiar;
   - registrar pagos, informados o verificados, sin duplicados por referencia;
   - asignar pagos de forma parcial o total;
   - confirmar, revertir asignaciones con motivo y anular pagos.
5. **Propietarios**:
   - liquidación por propietario y moneda, con bloqueos visibles;
   - aprobación que queda guardada y no cambia después;
   - resumen para el propietario;
   - constancia de la transferencia que el usuario hizo desde su banco.

## Reglas de cálculo (supuestos)

- **Dinero**: centavos enteros con moneda. Pesos y dólares nunca se suman.
- **Aumentos**: nuevo = anterior × (índice del mes final / índice del mes inicial). Los meses salen del período del aumento menos el rezago.
  - Si falta el rezago o un valor del índice, el aumento queda "pendiente de datos". Nada se inventa.
  - Un aumento aprobado queda congelado.
  - El redondeo es el del contrato. Si el contrato no lo define, se redondea al centavo y se indica en pantalla.
- **Punitorios**: interés diario simple, y solo si el contrato tiene una regla cargada (tasa, días de gracia, desde cuándo corre).
  - Se muestran como "calculados" y no se suman al saldo.
  - Sin regla en el contrato, no se calculan.
- **Pagos**: solo los verificados cuentan como cobrados y entran en la liquidación.
- **Liquidación**: no se puede aprobar mientras haya:
  - pagos informados sin verificar;
  - aumentos sin aprobar;
  - gastos pendientes;
  - porcentajes de propietarios que no suman 100%.
- **Período cerrado**: no admite cambios.

## Qué es real y qué es simulado

| Parte | Estado |
|---|---|
| Cálculos, estados, historial | Reales (en el código, con pruebas) |
| Valores de índice IPC/ICL de la demo | **Ficticios**. No son datos oficiales |
| WhatsApp | No conectado: solo arma el texto para copiar |
| Mercado Pago, bancos, INDEC/BCRA, ARCA | No conectados |
| Guardado | Netlify Blobs en Netlify; archivos JSON locales en la compu |
| Cuentas con mail y contraseña, una por inmobiliaria | Real |
| Suscripción con Mercado Pago | Real cuando se configura `MP_ACCESS_TOKEN`. No la pude probar contra Mercado Pago desde el entorno de desarrollo |

## Para revisar con un profesional antes de usarlo con datos reales

- La interpretación de las cláusulas de actualización: rezago del índice, mes base, redondeo, contratos de la Ley 27.551 y posteriores.
- Si corresponde cobrar punitorios, cómo se calculan y cómo se informan al inquilino.
- El tratamiento impositivo de comisiones y liquidaciones (facturación, retenciones).
- El tratamiento de los datos personales de inquilinos y propietarios.

## Próximos pasos (en orden)

1. Recuperar contraseña, varios usuarios por inmobiliaria y una base de datos relacional cuando haya muchos clientes.
2. Alta y edición de contratos, e importación desde planilla (CSV/Excel).
3. Carga de índices desde fuentes oficiales, con revisión humana antes de usarlos.
4. Envío de WhatsApp con plantilla y autorización explícita.
5. Reportes y Configuración (están en la especificación, no en esta versión).
6. Conciliación con extractos bancarios y Mercado Pago (solo lectura).

## Estructura

- `src/lib/domain/`: reglas de negocio puras (dinero, períodos, aumentos, cobros, pagos, liquidaciones, cierre, mensajes).
- `src/lib/demo/seed.ts`: datos ficticios.
- `src/lib/server/store.ts`: guardado en JSON.
- `src/app/`: pantallas (Next.js 15) y acciones del servidor.
- `tests/`: pruebas del núcleo.
