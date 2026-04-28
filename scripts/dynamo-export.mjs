#!/usr/bin/env node
/**
 * Exports all items from a DynamoDB table to a JSON file.
 *
 * Usage:
 *   node scripts/dynamo-export.mjs [table-name] [output-file]
 *
 * Defaults:
 *   table-name  : personal-tasks-manager
 *   output-file : dynamo-export-<timestamp>.json
 *
 * AWS credentials are read from the environment (AWS_PROFILE, AWS_ACCESS_KEY_ID, etc.)
 * Region defaults to AWS_REGION env var or us-east-1.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { writeFileSync } from 'fs';

const TABLE  = process.argv[2] ?? 'personal-tasks-manager';
const REGION = process.env.AWS_REGION ?? 'us-east-1';
const OUTPUT = process.argv[3] ?? `dynamo-export-${Date.now()}.json`;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function exportTable() {
  const items = [];
  let lastKey;

  do {
    const response = await client.send(new ScanCommand({
      TableName: TABLE,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    items.push(...(response.Items ?? []));
    lastKey = response.LastEvaluatedKey;
    process.stdout.write(`\rScanned ${items.length} items...`);
  } while (lastKey);

  console.log(`\nExporting ${items.length} items to ${OUTPUT}`);
  writeFileSync(OUTPUT, JSON.stringify({ table: TABLE, exportedAt: new Date().toISOString(), items }, null, 2));
  console.log('Done.');
}

exportTable().catch(err => { console.error(err); process.exit(1); });
