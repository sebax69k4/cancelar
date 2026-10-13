# ServicioTécnico — Frontend (MVP)

Frontend del sistema interno de workflow para un servicio técnico de PC y notebooks: recepción de equipos, órdenes de servicio, tablero Kanban, prioridad por impacto × urgencia, alertas de órdenes críticas y cierre con solución, evidencia y validación.

> **Dos modos.** Con el backend NestJS (`../backend`) los datos viven en la base y el login es real. Sin `PUBLIC_API_URL` en `.env`, funciona como **demo**: los datos se guardan en el navegador (localStorage) y la app arranca vacía. Ver [Conectar con el backend NestJS](#conectar-con-el-backend-nestjs).

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
| `npm run dev` | Servidor de desarrollo con recarga en caliente (conectado al backend si `.env` tiene `PUBLIC_API_URL`). |
| `npm run dev:demo` | Igual, pero en modo demo: sin backend, datos en el navegador. |
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

### Navegación sin recargas

Todas las pantallas internas cargan la misma isla, `src/components/islands/App.tsx`, que elige la pantalla según la URL (`src/lib/router.ts`). Al hacer clic en un enlace interno se actualiza el historial y cambia el contenido **sin recargar la página**: la sesión y los datos ya descargados se conservan, así que la pantalla aparece al instante. Además:

- Al pasar el mouse o el foco por un enlace se precargan los datos de esa pantalla (`src/lib/api/prefetch.ts`); al cargar la app se precargan, en un momento libre, las secciones del menú.
- Los enlaces siguen siendo enlaces normales: recargar, abrir en pestaña nueva (Ctrl+clic), atrás/adelante y compartir la URL funcionan igual.
- En cada cambio de pantalla se actualiza el título de la pestaña, se vuelve arriba y el foco pasa al contenido (lectores de pantalla).
- Para navegar desde código usá `navigate('/ruta')` de `src/lib/router.ts` en lugar de `window.location`.
- Una ruta nueva se agrega en `resolve()` de `App.tsx`, en `APP_ROUTE` de `router.ts` y como página `.astro` que monta `<App client:only="react">`.

La página `/design` muestra el sistema de diseño (paleta, tipografía y componentes).

### Estilos visuales

Hay dos estilos, combinables con el tema claro/oscuro (botones de la barra superior):

| Estilo | Claro | Oscuro |
|---|---|---|
| **Clásico** (por defecto) | Windows 2000: biseles, barras de título, barra de estado | Terminal CRT verde fósforo |
| **Moderno** | Interfaz plana clara | Interfaz plana oscura |

Cómo funciona: `<html>` lleva la clase `skin-classic`, que redefine los tokens de `global.css` (colores, fuentes, radios en 0). Los componentes exponen clases semánticas `ui-*` (`ui-panel`, `ui-btn`, `ui-field`, `ui-titlebar`, `ui-tab`, `ui-grid`…) que el bloque «ESTILO CLÁSICO» de `global.css` convierte en biseles. Para estilos puntuales existe la variante de Tailwind `classic:` (ej. `classic:font-mono`). El estilo elegido se guarda en `st.skin`.

## Persistencia en modo demo

| Clave de localStorage | Contenido |
|---|---|
| `st.db.v1` | Clientes, equipos, órdenes e informes leídos |
| `st.session` | Id del usuario mock logueado |
| `st.theme` | `light` / `dark` / `system` |
| `st.skin` | `classic` (por defecto) / `modern` |
| `st.clock.offsetHours` | Horas adelantadas del reloj simulado |

Los datos son por navegador: otro navegador u otra PC ven el sistema vacío. Varias pestañas del mismo navegador se sincronizan solas.

---

## Conectar con el backend NestJS

El backend ya está implementado en `../backend` (NestJS + Prisma + SQLite). Su README tiene la puesta en marcha, los usuarios iniciales, la referencia de la API y la guía para pasar a PostgreSQL.

La UI nunca llama a `fetch` directamente: todo pasa por la interfaz `ApiClient` (`src/lib/api/apiClient.ts`), con dos implementaciones que se eligen en `src/lib/api/config.ts`:

| `PUBLIC_API_URL` en `.env` | Cliente | Sesión |
|---|---|---|
| vacío o sin definir | `MockApiClient` (localStorage) | simulada, con selector de rol |
| `http://localhost:3000/api` | `HttpApiClient` (backend) | real: email + contraseña, cookie HTTP-only |

### Levantar todo junto

En `backend/`:

```bash
npm run start:dev
```

En `frontend/` (con `PUBLIC_API_URL=http://localhost:3000/api` en `.env`):

```bash
npm run dev
```

Entrá a http://localhost:4321 con un usuario de `backend/README.md`.

Para usar el **modo demo** sin tocar `.env` (no necesita backend; usa `.env.demo`):

```bash
npm run dev:demo
```

### Qué cambia en modo backend

- **Login**: `/login` pide email y contraseña reales (`POST /auth/login`). La sesión se recupera al cargar cada página con `GET /auth/me` (`src/lib/auth/mockCurrentUser.ts`, misma API en ambos modos). Si el backend responde 401 (sesión vencida), se vuelve al login.
- **Sin controles de demo**: no hay selector de rol, reloj simulado ni «Reiniciar demo».
- **Evidencia real**: el archivo se sube como multipart y el nombre en la lista abre el archivo guardado.
- **Reglas**: el frontend sigue usando `src/lib/workflow/` para explicar qué falta antes de enviar; el backend aplica las mismas reglas (copia en `backend/src/domain/`) y responde 422 con `details`. Si cambiás una regla, cambiala en los dos lados.

### Formato de errores

`HttpApiClient` convierte las respuestas de error en `ApiError` y muestra `details` como lista en el toast:

| HTTP | Código en el front | Cuándo |
|---|---|---|
| 400 | `VALIDATION` | Datos inválidos (`message: string[]`) |
| 401 | `UNAUTHORIZED` | Sin sesión o sesión vencida |
| 403 | `FORBIDDEN` | Rol sin permiso |
| 404 | `NOT_FOUND` | No existe |
| 409 | `CONFLICT` | Teléfono o número de serie repetido |
| 422 | `WORKFLOW_RULE` | Regla del workflow no cumplida |

### Si en el futuro se retira el modo demo

Se pueden borrar `src/mocks/db.ts`, la clase `MockApiClient`, `src/lib/clock.ts` (reemplazar `now()` por `Date.now()`), `DemoPanel.tsx`, `RoleSwitcher.tsx`, el login de demo en `LoginPage.tsx` y la suscripción a `subscribeDb` en `queryClient.ts`.

---

## Accesibilidad

- Contraste WCAG AA en modo claro y oscuro. Estados, prioridades y alertas siempre con **icono + texto**, nunca solo color.
- Foco visible en todos los controles y enlace «Saltar al contenido».
- Kanban por teclado: enfocá el asa de la tarjeta, **Espacio** para tomar, **← →** para cambiar de columna y **Espacio** para soltar. Anuncios en español para lectores de pantalla. Alternativa: botón **Mover** en cada tarjeta.
- Modales sobre `<dialog>` nativo (foco atrapado, Esc, retorno de foco). Toasts en regiones `aria-live`.
- Respeta `prefers-reduced-motion`.

## Limitaciones conocidas

- En modo demo no hay autenticación real y los datos viven solo en el navegador actual.
- La evidencia en modo demo registra nombre y tamaño; el archivo no se guarda (en modo backend sí).
- El reloj simulado afecta solo los cálculos de tiempo de la demo (horas abiertas, atrasos, críticas > 24 h).
