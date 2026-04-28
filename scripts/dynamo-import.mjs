#!/usr/bin/env node
/**
 * Imports items from a JSON export file into a DynamoDB table.
 *
 * Usage:
 *   node scripts/dynamo-import.mjs <input-file> [table-name]
 *
 *   table-name defaults to the value stored in the export file,
 *   or 'personal-tasks-manager' if not present.
 *
 * AWS credentials are read from the environment (AWS_PROFILE, AWS_ACCESS_KEY_ID, etc.)
 * Region defaults to AWS_REGION env var or us-east-1.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { readFileSync } from 'fs';

const INPUT  = process.argv[2];
const REGION = process.env.AWS_REGION ?? 'us-east-1';

if (!INPUT) {
  console.error('Usage: node scripts/dynamo-import.mjs <input-file> [table-name]');
  process.exit(1);
}

const payload = JSON.parse(readFileSync(INPUT, 'utf-8'));
const TABLE   = process.argv[3] ?? payload.table ?? 'personal-tasks-manager';
const items   = payload.items ?? [];

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const BATCH_SIZE = 25; // DynamoDB BatchWrite limit

function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function importTable() {
  console.log(`Importing ${items.length} items into table '${TABLE}' (${REGION})...`);

  let written = 0;
  for (const batch of chunks(items, BATCH_SIZE)) {
    const response = await client.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: batch.map(item => ({ PutRequest: { Item: item } })),
      },
    }));

    const unprocessed = response.UnprocessedItems?.[TABLE]?.length ?? 0;
    if (unprocessed > 0) {
      console.warn(`  Warning: ${unprocessed} items were not processed in this batch.`);
    }

    written += batch.length - unprocessed;
    process.stdout.write(`\r${written}/${items.length} items written...`);
  }

  console.log(`\nDone. ${written} items imported into '${TABLE}'.`);
}

importTable().catch(err => { console.error(err); process.exit(1); });
