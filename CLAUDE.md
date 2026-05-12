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
│   ├── filters.ts       applyFilters() + isActive() para el modo visual
│   ├── utils.ts         Helpers compartidos: fmt(), dateUrgency(), getTaskDate(), isValidLabelName(), LABEL_MAX_LENGTH
│   └── pql/             Motor de query PQL (agnóstico de React)
│       ├── types.ts     TokenKind enum, Token, ASTNode, PQLField, PQLOperator, PQLValue
│       ├── lexer.ts     tokenize() — string → Token[]; PQLSyntaxError
│       ├── parser.ts    parse() — Token[] → ASTNode (recursive descent con validación semántica)
│       ├── evaluator.ts evaluate() — ASTNode × Task[] → Task[]
│       └── index.ts     API pública: evaluatePQL(), parsePQL()
├── hooks/
│   ├── useAuth.ts       Estado de autenticación
│   ├── useFilters.ts    Estado de filtros (modo visual + modo query PQL)
│   ├── useTasks.ts      CRUD de tareas + comentarios
│   └── useLabels.ts     Caché de labels globales + carga en page load
├── components/
│   ├── ui/              Primitivos reutilizables (ver sección "Librería de componentes UI")
│   │   ├── Button.tsx        Botón con variantes default / primary / danger
│   │   ├── Field.tsx         Wrapper de label + control de formulario
│   │   ├── Input.tsx         Input con prop error
│   │   ├── Modal.tsx         Diálogo accesible (Radix Dialog)
│   │   ├── SegmentedControl.tsx  Toggle de opciones exclusivas (Radix ToggleGroup)
│   │   ├── Select.tsx        Selector con opciones (Radix Select)
│   │   ├── Textarea.tsx      Textarea con auto-resize (forwardRef)
│   │   └── index.ts          Barrel export
│   ├── Board.tsx        Toolbar + toggle de modo + renderizado condicional
│   ├── Column.tsx       Columna del modo Kanban (con drag-and-drop drop target)
│   ├── Card.tsx         Tarjeta individual de tarea (draggable)
│   ├── FilterBar.tsx    Barra de filtros: modo visual (criterios) + modo PQL (textarea + ayuda)
│   ├── ListView.tsx     Vista de lista con grupos colapsables por estado (Radix Accordion)
│   ├── TaskDetail.tsx   Modal de detalle/visualización de tarea + gestión de labels
│   └── TaskModal.tsx    Modal de creación y edición de tarea
├── types.ts             Tipos y constantes compartidas del dominio
├── App.tsx              Orquestador principal + estado de modales
└── styles.css           Estilos globales con tokens CSS + dark mode
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
| Comentario | `COMMENT#{taskId}#{commentId}` |
| Label | `LABEL#{taskId}#{labelId}` |

**Campos de tarea:** `taskId`, `name`, `body`, `status`, `kind`, `dueDate`, `nextDate`, `createdAt`  
**Campos de comentario:** `taskId`, `commentId`, `body`, `createdAt`

**IDs** generados en `backend/src/lib/dynamo.ts:newId()` — base36 timestamp + random.

**Helpers de DynamoDB (`backend/src/lib/dynamo.ts`):** `putItem`, `getItem`, `queryItems`, `updateItem`, `deleteItem`, `batchDeleteItems` (chunks de 25, límite de DynamoDB BatchWrite).

---

## Modelo de datos — Labels

Labels almacenadas en la misma tabla DynamoDB (single-table), mismo PK que tareas y comentarios:

```
PK: USER#{cognitoSub}
SK: LABEL#{taskId}#{labelId}
Campos: taskId, labelId, name
```

Un item por label por tarea. Para obtener todos los nombres únicos del usuario se consulta con prefijo `LABEL#`; para los labels de una tarea específica se usa `LABEL#{taskId}#`.

