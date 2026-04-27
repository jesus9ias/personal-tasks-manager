import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DbConstruct } from './db-construct';
import { AuthConstruct } from './auth-construct';
import { ApiConstruct } from './api-construct';
import { FrontendConstruct } from './frontend-construct';
import { Config } from '../config';

interface PersonalTasksManagerStackProps extends cdk.StackProps {
  config: Config;
}

export class PersonalTasksManagerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PersonalTasksManagerStackProps) {
    super(scope, id, props);

    const { config } = props;
    const appDomain = `${config.appSubdomain}.${config.domainName}`;

    const db = new DbConstruct(this, 'Db');
    const auth = new AuthConstruct(this, 'Auth', {
      domainName: config.domainName,
      appDomain,
      cognitoDomainPrefix: config.cognitoDomainPrefix,
      region: config.region,
    });
    const api = new ApiConstruct(this, 'Api', {
      table: db.table,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      appDomain,
    });
    new FrontendConstruct(this, 'Frontend', {
      domainName: config.domainName,
      appDomain,
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiUrl });
  }
}
