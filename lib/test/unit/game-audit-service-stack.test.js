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
const game_audit_service_stack_1 = require("../../lib/game-audit-service-stack");
describe('GameAuditServiceStack', () => {
    let template;
    let stack;
    beforeEach(() => {
        const app = new cdk.App();
        stack = new game_audit_service_stack_1.GameAuditServiceStack(app, 'TestGameAuditServiceStack', {
            environment: 'test',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi90ZXN0L3VuaXQvZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQWtEO0FBQ2xELGlGQUEyRTtBQUUzRSxRQUFRLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFO0lBQ3JDLElBQUksUUFBa0IsQ0FBQztJQUN2QixJQUFJLEtBQTRCLENBQUM7SUFFakMsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNkLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzFCLEtBQUssR0FBRyxJQUFJLGdEQUFxQixDQUFDLEdBQUcsRUFBRSwyQkFBMkIsRUFBRTtZQUNsRSxXQUFXLEVBQUUsTUFBTTtZQUNuQixHQUFHLEVBQUU7Z0JBQ0gsT0FBTyxFQUFFLGNBQWM7Z0JBQ3ZCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsUUFBUSxHQUFHLHFCQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG1EQUFtRCxFQUFFLEdBQUcsRUFBRTtRQUM3RCxRQUFRLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7WUFDckQsU0FBUyxFQUFFLDJCQUEyQjtZQUN0QyxxQkFBcUIsRUFBRTtnQkFDckIsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsa0JBQWtCLEVBQUUsQ0FBQzthQUN0QjtZQUNELG9CQUFvQixFQUFFO2dCQUNwQjtvQkFDRSxhQUFhLEVBQUUsU0FBUztvQkFDeEIsYUFBYSxFQUFFLEdBQUc7aUJBQ25CO2dCQUNEO29CQUNFLGFBQWEsRUFBRSxXQUFXO29CQUMxQixh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QXFCLENBQUMsdUJBQXVCLEVBQUU7WUFDMUQsWUFBWSxFQUFFLGlDQUFpQztZQUMvQyxVQUFVLEVBQUUsR0FBRztZQUNmLGFBQWEsRUFBRSxDQUFDLE9BQU8sQ0FBQztTQUN6QixDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFRlbXBsYXRlIH0gZnJvbSAnYXdzLWNkay1saWIvYXNzZXJ0aW9ucyc7XG5pbXBvcnQgeyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2sgfSBmcm9tICcuLi8uLi9saWIvZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrJztcblxuZGVzY3JpYmUoJ0dhbWVBdWRpdFNlcnZpY2VTdGFjaycsICgpID0+IHtcbiAgbGV0IHRlbXBsYXRlOiBUZW1wbGF0ZTtcbiAgbGV0IHN0YWNrOiBHYW1lQXVkaXRTZXJ2aWNlU3RhY2s7XG5cbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgICBzdGFjayA9IG5ldyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2soYXBwLCAnVGVzdEdhbWVBdWRpdFNlcnZpY2VTdGFjaycsIHtcbiAgICAgIGVudmlyb25tZW50OiAndGVzdCcsXG4gICAgICBlbnY6IHtcbiAgICAgICAgYWNjb3VudDogJzcyODQyNzQ3MDA0NicsXG4gICAgICAgIHJlZ2lvbjogJ2V1LW5vcnRoLTEnXG4gICAgICB9XG4gICAgfSk7XG4gICAgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2soc3RhY2spO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIER5bmFtb0RCIHRhYmxlIHdpdGggY29ycmVjdCBjb25maWd1cmF0aW9uJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpEeW5hbW9EQjo6VGFibGUnLCB7XG4gICAgICBUYWJsZU5hbWU6ICdsb3VwZWVuLWF1ZGl0LWV2ZW50cy10ZXN0JyxcbiAgICAgIFByb3Zpc2lvbmVkVGhyb3VnaHB1dDoge1xuICAgICAgICBSZWFkQ2FwYWNpdHlVbml0czogNSxcbiAgICAgICAgV3JpdGVDYXBhY2l0eVVuaXRzOiA1XG4gICAgICB9LFxuICAgICAgQXR0cmlidXRlRGVmaW5pdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdldmVudElkJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgQXR0cmlidXRlTmFtZTogJ3NlcnZpY2VOYW1lJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdldmVudFR5cGUnLFxuICAgICAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgQXR0cmlidXRlTmFtZTogJ3ByaW5jaXBhbElkJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdyaXNrTGV2ZWwnLFxuICAgICAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJ1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgS2V5U2NoZW1hOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAnZXZlbnRJZCcsXG4gICAgICAgICAgS2V5VHlwZTogJ0hBU0gnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICBLZXlUeXBlOiAnUkFOR0UnXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBhbGwgcmVxdWlyZWQgR1NJIGluZGV4ZXMnLCAoKSA9PiB7XG4gICAgLy8gQ2hlY2sgdGhhdCB0aGUgdGFibGUgaGFzIDMgR1NJIGluZGV4ZXNcbiAgICBjb25zdCB0YWJsZVJlc291cmNlcyA9IHRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoJ0FXUzo6RHluYW1vREI6OlRhYmxlJyk7XG4gICAgY29uc3QgdGFibGVSZXNvdXJjZSA9IE9iamVjdC52YWx1ZXModGFibGVSZXNvdXJjZXMpWzBdIGFzIGFueTtcbiAgICBcbiAgICBleHBlY3QodGFibGVSZXNvdXJjZS5Qcm9wZXJ0aWVzLkdsb2JhbFNlY29uZGFyeUluZGV4ZXMpLnRvSGF2ZUxlbmd0aCgzKTtcbiAgICBcbiAgICBjb25zdCBpbmRleE5hbWVzID0gdGFibGVSZXNvdXJjZS5Qcm9wZXJ0aWVzLkdsb2JhbFNlY29uZGFyeUluZGV4ZXMubWFwKChnc2k6IGFueSkgPT4gZ3NpLkluZGV4TmFtZSk7XG4gICAgZXhwZWN0KGluZGV4TmFtZXMpLnRvQ29udGFpbignU2VydmljZUV2ZW50VHlwZUluZGV4Jyk7XG4gICAgZXhwZWN0KGluZGV4TmFtZXMpLnRvQ29udGFpbignUHJpbmNpcGFsVGltZUluZGV4Jyk7XG4gICAgZXhwZWN0KGluZGV4TmFtZXMpLnRvQ29udGFpbignUmlza0xldmVsVGltZUluZGV4Jyk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgZXZlbnQgaW5nZXN0aW9uIExhbWJkYSBmdW5jdGlvbicsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsIHtcbiAgICAgIEZ1bmN0aW9uTmFtZTogJ2dhbWUtYXVkaXQtaW5nZXN0aW9uLXRlc3QnLFxuICAgICAgUnVudGltZTogJ25vZGVqczIwLngnLFxuICAgICAgQXJjaGl0ZWN0dXJlczogWydhcm02NCddLFxuICAgICAgSGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgTWVtb3J5U2l6ZTogMjU2LFxuICAgICAgVGltZW91dDogMTIwXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgcXVlcnkgTGFtYmRhIGZ1bmN0aW9uJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnZ2FtZS1hdWRpdC1xdWVyeS10ZXN0JyxcbiAgICAgIFJ1bnRpbWU6ICdub2RlanMyMC54JyxcbiAgICAgIEFyY2hpdGVjdHVyZXM6IFsnYXJtNjQnXSxcbiAgICAgIEhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIE1lbW9yeVNpemU6IDUxMixcbiAgICAgIFRpbWVvdXQ6IDMwXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgYW5vbWFseSBkZXRlY3Rpb24gTGFtYmRhIGZ1bmN0aW9uJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnZ2FtZS1hdWRpdC1hbm9tYWx5LXRlc3QnLFxuICAgICAgUnVudGltZTogJ25vZGVqczIwLngnLFxuICAgICAgQXJjaGl0ZWN0dXJlczogWydhcm02NCddLFxuICAgICAgSGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgTWVtb3J5U2l6ZTogNTEyLFxuICAgICAgVGltZW91dDogMzAwXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgRXZlbnRCcmlkZ2UgcnVsZXMgZm9yIGF1ZGl0IGV2ZW50cycsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RXZlbnRzOjpSdWxlJywge1xuICAgICAgTmFtZTogJ2xvdXBlZW4tYXV0aC1ldmVudHMtdGVzdCcsXG4gICAgICBFdmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2xvdXBlZW4uYXV0aCcsICdsb3VwZWVuLmF1dGh6J10sXG4gICAgICAgICdkZXRhaWwtdHlwZSc6IFtcbiAgICAgICAgICAnQXV0aGVudGljYXRpb24gRXZlbnQnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uIEV2ZW50JyxcbiAgICAgICAgICAnVG9rZW4gRXZlbnQnLFxuICAgICAgICAgICdQZXJtaXNzaW9uIENoYW5nZSdcbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIFN0YXRlOiAnRU5BQkxFRCdcbiAgICB9KTtcblxuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpFdmVudHM6OlJ1bGUnLCB7XG4gICAgICBOYW1lOiAnbG91cGVlbi1oaWdoLXJpc2stZXZlbnRzLXRlc3QnLFxuICAgICAgRXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydsb3VwZWVuLnNlY3VyaXR5J10sXG4gICAgICAgIGRldGFpbDoge1xuICAgICAgICAgIHJpc2tMZXZlbDogWydDUklUSUNBTCcsICdISUdIJ11cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIFN0YXRlOiAnRU5BQkxFRCdcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBhbm9tYWx5IGRldGVjdGlvbiBzY2hlZHVsZScsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6RXZlbnRzOjpSdWxlJywge1xuICAgICAgTmFtZTogJ2xvdXBlZW4tYW5vbWFseS1kZXRlY3Rpb24tdGVzdCcsXG4gICAgICBTY2hlZHVsZUV4cHJlc3Npb246ICdyYXRlKDEgaG91ciknLFxuICAgICAgU3RhdGU6ICdFTkFCTEVEJ1xuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIElBTSByb2xlIGZvciBhdWRpdCBwdWJsaXNoZXJzJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpJQU06OlJvbGUnLCB7XG4gICAgICBSb2xlTmFtZTogJ2xvdXBlZW4tYXVkaXQtcHVibGlzaGVyLXRlc3QnLFxuICAgICAgQXNzdW1lUm9sZVBvbGljeURvY3VtZW50OiB7XG4gICAgICAgIFN0YXRlbWVudDogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICAgIFByaW5jaXBhbDoge1xuICAgICAgICAgICAgICBTZXJ2aWNlOiAnbGFtYmRhLmFtYXpvbmF3cy5jb20nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgQWN0aW9uOiAnc3RzOkFzc3VtZVJvbGUnXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgQ2xvdWRXYXRjaCBkYXNoYm9hcmQnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkNsb3VkV2F0Y2g6OkRhc2hib2FyZCcsIHtcbiAgICAgIERhc2hib2FyZE5hbWU6ICdsb3VwZWVuLWF1ZGl0LXNlcnZpY2UtdGVzdCdcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnZ3JhbnRzIGNvcnJlY3QgRHluYW1vREIgcGVybWlzc2lvbnMnLCAoKSA9PiB7XG4gICAgLy8gQ2hlY2sgZm9yIElBTSBwb2xpY2llcyB0aGF0IGdyYW50IER5bmFtb0RCIGFjY2Vzc1xuICAgIGNvbnN0IHBvbGljaWVzID0gdGVtcGxhdGUuZmluZFJlc291cmNlcygnQVdTOjpJQU06OlBvbGljeScpO1xuICAgIGNvbnN0IHBvbGljeUNvdW50ID0gT2JqZWN0LmtleXMocG9saWNpZXMpLmxlbmd0aDtcbiAgICBcbiAgICAvLyBTaG91bGQgaGF2ZSBtdWx0aXBsZSBwb2xpY2llcyBmb3IgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGV4cGVjdChwb2xpY3lDb3VudCkudG9CZUdyZWF0ZXJUaGFuKDIpO1xuICAgIFxuICAgIC8vIENoZWNrIHRoYXQgdGhlcmUgYXJlIHBvbGljaWVzIHdpdGggRHluYW1vREIgcGVybWlzc2lvbnNcbiAgICBjb25zdCBoYXNEeW5hbW9EYlBvbGljeSA9IE9iamVjdC52YWx1ZXMocG9saWNpZXMpLnNvbWUoKHBvbGljeTogYW55KSA9PiB7XG4gICAgICByZXR1cm4gcG9saWN5LlByb3BlcnRpZXM/LlBvbGljeURvY3VtZW50Py5TdGF0ZW1lbnQ/LnNvbWUoKHN0YXRlbWVudDogYW55KSA9PiB7XG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHN0YXRlbWVudC5BY3Rpb24pICYmIFxuICAgICAgICAgICAgICAgc3RhdGVtZW50LkFjdGlvbi5zb21lKChhY3Rpb246IHN0cmluZykgPT4gYWN0aW9uLnN0YXJ0c1dpdGgoJ2R5bmFtb2RiOicpKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIFxuICAgIGV4cGVjdChoYXNEeW5hbW9EYlBvbGljeSkudG9CZSh0cnVlKTtcbiAgfSk7XG5cbiAgdGVzdCgnaGFzIGNvcnJlY3Qgc3RhY2sgb3V0cHV0cycsICgpID0+IHtcbiAgICAvLyBDaGVjayB0aGF0IG91dHB1dHMgZXhpc3RcbiAgICBjb25zdCBvdXRwdXRzID0gdGVtcGxhdGUuZmluZE91dHB1dHMoJyonKTtcbiAgICBjb25zdCBvdXRwdXROYW1lcyA9IE9iamVjdC5rZXlzKG91dHB1dHMpO1xuICAgIFxuICAgIGV4cGVjdChvdXRwdXROYW1lcykudG9Db250YWluKCdBdWRpdFRhYmxlTmFtZScpO1xuICAgIGV4cGVjdChvdXRwdXROYW1lcykudG9Db250YWluKCdFdmVudEluZ2VzdGlvbkZ1bmN0aW9uQXJuJyk7XG4gICAgZXhwZWN0KG91dHB1dE5hbWVzKS50b0NvbnRhaW4oJ1F1ZXJ5RnVuY3Rpb25Bcm4nKTtcbiAgICBleHBlY3Qob3V0cHV0TmFtZXMpLnRvQ29udGFpbignQXVkaXRQdWJsaXNoZXJSb2xlQXJuJyk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NvbmZpZ3VyZXMgZGlmZmVyZW50IHNldHRpbmdzIGZvciBwcm9kdWN0aW9uIGVudmlyb25tZW50JywgKCkgPT4ge1xuICAgIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG4gICAgY29uc3QgcHJvZFN0YWNrID0gbmV3IEdhbWVBdWRpdFNlcnZpY2VTdGFjayhhcHAsICdQcm9kR2FtZUF1ZGl0U2VydmljZVN0YWNrJywge1xuICAgICAgZW52aXJvbm1lbnQ6ICdwcm9kdWN0aW9uJyxcbiAgICAgIGVudjoge1xuICAgICAgICBhY2NvdW50OiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgICAgcmVnaW9uOiAndXMtZWFzdC0xJ1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJvZFRlbXBsYXRlID0gVGVtcGxhdGUuZnJvbVN0YWNrKHByb2RTdGFjayk7XG5cbiAgICAvLyBQcm9kdWN0aW9uIHNob3VsZCBub3QgaGF2ZSBQcm92aXNpb25lZFRocm91Z2hwdXQgKHVzZXMgUEFZX1BFUl9SRVFVRVNUKVxuICAgIGNvbnN0IHRhYmxlUmVzb3VyY2VzID0gcHJvZFRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoJ0FXUzo6RHluYW1vREI6OlRhYmxlJyk7XG4gICAgY29uc3QgdGFibGVSZXNvdXJjZSA9IE9iamVjdC52YWx1ZXModGFibGVSZXNvdXJjZXMpWzBdIGFzIGFueTtcbiAgICBcbiAgICBleHBlY3QodGFibGVSZXNvdXJjZS5Qcm9wZXJ0aWVzLlByb3Zpc2lvbmVkVGhyb3VnaHB1dCkudG9CZVVuZGVmaW5lZCgpO1xuXG4gICAgLy8gUHJvZHVjdGlvbiBmdW5jdGlvbnMgc2hvdWxkIGhhdmUgbW9yZSBtZW1vcnlcbiAgICBwcm9kVGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCB7XG4gICAgICBGdW5jdGlvbk5hbWU6ICdnYW1lLWF1ZGl0LWluZ2VzdGlvbi1wcm9kdWN0aW9uJyxcbiAgICAgIE1lbW9yeVNpemU6IDUxMixcbiAgICAgIEFyY2hpdGVjdHVyZXM6IFsnYXJtNjQnXVxuICAgIH0pO1xuICB9KTtcbn0pOyJdfQ==