**Validación de nombre:** max 50 caracteres, regex `^[a-zA-Z0-9\-_ ]+$` (letras, números, guion, guion bajo, espacios). Validada en el backend handler y también en el frontend antes de hacer el request.

---

## Tipos y constantes del dominio (`frontend/src/types.ts`)

```typescript
BoardMode:    'kanban' | 'list'
Theme:        'light' | 'dark'
TaskStatus:   'Backlog' | 'Planificación' | 'Ejecución' | 'Pausado' | 'Validación' | 'Finalizado' | 'Cancelado'
TaskKind:     'ONE_TIME' | 'RECURRING'
UrgencyLevel: 'warning' | 'alert' | 'overdue'

interface Label { id: string; name: string; }
```

**Constantes exportadas:**

| Constante | Tipo | Descripción |
|---|---|---|
| `STATES` | `TaskStatus[]` | Lista ordenada de estados para renderizar columnas/grupos |
| `STATE_COLORS` | `Record<TaskStatus, string>` | Color de texto por estado |
| `STATE_BG` | `Record<TaskStatus, string>` | Color de fondo por estado |
| `INACTIVE_STATUSES` | `TaskStatus[]` | Estados que desactivan los indicadores de urgencia: `['Pausado', 'Finalizado', 'Cancelado']` |
| `URGENCY` | `Record<UrgencyLevel, {icon, title}>` | Icono y tooltip para cada nivel de urgencia de fecha |
| `URGENCY_LEVELS` | `UrgencyLevel[]` | Lista ordenada de niveles de urgencia |
| `TASK_KINDS` | `TaskKind[]` | Lista de tipos de tarea para select |
| `TASK_KIND_LABELS` | `Record<TaskKind, string>` | Etiqueta de display: `ONE_TIME → 'Única'`, `RECURRING → 'Recurrente'` |
| `TASK_KIND_ICONS` | `Record<TaskKind, string>` | Emoji de tipo: `ONE_TIME → '📅'`, `RECURRING → '🔁'` |

**Helpers y constantes compartidas (`frontend/src/lib/utils.ts`):**

| Símbolo | Descripción |
|---|---|
| `fmt(dateStr?)` | Formatea una fecha YYYY-MM-DD a string legible en es-MX |
| `dateUrgency(dateStr?, status?)` | Retorna `UrgencyLevel \| null` según proximidad de la fecha; devuelve `null` si el estado está en `INACTIVE_STATUSES` |
| `getTaskDate(task)` | Retorna `task.dueDate` si `kind === 'ONE_TIME'`, `task.nextDate` si `RECURRING`. Fuente única para esta lógica en Card, ListView y Board |
| `LABEL_MAX_LENGTH` | `50` — límite de caracteres para nombres de label |
| `isValidLabelName(name)` | Valida que el nombre de label cumpla longitud y regex (`^[a-zA-Z0-9\-_ ]+$`) |

---

## Drag and drop (modo Kanban)

Implementado con la API nativa del navegador (`draggable`, `ondragstart`, `ondrop`), sin dependencias externas. Solo aplica en modo Kanban.

- **`Card`** — `draggable={true}`. `onDragStart` escribe el `taskId` en `dataTransfer`. Mientras se arrastra aplica clase `.card.dragging` (opacidad reducida) vía estado local.
- **`Column`** — es el drop target. `onDragOver` llama `preventDefault()` para habilitar el drop. `onDrop` lee el `taskId` de `dataTransfer` y llama `onMoveTask(taskId, status)`. `onDragEnter`/`onDragLeave` gestionan clase `.col.drag-over` (highlight visual); el `onDragLeave` usa `e.currentTarget.contains(e.relatedTarget)` para evitar falsos disparos al pasar sobre elementos hijos.
- **`Board`** — recibe `onMoveTask(taskId, status)` y lo inyecta a cada columna con su status ya fijado.
- **`App`** — pasa `onMoveTask={(taskId, status) => updateTask(taskId, { status })}`. La actualización reutiliza el mismo `PUT /tasks/{id}` que el selector de estado del modal.

