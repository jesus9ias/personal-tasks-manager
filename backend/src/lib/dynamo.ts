import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE = process.env.TABLE_NAME!;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function taskPK(sub: string) { return `USER#${sub}`; }
export function taskSK(taskId: string) { return `TASK#${taskId}`; }
export function commentSK(taskId: string, cid: string) { return `COMMENT#${taskId}#${cid}`; }

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function putItem(item: Record<string, unknown>) {
  await client.send(new PutCommand({ TableName: TABLE, Item: item }));
}

export async function getItem(pk: string, sk: string) {
  const res = await client.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
  return res.Item;
}

export async function queryItems(pk: string, skPrefix: string) {
  const res = await client.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': pk, ':prefix': skPrefix },
    }),
  );
  return res.Items ?? [];
}

export async function updateItem(
  pk: string,
  sk: string,
  updates: Record<string, unknown>,
) {
  const entries = Object.entries(updates);
  const expr = entries.map(([k]) => `#${k} = :${k}`).join(', ');
  const names = Object.fromEntries(entries.map(([k]) => [`#${k}`, k]));
  const values = Object.fromEntries(entries.map(([k, v]) => [`:${k}`, v]));

  const res = await client.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk, sk },
      UpdateExpression: `SET ${expr}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }),
  );
  return res.Attributes;
}

export async function deleteItem(pk: string, sk: string) {
  await client.send(new DeleteCommand({ TableName: TABLE, Key: { pk, sk } }));
}
