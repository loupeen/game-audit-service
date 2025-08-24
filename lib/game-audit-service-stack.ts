import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GameAuditServiceStackProps extends cdk.StackProps {
  environment: string;
}

export class GameAuditServiceStack extends cdk.Stack {
  public readonly auditTable: dynamodb.Table;
  public readonly eventIngestionFunction: lambda.Function;
  public readonly queryFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: GameAuditServiceStackProps) {
    super(scope, id, props);

    // DynamoDB table for audit events with proper indexing
    this.auditTable = new dynamodb.Table(this, 'AuditEventsTable', {
      tableName: `loupeen-audit-events-${props.environment}`,
      partitionKey: {
        name: 'eventId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: props.environment === 'production'
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      readCapacity: props.environment === 'production' ? undefined : 5,
      writeCapacity: props.environment === 'production' ? undefined : 5,
      pointInTimeRecovery: props.environment !== 'test',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: props.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY
    });

    // GSI for querying by service and event type
    this.auditTable.addGlobalSecondaryIndex({
      indexName: 'ServiceEventTypeIndex',
      partitionKey: {
        name: 'serviceName',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'eventType',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI for querying by user/principal
    this.auditTable.addGlobalSecondaryIndex({
      indexName: 'PrincipalTimeIndex',
      partitionKey: {
        name: 'principalId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // GSI for querying by risk level
    this.auditTable.addGlobalSecondaryIndex({
      indexName: 'RiskLevelTimeIndex',
      partitionKey: {
        name: 'riskLevel',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Lambda function for event ingestion
    this.eventIngestionFunction = new lambda.Function(this, 'EventIngestionFunction', {
      functionName: `game-audit-ingestion-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('./lambda/ingestion'),
      timeout: cdk.Duration.minutes(2),
      memorySize: props.environment === 'production' ? 512 : 256,
      environment: {
        AUDIT_TABLE_NAME: this.auditTable.tableName,
        ENVIRONMENT: props.environment,
        LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG'
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE
    });

    // Lambda function for audit queries
    this.queryFunction = new lambda.Function(this, 'QueryFunction', {
      functionName: `game-audit-query-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('./lambda/query'),
      timeout: cdk.Duration.seconds(30),
      memorySize: props.environment === 'production' ? 1024 : 512,
      environment: {
        AUDIT_TABLE_NAME: this.auditTable.tableName,
        ENVIRONMENT: props.environment,
        LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG'
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE
    });

    // Grant DynamoDB permissions
    this.auditTable.grantWriteData(this.eventIngestionFunction);
    this.auditTable.grantReadData(this.queryFunction);

    // CloudWatch Events Rule to capture authentication events
    const authEventsRule = new events.Rule(this, 'AuthEventsRule', {
      ruleName: `loupeen-auth-events-${props.environment}`,
      description: 'Capture authentication and authorization events for audit trail',
      eventPattern: {
        source: ['loupeen.auth', 'loupeen.authz'],
        detailType: [
          'Authentication Event',
          'Authorization Event',
          'Token Event',
          'Permission Change'
        ]
      },
      enabled: true
    });

    // Add ingestion Lambda as target
    authEventsRule.addTarget(new targets.LambdaFunction(this.eventIngestionFunction, {
      retryAttempts: 3
    }));

    // CloudWatch Events Rule to capture all high-risk events
    const highRiskEventsRule = new events.Rule(this, 'HighRiskEventsRule', {
      ruleName: `loupeen-high-risk-events-${props.environment}`,
      description: 'Capture high-risk security events for immediate audit attention',
      eventPattern: {
        source: ['loupeen.security'],
        detail: {
          riskLevel: ['CRITICAL', 'HIGH']
        }
      },
      enabled: true
    });

    // Add ingestion Lambda as target for high-risk events too
    highRiskEventsRule.addTarget(new targets.LambdaFunction(this.eventIngestionFunction, {
      retryAttempts: 5 // More retries for critical events
    }));

    // IAM role for cross-service audit event publishing
    const auditPublisherRole = new iam.Role(this, 'AuditPublisherRole', {
      roleName: `loupeen-audit-publisher-${props.environment}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Grant EventBridge publish permissions
    auditPublisherRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'events:PutEvents'
      ],
      resources: [
        `arn:aws:events:${this.region}:${this.account}:event-bus/default`
      ]
    }));

    // Anomaly detection Lambda function (for future enhancement)
    const anomalyDetectionFunction = new lambda.Function(this, 'AnomalyDetectionFunction', {
      functionName: `game-audit-anomaly-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('./lambda/anomaly-detection'),
      timeout: cdk.Duration.minutes(5),
      memorySize: props.environment === 'production' ? 1024 : 512,
      environment: {
        AUDIT_TABLE_NAME: this.auditTable.tableName,
        ENVIRONMENT: props.environment,
        LOG_LEVEL: props.environment === 'production' ? 'INFO' : 'DEBUG'
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      tracing: lambda.Tracing.ACTIVE
    });

    // Grant read permissions for anomaly detection
    this.auditTable.grantReadData(anomalyDetectionFunction);

    // Schedule anomaly detection to run every 5 minutes in production, hourly in test
    const anomalySchedule = new events.Rule(this, 'AnomalyDetectionSchedule', {
      ruleName: `loupeen-anomaly-detection-${props.environment}`,
      description: 'Schedule anomaly detection analysis',
      schedule: props.environment === 'production'
        ? events.Schedule.rate(cdk.Duration.minutes(5))
        : events.Schedule.rate(cdk.Duration.hours(1)),
      enabled: true
    });

    anomalySchedule.addTarget(new targets.LambdaFunction(anomalyDetectionFunction));

    // CloudWatch Dashboard for audit monitoring
    const dashboard = new cdk.aws_cloudwatch.Dashboard(this, 'AuditDashboard', {
      dashboardName: `loupeen-audit-service-${props.environment}`
    });

    // Add widgets for monitoring
    dashboard.addWidgets(
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Event Ingestion Rate',
        left: [this.eventIngestionFunction.metricInvocations()],
        right: [this.eventIngestionFunction.metricErrors()]
      }),
      new cdk.aws_cloudwatch.GraphWidget({
        title: 'Query Function Performance',
        left: [this.queryFunction.metricDuration()],
        right: [this.queryFunction.metricErrors()]
      })
    );

    // Stack outputs
    new cdk.CfnOutput(this, 'AuditTableName', {
      value: this.auditTable.tableName,
      description: 'DynamoDB table name for audit events'
    });

    new cdk.CfnOutput(this, 'EventIngestionFunctionArn', {
      value: this.eventIngestionFunction.functionArn,
      description: 'Lambda function ARN for event ingestion'
    });

    new cdk.CfnOutput(this, 'QueryFunctionArn', {
      value: this.queryFunction.functionArn,
      description: 'Lambda function ARN for audit queries'
    });

    new cdk.CfnOutput(this, 'AuditPublisherRoleArn', {
      value: auditPublisherRole.roleArn,
      description: 'IAM role ARN for cross-service audit event publishing'
    });
  }
}