---

## Labels

### Frontend — `useLabels.ts`
Carga `GET /labels` una vez en el mount (cuando el usuario está autenticado). Expone:
- `allLabelNames: string[]` — caché de todos los nombres de labels del usuario, usados para sugerencias de autocompletado.
- `registerLabel(name)` — añade un nombre al caché local si no existe, sin hacer request. Se llama desde `TaskDetail` al crear una label nueva durante la sesión.

### Frontend — `TaskDetail` (sección Labels)
- Al abrir el modal: inicializa estado local `labels: Label[]` directamente desde `task.labels` (ya incluido en la respuesta de `GET /tasks`). No se hace ningún request adicional al abrir.
- Muestra chips removibles por cada label. Click en `×` → `DELETE /tasks/{id}/labels/{labelId}` y actualiza estado local.
- Input con dropdown de sugerencias:
  - Filtra `allLabelNames` por substring (case-insensitive), excluyendo labels ya en la tarea.
  - Si el input es válido y no está en la tarea, muestra opción «Crear `{nombre}`» al fondo del dropdown.
  - Mensajes inline si el nombre es inválido o ya existe en la tarea.
  - Enter o click en sugerencia → `POST /tasks/{id}/labels`, actualiza estado local y llama `registerLabel`.
  - `onBlur` cierra sugerencias con `setTimeout(150ms)` para permitir el `mousedown` de los items.

---

## Modos del tablero

El modo activo se persiste en `localStorage` bajo la clave `board-view-mode`. El toggle está en el toolbar. Los dos modos disponibles son:

### Modo Kanban (`'kanban'`)
- Columnas horizontales scrolleables, una por cada `TaskStatus`.
- Cada tarjeta (`Card`) muestra: título, descripción truncada, y una fila inferior con la fecha a la izquierda y los iconos de urgencia + tipo (`TASK_KIND_ICONS`) a la derecha. El icono de tipo tiene `title` con el label de `TASK_KIND_LABELS`.
- Las tarjetas de cada columna se ordenan por fecha ascendente (`getTaskDate`); las tareas sin fecha van al final. El orden se aplica en `Board.tsx` antes de distribuir por estado.
- Header de columna: nombre del estado (en su color), conteo de tarjetas, botón `+` para crear tarea preseleccionando ese estado.

### Modo Lista (`'list'`)
- Vista vertical centrada (`max-width: 860px`, `margin: 0 auto`).
- Un grupo colapsable por cada `TaskStatus`, en el mismo orden que el modo Kanban.
- **Header de grupo:** botón ▶/▼ para colapsar, nombre del estado (en su color), conteo, botón `+`.
- **Cuerpo del grupo:** filas con cuatro celdas: título (flex) | icono de urgencia (18px, solo si aplica) | icono de tipo con `title` (18px) | fecha alineada a la derecha (100px).
- Las tareas siguen el mismo orden por fecha que el modo Kanban (el sort se aplica en `Board` antes de pasar a `ListView`).
- El estado de colapso es local al componente (no se persiste).
- Click en cualquier fila abre el modal de detalle.

---

## Sistema de filtros

El sistema de filtros tiene dos modos excluyentes gestionados por `useFilters.ts`. El modo activo **no** se persiste en localStorage; se resetea a `'visual'` al recargar.

### Modo visual (`'visual'`)

- Barra de búsqueda por nombre (substring, case-insensitive) siempre visible en el subheader.
- Panel expandible con criterios estructurados. Cada criterio tiene: selector de campo, toggle de operador (Radix ToggleGroup), y control de valor específico por campo.
- Campos disponibles: `name`, `body`, `status`, `kind`, `createdAt`, `dueOrNextDate`, `urgency`, `labels`, `comments`.
- La evaluación ocurre en `lib/filters.ts:applyFilters()` + `isActive()`.

