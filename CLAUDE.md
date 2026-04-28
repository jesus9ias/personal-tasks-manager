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

## Tipos de dominio (`frontend/src/types.ts`)

```typescript
TaskStatus: 'Backlog' | 'Planificación' | 'Ejecución' | 'Pausado' | 'Validación' | 'Finalizado' | 'Cancelado'
TaskType:   'unica' | 'recurrente'
```

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

## Coexistencia con KanbanStack

Existe un stack anterior `KanbanStack` en la misma cuenta/región. **No modificarlo.** Todos los nombres de recursos y CloudFormation exports de este proyecto usan el prefijo `PersonalTasksManager-` para evitar colisiones.

---

## Decisiones de diseño relevantes

- **Single-table DynamoDB**: todas las entidades en una sola tabla, distinguidas por el patrón `sk`.
- **No hay backend de usuarios**: la identidad es el `sub` del JWT de Cognito. No hay tabla de usuarios.
- **Lambda handlers sin framework**: sin Express ni Hono, routing manual por `method` + `pathParameters`.
- **PKCE en el frontend**: el `client_secret` de Cognito no se usa (`generateSecret: false`), el flujo es seguro sin backend de auth.
- **Tokens en localStorage**: decisión consciente para simplicidad — app de uso personal, no multi-tenant.
