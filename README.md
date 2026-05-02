# Personal Tasks Manager

Gestor personal de tareas con tablero Kanban. App full-stack serverless en AWS, autenticación con Google vía Cognito.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | AWS Lambda (Node 24, TypeScript) |
| Base de datos | DynamoDB (single-table) |
| Auth | AWS Cognito + Google OAuth2 (PKCE) |
| Infra como código | AWS CDK v2 (TypeScript) |
| CI/CD | GitHub Actions |
| DNS / TLS | Route53 + ACM |
| CDN | CloudFront |

## Arquitectura

```
                    ┌─────────────┐
                    │   Route53   │
                    └──────┬──────┘
                           │ DNS
                    ┌──────▼──────┐
                    │ CloudFront  │
                    └──────┬──────┘
                           │
               ┌───────────┴───────────┐
               │                       │
        ┌──────▼──────┐        ┌───────▼──────┐
        │  S3 Bucket  │        │  API Gateway │
        │  (frontend) │        │  (HTTP API)  │
        └─────────────┘        └───────┬──────┘
                                       │ JWT validated
                                       │ by Cognito authorizer
                               ┌───────▼──────┐
                               │    Lambda    │
                               │ tasks.ts     │
                               │ comments.ts  │
                               └───────┬──────┘
                                       │
                               ┌───────▼──────┐
                               │   DynamoDB   │
                               │ single-table │
                               └──────────────┘

  Cognito User Pool ──── Google IdP ──── OAuth2 PKCE ──── Browser
```

## Estructura del repositorio

```
personal-tasks-manager/
├── frontend/                  React 18 + Vite
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts        OAuth2 PKCE flow + token management
│   │   │   ├── api.ts         REST client con auto-refresh de JWT
│   │   │   └── utils.ts       Helpers: fmt(), dateUrgency()
│   │   ├── hooks/
│   │   │   ├── useAuth.ts     Estado de autenticación
│   │   │   ├── useTasks.ts    CRUD de tareas + comentarios
│   │   │   └── useLabels.ts   Caché global de labels + carga en page load
│   │   ├── components/
│   │   │   ├── Board.tsx      Toolbar + toggle de modo + layout condicional
│   │   │   ├── Column.tsx     Columna del modo Kanban (drop target)
│   │   │   ├── Card.tsx       Tarjeta de tarea (draggable)
│   │   │   ├── ListView.tsx   Vista de lista con grupos colapsables
│   │   │   ├── TaskDetail.tsx Modal de detalle de tarea + gestión de labels
│   │   │   └── TaskModal.tsx  Modal de creación y edición de tarea
│   │   ├── types.ts           Tipos y constantes del dominio
│   │   ├── App.tsx            Orquestador + estado de modales
│   │   └── styles.css         Estilos globales + dark mode
│   ├── .env.example           Template de variables de entorno
│   └── .env.local             Variables locales — gitignoreado
│
├── backend/                   Lambda handlers (TypeScript)
│   └── src/
│       ├── handlers/
│       │   ├── tasks.ts       GET/POST/PUT/DELETE /tasks
│       │   ├── comments.ts    POST /tasks/{id}/comments
│       │   └── labels.ts      GET /labels, GET+POST /tasks/{id}/labels, DELETE /tasks/{id}/labels/{labelId}
│       └── lib/
│           └── dynamo.ts      DynamoDB Document Client + helpers
│
├── infra/                     AWS CDK v2
│   ├── bin/app.ts             Entry point del CDK app
│   ├── config.ts              Carga infra/.env y exporta Config tipado
│   ├── lib/
│   │   ├── personal-tasks-manager-stack.ts  Stack principal
│   │   ├── auth-construct.ts  Cognito User Pool + Google IdP + dominio
│   │   ├── api-construct.ts   API Gateway + Lambdas + authorizer
│   │   ├── db-construct.ts    DynamoDB table
│   │   └── frontend-construct.ts  S3 + CloudFront + Route53 + ACM
│   ├── .env.example           Template de configuración de infra
│   └── .env                   Configuración local — gitignoreado
│
├── scripts/
│   ├── dynamo-export.mjs      Exporta toda la tabla a JSON
│   └── dynamo-import.mjs      Importa desde JSON a DynamoDB
│
├── .github/workflows/
│   ├── deploy-infra.yml       Deploy CDK al hacer push en infra/** o backend/**
│   └── deploy-frontend.yml    Build + sync S3 + invalidar CDN al hacer push en frontend/**
│
├── CLAUDE.md                  Contexto técnico para Claude Code
└── README.md                  Este archivo
```

