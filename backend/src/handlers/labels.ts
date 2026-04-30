import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { putItem, queryItems, deleteItem, taskPK, labelSK, newId } from '../lib/dynamo';

const LABEL_REGEX = /^[a-zA-Z0-9\-_ ]+$/;

function ok(body: unknown, status = 200): APIGatewayProxyResultV2 {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function err(status: number, msg: string): APIGatewayProxyResultV2 {
  return { statusCode: status, body: JSON.stringify({ error: msg }) };
}
function getSub(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims['sub'] as string;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const sub = getSub(event);
  const pk = taskPK(sub);
  const method = event.requestContext.http.method;
  const taskId = event.pathParameters?.id;
  const labelId = event.pathParameters?.labelId;

  try {
    // GET /labels — all unique label names for the user
    if (method === 'GET' && !taskId) {
      const items = await queryItems(pk, 'LABEL#');
      const names = [...new Set(items.map((i) => i['name'] as string))];
      return ok(names);
    }

    // GET /tasks/{id}/labels — labels for a specific task
    if (method === 'GET' && taskId) {
      const items = await queryItems(pk, `LABEL#${taskId}#`);
      return ok(items.map((i) => ({ id: i['labelId'], name: i['name'] })));
    }

    // POST /tasks/{id}/labels — add label to task
    if (method === 'POST' && taskId) {
      const body = JSON.parse(event.body ?? '{}');
      const name = (body.name ?? '').trim() as string;
      if (!name) return err(400, 'name is required');
      if (name.length > 50) return err(400, 'name exceeds 50 characters');
      if (!LABEL_REGEX.test(name)) return err(400, 'name contains invalid characters');

      const id = newId();
      await putItem({ pk, sk: labelSK(taskId, id), taskId, labelId: id, name });
      return ok({ id, name }, 201);
    }

    // DELETE /tasks/{id}/labels/{labelId} — remove label from task
    if (method === 'DELETE' && taskId && labelId) {
      await deleteItem(pk, labelSK(taskId, labelId));
      return { statusCode: 204, body: '' };
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return err(500, 'Internal server error');
  }
}
