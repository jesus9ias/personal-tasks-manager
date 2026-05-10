import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  putItem, queryItems, updateItem, deleteItem, batchDeleteItems,
  taskPK, taskSK, newId,
} from '../lib/dynamo';

function ok(body: unknown): APIGatewayProxyResultV2 {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function err(status: number, msg: string): APIGatewayProxyResultV2 {
  return { statusCode: status, body: JSON.stringify({ error: msg }) };
}

function getSub(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims['sub'] as string;
}

function dbItemToTask(item: Record<string, unknown>, comments: Record<string, unknown>[]) {
  return {
    id: item['taskId'],
    name: item['name'],
    body: item['body'] ?? '',
    status: item['status'],
    kind: item['kind'],
    dueDate: item['dueDate'],
    nextDate: item['nextDate'],
    createdAt: item['createdAt'],
    comments: comments.map((c) => ({
      id: c['commentId'],
      body: c['body'],
      createdAt: c['createdAt'],
    })),
  };
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const sub = getSub(event);
  const pk = taskPK(sub);
  const method = event.requestContext.http.method;
  const taskId = event.pathParameters?.id;

  try {
    if (method === 'GET' && !taskId) {
      const taskItems = await queryItems(pk, 'TASK#');
      const commentItems = await queryComments(pk, 'COMMENT#');

      const commentsByTask: Record<string, Record<string, unknown>[]> = {};
      for (const c of commentItems) {
        const sk = c['sk'] as string;
        const tid = sk.split('#')[1];
        if (!commentsByTask[tid]) commentsByTask[tid] = [];
        commentsByTask[tid].push(c as Record<string, unknown>);
      }

      const tasks = taskItems.map((item) => {
        const tid = (item['taskId'] as string) ?? '';
        return dbItemToTask(item as Record<string, unknown>, commentsByTask[tid] ?? []);
      });

      return ok(tasks);
    }

    if (method === 'POST' && !taskId) {
      const payload = JSON.parse(event.body ?? '{}');
      const id = newId();
      const now = new Date().toISOString().slice(0, 10);
      const item = {
        pk,
        sk: taskSK(id),
        taskId: id,
        name: payload.name,
        body: payload.body ?? '',
        status: payload.status ?? 'Backlog',
        kind: payload.kind ?? 'ONE_TIME',
        dueDate: payload.dueDate ?? null,
        nextDate: payload.nextDate ?? null,
        createdAt: now,
      };
      await putItem(item);
      return ok(dbItemToTask(item, []));
    }

    if (method === 'PUT' && taskId) {
      const payload = JSON.parse(event.body ?? '{}');
      const allowed = ['name', 'body', 'status', 'kind', 'dueDate', 'nextDate'];
      const updates = Object.fromEntries(
        Object.entries(payload).filter(([k]) => allowed.includes(k)),
      );
      const updated = await updateItem(pk, taskSK(taskId), updates);
      if (!updated) return err(404, 'Task not found');
      const comments = await queryComments(pk, `COMMENT#${taskId}#`);
      return ok(dbItemToTask(updated as Record<string, unknown>, comments as Record<string, unknown>[]));
    }

    if (method === 'DELETE' && taskId) {
      const [comments, labels] = await Promise.all([
        queryItems(pk, `COMMENT#${taskId}#`),
        queryItems(pk, `LABEL#${taskId}#`),
      ]);
      const related = [...comments, ...labels].map((item) => ({
        pk: item['pk'] as string,
        sk: item['sk'] as string,
      }));
      await Promise.all([
        deleteItem(pk, taskSK(taskId)),
        batchDeleteItems(related),
      ]);
      return { statusCode: 204, body: '' };
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return err(500, 'Internal server error');
  }
}