---

## Funcionalidades

### Modos del tablero

El tablero tiene dos modos de visualización. El modo activo se guarda en `localStorage` y persiste entre sesiones.

#### Modo Kanban
Columnas horizontales scrolleables, una por cada estado. Cada tarjeta muestra:
- Título y descripción (truncada a 2 líneas)
- Badge de tipo (Única / Recurrente)
- Fecha con icono de urgencia si aplica
- Borde izquierdo en el color del estado

El header de cada columna muestra el nombre del estado, el conteo de tarjetas y un botón `+` para crear una tarea directamente en ese estado.

Las tarjetas son **arrastrables entre columnas** (drag and drop). Al soltar una tarjeta en otra columna su estado se actualiza automáticamente. La columna destino se resalta visualmente mientras hay una tarjeta encima.

#### Modo Lista
Vista vertical centrada, agrupada por estado en el mismo orden que el Kanban. Cada grupo es colapsable individualmente mediante el botón ▶/▼ de su header. El header de cada grupo también tiene el conteo y el botón `+`.

Cada fila de tarea muestra: título | badge de tipo | fecha con icono de urgencia.

### Indicadores de urgencia de fechas

Aparecen en tarjetas (Kanban), filas (Lista) y modal de detalle. Solo se muestran si la tarea tiene fecha y su estado no es Pausado, Finalizado ni Cancelado.

| Indicador | Condición |
|---|---|
| ⚠️ Faltan 5 días o menos | Vence en 1–5 días |
| 🔴 Vence hoy | Vence hoy |
| 🚨 Fecha vencida | La fecha ya pasó |

### Modales de tarea

Todos los modales se cierran con **Escape** o haciendo click fuera del modal.

#### Nueva tarea
Se abre desde el botón `+ Nueva tarea` del toolbar o desde el `+` de una columna/grupo (que preselecciona el estado).

Campos:
- **Nombre** (requerido)
- **Descripción**
- **Estado** — selector con todos los estados posibles
- **Tipo** — Única o Recurrente
- **Fecha límite** — visible solo si el tipo es Única
- **Siguiente fecha** — visible solo si el tipo es Recurrente

#### Detalle de tarea
Se abre al hacer click en una tarjeta o en una fila de lista.

Muestra:
- Título con botón **Editar** en el header
- Selector visual de estado: pills de todos los estados que al hacer click cambian el estado inmediatamente (sin necesidad de guardar)
- Descripción
- Tipo y fecha de creación
- Fecha límite o siguiente fecha, con indicador de urgencia si corresponde
- Sección **Labels**: chips removibles con las labels de la tarea + input con autocompletado para agregar más (ver más abajo)
- Sección de comentarios: input de agregar al principio, lista debajo ordenada del más reciente al más antiguo

### Labels

Cada tarea puede tener múltiples labels de texto libre. Las labels solo son gestionables desde el modal de detalle (no desde el de creación).

**Autocompletado:** al abrir el modal de detalle se cargan los labels de esa tarea. Al escribir en el input de labels se muestran sugerencias basadas en todos los labels existentes del usuario, excluyendo los que ya están en la tarea. Si el nombre escrito no existe, aparece la opción «Crear `{nombre}`».

**Validación:** máximo 50 caracteres, solo letras, números, espacios, guion (`-`) y guion bajo (`_`).

**Caché:** la lista de todos los nombres de labels se carga una vez al iniciar la sesión (`GET /labels`) y se mantiene en memoria. Las labels creadas durante la sesión se agregan al caché sin consultar el backend de nuevo. Los labels de cada tarea se cargan individualmente al abrir su modal (`GET /tasks/{id}/labels`).

