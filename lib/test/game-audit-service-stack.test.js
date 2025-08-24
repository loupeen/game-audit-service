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
const cdk = __importStar(require("aws-cdk-lib"));
const assertions_1 = require("aws-cdk-lib/assertions");
const game_audit_service_stack_1 = require("../lib/game-audit-service-stack");
describe('GameAuditServiceStack', () => {
    let template;
    let stack;
    beforeEach(() => {
        const app = new cdk.App();
        stack = new game_audit_service_stack_1.GameAuditServiceStack(app, 'TestGameAuditServiceStack', {
            environment: 'test',
            region: 'eu-north-1',
            accountId: '728427470046',
            logRetentionDays: 90,
            env: {
                account: '728427470046',
                region: 'eu-north-1'
            }
        });
        template = assertions_1.Template.fromStack(stack);
    });
    test('creates DynamoDB table with correct configuration', () => {
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            TableName: 'loupeen-audit-events-test',
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            },
            AttributeDefinitions: [
                {
                    AttributeName: 'eventId',
                    AttributeType: 'S'
                },
                {
                    AttributeName: 'timestamp',
                    AttributeType: 'S'
                },
                {
                    AttributeName: 'serviceName',
                    AttributeType: 'S'
                },
                {
                    AttributeName: 'eventType',
                    AttributeType: 'S'
                },
                {
                    AttributeName: 'principalId',
                    AttributeType: 'S'
                },
                {
                    AttributeName: 'riskLevel',
                    AttributeType: 'S'
                }
            ],
            KeySchema: [
                {
                    AttributeName: 'eventId',
                    KeyType: 'HASH'
                },
                {
                    AttributeName: 'timestamp',
                    KeyType: 'RANGE'
                }
            ]
        });
    });
    test('creates all required GSI indexes', () => {
        // Check that the table has 3 GSI indexes
        const tableResources = template.findResources('AWS::DynamoDB::Table');
        const tableResource = Object.values(tableResources)[0];
        expect(tableResource.Properties.GlobalSecondaryIndexes).toHaveLength(3);
        const indexNames = tableResource.Properties.GlobalSecondaryIndexes.map((gsi) => gsi.IndexName);
        expect(indexNames).toContain('ServiceEventTypeIndex');
        expect(indexNames).toContain('PrincipalTimeIndex');
        expect(indexNames).toContain('RiskLevelTimeIndex');
    });
    test('creates event ingestion Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-ingestion-test',
            Runtime: 'nodejs20.x',
            Architectures: ['arm64'],
            Handler: 'index.handler',
            MemorySize: 256,
            Timeout: 120
        });
    });
    test('creates query Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-query-test',
            Runtime: 'nodejs20.x',
            Architectures: ['arm64'],
            Handler: 'index.handler',
            MemorySize: 512,
            Timeout: 30
        });
    });
    test('creates anomaly detection Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-anomaly-test',
            Runtime: 'nodejs20.x',
            Architectures: ['arm64'],
            Handler: 'index.handler',
            MemorySize: 512,
            Timeout: 300
        });
    });
    test('creates EventBridge rules for audit events', () => {
        template.hasResourceProperties('AWS::Events::Rule', {
            Name: 'loupeen-auth-events-test',
            EventPattern: {
                source: ['loupeen.auth', 'loupeen.authz'],
                'detail-type': [
                    'Authentication Event',
                    'Authorization Event',
                    'Token Event',
                    'Permission Change'
                ]
            },
            State: 'ENABLED'
        });
        template.hasResourceProperties('AWS::Events::Rule', {
            Name: 'loupeen-high-risk-events-test',
            EventPattern: {
                source: ['loupeen.security'],
                detail: {
                    riskLevel: ['CRITICAL', 'HIGH']
                }
            },
            State: 'ENABLED'
        });
    });
    test('creates anomaly detection schedule', () => {
        template.hasResourceProperties('AWS::Events::Rule', {
            Name: 'loupeen-anomaly-detection-test',
            ScheduleExpression: 'rate(1 hour)',
            State: 'ENABLED'
        });
    });
    test('creates IAM role for audit publishers', () => {
        template.hasResourceProperties('AWS::IAM::Role', {
            RoleName: 'loupeen-audit-publisher-test',
            AssumeRolePolicyDocument: {
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }
                ]
            }
        });
    });
    test('creates CloudWatch dashboard', () => {
        template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
            DashboardName: 'loupeen-audit-service-test'
        });
    });
    test('grants correct DynamoDB permissions', () => {
        // Check for IAM policies that grant DynamoDB access
        const policies = template.findResources('AWS::IAM::Policy');
        const policyCount = Object.keys(policies).length;
        // Should have multiple policies for Lambda functions
        expect(policyCount).toBeGreaterThan(2);
        // Check that there are policies with DynamoDB permissions
        const hasDynamoDbPolicy = Object.values(policies).some((policy) => {
            return policy.Properties?.PolicyDocument?.Statement?.some((statement) => {
                return Array.isArray(statement.Action) &&
                    statement.Action.some((action) => action.startsWith('dynamodb:'));
            });
        });
        expect(hasDynamoDbPolicy).toBe(true);
    });
    test('has correct stack outputs', () => {
        // Check that outputs exist
        const outputs = template.findOutputs('*');
        const outputNames = Object.keys(outputs);
        expect(outputNames).toContain('AuditTableName');
        expect(outputNames).toContain('EventIngestionFunctionArn');
        expect(outputNames).toContain('QueryFunctionArn');
        expect(outputNames).toContain('AuditPublisherRoleArn');
    });
    test('configures different settings for production environment', () => {
        const app = new cdk.App();
        const prodStack = new game_audit_service_stack_1.GameAuditServiceStack(app, 'ProdGameAuditServiceStack', {
            environment: 'production',
            region: 'us-east-1',
            accountId: '123456789012',
            logRetentionDays: 2555,
            env: {
                account: '123456789012',
                region: 'us-east-1'
            }
        });
        const prodTemplate = assertions_1.Template.fromStack(prodStack);
        // Production should not have ProvisionedThroughput (uses PAY_PER_REQUEST)
        const tableResources = prodTemplate.findResources('AWS::DynamoDB::Table');
        const tableResource = Object.values(tableResources)[0];
        expect(tableResource.Properties.ProvisionedThroughput).toBeUndefined();
        // Production functions should have more memory
        prodTemplate.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-ingestion-production',
            MemorySize: 512,
            Architectures: ['arm64']
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi90ZXN0L2dhbWUtYXVkaXQtc2VydmljZS1zdGFjay50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVEQUFrRDtBQUNsRCw4RUFBd0U7QUFFeEUsUUFBUSxDQUFDLHVCQUF1QixFQUFFLEdBQUcsRUFBRTtJQUNyQyxJQUFJLFFBQWtCLENBQUM7SUFDdkIsSUFBSSxLQUE0QixDQUFDO0lBRWpDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUMxQixLQUFLLEdBQUcsSUFBSSxnREFBcUIsQ0FBQyxHQUFHLEVBQUUsMkJBQTJCLEVBQUU7WUFDbEUsV0FBVyxFQUFFLE1BQU07WUFDbkIsTUFBTSxFQUFFLFlBQVk7WUFDcEIsU0FBUyxFQUFFLGNBQWM7WUFDekIsZ0JBQWdCLEVBQUUsRUFBRTtZQUNwQixHQUFHLEVBQUU7Z0JBQ0gsT0FBTyxFQUFFLGNBQWM7Z0JBQ3ZCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsUUFBUSxHQUFHLHFCQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG1EQUFtRCxFQUFFLEdBQUcsRUFBRTtRQUM3RCxRQUFRLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7WUFDckQsU0FBUyxFQUFFLDJCQUEyQjtZQUN0QyxxQkFBcUIsRUFBRTtnQkFDckIsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsa0JBQWtCLEVBQUUsQ0FBQzthQUN0QjtZQUNELG9CQUFvQixFQUFFO2dCQUNwQjtvQkFDRSxhQUFhLEVBQUUsU0FBUztvQkFDeEIs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QyxDQUFDLENBQUMsQ0FBUSxDQUFDO1FBRTlELE1BQU0sQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLHFCQUFxQixDQUFDLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFdkUsK0NBQStDO1FBQy9DLFlBQVksQ0FBQyxxQkFBcUIsQ0FBQyx1QkFBdUIsRUFBRTtZQUMxRCxZQUFZLEVBQUUsaUNBQWlDO1lBQy9DLFVBQVUsRUFBRSxHQUFHO1lBQ2YsYUFBYSxFQUFFLENBQUMsT0FBTyxDQUFDO1NBQ3pCLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVGVtcGxhdGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hc3NlcnRpb25zJztcbmltcG9ydCB7IEdhbWVBdWRpdFNlcnZpY2VTdGFjayB9IGZyb20gJy4uL2xpYi9nYW1lLWF1ZGl0LXNlcnZpY2Utc3RhY2snO1xuXG5kZXNjcmliZSgnR2FtZUF1ZGl0U2VydmljZVN0YWNrJywgKCkgPT4ge1xuICBsZXQgdGVtcGxhdGU6IFRlbXBsYXRlO1xuICBsZXQgc3RhY2s6IEdhbWVBdWRpdFNlcnZpY2VTdGFjaztcblxuICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICAgIHN0YWNrID0gbmV3IEdhbWVBdWRpdFNlcnZpY2VTdGFjayhhcHAsICdUZXN0R2FtZUF1ZGl0U2VydmljZVN0YWNrJywge1xuICAgICAgZW52aXJvbm1lbnQ6ICd0ZXN0JyxcbiAgICAgIHJlZ2lvbjogJ2V1LW5vcnRoLTEnLFxuICAgICAgYWNjb3VudElkOiAnNzI4NDI3NDcwMDQ2JyxcbiAgICAgIGxvZ1JldGVudGlvbkRheXM6IDkwLFxuICAgICAgZW52OiB7XG4gICAgICAgIGFjY291bnQ6ICc3Mjg0Mjc0NzAwNDYnLFxuICAgICAgICByZWdpb246ICdldS1ub3J0aC0xJ1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRlbXBsYXRlID0gVGVtcGxhdGUuZnJvbVN0YWNrKHN0YWNrKTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBEeW5hbW9EQiB0YWJsZSB3aXRoIGNvcnJlY3QgY29uZmlndXJhdGlvbicsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RHluYW1vREI6OlRhYmxlJywge1xuICAgICAgVGFibGVOYW1lOiAnbG91cGVlbi1hdWRpdC1ldmVudHMtdGVzdCcsXG4gICAgICBQcm92aXNpb25lZFRocm91Z2hwdXQ6IHtcbiAgICAgICAgUmVhZENhcGFjaXR5VW5pdHM6IDUsXG4gICAgICAgIFdyaXRlQ2FwYWNpdHlVbml0czogNVxuICAgICAgfSxcbiAgICAgIEF0dHJpYnV0ZURlZmluaXRpb25zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAnZXZlbnRJZCcsXG4gICAgICAgICAgQXR0cmlidXRlVHlwZTogJ1MnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdzZXJ2aWNlTmFtZScsXG4gICAgICAgICAgQXR0cmlidXRlVHlwZTogJ1MnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAnZXZlbnRUeXBlJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdwcmluY2lwYWxJZCcsXG4gICAgICAgICAgQXR0cmlidXRlVHlwZTogJ1MnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAncmlza0xldmVsJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfVxuICAgICAgXSxcbiAgICAgIEtleVNjaGVtYTogW1xuICAgICAgICB7XG4gICAgICAgICAgQXR0cmlidXRlTmFtZTogJ2V2ZW50SWQnLFxuICAgICAgICAgIEtleVR5cGU6ICdIQVNIJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgQXR0cmlidXRlTmFtZTogJ3RpbWVzdGFtcCcsXG4gICAgICAgICAgS2V5VHlwZTogJ1JBTkdFJ1xuICAgICAgICB9XG4gICAgICBdXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgYWxsIHJlcXVpcmVkIEdTSSBpbmRleGVzJywgKCkgPT4ge1xuICAgIC8vIENoZWNrIHRoYXQgdGhlIHRhYmxlIGhhcyAzIEdTSSBpbmRleGVzXG4gICAgY29uc3QgdGFibGVSZXNvdXJjZXMgPSB0ZW1wbGF0ZS5maW5kUmVzb3VyY2VzKCdBV1M6OkR5bmFtb0RCOjpUYWJsZScpO1xuICAgIGNvbnN0IHRhYmxlUmVzb3VyY2UgPSBPYmplY3QudmFsdWVzKHRhYmxlUmVzb3VyY2VzKVswXSBhcyBhbnk7XG4gICAgXG4gICAgZXhwZWN0KHRhYmxlUmVzb3VyY2UuUHJvcGVydGllcy5HbG9iYWxTZWNvbmRhcnlJbmRleGVzKS50b0hhdmVMZW5ndGgoMyk7XG4gICAgXG4gICAgY29uc3QgaW5kZXhOYW1lcyA9IHRhYmxlUmVzb3VyY2UuUHJvcGVydGllcy5HbG9iYWxTZWNvbmRhcnlJbmRleGVzLm1hcCgoZ3NpOiBhbnkpID0+IGdzaS5JbmRleE5hbWUpO1xuICAgIGV4cGVjdChpbmRleE5hbWVzKS50b0NvbnRhaW4oJ1NlcnZpY2VFdmVudFR5cGVJbmRleCcpO1xuICAgIGV4cGVjdChpbmRleE5hbWVzKS50b0NvbnRhaW4oJ1ByaW5jaXBhbFRpbWVJbmRleCcpO1xuICAgIGV4cGVjdChpbmRleE5hbWVzKS50b0NvbnRhaW4oJ1Jpc2tMZXZlbFRpbWVJbmRleCcpO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIGV2ZW50IGluZ2VzdGlvbiBMYW1iZGEgZnVuY3Rpb24nLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCB7XG4gICAgICBGdW5jdGlvbk5hbWU6ICdnYW1lLWF1ZGl0LWluZ2VzdGlvbi10ZXN0JyxcbiAgICAgIFJ1bnRpbWU6ICdub2RlanMyMC54JyxcbiAgICAgIEFyY2hpdGVjdHVyZXM6IFsnYXJtNjQnXSxcbiAgICAgIEhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIE1lbW9yeVNpemU6IDI1NixcbiAgICAgIFRpbWVvdXQ6IDEyMFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIHF1ZXJ5IExhbWJkYSBmdW5jdGlvbicsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ2dhbWUtYXVkaXQtcXVlcnktdGVzdCcsXG4gICAgICBSdW50aW1lOiAnbm9kZWpzMjAueCcsXG4gICAgICBBcmNoaXRlY3R1cmVzOiBbJ2FybTY0J10sXG4gICAgICBIYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBNZW1vcnlTaXplOiA1MTIsXG4gICAgICBUaW1lb3V0OiAzMFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIGFub21hbHkgZGV0ZWN0aW9uIExhbWJkYSBmdW5jdGlvbicsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ2dhbWUtYXVkaXQtYW5vbWFseS10ZXN0JyxcbiAgICAgIFJ1bnRpbWU6ICdub2RlanMyMC54JyxcbiAgICAgIEFyY2hpdGVjdHVyZXM6IFsnYXJtNjQnXSxcbiAgICAgIEhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIE1lbW9yeVNpemU6IDUxMixcbiAgICAgIFRpbWVvdXQ6IDMwMFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIEV2ZW50QnJpZGdlIHJ1bGVzIGZvciBhdWRpdCBldmVudHMnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkV2ZW50czo6UnVsZScsIHtcbiAgICAgIE5hbWU6ICdsb3VwZWVuLWF1dGgtZXZlbnRzLXRlc3QnLFxuICAgICAgRXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydsb3VwZWVuLmF1dGgnLCAnbG91cGVlbi5hdXRoeiddLFxuICAgICAgICAnZGV0YWlsLXR5cGUnOiBbXG4gICAgICAgICAgJ0F1dGhlbnRpY2F0aW9uIEV2ZW50JyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbiBFdmVudCcsXG4gICAgICAgICAgJ1Rva2VuIEV2ZW50JyxcbiAgICAgICAgICAnUGVybWlzc2lvbiBDaGFuZ2UnXG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICBTdGF0ZTogJ0VOQUJMRUQnXG4gICAgfSk7XG5cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RXZlbnRzOjpSdWxlJywge1xuICAgICAgTmFtZTogJ2xvdXBlZW4taGlnaC1yaXNrLWV2ZW50cy10ZXN0JyxcbiAgICAgIEV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnbG91cGVlbi5zZWN1cml0eSddLFxuICAgICAgICBkZXRhaWw6IHtcbiAgICAgICAgICByaXNrTGV2ZWw6IFsnQ1JJVElDQUwnLCAnSElHSCddXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBTdGF0ZTogJ0VOQUJMRUQnXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgYW5vbWFseSBkZXRlY3Rpb24gc2NoZWR1bGUnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkV2ZW50czo6UnVsZScsIHtcbiAgICAgIE5hbWU6ICdsb3VwZWVuLWFub21hbHktZGV0ZWN0aW9uLXRlc3QnLFxuICAgICAgU2NoZWR1bGVFeHByZXNzaW9uOiAncmF0ZSgxIGhvdXIpJyxcbiAgICAgIFN0YXRlOiAnRU5BQkxFRCdcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBJQU0gcm9sZSBmb3IgYXVkaXQgcHVibGlzaGVycycsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6SUFNOjpSb2xlJywge1xuICAgICAgUm9sZU5hbWU6ICdsb3VwZWVuLWF1ZGl0LXB1Ymxpc2hlci10ZXN0JyxcbiAgICAgIEFzc3VtZVJvbGVQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICBTdGF0ZW1lbnQ6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXG4gICAgICAgICAgICBQcmluY2lwYWw6IHtcbiAgICAgICAgICAgICAgU2VydmljZTogJ2xhbWJkYS5hbWF6b25hd3MuY29tJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIEFjdGlvbjogJ3N0czpBc3N1bWVSb2xlJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIENsb3VkV2F0Y2ggZGFzaGJvYXJkJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpDbG91ZFdhdGNoOjpEYXNoYm9hcmQnLCB7XG4gICAgICBEYXNoYm9hcmROYW1lOiAnbG91cGVlbi1hdWRpdC1zZXJ2aWNlLXRlc3QnXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2dyYW50cyBjb3JyZWN0IER5bmFtb0RCIHBlcm1pc3Npb25zJywgKCkgPT4ge1xuICAgIC8vIENoZWNrIGZvciBJQU0gcG9saWNpZXMgdGhhdCBncmFudCBEeW5hbW9EQiBhY2Nlc3NcbiAgICBjb25zdCBwb2xpY2llcyA9IHRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoJ0FXUzo6SUFNOjpQb2xpY3knKTtcbiAgICBjb25zdCBwb2xpY3lDb3VudCA9IE9iamVjdC5rZXlzKHBvbGljaWVzKS5sZW5ndGg7XG4gICAgXG4gICAgLy8gU2hvdWxkIGhhdmUgbXVsdGlwbGUgcG9saWNpZXMgZm9yIExhbWJkYSBmdW5jdGlvbnNcbiAgICBleHBlY3QocG9saWN5Q291bnQpLnRvQmVHcmVhdGVyVGhhbigyKTtcbiAgICBcbiAgICAvLyBDaGVjayB0aGF0IHRoZXJlIGFyZSBwb2xpY2llcyB3aXRoIER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgY29uc3QgaGFzRHluYW1vRGJQb2xpY3kgPSBPYmplY3QudmFsdWVzKHBvbGljaWVzKS5zb21lKChwb2xpY3k6IGFueSkgPT4ge1xuICAgICAgcmV0dXJuIHBvbGljeS5Qcm9wZXJ0aWVzPy5Qb2xpY3lEb2N1bWVudD8uU3RhdGVtZW50Py5zb21lKChzdGF0ZW1lbnQ6IGFueSkgPT4ge1xuICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShzdGF0ZW1lbnQuQWN0aW9uKSAmJiBcbiAgICAgICAgICAgICAgIHN0YXRlbWVudC5BY3Rpb24uc29tZSgoYWN0aW9uOiBzdHJpbmcpID0+IGFjdGlvbi5zdGFydHNXaXRoKCdkeW5hbW9kYjonKSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBcbiAgICBleHBlY3QoaGFzRHluYW1vRGJQb2xpY3kpLnRvQmUodHJ1ZSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2hhcyBjb3JyZWN0IHN0YWNrIG91dHB1dHMnLCAoKSA9PiB7XG4gICAgLy8gQ2hlY2sgdGhhdCBvdXRwdXRzIGV4aXN0XG4gICAgY29uc3Qgb3V0cHV0cyA9IHRlbXBsYXRlLmZpbmRPdXRwdXRzKCcqJyk7XG4gICAgY29uc3Qgb3V0cHV0TmFtZXMgPSBPYmplY3Qua2V5cyhvdXRwdXRzKTtcbiAgICBcbiAgICBleHBlY3Qob3V0cHV0TmFtZXMpLnRvQ29udGFpbignQXVkaXRUYWJsZU5hbWUnKTtcbiAgICBleHBlY3Qob3V0cHV0TmFtZXMpLnRvQ29udGFpbignRXZlbnRJbmdlc3Rpb25GdW5jdGlvbkFybicpO1xuICAgIGV4cGVjdChvdXRwdXROYW1lcykudG9Db250YWluKCdRdWVyeUZ1bmN0aW9uQXJuJyk7XG4gICAgZXhwZWN0KG91dHB1dE5hbWVzKS50b0NvbnRhaW4oJ0F1ZGl0UHVibGlzaGVyUm9sZUFybicpO1xuICB9KTtcblxuICB0ZXN0KCdjb25maWd1cmVzIGRpZmZlcmVudCBzZXR0aW5ncyBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudCcsICgpID0+IHtcbiAgICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICAgIGNvbnN0IHByb2RTdGFjayA9IG5ldyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2soYXBwLCAnUHJvZEdhbWVBdWRpdFNlcnZpY2VTdGFjaycsIHtcbiAgICAgIGVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgYWNjb3VudElkOiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgIGxvZ1JldGVudGlvbkRheXM6IDI1NTUsXG4gICAgICBlbnY6IHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMSdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHByb2RUZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhwcm9kU3RhY2spO1xuXG4gICAgLy8gUHJvZHVjdGlvbiBzaG91bGQgbm90IGhhdmUgUHJvdmlzaW9uZWRUaHJvdWdocHV0ICh1c2VzIFBBWV9QRVJfUkVRVUVTVClcbiAgICBjb25zdCB0YWJsZVJlc291cmNlcyA9IHByb2RUZW1wbGF0ZS5maW5kUmVzb3VyY2VzKCdBV1M6OkR5bmFtb0RCOjpUYWJsZScpO1xuICAgIGNvbnN0IHRhYmxlUmVzb3VyY2UgPSBPYmplY3QudmFsdWVzKHRhYmxlUmVzb3VyY2VzKVswXSBhcyBhbnk7XG4gICAgXG4gICAgZXhwZWN0KHRhYmxlUmVzb3VyY2UuUHJvcGVydGllcy5Qcm92aXNpb25lZFRocm91Z2hwdXQpLnRvQmVVbmRlZmluZWQoKTtcblxuICAgIC8vIFByb2R1Y3Rpb24gZnVuY3Rpb25zIHNob3VsZCBoYXZlIG1vcmUgbWVtb3J5XG4gICAgcHJvZFRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnZ2FtZS1hdWRpdC1pbmdlc3Rpb24tcHJvZHVjdGlvbicsXG4gICAgICBNZW1vcnlTaXplOiA1MTIsXG4gICAgICBBcmNoaXRlY3R1cmVzOiBbJ2FybTY0J11cbiAgICB9KTtcbiAgfSk7XG59KTsiXX0=