### Modo query PQL (`'query'`)

- El buscador por nombre se oculta (la query PQL lo reemplaza).
- El botón "Filtros" cambia su etiqueta a "PQL".
- Panel expandible con un `<textarea>` monoespaciado. Evalúa con debounce de 350ms tras el último cambio.
- Si hay error de sintaxis: alerta roja bajo el textarea, el tablero mantiene el **último resultado válido**.
- Si la query está vacía: sin filtro activo, se muestran todas las tareas.
- La tabla de referencia rápida de campos y operadores está disponible bajo un `<details>` colapsable.

### Estado en `useFilters`

```typescript
// Públicos en el retorno del hook
pqlQuery          // string raw de la query
pqlError          // string | undefined — error de sintaxis/semántica
setPqlQuery       // actualiza el string raw
setMode           // cambia el FilterMode y limpia pqlError
onPqlEvaluated    // (tasks: Task[] | null, error?: string) => void
                  // null = mantener lastValidPqlTasks; llamado desde PQLFilterContent tras debounce
```

`activeCount` en modo query devuelve `1` cuando hay query activa (para el badge del botón).

### Leyenda de coincidencias

`<MatchCountLegend>` en `FilterBarControls` muestra:
- **"X coincidencias"** cuando hay filtro activo y hay resultados.
- **"Sin resultados"** en rojo cuando el filtro activo produce 0 tareas.
- Oculta cuando no hay filtro activo o cuando matchCount === totalCount.

---

## Motor PQL (`lib/pql/`)

Módulo agnóstico de React. Sin dependencias externas, sin `eval()`. Solo importa `../../types` y `../utils`.

### Pipeline

```
query string → tokenize() → Token[] → parse() → ASTNode → evaluate() → Task[]
```

### Campos soportados

| Campo | Tipo | Fuente |
|---|---|---|
| `name`, `body` | texto | `task.name`, `task.body` |
| `status` | multi-select | `task.status` |
| `kind` | single-select | `task.kind` |
| `createdAt`, `dueDate`, `nextDate` | fecha ISO | campos de tarea |
| `labels` | labels | `task.labels[].name` |
| `comments` | presencia | `task.comments` |
| `urgency` | calculado | `dateUrgency(task.dueDate ?? task.nextDate, task.status)` |
| `commentsCount()`, `labelsCount()` | numérico | `.length` de los arrays |

Los campos de conteo requieren sintaxis de función: `commentsCount()`, `labelsCount()`.

### Operadores por campo

| Campo(s) | Operadores |
|---|---|
| `name`, `body` | `IS`, `NOT IS`, `=`, `!=`, `CONTAINS`, `NOT CONTAINS` |
| `status` | `IS`, `NOT IS`, `=`, `!=`, `IN`, `NOT IN` |
| `kind` | `IS`, `NOT IS`, `=`, `!=` |
| `createdAt`, `dueDate`, `nextDate` | `IS`, `NOT IS`, `=`, `!=`, `BEFORE`, `AFTER` |
| `labels` | `CONTAINS`, `NOT CONTAINS`, `CONTAINS_ALL`, `HAS`, `NOT HAS` |
| `comments` | `HAS`, `NOT HAS` |
| `urgency` | `IN`, `NOT IN`, `HAS`, `NOT HAS` |
| `commentsCount()`, `labelsCount()` | `>`, `<`, `>=`, `<=`, `=`, `!=` |

### Valores especiales

- `EMPTY` — campo vacío o ausente (ej. `dueDate IS EMPTY`)
- `currentDate()` — fecha actual en el momento de evaluación (YYYY-MM-DD)
- Listas: `('valor1', 'valor2')` — solo strings
- Fechas en queries: formato `DD/MM/YYYY`; el evaluador convierte a YYYY-MM-DD

### Comportamiento semántico destacado

