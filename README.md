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
                               └─────────────┘

  Cognito User Pool ──── Google IdP ──── OAuth2 PKCE ──── Browser
```

## Estructura del repositorio

```
personal-tasks-manager/
├── frontend/                  React 18 + Vite
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts        OAuth2 PKCE flow + token management
│   │   │   └── api.ts         REST client con auto-refresh de JWT
│   │   ├── hooks/
│   │   │   ├── useAuth.ts     Estado de autenticación
│   │   │   └── useTasks.ts    CRUD de tareas + comentarios
│   │   └── types.ts           Tipos compartidos (Task, Comment, TaskStatus)
│   ├── .env.example           Template de variables de entorno
│   └── .env.local             Variables locales — gitignoreado
│
├── backend/                   Lambda handlers (TypeScript)
│   └── src/
│       ├── handlers/
│       │   ├── tasks.ts       GET/POST/PUT/DELETE /tasks
│       │   └── comments.ts    POST /tasks/{id}/comments
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

### Campos de tarea

| Campo | Tipo | Descripción |
|---|---|---|
| `taskId` | string | ID único (base36) |
| `title` | string | Título |
| `desc` | string | Descripción |
| `status` | TaskStatus | Estado actual |
| `tipo` | `unica` \| `recurrente` | Tipo de tarea |
| `deadline` | string (YYYY-MM-DD) | Fecha límite, opcional |
| `nextDate` | string (YYYY-MM-DD) | Próxima fecha de recurrencia, opcional |
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
