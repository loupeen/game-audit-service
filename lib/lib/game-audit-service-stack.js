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
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBQ2pELCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQsMkRBQTZDO0FBQzdDLHlEQUEyQztBQU8zQyxNQUFhLHFCQUFzQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2xDLFVBQVUsQ0FBaUI7SUFDM0Isc0JBQXNCLENBQWtCO0lBQ3hDLGFBQWEsQ0FBa0I7SUFFL0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFpQztRQUN6RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix1REFBdUQ7UUFDdkQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzdELFNBQVMsRUFBRSx3QkFBd0IsS0FBSyxDQUFDLFdBQVcsRUFBRTtZQUN0RCxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVyxLQUFLLFlBQVk7Z0JBQzdDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7Z0JBQ3RDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVc7WUFDcEMsWUFBWSxFQUFFLEtBQUssQ0FBQyxXQUFXLEtBQUssWUFB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LElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXO1lBQ3JDLFdBQVcsRUFBRSx1Q0FBdUM7U0FDckQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsa0JBQWtCLENBQUMsT0FBTztZQUNqQyxXQUFXLEVBQUUsdURBQXVEO1NBQ3JFLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXJQRCxzREFxUEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2FtZUF1ZGl0U2VydmljZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXVkaXRUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBldmVudEluZ2VzdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBxdWVyeUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEdhbWVBdWRpdFNlcnZpY2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiB0YWJsZSBmb3IgYXVkaXQgZXZlbnRzIHdpdGggcHJvcGVyIGluZGV4aW5nXG4gICAgdGhpcy5hdWRpdFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdBdWRpdEV2ZW50c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgbG91cGVlbi1hdWRpdC1ldmVudHMtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdldmVudElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nXG4gICAgICAgID8gZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNUXG4gICAgICAgIDogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXG4gICAgICByZWFkQ2FwYWNpdHk6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyB1bmRlZmluZWQgOiA1LFxuICAgICAgd3JpdGVDYXBhY2l0eTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IHVuZGVmaW5lZCA6IDUsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBwcm9wcy5lbnZpcm9ubWVudCAhPT0gJ3Rlc3QnLFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJ1xuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTlxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgcXVlcnlpbmcgYnkgc2VydmljZSBhbmQgZXZlbnQgdHlwZVxuICAgIHRoaXMuYXVkaXRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTZXJ2aWNlRXZlbnRUeXBlSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdzZXJ2aWNlTmFtZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnZXZlbnRUeXBlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICAvLyBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IHVzZXIvcHJpbmNpcGFsXG4gICAgdGhpcy5hdWRpdFRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1ByaW5jaXBhbFRpbWVJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3ByaW5jaXBhbElkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgcXVlcnlpbmcgYnkgcmlzayBsZXZlbFxuICAgIHRoaXMuYXVkaXRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdSaXNrTGV2ZWxUaW1lSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdyaXNrTGV2ZWwnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBldmVudCBpbmdlc3Rpb25cbiAgICB0aGlzLmV2ZW50SW5nZXN0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdFdmVudEluZ2VzdGlvbkZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgZ2FtZS1hdWRpdC1pbmdlc3Rpb24tJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuL2xhbWJkYS9pbmdlc3Rpb24nKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDIpLFxuICAgICAgbWVtb3J5U2l6ZTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IDUxMiA6IDI1NixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFVRElUX1RBQkxFX05BTUU6IHRoaXMuYXVkaXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgTE9HX0xFVkVMOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gJ0lORk8nIDogJ0RFQlVHJ1xuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBhdWRpdCBxdWVyaWVzXG4gICAgdGhpcy5xdWVyeUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUXVlcnlGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGdhbWUtYXVkaXQtcXVlcnktJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuL2xhbWJkYS9xdWVyeScpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/IDEwMjQgOiA1MTIsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBBVURJVF9UQUJMRV9OQU1FOiB0aGlzLmF1ZGl0VGFibGUudGFibGVOYW1lLFxuICAgICAgICBFTlZJUk9OTUVOVDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICAgIExPR19MRVZFTDogcHJvcHMuZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyA/ICdJTkZPJyA6ICdERUJVRydcbiAgICAgIH0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkVcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgdGhpcy5hdWRpdFRhYmxlLmdyYW50V3JpdGVEYXRhKHRoaXMuZXZlbnRJbmdlc3Rpb25GdW5jdGlvbik7XG4gICAgdGhpcy5hdWRpdFRhYmxlLmdyYW50UmVhZERhdGEodGhpcy5xdWVyeUZ1bmN0aW9uKTtcblxuICAgIC8vIENsb3VkV2F0Y2ggRXZlbnRzIFJ1bGUgdG8gY2FwdHVyZSBhdXRoZW50aWNhdGlvbiBldmVudHNcbiAgICBjb25zdCBhdXRoRXZlbnRzUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQXV0aEV2ZW50c1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGxvdXBlZW4tYXV0aC1ldmVudHMtJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgZGVzY3JpcHRpb246ICdDYXB0dXJlIGF1dGhlbnRpY2F0aW9uIGFuZCBhdXRob3JpemF0aW9uIGV2ZW50cyBmb3IgYXVkaXQgdHJhaWwnLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydsb3VwZWVuLmF1dGgnLCAnbG91cGVlbi5hdXRoeiddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbXG4gICAgICAgICAgJ0F1dGhlbnRpY2F0aW9uIEV2ZW50JyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbiBFdmVudCcsXG4gICAgICAgICAgJ1Rva2VuIEV2ZW50JyxcbiAgICAgICAgICAnUGVybWlzc2lvbiBDaGFuZ2UnXG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICBlbmFibGVkOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgaW5nZXN0aW9uIExhbWJkYSBhcyB0YXJnZXRcbiAgICBhdXRoRXZlbnRzUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy5ldmVudEluZ2VzdGlvbkZ1bmN0aW9uLCB7XG4gICAgICByZXRyeUF0dGVtcHRzOiAzXG4gICAgfSkpO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBFdmVudHMgUnVsZSB0byBjYXB0dXJlIGFsbCBoaWdoLXJpc2sgZXZlbnRzXG4gICAgY29uc3QgaGlnaFJpc2tFdmVudHNSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdIaWdoUmlza0V2ZW50c1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGxvdXBlZW4taGlnaC1yaXNrLWV2ZW50cy0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NhcHR1cmUgaGlnaC1yaXNrIHNlY3VyaXR5IGV2ZW50cyBmb3IgaW1tZWRpYXRlIGF1ZGl0IGF0dGVudGlvbicsXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2xvdXBlZW4uc2VjdXJpdHknXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgcmlza0xldmVsOiBbJ0NSSVRJQ0FMJywgJ0hJR0gnXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGluZ2VzdGlvbiBMYW1iZGEgYXMgdGFyZ2V0IGZvciBoaWdoLXJpc2sgZXZlbnRzIHRvb1xuICAgIGhpZ2hSaXNrRXZlbnRzUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy5ldmVudEluZ2VzdGlvbkZ1bmN0aW9uLCB7XG4gICAgICByZXRyeUF0dGVtcHRzOiA1IC8vIE1vcmUgcmV0cmllcyBmb3IgY3JpdGljYWwgZXZlbnRzXG4gICAgfSkpO1xuXG4gICAgLy8gSUFNIHJvbGUgZm9yIGNyb3NzLXNlcnZpY2UgYXVkaXQgZXZlbnQgcHVibGlzaGluZ1xuICAgIGNvbnN0IGF1ZGl0UHVibGlzaGVyUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQXVkaXRQdWJsaXNoZXJSb2xlJywge1xuICAgICAgcm9sZU5hbWU6IGBsb3VwZWVuLWF1ZGl0LXB1Ymxpc2hlci0ke3Byb3BzLmVudmlyb25tZW50fWAsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRXZlbnRCcmlkZ2UgcHVibGlzaCBwZXJtaXNzaW9uc1xuICAgIGF1ZGl0UHVibGlzaGVyUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdldmVudHM6UHV0RXZlbnRzJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpldmVudHM6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmV2ZW50LWJ1cy9kZWZhdWx0YFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEFub21hbHkgZGV0ZWN0aW9uIExhbWJkYSBmdW5jdGlvbiAoZm9yIGZ1dHVyZSBlbmhhbmNlbWVudClcbiAgICBjb25zdCBhbm9tYWx5RGV0ZWN0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBbm9tYWx5RGV0ZWN0aW9uRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBnYW1lLWF1ZGl0LWFub21hbHktJHtwcm9wcy5lbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuL2xhbWJkYS9hbm9tYWx5LWRldGVjdGlvbicpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gMTAyNCA6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEFVRElUX1RBQkxFX05BTUU6IHRoaXMuYXVkaXRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEVOVklST05NRU5UOiBwcm9wcy5lbnZpcm9ubWVudCxcbiAgICAgICAgTE9HX0xFVkVMOiBwcm9wcy5lbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gJ0lORk8nIDogJ0RFQlVHJ1xuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRVxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcmVhZCBwZXJtaXNzaW9ucyBmb3IgYW5vbWFseSBkZXRlY3Rpb25cbiAgICB0aGlzLmF1ZGl0VGFibGUuZ3JhbnRSZWFkRGF0YShhbm9tYWx5RGV0ZWN0aW9uRnVuY3Rpb24pO1xuXG4gICAgLy8gU2NoZWR1bGUgYW5vbWFseSBkZXRlY3Rpb24gdG8gcnVuIGV2ZXJ5IDUgbWludXRlcyBpbiBwcm9kdWN0aW9uLCBob3VybHkgaW4gdGVzdFxuICAgIGNvbnN0IGFub21hbHlTY2hlZHVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnQW5vbWFseURldGVjdGlvblNjaGVkdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBsb3VwZWVuLWFub21hbHktZGV0ZWN0aW9uLSR7cHJvcHMuZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2NoZWR1bGUgYW5vbWFseSBkZXRlY3Rpb24gYW5hbHlzaXMnLFxuICAgICAgc2NoZWR1bGU6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbidcbiAgICAgICAgPyBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24ubWludXRlcyg1KSlcbiAgICAgICAgOiBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24uaG91cnMoMSkpLFxuICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgIH0pO1xuXG4gICAgYW5vbWFseVNjaGVkdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihhbm9tYWx5RGV0ZWN0aW9uRnVuY3Rpb24pKTtcblxuICAgIC8vIENsb3VkV2F0Y2ggRGFzaGJvYXJkIGZvciBhdWRpdCBtb25pdG9yaW5nXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IGNkay5hd3NfY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0F1ZGl0RGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYGxvdXBlZW4tYXVkaXQtc2VydmljZS0ke3Byb3BzLmVudmlyb25tZW50fWBcbiAgICB9KTtcblxuICAgIC8vIEFkZCB3aWRnZXRzIGZvciBtb25pdG9yaW5nXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdFdmVudCBJbmdlc3Rpb24gUmF0ZScsXG4gICAgICAgIGxlZnQ6IFt0aGlzLmV2ZW50SW5nZXN0aW9uRnVuY3Rpb24ubWV0cmljSW52b2NhdGlvbnMoKV0sXG4gICAgICAgIHJpZ2h0OiBbdGhpcy5ldmVudEluZ2VzdGlvbkZ1bmN0aW9uLm1ldHJpY0Vycm9ycygpXVxuICAgICAgfSksXG4gICAgICBuZXcgY2RrLmF3c19jbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdRdWVyeSBGdW5jdGlvbiBQZXJmb3JtYW5jZScsXG4gICAgICAgIGxlZnQ6IFt0aGlzLnF1ZXJ5RnVuY3Rpb24ubWV0cmljRHVyYXRpb24oKV0sXG4gICAgICAgIHJpZ2h0OiBbdGhpcy5xdWVyeUZ1bmN0aW9uLm1ldHJpY0Vycm9ycygpXVxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gU3RhY2sgb3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdWRpdFRhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF1ZGl0VGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiB0YWJsZSBuYW1lIGZvciBhdWRpdCBldmVudHMnXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRXZlbnRJbmdlc3Rpb25GdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmV2ZW50SW5nZXN0aW9uRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBBUk4gZm9yIGV2ZW50IGluZ2VzdGlvbidcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdRdWVyeUZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMucXVlcnlGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIGZ1bmN0aW9uIEFSTiBmb3IgYXVkaXQgcXVlcmllcydcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdWRpdFB1Ymxpc2hlclJvbGVBcm4nLCB7XG4gICAgICB2YWx1ZTogYXVkaXRQdWJsaXNoZXJSb2xlLnJvbGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIEFSTiBmb3IgY3Jvc3Mtc2VydmljZSBhdWRpdCBldmVudCBwdWJsaXNoaW5nJ1xuICAgIH0pO1xuICB9XG59Il19