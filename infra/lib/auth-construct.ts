import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { CfnOutput, SecretValue } from 'aws-cdk-lib';

interface AuthProps {
  domainName: string;
  appDomain: string;
  cognitoDomainPrefix: string;
  region: string;
}

export class AuthConstruct extends Construct {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly cognitoDomain: string;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    const { appDomain, cognitoDomainPrefix, region } = props;

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'personal-tasks-manager-users',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
    });

    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this, '/personal-tasks-manager/google/client-id',
    );
    // SecureString no está soportado en Cognito IdP — se usa String + unsafePlainText
    const googleClientSecret = SecretValue.unsafePlainText(
      ssm.StringParameter.valueForStringParameter(this, '/personal-tasks-manager/google/client-secret'),
    );

    const googleIdP = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
      userPool: this.userPool,
      clientId: googleClientId,
      clientSecretValue: googleClientSecret,
      scopes: ['email', 'profile', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    });

    const domain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: cognitoDomainPrefix },
    });
    this.cognitoDomain = `https://${domain.domainName}.auth.${region}.amazoncognito.com`;

    this.userPoolClient = this.userPool.addClient('AppClient', {
      userPoolClientName: 'personal-tasks-manager-app',
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${appDomain}/callback`, 'http://localhost:3000/callback'],
        logoutUrls: [`https://${appDomain}`, 'http://localhost:3000'],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      preventUserExistenceErrors: true,
    });

    this.userPoolClient.node.addDependency(googleIdP);

    new CfnOutput(this, 'CognitoDomain', { value: this.cognitoDomain, exportName: 'CognitoDomain' });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId, exportName: 'UserPoolClientId' });
  }
}
