"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameAuditServiceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class GameAuditServiceStack extends cdk.Stack {
    auditTable;
    eventIngestionFunction;
    queryFunction;
    constructor(scope, id, props) {
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
            logRetention: props.logRetentionDays,
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
            logRetention: props.logRetentionDays,
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
                `arn:aws:events:${props.region}:${props.accountId}:event-bus/default`
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
            logRetention: props.logRetentionDays,
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
        dashboard.addWidgets(new cdk.aws_cloudwatch.GraphWidget({
            title: 'Event Ingestion Rate',
            left: [this.eventIngestionFunction.metricInvocations()],
            right: [this.eventIngestionFunction.metricErrors()]
        }), new cdk.aws_cloudwatch.GraphWidget({
            title: 'Query Function Performance',
            left: [this.queryFunction.metricDuration()],
            right: [this.queryFunction.metricErrors()]
        }));
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
exports.GameAuditServiceStack = GameAuditServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFFMUQseURBQTJDO0FBVTNDLE1BQWEscUJBQXNCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbEMsVUFBVSxDQUFpQjtJQUMzQixzQkFBc0IsQ0FBa0I7SUFDeEMsYUFBYSxDQUFrQjtJQUUvQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHVEQUF1RDtRQUN2RCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDN0QsU0FBUyxFQUFFLHdCQUF3QixLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ3RELFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsU0FBUztnQkFDZixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxXQUFXO2dCQUNqQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssWUFBWTtnQkFDN0MsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtnQkFDdEMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsV0FBVztZQUNwQyxZQUFZLEVBQUUsS0FBSyxDQUFDLFdBQVcsS0FBSyxZQUFZLENBQUMsQ0FBQyxD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RSxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVc7WUFDckMsV0FBVyxFQUFFLHVDQUF1QztTQUNyRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxPQUFPO1lBQ2pDLFdBQVcsRUFBRSx1REFBdUQ7U0FDckUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBclBELHNEQXFQQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBHYW1lQXVkaXRTZXJ2aWNlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgcmVnaW9uOiBzdHJpbmc7XG4gIGFjY291bnRJZDogc3RyaW5nO1xuICBsb2dSZXRlbnRpb25EYXlzOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXVkaXRUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBldmVudEluZ2VzdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBxdWVyeUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEdhbWVBdWRpdFNlcnZpY2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiB0YWJsZSBmb3IgYXVkaXQgZXZlbnRzIHdpdGggcHJvcGVyIGluZGV4aW5nXG4gICAgdGhpcy5hdWRpdFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBdWRpdEV2ZW50c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgbG91cGVlbi1hdWRpdC1ldmVudHMtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdldmVudElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nXG4gICAgICAgID8gZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNUXG4gICAgICAgIDogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXG4gICAgICByZWFkQ2FwYWNpdHk6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyB1bmRlZmluZWQgOiA1LFxuICAgICAgd3JpdGVDYXBhY2l0eTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IHVuZGVmaW5lZCA6IDUsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBwcm9wcy5lbnZpcm9ubWVudCAhPT0gJ3Rlc3QnLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJ1xuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTlxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgcXVlcnlpbmcgYnkgc2VydmljZSBhbmQgZXZlbnQgdHlwZVxuICAgIHRoaXMuYXVkaXRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTZXJ2aWNlRXZlbnRUeXBlSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdzZXJ2aWNlTmFtZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnZXZlbnRUeXBlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICAvLyBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IHVzZXIvcHJpbmNpcGFsXG4gICAgdGhpcy5hdWRpdFRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1ByaW5jaXBhbFRpbWVJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3ByaW5jaXBhbElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgcXVlcnlpbmcgYnkgcmlzayBsZXZlbFxuICAgIHRoaXMuYXVkaXRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdSaXNrTGV2ZWxUaW1lSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdyaXNrTGV2ZWwnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBldmVudCBpbmdlc3Rpb25cbiAgICB0aGlzLmV2ZW50SW5nZXN0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdFdmVudEluZ2VzdGlvbkZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgZ2FtZS1hdWRpdC1pbmdlc3Rpb24tJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuL2xhbWJkYS9pbmdlc3Rpb24nKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDIpLFxuICAgICAgbWVtb3J5U2l6ZTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IDUxMiA6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFVRElUX1RBQkxFX05BTUU6IHRoaXMuYXVkaXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgTE9HX0xFVkVMOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gJ0lORk8nIDogJ0RFQlVHJ1xuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogcHJvcHMubG9nUmV0ZW50aW9uRGF5cyBhcyBsb2dzLlJldGVudGlvbkRheXMsXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkVcbiAgICB9KTtcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgYXVkaXQgcXVlcmllc1xuICAgIHRoaXMucXVlcnlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1F1ZXJ5RnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBnYW1lLWF1ZGl0LXF1ZXJ5LSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi9sYW1iZGEvcXVlcnknKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyAxMDI0IDogNTEyLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQVVESVRfVEFCTEVfTkFNRTogdGhpcy5hdWRpdFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRU5WSVJPTk1FTlQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgICBMT0dfTEVWRUw6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyAnSU5GTycgOiAnREVCVUcnXG4gICAgICB9LFxuICAgICAgbG9nUmV0ZW50aW9uOiBwcm9wcy5sb2dSZXRlbnRpb25EYXlzIGFzIGxvZ3MuUmV0ZW50aW9uRGF5cyxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRVxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnNcbiAgICB0aGlzLmF1ZGl0VGFibGUuZ3JhbnRXcml0ZURhdGEodGhpcy5ldmVudEluZ2VzdGlvbkZ1bmN0aW9uKTtcbiAgICB0aGlzLmF1ZGl0VGFibGUuZ3JhbnRSZWFkRGF0YSh0aGlzLnF1ZXJ5RnVuY3Rpb24pO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBFdmVudHMgUnVsZSB0byBjYXB0dXJlIGF1dGhlbnRpY2F0aW9uIGV2ZW50c1xuICAgIGNvbnN0IGF1dGhFdmVudHNSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdBdXRoRXZlbnRzUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgbG91cGVlbi1hdXRoLWV2ZW50cy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NhcHR1cmUgYXV0aGVudGljYXRpb24gYW5kIGF1dGhvcml6YXRpb24gZXZlbnRzIGZvciBhdWRpdCB0cmFpbCcsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2xvdXBlZW4uYXV0aCcsICdsb3VwZWVuLmF1dGh6J10sXG4gICAgICAgIGRldGFpbFR5cGU6IFtcbiAgICAgICAgICAnQXV0aGVudGljYXRpb24gRXZlbnQnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uIEV2ZW50JyxcbiAgICAgICAgICAnVG9rZW4gRXZlbnQnLFxuICAgICAgICAgICdQZXJtaXNzaW9uIENoYW5nZSdcbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9KTtcblxuICAgIC8vIEFkZCBpbmdlc3Rpb24gTGFtYmRhIGFzIHRhcmdldFxuICAgIGF1dGhFdmVudHNSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmV2ZW50SW5nZXN0aW9uRnVuY3Rpb24sIHtcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IDNcbiAgICB9KSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIEV2ZW50cyBSdWxlIHRvIGNhcHR1cmUgYWxsIGhpZ2gtcmlzayBldmVudHNcbiAgICBjb25zdCBoaWdoUmlza0V2ZW50c1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0hpZ2hSaXNrRXZlbnRzUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgbG91cGVlbi1oaWdoLXJpc2stZXZlbnRzLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2FwdHVyZSBoaWdoLXJpc2sgc2VjdXJpdHkgZXZlbnRzIGZvciBpbW1lZGlhdGUgYXVkaXQgYXR0ZW50aW9uJyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnbG91cGVlbi5zZWN1cml0eSddLFxuICAgICAgICBkZXRhaWw6IHtcbiAgICAgICAgICByaXNrTGV2ZWw6IFsnQ1JJVElDQUwnLCAnSElHSCddXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgaW5nZXN0aW9uIExhbWJkYSBhcyB0YXJnZXQgZm9yIGhpZ2gtcmlzayBldmVudHMgdG9vXG4gICAgaGlnaFJpc2tFdmVudHNSdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih0aGlzLmV2ZW50SW5nZXN0aW9uRnVuY3Rpb24sIHtcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IDUgLy8gTW9yZSByZXRyaWVzIGZvciBjcml0aWNhbCBldmVudHNcbiAgICB9KSk7XG5cbiAgICAvLyBJQU0gcm9sZSBmb3IgY3Jvc3Mtc2VydmljZSBhdWRpdCBldmVudCBwdWJsaXNoaW5nXG4gICAgY29uc3QgYXVkaXRQdWJsaXNoZXJSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdBdWRpdFB1Ymxpc2hlclJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYGxvdXBlZW4tYXVkaXQtcHVibGlzaGVyLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpXG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBFdmVudEJyaWRnZSBwdWJsaXNoIHBlcm1pc3Npb25zXG4gICAgYXVkaXRQdWJsaXNoZXJSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2V2ZW50czpQdXRFdmVudHMnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmV2ZW50czoke3Byb3BzLnJlZ2lvbn06JHtwcm9wcy5hY2NvdW50SWR9OmV2ZW50LWJ1cy9kZWZhdWx0YFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEFub21hbHkgZGV0ZWN0aW9uIExhbWJkYSBmdW5jdGlvbiAoZm9yIGZ1dHVyZSBlbmhhbmNlbWVudClcbiAgICBjb25zdCBhbm9tYWx5RGV0ZWN0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBbm9tYWx5RGV0ZWN0aW9uRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBnYW1lLWF1ZGl0LWFub21hbHktJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuL2xhbWJkYS9hbm9tYWx5LWRldGVjdGlvbicpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gMTAyNCA6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFVRElUX1RBQkxFX05BTUU6IHRoaXMuYXVkaXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgTE9HX0xFVkVMOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gJ0lORk8nIDogJ0RFQlVHJ1xuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogcHJvcHMubG9nUmV0ZW50aW9uRGF5cyBhcyBsb2dzLlJldGVudGlvbkRheXMsXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkVcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHJlYWQgcGVybWlzc2lvbnMgZm9yIGFub21hbHkgZGV0ZWN0aW9uXG4gICAgdGhpcy5hdWRpdFRhYmxlLmdyYW50UmVhZERhdGEoYW5vbWFseURldGVjdGlvbkZ1bmN0aW9uKTtcblxuICAgIC8vIFNjaGVkdWxlIGFub21hbHkgZGV0ZWN0aW9uIHRvIHJ1biBldmVyeSA1IG1pbnV0ZXMgaW4gcHJvZHVjdGlvbiwgaG91cmx5IGluIHRlc3RcbiAgICBjb25zdCBhbm9tYWx5U2NoZWR1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0Fub21hbHlEZXRlY3Rpb25TY2hlZHVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgbG91cGVlbi1hbm9tYWx5LWRldGVjdGlvbi0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NjaGVkdWxlIGFub21hbHkgZGV0ZWN0aW9uIGFuYWx5c2lzJyxcbiAgICAgIHNjaGVkdWxlOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nXG4gICAgICAgID8gZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSkpXG4gICAgICAgIDogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLmhvdXJzKDEpKSxcbiAgICAgIGVuYWJsZWQ6IHRydWVcbiAgICB9KTtcblxuICAgIGFub21hbHlTY2hlZHVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oYW5vbWFseURldGVjdGlvbkZ1bmN0aW9uKSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIERhc2hib2FyZCBmb3IgYXVkaXQgbW9uaXRvcmluZ1xuICAgIGNvbnN0IGRhc2hib2FyZCA9IG5ldyBjZGsuYXdzX2Nsb3Vkd2F0Y2guRGFzaGJvYXJkKHRoaXMsICdBdWRpdERhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGBsb3VwZWVuLWF1ZGl0LXNlcnZpY2UtJHtwcm9wcy5lbnZpcm9ubWVudH1gXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgd2lkZ2V0cyBmb3IgbW9uaXRvcmluZ1xuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnRXZlbnQgSW5nZXN0aW9uIFJhdGUnLFxuICAgICAgICBsZWZ0OiBbdGhpcy5ldmVudEluZ2VzdGlvbkZ1bmN0aW9uLm1ldHJpY0ludm9jYXRpb25zKCldLFxuICAgICAgICByaWdodDogW3RoaXMuZXZlbnRJbmdlc3Rpb25GdW5jdGlvbi5tZXRyaWNFcnJvcnMoKV1cbiAgICAgIH0pLFxuICAgICAgbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUXVlcnkgRnVuY3Rpb24gUGVyZm9ybWFuY2UnLFxuICAgICAgICBsZWZ0OiBbdGhpcy5xdWVyeUZ1bmN0aW9uLm1ldHJpY0R1cmF0aW9uKCldLFxuICAgICAgICByaWdodDogW3RoaXMucXVlcnlGdW5jdGlvbi5tZXRyaWNFcnJvcnMoKV1cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFN0YWNrIG91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVkaXRUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdWRpdFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgdGFibGUgbmFtZSBmb3IgYXVkaXQgZXZlbnRzJ1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0V2ZW50SW5nZXN0aW9uRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5ldmVudEluZ2VzdGlvbkZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgZnVuY3Rpb24gQVJOIGZvciBldmVudCBpbmdlc3Rpb24nXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUXVlcnlGdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnF1ZXJ5RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBBUk4gZm9yIGF1ZGl0IHF1ZXJpZXMnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVkaXRQdWJsaXNoZXJSb2xlQXJuJywge1xuICAgICAgdmFsdWU6IGF1ZGl0UHVibGlzaGVyUm9sZS5yb2xlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdJQU0gcm9sZSBBUk4gZm9yIGNyb3NzLXNlcnZpY2UgYXVkaXQgZXZlbnQgcHVibGlzaGluZydcbiAgICB9KTtcbiAgfVxufSJdfQ==