- `labels CONTAINS "urgente"` = la tarea tiene esa label (equivale a CONTAINS_ALL con un elemento).
- `labels HAS` / `labels NOT HAS` — sin valor explícito; el parser asigna `{ type: 'empty' }`.
- `comments HAS` / `urgency HAS` — igual, sin valor.
- Comparaciones de texto siempre en lowercase. Fechas con `T00:00:00` para evitar problemas de zona horaria.
- `NOT` solo es válido seguido de `IS`, `CONTAINS`, `IN` o `HAS`; de lo contrario lanza `PQLSyntaxError`.

### API pública (`lib/pql/index.ts`)

```typescript
evaluatePQL(query: string, tasks: Task[]): PQLResult
// { tasks } si vacía; { tasks: filtradas } si válida; { tasks, error } si error

parsePQL(query: string): { ast: ASTNode } | { error: string }
// Solo parsea, sin evaluar. Útil para validación en tiempo real.
```

---

## Librería de componentes UI (`components/ui/`)

**Regla:** todo cambio o adición de UI debe usar los componentes de `components/ui/` como base. Si no existe un primitivo adecuado en Radix UI, usar la alternativa más cercana. Solo se puede omitir esta regla cuando se indique explícitamente.

### Componentes disponibles

| Componente | Base | Descripción |
|---|---|---|
| `Button` | HTML `<button>` | Variantes `default` / `primary` / `danger`. Acepta todas las props nativas. |
| `Field` | `<div>` + `<label>` | Wrapper de campo de formulario. Props: `label`, `children`, `className`. |
| `Input` | HTML `<input>` | Prop extra `error: boolean` agrega clase `.error`. Acepta todas las props nativas. |
| `Modal` | `@radix-ui/react-dialog` | Diálogo accesible. Cierra con Escape y click en overlay. Props: `onClose`, `children`, `title?` (para accesibilidad, default `'Diálogo'`). |
| `SegmentedControl` | `@radix-ui/react-toggle-group` | Toggle de opciones mutuamente exclusivas. Props: `value`, `onValueChange`, `options: {value, label?, icon?}[]`. |
| `Select` | `@radix-ui/react-select` | Selector nativo accesible. Props: `value`, `onValueChange`, `options: {value, label}[]`, `className?`. |
| `Textarea` | HTML `<textarea>` + `forwardRef` | Soporta `autoResize` (crece con el contenido). Compatible con `ref` externo para leer valor. |

### Dependencias Radix UI instaladas

```
@radix-ui/react-accordion      — ListView (grupos colapsables)
@radix-ui/react-dialog         — Modal
@radix-ui/react-select         — Select
@radix-ui/react-toggle-group   — SegmentedControl + operadores de filtro
@radix-ui/react-visually-hidden — Dialog.Title accesible oculto
```

### Librería adicional

- **`react-select`** — dropdowns con búsqueda en FilterBar (campo a filtrar y "Agregar filtro"). Se estiliza vía `StylesConfig` usando `var(--css-variable)` para compatibilidad automática con dark mode. Usar `menuPortalTarget={document.body}` + `menuPosition="fixed"` cuando el dropdown esté dentro de un contenedor con `overflow` limitado.

### Tokens CSS (`styles.css :root`)

Todos los valores de color, radio y sombra están en variables CSS. Dark mode se implementa sobrescribiendo solo las variables en `[data-theme="dark"]`.

| Token | Descripción |
|---|---|
| `--bg-app` | Fondo de la aplicación |
| `--bg-surface` | Fondo de tarjetas y paneles |
| `--bg-raised` | Fondo elevado (hover, chips) |
| `--bg-popup` | Fondo de modales y dropdowns |
| `--bg-input` | Fondo de inputs |
| `--bg-hover` | Overlay hover sutil |
| `--text` / `--text-2` / `--text-3` / `--text-4` | Jerarquía de texto |
| `--bd` / `--bd-md` | Bordes |
| `--primary` / `--primary-bg` / `--primary-bd` | Color primario y sus variantes |
| `--danger` | Color rojo de acciones destructivas |
| `--r-sm` / `--r-md` / `--r-lg` / `--r-xl` / `--r-pill` | Radios de borde |

