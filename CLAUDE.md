# Personal Tasks Manager — CLAUDE.md

## Qué es este proyecto

Gestor personal de tareas con tablero Kanban. App full-stack serverless en AWS de uso personal (un solo usuario autenticado vía Google). Repo público en GitHub.

---

## Estructura del monorepo

```
personal-tasks-manager/
├── frontend/          React 18 + Vite (TypeScript)
├── backend/           AWS Lambda handlers (TypeScript, Node 24)
├── infra/             AWS CDK v2 (TypeScript)
├── scripts/           Utilidades locales (export/import DynamoDB)
├── .github/workflows/ CI/CD GitHub Actions
└── package.json       Workspace raíz (npm workspaces)
```

### Frontend — estructura detallada

```
frontend/src/
├── lib/
│   ├── auth.ts          OAuth2 PKCE flow + gestión de tokens
│   ├── api.ts           REST client con auto-refresh de JWT
│   └── utils.ts         Helpers compartidos: fmt(), dateUrgency()
├── hooks/
│   ├── useAuth.ts       Estado de autenticación
│   └── useTasks.ts      CRUD de tareas + comentarios
├── components/
│   ├── Board.tsx        Toolbar + toggle de modo + renderizado condicional
│   ├── Column.tsx       Columna del modo Kanban
│   ├── Card.tsx         Tarjeta individual de tarea
│   ├── ListView.tsx     Vista de lista con grupos colapsables por estado
│   ├── TaskDetail.tsx   Modal de detalle/visualización de tarea
│   └── TaskModal.tsx    Modal de creación y edición de tarea
├── types.ts             Tipos y constantes compartidas del dominio
├── App.tsx              Orquestador principal + estado de modales
└── styles.css           Estilos globales (incluye dark mode)
```

---

## Arquitectura AWS

```
Route53 → CloudFront → S3 (frontend estático)
Browser → API Gateway HTTP API → Lambda → DynamoDB
Cognito User Pool (Google OAuth2) emite JWTs que valida API Gateway
```

**Stack CloudFormation:** `PersonalTasksManager`

**Recursos creados por CDK:**
| Recurso | Nombre / ID |
|---|---|
| DynamoDB table | `personal-tasks-manager` |
| Cognito User Pool | `personal-tasks-manager-users` |
| Cognito App Client | `personal-tasks-manager-app` |
| Cognito domain prefix | configurado en `infra/.env` |
| API Gateway | `personal-tasks-manager-api` |
| S3 bucket | generado por CDK |
| CloudFront distribution | generado por CDK |

**CloudFormation exports** (usados por el workflow del frontend):
- `PersonalTasksManager-FrontendBucket`
- `PersonalTasksManager-DistributionId`
- `PersonalTasksManager-CognitoDomain`
- `PersonalTasksManager-UserPoolClientId`
- `PersonalTasksManager-ApiUrl`

---

## Modelo de datos — DynamoDB (single-table)

**Tabla:** `personal-tasks-manager`  
**PK:** `USER#{cognitoSub}` | **SK:** ver abajo

| Entidad | SK |
|---|---|
| Tarea | `TASK#{taskId}` |
| Comentario | `COMMENT#{taskId}#{cid}` |

**Campos de tarea:** `taskId`, `title`, `desc`, `status`, `tipo`, `deadline`, `nextDate`, `createdAt`  
**Campos de comentario:** `taskId`, `cid`, `text`, `date`

**IDs** generados en `backend/src/lib/dynamo.ts:newId()` — base36 timestamp + random.

---

## Tipos y constantes del dominio (`frontend/src/types.ts`)

```typescript
BoardMode:    'kanban' | 'list'
TaskStatus:   'Backlog' | 'Planificación' | 'Ejecución' | 'Pausado' | 'Validación' | 'Finalizado' | 'Cancelado'
TaskType:     'unica' | 'recurrente'
UrgencyLevel: 'warning' | 'alert' | 'overdue'
```

**Constantes exportadas:**

| Constante | Tipo | Descripción |
|---|---|---|
| `STATES` | `TaskStatus[]` | Lista ordenada de estados para renderizar columnas/grupos |
| `STATE_COLORS` | `Record<TaskStatus, string>` | Color de texto por estado |
| `STATE_BG` | `Record<TaskStatus, string>` | Color de fondo por estado |
| `INACTIVE_STATUSES` | `TaskStatus[]` | Estados que desactivan los indicadores de urgencia: `['Pausado', 'Finalizado', 'Cancelado']` |
| `URGENCY` | `Record<UrgencyLevel, {icon, title}>` | Icono y tooltip para cada nivel de urgencia de fecha |
| `TASK_TYPES` | `TaskType[]` | Lista de tipos de tarea para select |
| `TASK_TYPE_LABELS` | `Record<TaskType, string>` | Etiqueta de display: `unica → 'Única'`, `recurrente → 'Recurrente'` |

