import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { putItem, deleteItem, taskPK, commentSK, newId } from '../lib/dynamo';

function getSub(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims['sub'] as string;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> {
  const sub = getSub(event);
  const taskId = event.pathParameters?.id;
  const commentId = event.pathParameters?.commentId;
  const method = event.requestContext.http.method;

  if (!taskId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing task id' }) };
  }

  try {
    if (method === 'DELETE' && commentId) {
      await deleteItem(taskPK(sub), commentSK(taskId, commentId));
      return { statusCode: 204, body: '' };
    }

    const payload = JSON.parse(event.body ?? '{}');
    const body = (payload.body ?? '').trim();
    if (!body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'body is required' }) };
    }

    const newCommentId = newId();
    const createdAt = new Date().toISOString().slice(0, 10);
    const item = {
      pk: taskPK(sub),
      sk: commentSK(taskId, newCommentId),
      taskId,
      commentId: newCommentId,
      body,
      createdAt,
    };
    await putItem(item);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newCommentId, body, createdAt }),
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
