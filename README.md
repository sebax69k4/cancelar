# ServicioTécnico — Frontend (MVP)

Frontend del sistema interno de workflow para un servicio técnico de PC y notebooks: recepción de equipos, órdenes de servicio, tablero Kanban, prioridad por impacto × urgencia, alertas de órdenes críticas y cierre con solución, evidencia y validación.

> **Versión demo.** No hay backend: todos los datos se guardan **en el navegador** (localStorage) y la app **arranca vacía**. La capa `apiClient` está lista para cambiarse por la API REST de NestJS (ver [Conectar con NestJS](#conectar-con-el-backend-nestjs)).

---

## Índice

1. [Stack](#stack)
2. [Comandos](#comandos)
3. [Probar la demo](#probar-la-demo)
4. [Roles y permisos](#roles-y-permisos)
5. [Reglas del workflow](#reglas-del-workflow)
6. [Estructura del proyecto](#estructura-del-proyecto)
7. [Persistencia en modo demo](#persistencia-en-modo-demo)
8. [Conectar con el backend NestJS](#conectar-con-el-backend-nestjs)
9. [Accesibilidad](#accesibilidad)
10. [Limitaciones conocidas](#limitaciones-conocidas)

---

## Stack

| Tecnología | Uso |
|---|---|
| Astro 7 + `@astrojs/node` | Rutas y layout. La ruta `/ordenes/[id]` es dinámica (`prerender = false`). |
| React 19 (islas `client:only`) | Toda la interfaz interactiva. |
| TypeScript estricto | `strict` + `noUncheckedIndexedAccess`. Sin `any`. |
| Tailwind CSS 4 | Tokens de diseño en `src/styles/global.css` (modo claro/oscuro). |
| TanStack Query | Caché y estados de carga/error de las llamadas a `apiClient`. |
| react-hook-form + zod | Formularios y validaciones (`src/schemas`). |
| @dnd-kit | Kanban con arrastrar y soltar (mouse, táctil y teclado). |
| lucide-react | Iconografía. |

## Comandos

Requisitos: **Node.js ≥ 22.12** y npm.

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:4321. También se puede iniciar en segundo plano con `npx astro dev --background` (y `npx astro dev stop` para detenerlo).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run check` | Chequeo de tipos de TypeScript y Astro (debe dar 0 errores). |
| `npm run build` | Compila para producción en `dist/` (servidor Node standalone). |
| `npm run preview` | Sirve el build de producción localmente. |

Para correr el build de producción directamente:

```bash
node dist/server/entry.mjs
```

## Probar la demo

1. Entrá a `/login`, elegí un **rol de prueba** y presioná *Ingresar* (cualquier contraseña de 4+ caracteres).
2. Como **Recepción** o **Admin**: *Nueva orden* → creá el cliente desde el buscador, después el equipo, la falla, el servicio, el responsable, el técnico, el impacto y la urgencia.
3. Como **Técnico** (Carlos Ibáñez): abrí la orden, pasala a diagnóstico, cargá el diagnóstico y movela en el Kanban.
4. Como **Supervisor**: documentá la solución, adjuntá evidencia, validá y cerrá.
5. Para ver una **crítica de más de 24 h** sin esperar: en el panel *Versión demo* de la barra lateral, presioná **+24 h** (reloj simulado). *Tiempo real* lo vuelve a la normalidad.
6. **Reiniciar demo** (solo Admin) borra todo y deja el sistema vacío.

El rol se puede cambiar en cualquier momento desde el selector amarillo de la barra superior.

**Atajos:** `/` enfoca la búsqueda global. Errores de red simulados: agregá `?mockError=1` a cualquier URL.

## Roles y permisos

Usuarios de prueba en `src/mocks/users.ts`. Matriz de permisos en `src/lib/auth/permissions.ts`.

| Acción | Admin | Supervisor | Recepción | Técnico |
|---|:-:|:-:|:-:|:-:|
| Ver dashboard y órdenes | ✔ | ✔ | ✔ | solo las suyas |
| Clientes (ver / crear) | ✔ | ✔ | ✔ | — |
| Equipos (ver / crear) | ✔ | ✔ | ✔ | ver |
| Crear orden y asignar | ✔ | ✔ | ✔ | — |
| Cambiar estado | ✔ | ✔ | solo Recibido → Diagnóstico | solo las suyas |
| Diagnóstico, solución y evidencia | ✔ | ✔ | — | solo las suyas |
| Cambiar impacto y urgencia | ✔ | ✔ | — | — |
| Bloquear / Escalar | ✔ | ✔ | — | solo las suyas |
| Desbloquear, validar, cerrar y reabrir | ✔ | ✔ | — | — |
| Alertas | ✔ | ✔ | — | solo las suyas |
| Reiniciar demo | ✔ | — | — | — |

«Las suyas» = órdenes donde el usuario es técnico asignado o responsable.

## Reglas del workflow

Las reglas son **funciones puras** en `src/lib/workflow/`. La UI las usa para explicar qué falta y el `apiClient` mock para rechazar. **El backend debe replicarlas** (son la especificación).

### Prioridad (`priority.ts`)

| Impacto \ Urgencia | Baja | Media | Alta |
|---|---|---|---|
| **Alto** | Media | Alta | **Crítica** |
| **Medio** | Media | Media | Alta |
| **Bajo** | Baja | Media | Media |

### Transiciones (`transitions.ts`)

Todo cambio exige **comentario** (mín. 5 caracteres). Una orden **bloqueada** no cambia de estado.

| Desde → Hacia | Requisito adicional |
|---|---|
| Recibido → En diagnóstico | Técnico asignado |
| En diagnóstico → En reparación | Diagnóstico cargado |
| En reparación → Pruebas / ← En diagnóstico | — |
| Pruebas → Listo para retirar | Solución documentada |
| Pruebas → En reparación (retroceso) | — |
| Listo para retirar → Cerrado | Solución + ≥ 1 evidencia + validación de supervisor; rol Supervisor/Admin |
| Cerrado → (Reabrir) Diagnóstico o Reparación | Motivo (mín. 10); rol Supervisor/Admin. Se pierde la validación. |

Acciones especiales: **Bloquear** y **Escalar** (motivo mín. 10), **Desbloquear** (comentario), **Validar** (requiere solución). Cambiar la solución o quitar evidencia invalida la validación. Cerrar limpia el escalado.

### Alertas (`alerts.ts`)

- **Crítica vencida**: prioridad Crítica, no cerrada y abierta hace más de **24 h**. Genera un `InformeCritico` (aparece en el dashboard hasta marcarlo como revisado; vuelve a aparecer cada 24 h si sigue abierta).
- **Atrasada**: pasó la fecha estimada y no está lista ni cerrada.

## Estructura del proyecto

```text
src/
├── pages/                 Rutas Astro (solo montan la isla de cada página)
│   ├── login.astro  dashboard.astro  alertas.astro  clientes.astro  equipos.astro
│   └── ordenes/  index.astro (Kanban)  nueva.astro  [id].astro (detalle)
├── layouts/BaseLayout.astro   <html>, fuentes y script de tema sin parpadeo
├── components/
│   ├── ui/                Genéricos: Button, Input, Select, Modal, Toast, Tabs, Table, States…
│   ├── layout/            AppShell, Sidebar, Topbar, RoleSwitcher, DemoPanel
│   ├── auth/              PermissionGuard
│   ├── domain/            StatusBadge, PriorityBadge, OrderCard, kanban/, order/, client/, equipment/, dashboard/
│   └── islands/           Un componente raíz por página
├── hooks/                 useOrders, useOrder, useClients, useEquipment, useDashboard…
├── lib/
│   ├── api/               apiClient.ts (interfaz + mock), httpApiClient.ts (NestJS), errors.ts, queryClient.ts
│   ├── workflow/          priority.ts, transitions.ts, alerts.ts  ← reglas de negocio
│   ├── auth/              mockCurrentUser.ts, permissions.ts
│   └── clock.ts  format.ts  theme.ts  toast.ts  storage.ts
├── mocks/                 db.ts (localStorage), users.ts, catalog.ts (servicios)
├── schemas/               zod: cliente, equipo, orden, transición, login
└── types/domain.ts        Tipos de dominio = contrato con el backend
```

**Regla de dependencias:** `components → hooks → lib/api/apiClient → mocks`. Ningún componente importa `mocks/db.ts`.

La página `/design` muestra el sistema de diseño (paleta, tipografía y componentes).

## Persistencia en modo demo

| Clave de localStorage | Contenido |
|---|---|
| `st.db.v1` | Clientes, equipos, órdenes e informes leídos |
| `st.session` | Id del usuario mock logueado |
| `st.theme` | `light` / `dark` / `system` |
| `st.clock.offsetHours` | Horas adelantadas del reloj simulado |

Los datos son por navegador: otro navegador u otra PC ven el sistema vacío. Varias pestañas del mismo navegador se sincronizan solas.

---

## Conectar con el backend NestJS

La UI nunca llama a `fetch` directamente: todo pasa por la interfaz `ApiClient` (`src/lib/api/apiClient.ts`). Hay dos implementaciones:

- `MockApiClient`: la demo actual, en localStorage.
- `HttpApiClient` (`src/lib/api/httpApiClient.ts`): **ya implementado** contra los endpoints de abajo.

### 1. Activar el cliente HTTP

```bash
cp .env.example .env
```

Editá `.env`:

```env
PUBLIC_API_URL=http://localhost:3000/api
```

Reiniciá `npm run dev`. Con `PUBLIC_API_URL` definido se usa `HttpApiClient` y desaparece el panel *Versión demo*. Sin definir, vuelve al mock.

### 2. Preparar NestJS (`backend/src/main.ts`)

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: 'http://localhost:4321', credentials: true }); // cookies de sesión
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```

### 3. Endpoints que espera el frontend

Las respuestas deben tener **la forma de los tipos de `src/types/domain.ts`** (nombres de campos en español, fechas ISO 8601, ids string). `OrdenResumen` incluye las relaciones (`cliente`, `equipo`, `servicio`, `responsable`, `tecnico`) y los campos calculados `horasAbierta`, `atrasada`, `criticaVencida`.

| Método | Ruta | Body / query | Respuesta |
|---|---|---|---|
| GET | `/users` | — | `Usuario[]` |
| GET | `/services` | — | `Servicio[]` |
| GET | `/clients` | `?q=` | `Cliente[]` |
| POST | `/clients` | `{ nombre, telefono, email?, notas? }` | `Cliente` |
| GET | `/equipment` | `?q=&clientId=` | `Equipo[]` |
| POST | `/equipment` | `{ clienteId, tipo, marca, modelo, numeroSerie, notas? }` | `Equipo` |
| GET | `/equipment/:id/orders` | — | `OrdenResumen[]` |
| GET | `/orders` | `?q=&status=&priority=&ownerId=` | `OrdenResumen[]` |
| GET | `/orders/:id` | — | `OrdenResumen` |
| POST | `/orders` | `CreateOrderInput` | `OrdenResumen` |
| PATCH | `/orders/:id` | `UpdateOrderInput & { comentario? }` | `OrdenResumen` |
| POST | `/orders/:id/transitions` | `{ to, comentario }` | `OrdenResumen` |
| POST | `/orders/:id/block` | `{ motivo }` | `OrdenResumen` |
| POST | `/orders/:id/unblock` | `{ comentario }` | `OrdenResumen` |
| POST | `/orders/:id/escalate` | `{ motivo }` | `OrdenResumen` |
| POST | `/orders/:id/reopen` | `{ to, motivo }` | `OrdenResumen` |
| POST | `/orders/:id/validate` | `{ comentario }` | `OrdenResumen` |
| POST | `/orders/:id/evidence` | multipart, campo `file` | `OrdenResumen` |
| DELETE | `/orders/:id/evidence/:evidenceId` | — | `OrdenResumen` |
| GET | `/dashboard` | — | `DashboardData` |
| GET | `/alerts` | — | `AlertsData` |
| PATCH | `/critical-reports/:id/read` | — | `204` |

Los tipos `CreateOrderInput`, `UpdateOrderInput`, `DashboardData` y `AlertsData` están en `src/lib/api/apiClient.ts`. El backend debe calcular `prioridad` (nunca confiar en la del cliente) y filtrar por usuario: un Técnico solo recibe sus órdenes.

### 4. Formato de errores

`HttpApiClient` convierte la respuesta de error de NestJS en `ApiError` y muestra `details` como lista en el toast:

| HTTP | Código en el front | Cuándo |
|---|---|---|
| 400 | `VALIDATION` | DTO inválido (`message: string[]` de ValidationPipe) |
| 401 | `UNAUTHORIZED` | Sin sesión |
| 403 | `FORBIDDEN` | Rol sin permiso |
| 404 | `NOT_FOUND` | No existe |
| 409 | `CONFLICT` | Teléfono o número de serie repetido |
| 422 | `WORKFLOW_RULE` | Regla del workflow no cumplida |

Para reglas del workflow, devolvé la lista de faltantes en `details`:

```ts
throw new UnprocessableEntityException({
  message: 'No se puede mover a «Listo para retirar»',
  details: ['Falta documentar la solución'],
});
```

### 5. Autenticación real

Hoy la sesión es simulada (`src/lib/auth/mockCurrentUser.ts`). Para reemplazarla:

1. Backend: `POST /auth/login` (passport-local + argon2) que setea una cookie HTTP-only con el JWT, `GET /auth/me` y `POST /auth/logout`.
2. `mockCurrentUser.ts`: `getMockCurrentUser()` debe devolver el usuario de `/auth/me` (cargado al iniciar) en lugar de leer localStorage. Mantener la misma API (`subscribeCurrentUser`, `signOut`) para que `useCurrentUser` no cambie.
3. `LoginPage.tsx`: enviar email y contraseña a `/auth/login` y quitar el selector de rol de prueba.
4. Quitar `RoleSwitcher` de la barra superior.
5. Los permisos de `permissions.ts` siguen sirviendo para mostrar u ocultar botones, pero **el backend debe aplicarlos** con guards por rol.

### 6. Otras tareas del backend

- **Informes críticos**: un job con `@nestjs/schedule` (ej. cada 15 min) que detecte órdenes críticas abiertas más de 24 h y genere `InformeCritico`.
- **Evidencia**: guardar el archivo (multer) y devolver la `Evidencia` con sus metadatos. El frontend ya envía el archivo como `FormData`.
- **Numeración**: `OS-AAAA-0001` correlativa, generada en el backend dentro de una transacción.
- **Historial**: cada acción agrega un registro `Historial` con usuario, fecha, estados y comentario.
- **Reloj simulado y reinicio**: son solo de la demo. `resetDemo()` en `HttpApiClient` siempre falla y el panel no se muestra.

### 7. Qué se puede borrar al terminar la migración

`src/mocks/db.ts`, la clase `MockApiClient`, `src/lib/clock.ts` (reemplazar `now()` por `Date.now()`), `DemoPanel.tsx` y la suscripción a `subscribeDb` en `queryClient.ts`. Las invalidaciones de TanStack Query después de cada mutación ya están en los hooks.

---

## Accesibilidad

- Contraste WCAG AA en modo claro y oscuro. Estados, prioridades y alertas siempre con **icono + texto**, nunca solo color.
- Foco visible en todos los controles y enlace «Saltar al contenido».
- Kanban por teclado: enfocá el asa de la tarjeta, **Espacio** para tomar, **← →** para cambiar de columna y **Espacio** para soltar. Anuncios en español para lectores de pantalla. Alternativa: botón **Mover** en cada tarjeta.
- Modales sobre `<dialog>` nativo (foco atrapado, Esc, retorno de foco). Toasts en regiones `aria-live`.
- Respeta `prefers-reduced-motion`.

## Limitaciones conocidas

- Sin autenticación real ni backend: los datos viven solo en el navegador actual.
- La evidencia en modo demo registra nombre y tamaño; el archivo no se guarda.
- El reloj simulado afecta solo los cálculos de tiempo de la demo (horas abiertas, atrasos, críticas > 24 h).
