#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PersonalTasksManagerStack } from '../lib/personal-tasks-manager-stack';
import { config } from '../config';

const app = new cdk.App();

new PersonalTasksManagerStack(app, 'PersonalTasksManager', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region },
  config,
});