---

## Modales de tareas

Todos los modales se cierran con **Escape** o haciendo click fuera del área del modal (en el overlay). El cierre lo gestiona Radix Dialog internamente (`onOpenChange`) — no hay `useEffect` manual en `App.tsx` para esto.

### Modal de nueva tarea
- Se abre desde el botón `+ Nueva tarea` del toolbar (sin estado preseleccionado) o desde el botón `+` de una columna/grupo (con `initialStatus` preseleccionado).
- Campos: **Nombre** (requerido), **Descripción**, **Estado** (select con todos los estados), **Tipo** (Única / Recurrente).
- Si el tipo es `ONE_TIME`, muestra el campo **Fecha límite**.
- Si el tipo es `RECURRING`, muestra el campo **Siguiente fecha**.
- Al guardar llama a `POST /tasks` y cierra el modal.

### Modal de detalle (`TaskDetail`)
- Se abre al hacer click en una tarjeta (modo Kanban) o en una fila (modo Lista).
- Muestra: título, selector visual de estado (pills clicables que cambian el estado en tiempo real vía `PUT /tasks/{id}`), descripción, tipo, fecha de creación, fecha límite o siguiente fecha con indicador de urgencia si aplica.
- **Descripción y comentarios** usan `ExpandableText`: respeta saltos de línea (`white-space: pre-wrap`); si el texto supera 3 líneas o 200 caracteres, se trunca con `webkit-line-clamp: 3` y aparece un botón "Ver más / Ver menos".
- **Comentarios:** `<textarea>` de agregar al principio (2 filas, redimensionable). Enter inserta salto de línea; el botón "Agregar" (abajo a la derecha) envía. Mientras el request está en vuelo, el textarea y el botón se deshabilitan (`disabled`) con opacidad reducida y el botón muestra "Agregando…". Los comentarios se listan del más reciente al más antiguo. Cada comentario tiene un botón `×` discreto que al hacer click muestra confirmación inline (`¿Eliminar? Sí / No`) → `DELETE /tasks/{id}/comments/{commentId}` → remove optimista del estado local.
- **Eliminar tarea:** botón rojo "Eliminar" en el header (junto a "Editar"). Al hacer click despliega una zona inline donde hay que escribir `eliminar` para habilitar el botón "Confirmar". Al confirmar → `DELETE /tasks/{id}` (con cascade) → modal se cierra, tarea desaparece del tablero. El delete es optimista: la tarea se elimina del estado local antes de que la API responda.
- Botón "Editar" en el header abre el modal de edición manteniendo la tarea activa.

### Modal de edición (`TaskModal` con tarea existente)
- Mismos campos que el modal de nueva tarea, prellenados con los valores actuales.
- Botón **Eliminar** (rojo) llama a `DELETE /tasks/{id}` y cierra.
- Botón **Guardar cambios** llama a `PUT /tasks/{id}` con los campos modificados.
- El campo `dueDate` se envía solo si `kind === 'ONE_TIME'`; `nextDate` solo si `kind === 'RECURRING'`.

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
| PUT | `/tasks/{id}` | Actualiza campos: `name`, `body`, `status`, `kind`, `dueDate`, `nextDate` |
| DELETE | `/tasks/{id}` | Elimina tarea + cascade de todos sus comentarios y labels |
| POST | `/tasks/{id}/comments` | Agrega comentario (`{ body }`) |
| DELETE | `/tasks/{id}/comments/{commentId}` | Elimina un comentario |
| GET | `/labels` | Lista todos los nombres de labels únicos del usuario |
| GET | `/tasks/{id}/labels` | Lista labels de una tarea específica |
| POST | `/tasks/{id}/labels` | Crea label en una tarea (`{ name }`) |
| DELETE | `/tasks/{id}/labels/{labelId}` | Elimina label de una tarea |

