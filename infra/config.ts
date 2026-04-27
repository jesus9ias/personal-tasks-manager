import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}. Copy infra/.env.example to infra/.env and fill in the values.`);
  return value;
}

export const config = {
  region: process.env.AWS_REGION ?? 'us-east-1',
  domainName: required('DOMAIN_NAME'),
  appSubdomain: process.env.APP_SUBDOMAIN ?? 'tasks',
  cognitoDomainPrefix: required('COGNITO_DOMAIN_PREFIX'),
} as const;

export type Config = typeof config;