#### Edición de tarea
Se abre desde el botón "Editar" del modal de detalle.

Mismos campos que el modal de nueva tarea, prellenados con los valores actuales. Incluye botón **Eliminar** que borra la tarea permanentemente.

---

## Requisitos previos

- Node.js 24+
- AWS CLI configurado (`aws configure`)
- Una cuenta de AWS con una hosted zone en Route53 para tu dominio
- Una app de Google Cloud con OAuth2 habilitado
- AWS CDK CLI: `npm install -g aws-cdk`

---

## Instalación local

```bash
git clone <repo>
cd personal-tasks-manager
npm install
```

---

## Configuración

### 1. Infra — `infra/.env`

Copia el template y completa los valores:

```bash
cp infra/.env.example infra/.env
```

```env
DOMAIN_NAME=tu-dominio.com          # debe existir como hosted zone en Route53
APP_SUBDOMAIN=tasks                 # la app quedará en tasks.tu-dominio.com
COGNITO_DOMAIN_PREFIX=tasks-tunombre  # debe ser único globalmente en AWS
AWS_REGION=us-east-1
```

### 2. Secretos de Google OAuth en AWS SSM

Antes del primer deploy, crea los parámetros en SSM:

```bash
aws ssm put-parameter \
  --name /personal-tasks-manager/google/client-id \
  --value "TU_GOOGLE_CLIENT_ID" \
  --type String

aws ssm put-parameter \
  --name /personal-tasks-manager/google/client-secret \
  --value "TU_GOOGLE_CLIENT_SECRET" \
  --type String
```

> Obtén estas credenciales en [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client IDs.

### 3. Frontend — `frontend/.env.local`

Después del primer deploy de infra, toma los outputs de CloudFormation:

```bash
cp frontend/.env.example frontend/.env.local
```

```env
VITE_COGNITO_DOMAIN=https://<prefix>.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=<client-id-del-output>
VITE_COGNITO_REDIRECT_URI=http://localhost:3000/callback
VITE_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
```

Para obtener los valores de los outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name PersonalTasksManager \
  --query "Stacks[0].Outputs"
```

---

## Desarrollo local

```bash
npm run frontend    # inicia Vite en http://localhost:3000
```

El frontend apunta a la API desplegada en AWS (`VITE_API_URL`). No hay emulador local de Lambda/DynamoDB.

---

## Deploy

### Primera vez (bootstrap CDK)

```bash
cd infra
npm install
npx cdk bootstrap
```

Solo es necesario hacerlo una vez por cuenta/región.

### Deploy manual

```bash
npm run infra:diff    # previsualiza cambios
npm run infra:deploy  # despliega infra + backend
```

El frontend se despliega subiendo los archivos compilados a S3:

```bash
npm -w frontend run build
aws s3 sync frontend/dist/ s3://$(aws cloudformation list-exports \
  --query "Exports[?Name=='PersonalTasksManager-FrontendBucket'].Value" \
  --output text) --delete
```

### Deploy automático vía GitHub Actions

Configura los siguientes secrets en **Settings → Secrets and variables → Actions** de tu repositorio:

| Secret | Descripción |
|---|---|
| `AWS_ACCESS_KEY_ID` | Access key de tu usuario IAM |
| `AWS_SECRET_ACCESS_KEY` | Secret key de tu usuario IAM |
| `AWS_REGION` | Región de deploy (`us-east-1`) |
| `DOMAIN_NAME` | Tu dominio raíz |
| `APP_SUBDOMAIN` | Subdominio de la app |
| `COGNITO_DOMAIN_PREFIX` | Prefijo del dominio Cognito |
| `VITE_COGNITO_DOMAIN` | URL del hosted UI de Cognito |
| `VITE_COGNITO_CLIENT_ID` | ID del app client de Cognito |
| `VITE_API_URL` | URL base del API Gateway |
| `VITE_COGNITO_REDIRECT_URI` | `https://APP_SUBDOMAIN.DOMAIN_NAME/callback` |