**Nota sobre respuestas 204:** `api.ts:request()` detecta status 204 o `content-length: 0` y retorna `undefined` sin llamar `res.json()`, evitando un SyntaxError en respuestas sin cuerpo.

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

## Skeleton de carga (`Board.tsx`)

Durante la carga inicial (`loading === true` en `useTasks`), `Board` renderiza un skeleton en lugar del tablero real, manteniendo el mismo layout del modo activo:

- **Modo Kanban:** las 7 columnas aparecen con 2 tarjetas skeleton cada una.
- **Modo Lista:** 4 grupos skeleton con 3 filas cada uno.

Animación shimmer via `@keyframes sk-shimmer` (gradiente horizontal animado). Al llegar los datos se reemplaza directamente sin flash. El toolbar (toggle de modo, botones) sigue visible durante la carga.

---

## Decisiones de diseño relevantes

- **Single-table DynamoDB**: todas las entidades en una sola tabla, distinguidas por el patrón `sk`.
- **No hay backend de usuarios**: la identidad es el `sub` del JWT de Cognito. No hay tabla de usuarios.
- **Lambda handlers sin framework**: sin Express ni Hono, routing manual por `method` + `pathParameters`.
- **PKCE en el frontend**: el `client_secret` de Cognito no se usa (`generateSecret: false`), el flujo es seguro sin backend de auth.
- **Tokens en localStorage**: decisión consciente para simplicidad — app de uso personal, no multi-tenant.
- **Modo del tablero en localStorage**: persiste entre sesiones sin necesidad de backend; clave `board-view-mode`.
- **Constantes centralizadas en `types.ts`**: todos los valores del dominio (colores, labels, iconos, listas de estados) viven en un solo lugar. Incluye `TASK_KIND_ICONS`, `URGENCY_LEVELS` y el tipo `Theme`.
- **Helpers compartidos en `lib/utils.ts`**: `fmt`, `dateUrgency`, `getTaskDate`, `isValidLabelName` y `LABEL_MAX_LENGTH` evitan duplicación entre componentes. `getTaskDate` es la única fuente para resolver qué campo de fecha usar según `task.kind`.
- **`isActive` en `lib/filters.ts`**: función exportada y consumida por `useFilters.ts`. No hay copia local en el hook.
- **PQL evalúa en el componente, no en el hook**: el debounce (350ms) y la llamada a `evaluatePQL` viven en `PQLFilterContent`. El resultado se comunica al hook mediante `onPqlEvaluated(tasks, error)`. El hook solo almacena el último resultado válido (`lastValidPqlTasks`) y lo sirve en `filteredTasks()`.
- **Error PQL mantiene el último resultado válido**: `onPqlEvaluated(null, error)` deja `lastValidPqlTasks` intacto. El tablero no parpadea mientras el usuario escribe una query incompleta.
- **Motor PQL agnóstico de React**: `lib/pql/` no importa nada de React. El `ASTNode` es serializable a JSON — diseñado para futura traducción a `FilterExpression` de DynamoDB en el backend.
- **`enum` en lugar de `const enum` en PQL**: Vite usa esbuild que no soporta `const enum` entre módulos con `isolatedModules`. Se usa `enum` estándar; el comportamiento es idéntico.
- **`Dialog.Title` oculto con `VisuallyHidden`**: `Modal.tsx` envuelve un `<Dialog.Title>` con `@radix-ui/react-visually-hidden` para cumplir el requisito de accesibilidad de Radix sin afectar el layout visual. El prop `title` es opcional (default `'Diálogo'`).
- **Cierre de modales vía Radix Dialog**: `Modal.tsx` usa `Dialog.Root` con `onOpenChange`. Escape y click en overlay los maneja Radix internamente. No hay `useEffect` manual en `App.tsx` para esto.
- **`SegmentedControl` con Radix ToggleGroup**: el toggle Tablero/Lista usa `ToggleGroup.Root type="single"` con `onValueChange` que ignora string vacío (Radix lo emite cuando se desmarca el item activo — se previene con `v && onValueChange(v)`).
- **Accordion de Radix para ListView**: `ListView` usa `Accordion.Root type="multiple" defaultValue={[...STATES]}` para que todos los grupos arranquen expandidos. La animación height usa `--radix-accordion-content-height` inyectada por Radix.
- **Operadores de filtro como ToggleGroup**: en `FilterBar`, los operadores de cada criterio usan `ToggleGroup.Root` con clase `.op-toggle`. Las etiquetas son abreviadas (ej. `contiene`, `no contiene`) y el texto completo va en `title` para tooltip.
- **react-select para dropdowns de filtro**: el selector de campo de cada criterio y el dropdown "Agregar filtro" usan `react-select`. Los estilos usan `var(--css-variable)` en `StylesConfig` para dark mode automático. `menuPortalTarget={document.body}` + `menuPosition="fixed"` evita recorte por `overflow`.
- **Tokens CSS centralizados**: `:root` en `styles.css` define todas las variables de color, radio y fondo. Dark mode sobrescribe solo las variables en `[data-theme="dark"]`, sin duplicar reglas de layout.
- **Modal centrado con `vw`/`vh`**: `.modal` usa `top:50vh;left:50vw` en lugar de `top:50%;left:50%` para evitar que el desbordamiento horizontal del tablero Kanban expanda el initial containing block y desplace el modal en mobile.
- **`Textarea` con `forwardRef` y `autoResize`**: el prop `autoResize` ajusta `height` vía `scrollHeight` en el callback de ref y en `onInput`. El `setRef` callback combina el ref externo con la inicialización del auto-resize para textareas prellenadas.
- **Claves de localStorage nombradas**: `BOARD_MODE_KEY = 'board-view-mode'` en `App.tsx`; `THEME_KEY = 'theme'` en `App.tsx`; `TOKEN_KEY = 'auth_tokens'` y `PKCE_VERIFIER_KEY = 'pkce_verifier'` en `auth.ts`.
- **Drag and drop nativo**: sin dependencias externas. La API de HTML5 es suficiente para el caso de uso (escritorio, mover entre columnas). El drop reutiliza el mismo `updateTask` que el selector de estado del modal.
- **Labels incluidas en `GET /tasks`**: el backend consulta `LABEL#` en el mismo request que tareas y comentarios. `TaskDetail` inicializa su estado local desde `task.labels` directamente, sin hacer `GET /tasks/{id}/labels` al abrir el modal.
- **Caché local de nombres de labels**: `useLabels` carga `GET /labels` una vez al inicio y mantiene la lista en memoria. Las labels creadas en la sesión se agregan con `registerLabel` sin request adicional.
- **Cascade delete en tarea**: `DELETE /tasks/{id}` consulta todos los items `COMMENT#{taskId}#` y `LABEL#{taskId}#` y los borra en paralelo con la tarea usando `batchDeleteItems`. Sin huérfanos en DynamoDB.
- **Delete optimista de tarea**: `useTasks.deleteTask` actualiza el estado local antes de esperar la respuesta del API, para que el modal cierre y el tablero actualice de inmediato.
- **Orden por fecha en el tablero**: `Board.tsx` ordena el array de tareas con `sortByDate` (usa `getTaskDate`) antes de distribuir por estado. Las tareas sin fecha van al final. El orden aplica igual en Kanban y Lista.
- **`ExpandableText`**: componente interno de `TaskDetail` que trunca a 3 líneas con `webkit-line-clamp` y ofrece "Ver más / Ver menos". Respeta `\n` via `white-space: pre-wrap`. Aplica a descripción y a cada comentario.