**Helpers compartidos (`frontend/src/lib/utils.ts`):**

| Función | Descripción |
|---|---|
| `fmt(dateStr?)` | Formatea una fecha YYYY-MM-DD a string legible en es-MX |
| `dateUrgency(dateStr?, status?)` | Retorna `UrgencyLevel \| null` según proximidad de la fecha; devuelve `null` si el estado está en `INACTIVE_STATUSES` |

---

## Modos del tablero

El modo activo se persiste en `localStorage` bajo la clave `board-view-mode`. El toggle está en el toolbar. Los dos modos disponibles son:

### Modo Kanban (`'kanban'`)
- Columnas horizontales scrolleables, una por cada `TaskStatus`.
- Cada columna muestra sus tarjetas (`Card`) con título, descripción truncada, badge de tipo y fecha con icono de urgencia.
- Header de columna: nombre del estado (en su color), conteo de tarjetas, botón `+` para crear tarea preseleccionando ese estado.

### Modo Lista (`'list'`)
- Vista vertical centrada (`max-width: 860px`, `margin: 0 auto`).
- Un grupo colapsable por cada `TaskStatus`, en el mismo orden que el modo Kanban.
- **Header de grupo:** botón ▶/▼ para colapsar, nombre del estado (en su color), conteo, botón `+`.
- **Cuerpo del grupo:** filas de tarea con tres columnas: título | badge de tipo | fecha con icono de urgencia.
- El estado de colapso es local al componente (no se persiste).
- Click en cualquier fila abre el modal de detalle.

---

## Modales de tareas

Todos los modales se cierran con **Escape** o haciendo click fuera del área del modal (en el overlay). La lógica de cierre vive en `App.tsx` mediante un `useEffect` que escucha `keydown` solo cuando hay un modal abierto.

### Modal de nueva tarea
- Se abre desde el botón `+ Nueva tarea` del toolbar (sin estado preseleccionado) o desde el botón `+` de una columna/grupo (con `initialStatus` preseleccionado).
- Campos: **Nombre** (requerido), **Descripción**, **Estado** (select con todos los estados), **Tipo** (Única / Recurrente).
- Si el tipo es `unica`, muestra el campo **Fecha límite**.
- Si el tipo es `recurrente`, muestra el campo **Siguiente fecha**.
- Al guardar llama a `POST /tasks` y cierra el modal.

### Modal de detalle (`TaskDetail`)
- Se abre al hacer click en una tarjeta (modo Kanban) o en una fila (modo Lista).
- Muestra: título, selector visual de estado (pills clicables que cambian el estado en tiempo real vía `PUT /tasks/{id}`), descripción, tipo, fecha de creación, fecha límite o siguiente fecha con indicador de urgencia si aplica.
- **Comentarios:** el input de agregar aparece primero; los comentarios se listan del más reciente al más antiguo. Envío con Enter o botón "Agregar".
- Botón "Editar" en el header abre el modal de edición manteniendo la tarea activa.

### Modal de edición (`TaskModal` con tarea existente)
- Mismos campos que el modal de nueva tarea, prellenados con los valores actuales.
- Botón **Eliminar** (rojo) llama a `DELETE /tasks/{id}` y cierra.
- Botón **Guardar cambios** llama a `PUT /tasks/{id}` con los campos modificados.
- El campo `deadline` se envía solo si `tipo === 'unica'`; `nextDate` solo si `tipo === 'recurrente'`.

---

## Indicadores de urgencia de fechas

Calculados por `dateUrgency()` en `frontend/src/lib/utils.ts`. Solo aplican cuando la tarea tiene fecha y su estado no está en `INACTIVE_STATUSES`.

| Nivel | Condición | Icono | Tooltip |
|---|---|---|---|
| `overdue` | La fecha ya pasó | 🚨 | Fecha vencida |
| `alert` | Vence hoy | 🔴 | Vence hoy |
| `warning` | Vence en 5 días o menos | ⚠️ | Faltan 5 días o menos |

Se muestran en las tarjetas (modo Kanban), en las filas (modo Lista) y en el modal de detalle.

---

## API REST