A partir de ahí, cada push a `main` dispara el workflow correspondiente según los archivos modificados.

---

## Configuración de Google OAuth

En [Google Cloud Console](https://console.cloud.google.com) → tu OAuth Client → agrega:

**Authorized JavaScript origins:**
```
https://APP_SUBDOMAIN.DOMAIN_NAME
```

**Authorized redirect URIs:**
```
https://APP_SUBDOMAIN.DOMAIN_NAME/callback
https://COGNITO_DOMAIN_PREFIX.auth.AWS_REGION.amazoncognito.com/oauth2/idpresponse
```

---

## Modelo de datos

Tabla DynamoDB `personal-tasks-manager` con diseño single-table.

| Entidad | PK | SK |
|---|---|---|
| Tarea | `USER#{cognitoSub}` | `TASK#{taskId}` |
| Comentario | `USER#{cognitoSub}` | `COMMENT#{taskId}#{cid}` |
| Label | `USER#{cognitoSub}` | `LABEL#{taskId}#{labelId}` |

### Campos de tarea

| Campo | Tipo | Descripción |
|---|---|---|
| `taskId` | string | ID único (base36) |
| `title` | string | Título |
| `desc` | string | Descripción |
| `status` | TaskStatus | Estado actual |
| `tipo` | `unica` \| `recurrente` | Tipo de tarea |
| `deadline` | string (YYYY-MM-DD) | Fecha límite — solo para tareas únicas, opcional |
| `nextDate` | string (YYYY-MM-DD) | Próxima fecha de recurrencia — solo para tareas recurrentes, opcional |
| `createdAt` | string (YYYY-MM-DD) | Fecha de creación |

### Estados posibles (`TaskStatus`)

`Backlog` → `Planificación` → `Ejecución` → `Validación` → `Finalizado`

También: `Pausado`, `Cancelado`

### Campos de comentario

| Campo | Tipo |
|---|---|
| `cid` | string — ID único |
| `text` | string |
| `date` | string (YYYY-MM-DD) |

---

## API REST

Todas las rutas requieren `Authorization: Bearer <idToken>` (JWT de Cognito).

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/tasks` | Lista todas las tareas con sus comentarios |
| `POST` | `/tasks` | Crea una tarea |
| `PUT` | `/tasks/{id}` | Actualiza campos de una tarea |
| `DELETE` | `/tasks/{id}` | Elimina una tarea |
| `POST` | `/tasks/{id}/comments` | Agrega un comentario (`{ "text": "..." }`) |
| `GET` | `/labels` | Lista todos los nombres de labels únicos del usuario |
| `GET` | `/tasks/{id}/labels` | Lista las labels de una tarea |
| `POST` | `/tasks/{id}/labels` | Agrega una label a una tarea (`{ "name": "..." }`) |
| `DELETE` | `/tasks/{id}/labels/{labelId}` | Elimina una label de una tarea |

---

## Scripts de utilidad

### Exportar DynamoDB a JSON

```bash
npm run db:export                                        # tabla por defecto
node scripts/dynamo-export.mjs otra-tabla               # tabla custom
node scripts/dynamo-export.mjs otra-tabla backup.json   # archivo de salida custom
```

Genera un archivo `dynamo-export-<timestamp>.json` con todos los items.

### Importar JSON a DynamoDB

```bash
npm run db:import -- dynamo-export-123.json             # importa al table del export
node scripts/dynamo-import.mjs backup.json otra-tabla   # tabla destino custom
```

Útil para migrar datos entre stacks o hacer backups locales.

---

## Comandos de referencia

```bash
# Desarrollo
npm run frontend              # Vite dev server en :3000

# Infra
npm run infra:diff            # CDK diff
npm run infra:deploy          # CDK deploy
cd infra && npx cdk bootstrap # Primera vez por cuenta/región

# DynamoDB
npm run db:export             # Exportar tabla
npm run db:import -- <file>   # Importar desde archivo
```
