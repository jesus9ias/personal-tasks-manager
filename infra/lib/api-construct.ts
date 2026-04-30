import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as path from 'path';

interface Props {
  table: dynamodb.Table;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  appDomain: string;
}

export class ApiConstruct extends Construct {
  readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { appDomain } = props;
    const backendDir = path.join(__dirname, '..', '..', 'backend');

    const commonLambdaProps: Partial<lambdaNodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: props.table.tableName },
      bundling: { minify: true, sourceMap: false },
    };

    const tasksHandler = new lambdaNodejs.NodejsFunction(this, 'TasksHandler', {
      ...commonLambdaProps,
      entry: path.join(backendDir, 'src', 'handlers', 'tasks.ts'),
      handler: 'handler',
    });

    const commentsHandler = new lambdaNodejs.NodejsFunction(this, 'CommentsHandler', {
      ...commonLambdaProps,
      entry: path.join(backendDir, 'src', 'handlers', 'comments.ts'),
      handler: 'handler',
    });

    const labelsHandler = new lambdaNodejs.NodejsFunction(this, 'LabelsHandler', {
      ...commonLambdaProps,
      entry: path.join(backendDir, 'src', 'handlers', 'labels.ts'),
      handler: 'handler',
    });

    props.table.grantReadWriteData(tasksHandler);
    props.table.grantReadWriteData(commentsHandler);
    props.table.grantReadWriteData(labelsHandler);

    const authorizer = new authorizers.HttpJwtAuthorizer('CognitoAuth', props.userPool.userPoolProviderUrl, {
      jwtAudience: [props.userPoolClient.userPoolClientId],
    });

    const api = new apigwv2.HttpApi(this, 'Api', {
      apiName: 'personal-tasks-manager-api',
      corsPreflight: {
        allowOrigins: [`https://${appDomain}`, 'http://localhost:3000'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.PUT, apigwv2.CorsHttpMethod.DELETE],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    const tasksIntegration = new integrations.HttpLambdaIntegration('TasksIntegration', tasksHandler);
    const commentsIntegration = new integrations.HttpLambdaIntegration('CommentsIntegration', commentsHandler);
    const labelsIntegration = new integrations.HttpLambdaIntegration('LabelsIntegration', labelsHandler);

    api.addRoutes({ path: '/tasks', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration: tasksIntegration, authorizer });
    api.addRoutes({ path: '/tasks/{id}', methods: [apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE], integration: tasksIntegration, authorizer });
    api.addRoutes({ path: '/tasks/{id}/comments', methods: [apigwv2.HttpMethod.POST], integration: commentsIntegration, authorizer });
    api.addRoutes({ path: '/labels', methods: [apigwv2.HttpMethod.GET], integration: labelsIntegration, authorizer });
    api.addRoutes({ path: '/tasks/{id}/labels', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration: labelsIntegration, authorizer });
    api.addRoutes({ path: '/tasks/{id}/labels/{labelId}', methods: [apigwv2.HttpMethod.DELETE], integration: labelsIntegration, authorizer });

    this.apiUrl = api.url!;

    new CfnOutput(this, 'ApiUrl', { value: this.apiUrl, exportName: 'PersonalTasksManager-ApiUrl' });
  }
}