Base URL en `VITE_API_URL`. Todas las rutas requieren `Authorization: Bearer <idToken>`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/tasks` | Lista todas las tareas con sus comentarios |
| POST | `/tasks` | Crea tarea |
| PUT | `/tasks/{id}` | Actualiza campos: `title`, `desc`, `status`, `tipo`, `deadline`, `nextDate` |
| DELETE | `/tasks/{id}` | Elimina tarea |
| POST | `/tasks/{id}/comments` | Agrega comentario (`{ text }`) |

---

## Autenticación

Flujo OAuth2 PKCE con Cognito + Google IdP:
1. `signIn()` → redirige a Cognito hosted UI
2. Cognito → Google → callback en `/callback`
3. `handleCallback(code)` → intercambia code por tokens
4. Tokens guardados en `localStorage` bajo `auth_tokens`
5. `getIdToken()` refresca automáticamente si expira en < 60s
6. `signOut()` → limpia localStorage y redirige a Cognito logout

**Archivos clave:** `frontend/src/lib/auth.ts`, `frontend/src/lib/api.ts`

---

## Configuración de entorno

### Infra (`infra/.env`) — gitignoreado
Usar .env para obtener los valores actuales.
```
DOMAIN_NAME=example.com
APP_SUBDOMAIN=tasks
COGNITO_DOMAIN_PREFIX=tasks-example
AWS_REGION=us-east-1
```
Template en `infra/.env.example`. Cargado vía `dotenv` en `infra/config.ts`.

### Frontend (`frontend/.env.local`) — gitignoreado
```
VITE_COGNITO_DOMAIN=https://<prefix>.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_COGNITO_REDIRECT_URI=http://localhost:3000/callback
VITE_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
```
Template en `frontend/.env.example`. Valores obtenidos de outputs de CloudFormation tras deploy de infra.

### `cdk.context.json` — gitignoreado
Repo público: el archivo de cache de CDK se gitignora porque contiene el AWS Account ID en las claves. CDK lo regenera automáticamente en cada operación (requiere credenciales AWS activas).

---

## Secretos de Google OAuth

Almacenados en AWS SSM Parameter Store:
- `/personal-tasks-manager/google/client-id` (tipo String)
- `/personal-tasks-manager/google/client-secret` (tipo String)

Deben existir en SSM **antes** del primer `cdk deploy`.

---

## Comandos frecuentes

```bash
# Desarrollo local frontend
npm run frontend                          # http://localhost:3000

# Infra
cd infra && npm install                   # instalar dependencias (incluye dotenv)
npm run infra:diff                        # ver cambios pendientes
npm run infra:deploy                      # deployar

# Bootstrap CDK (solo la primera vez por cuenta/región)
cd infra && npx cdk bootstrap

# Export/import DynamoDB (local)
npm run db:export                                          # exporta personal-tasks-manager
node scripts/dynamo-export.mjs <tabla> [archivo.json]     # tabla custom
npm run db:import -- <archivo.json>                        # importa al table del export
node scripts/dynamo-import.mjs <archivo.json> <tabla>     # tabla destino custom
```

---

## CI/CD — GitHub Actions

| Workflow | Trigger | Qué hace |
|---|---|---|
| `deploy-infra.yml` | push a `main` con cambios en `infra/**` o `backend/**` | `cdk diff` + `cdk deploy` |
| `deploy-frontend.yml` | push a `main` con cambios en `frontend/**` | build Vite → sync S3 → invalidar CloudFront |

### GitHub Secrets requeridos

**Ambos workflows:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**Solo infra:**
- `DOMAIN_NAME`, `APP_SUBDOMAIN`, `COGNITO_DOMAIN_PREFIX`

**Solo frontend:**
- `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_API_URL`, `VITE_COGNITO_REDIRECT_URI`

El workflow de infra escribe `infra/.env` en tiempo de ejecución a partir de estos secrets.

### Orden del primer deploy
1. Crear params SSM en AWS
2. Configurar todos los secrets en GitHub
3. Push → se ejecuta `deploy-infra.yml`
4. Tomar outputs de CloudFormation y configurar secrets del frontend
5. Disparar `deploy-frontend.yml` manualmente o hacer un cambio en `frontend/`

---

## Decisiones de diseño relevantes

- **Single-table DynamoDB**: todas las entidades en una sola tabla, distinguidas por el patrón `sk`.
- **No hay backend de usuarios**: la identidad es el `sub` del JWT de Cognito. No hay tabla de usuarios.
- **Lambda handlers sin framework**: sin Express ni Hono, routing manual por `method` + `pathParameters`.
- **PKCE en el frontend**: el `client_secret` de Cognito no se usa (`generateSecret: false`), el flujo es seguro sin backend de auth.
- **Tokens en localStorage**: decisión consciente para simplicidad — app de uso personal, no multi-tenant.
- **Modo del tablero en localStorage**: persiste entre sesiones sin necesidad de backend; clave `board-view-mode`.
- **Constantes centralizadas en `types.ts`**: todos los valores del dominio (colores, labels, listas de estados) viven en un solo lugar para evitar strings hardcodeados dispersos en componentes.
- **Helpers compartidos en `lib/utils.ts`**: `fmt` y `dateUrgency` se usan en `Card`, `TaskDetail` y `ListView`; extraídos para evitar duplicación.
