import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  putItem, queryItems, updateItem, deleteItem,
  taskPK, taskSK, commentSK, queryItems as queryComments, newId,
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
    title: item['title'],
    desc: item['desc'] ?? '',
    status: item['status'],
    tipo: item['tipo'],
    deadline: item['deadline'],
    nextDate: item['nextDate'],
    createdAt: item['createdAt'],
    comments: comments.map((c) => ({
      id: c['cid'],
      text: c['text'],
      date: c['date'],
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
      const body = JSON.parse(event.body ?? '{}');
      const id = newId();
      const now = new Date().toISOString().slice(0, 10);
      const item = {
        pk,
        sk: taskSK(id),
        taskId: id,
        title: body.title,
        desc: body.desc ?? '',
        status: body.status ?? 'Backlog',
        tipo: body.tipo ?? 'unica',
        deadline: body.deadline ?? null,
        nextDate: body.nextDate ?? null,
        createdAt: now,
      };
      await putItem(item);
      return ok(dbItemToTask(item, []));
    }

    if (method === 'PUT' && taskId) {
      const body = JSON.parse(event.body ?? '{}');
      const allowed = ['title', 'desc', 'status', 'tipo', 'deadline', 'nextDate'];
      const updates = Object.fromEntries(
        Object.entries(body).filter(([k]) => allowed.includes(k)),
      );
      const updated = await updateItem(pk, taskSK(taskId), updates);
      if (!updated) return err(404, 'Task not found');
      const comments = await queryComments(pk, `COMMENT#${taskId}#`);
      return ok(dbItemToTask(updated as Record<string, unknown>, comments as Record<string, unknown>[]));
    }

    if (method === 'DELETE' && taskId) {
      await deleteItem(pk, taskSK(taskId));
      return { statusCode: 204, body: '' };
    }

    return err(405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return err(500, 'Internal server error');
  }
}
