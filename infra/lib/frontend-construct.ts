import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';

interface FrontendProps {
  domainName: string;
  appDomain: string;
}

export class FrontendConstruct extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

    const { domainName, appDomain } = props;

    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName });

    const cert = new acm.Certificate(this, 'Cert', {
      domainName: appDomain,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      domainNames: [appDomain],
      certificate: cert,
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    const subdomain = appDomain.split('.')[0];
    new route53.ARecord(this, 'AliasRecord', {
      zone,
      recordName: subdomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
    });

    new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName, exportName: 'PersonalTasksManager-FrontendBucket' });
    new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId, exportName: 'PersonalTasksManager-DistributionId' });
  }
}
