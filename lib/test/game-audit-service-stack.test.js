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
            BillingMode: 'PROVISIONED',
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
        // Service Event Type Index
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'ServiceEventTypeIndex',
                    KeySchema: [
                        {
                            AttributeName: 'serviceName',
                            KeyType: 'HASH'
                        },
                        {
                            AttributeName: 'eventType',
                            KeyType: 'RANGE'
                        }
                    ],
                    ProjectionType: 'ALL'
                },
                {
                    IndexName: 'PrincipalTimeIndex',
                    KeySchema: [
                        {
                            AttributeName: 'principalId',
                            KeyType: 'HASH'
                        },
                        {
                            AttributeName: 'timestamp',
                            KeyType: 'RANGE'
                        }
                    ],
                    ProjectionType: 'ALL'
                },
                {
                    IndexName: 'RiskLevelTimeIndex',
                    KeySchema: [
                        {
                            AttributeName: 'riskLevel',
                            KeyType: 'HASH'
                        },
                        {
                            AttributeName: 'timestamp',
                            KeyType: 'RANGE'
                        }
                    ],
                    ProjectionType: 'ALL'
                }
            ]
        });
    });
    test('creates event ingestion Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-ingestion-test',
            Runtime: 'nodejs20.x',
            Architecture: 'arm64',
            Handler: 'index.handler',
            MemorySize: 256,
            Timeout: 120
        });
    });
    test('creates query Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-query-test',
            Runtime: 'nodejs20.x',
            Architecture: 'arm64',
            Handler: 'index.handler',
            MemorySize: 512,
            Timeout: 30
        });
    });
    test('creates anomaly detection Lambda function', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-anomaly-test',
            Runtime: 'nodejs20.x',
            Architecture: 'arm64',
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
        // Check that ingestion function has write permissions
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            'dynamodb:BatchWriteItem',
                            'dynamodb:PutItem',
                            'dynamodb:UpdateItem',
                            'dynamodb:DeleteItem'
                        ],
                        Resource: [
                            {
                                'Fn::GetAtt': [
                                    'AuditEventsTable',
                                    'Arn'
                                ]
                            }
                        ]
                    }
                ]
            }
        });
        // Check that query function has read permissions
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            'dynamodb:BatchGetItem',
                            'dynamodb:GetRecords',
                            'dynamodb:GetShardIterator',
                            'dynamodb:Query',
                            'dynamodb:GetItem',
                            'dynamodb:Scan',
                            'dynamodb:ConditionCheckItem'
                        ],
                        Resource: [
                            {
                                'Fn::GetAtt': [
                                    'AuditEventsTable',
                                    'Arn'
                                ]
                            },
                            {
                                'Fn::Join': [
                                    '',
                                    [
                                        {
                                            'Fn::GetAtt': [
                                                'AuditEventsTable',
                                                'Arn'
                                            ]
                                        },
                                        '/index/*'
                                    ]
                                ]
                            }
                        ]
                    }
                ]
            }
        });
    });
    test('has correct stack outputs', () => {
        template.hasOutput('AuditTableName', {
            Value: {
                Ref: 'AuditEventsTable'
            }
        });
        template.hasOutput('EventIngestionFunctionArn', {
            Value: {
                'Fn::GetAtt': [
                    'EventIngestionFunction',
                    'Arn'
                ]
            }
        });
        template.hasOutput('QueryFunctionArn', {
            Value: {
                'Fn::GetAtt': [
                    'QueryFunction',
                    'Arn'
                ]
            }
        });
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
        // Production should use PAY_PER_REQUEST billing
        prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
            BillingMode: 'PAY_PER_REQUEST'
        });
        // Production functions should have more memory
        prodTemplate.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'game-audit-ingestion-production',
            MemorySize: 512
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi90ZXN0L2dhbWUtYXVkaXQtc2VydmljZS1zdGFjay50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVEQUFrRDtBQUNsRCw4RUFBd0U7QUFFeEUsUUFBUSxDQUFDLHVCQUF1QixFQUFFLEdBQUcsRUFBRTtJQUNyQyxJQUFJLFFBQWtCLENBQUM7SUFDdkIsSUFBSSxLQUE0QixDQUFDO0lBRWpDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUMxQixLQUFLLEdBQUcsSUFBSSxnREFBcUIsQ0FBQyxHQUFHLEVBQUUsMkJBQTJCLEVBQUU7WUFDbEUsV0FBVyxFQUFFLE1BQU07WUFDbkIsTUFBTSxFQUFFLFlBQVk7WUFDcEIsU0FBUyxFQUFFLGNBQWM7WUFDekIsZ0JBQWdCLEVBQUUsRUFBRTtZQUNwQixHQUFHLEVBQUU7Z0JBQ0gsT0FBTyxFQUFFLGNBQWM7Z0JBQ3ZCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsUUFBUSxHQUFHLHFCQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG1EQUFtRCxFQUFFLEdBQUcsRUFBRTtRQUM3RCxRQUFRLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7WUFDckQsU0FBUyxFQUFFLDJCQUEyQjtZQUN0QyxXQUFXLEVBQUUsYUFBYTtZQUMxQixvQkFBb0IsRUFBRTtnQkFDcEI7b0JBQ0UsYUFBYSxFQUFFLFNBQVM7b0JBQ3hCLGFBQWEsRUFBRSxHQUFHO2lCQUNuQjtnQkFDRDtvQkFDRSxhQUFhLEVBQUUsV0FBVztv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LENBQUMsQ0FBQztRQUVILE1BQU0sWUFBWSxHQUFHLHFCQUFRLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRW5ELGdEQUFnRDtRQUNoRCxZQUFZLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7WUFDekQsV0FBVyxFQUFFLGlCQUFpQjtTQUMvQixDQUFDLENBQUM7UUFFSCwrQ0FBK0M7UUFDL0MsWUFBWSxDQUFDLHFCQUFxQixDQUFDLHVCQUF1QixFQUFFO1lBQzFELFlBQVksRUFBRSxpQ0FBaUM7WUFDL0MsVUFBVSxFQUFFLEdBQUc7U0FDaEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBUZW1wbGF0ZSB9IGZyb20gJ2F3cy1jZGstbGliL2Fzc2VydGlvbnMnO1xuaW1wb3J0IHsgR2FtZUF1ZGl0U2VydmljZVN0YWNrIH0gZnJvbSAnLi4vbGliL2dhbWUtYXVkaXQtc2VydmljZS1zdGFjayc7XG5cbmRlc2NyaWJlKCdHYW1lQXVkaXRTZXJ2aWNlU3RhY2snLCAoKSA9PiB7XG4gIGxldCB0ZW1wbGF0ZTogVGVtcGxhdGU7XG4gIGxldCBzdGFjazogR2FtZUF1ZGl0U2VydmljZVN0YWNrO1xuXG4gIGJlZm9yZUVhY2goKCkgPT4ge1xuICAgIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG4gICAgc3RhY2sgPSBuZXcgR2FtZUF1ZGl0U2VydmljZVN0YWNrKGFwcCwgJ1Rlc3RHYW1lQXVkaXRTZXJ2aWNlU3RhY2snLCB7XG4gICAgICBlbnZpcm9ubWVudDogJ3Rlc3QnLFxuICAgICAgcmVnaW9uOiAnZXUtbm9ydGgtMScsXG4gICAgICBhY2NvdW50SWQ6ICc3Mjg0Mjc0NzAwNDYnLFxuICAgICAgbG9nUmV0ZW50aW9uRGF5czogOTAsXG4gICAgICBlbnY6IHtcbiAgICAgICAgYWNjb3VudDogJzcyODQyNzQ3MDA0NicsXG4gICAgICAgIHJlZ2lvbjogJ2V1LW5vcnRoLTEnXG4gICAgICB9XG4gICAgfSk7XG4gICAgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2soc3RhY2spO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIER5bmFtb0RCIHRhYmxlIHdpdGggY29ycmVjdCBjb25maWd1cmF0aW9uJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpEeW5hbW9EQjo6VGFibGUnLCB7XG4gICAgICBUYWJsZU5hbWU6ICdsb3VwZWVuLWF1ZGl0LWV2ZW50cy10ZXN0JyxcbiAgICAgIEJpbGxpbmdNb2RlOiAnUFJPVklTSU9ORUQnLFxuICAgICAgQXR0cmlidXRlRGVmaW5pdGlvbnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdldmVudElkJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICd0aW1lc3RhbXAnLFxuICAgICAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgQXR0cmlidXRlTmFtZTogJ3NlcnZpY2VOYW1lJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdldmVudFR5cGUnLFxuICAgICAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgQXR0cmlidXRlTmFtZTogJ3ByaW5jaXBhbElkJyxcbiAgICAgICAgICBBdHRyaWJ1dGVUeXBlOiAnUydcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdyaXNrTGV2ZWwnLFxuICAgICAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJ1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgS2V5U2NoZW1hOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAnZXZlbnRJZCcsXG4gICAgICAgICAgS2V5VHlwZTogJ0hBU0gnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICBLZXlUeXBlOiAnUkFOR0UnXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBhbGwgcmVxdWlyZWQgR1NJIGluZGV4ZXMnLCAoKSA9PiB7XG4gICAgLy8gU2VydmljZSBFdmVudCBUeXBlIEluZGV4XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkR5bmFtb0RCOjpUYWJsZScsIHtcbiAgICAgIEdsb2JhbFNlY29uZGFyeUluZGV4ZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIEluZGV4TmFtZTogJ1NlcnZpY2VFdmVudFR5cGVJbmRleCcsXG4gICAgICAgICAgS2V5U2NoZW1hOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIEF0dHJpYnV0ZU5hbWU6ICdzZXJ2aWNlTmFtZScsXG4gICAgICAgICAgICAgIEtleVR5cGU6ICdIQVNIJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgQXR0cmlidXRlTmFtZTogJ2V2ZW50VHlwZScsXG4gICAgICAgICAgICAgIEtleVR5cGU6ICdSQU5HRSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBdLFxuICAgICAgICAgIFByb2plY3Rpb25UeXBlOiAnQUxMJ1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgSW5kZXhOYW1lOiAnUHJpbmNpcGFsVGltZUluZGV4JyxcbiAgICAgICAgICBLZXlTY2hlbWE6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgQXR0cmlidXRlTmFtZTogJ3ByaW5jaXBhbElkJyxcbiAgICAgICAgICAgICAgS2V5VHlwZTogJ0hBU0gnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICAgICAgS2V5VHlwZTogJ1JBTkdFJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgIF0sXG4gICAgICAgICAgUHJvamVjdGlvblR5cGU6ICdBTEwnXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBJbmRleE5hbWU6ICdSaXNrTGV2ZWxUaW1lSW5kZXgnLFxuICAgICAgICAgIEtleVNjaGVtYTogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAncmlza0xldmVsJyxcbiAgICAgICAgICAgICAgS2V5VHlwZTogJ0hBU0gnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBBdHRyaWJ1dGVOYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICAgICAgS2V5VHlwZTogJ1JBTkdFJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgIF0sXG4gICAgICAgICAgUHJvamVjdGlvblR5cGU6ICdBTEwnXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBldmVudCBpbmdlc3Rpb24gTGFtYmRhIGZ1bmN0aW9uJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnZ2FtZS1hdWRpdC1pbmdlc3Rpb24tdGVzdCcsXG4gICAgICBSdW50aW1lOiAnbm9kZWpzMjAueCcsXG4gICAgICBBcmNoaXRlY3R1cmU6ICdhcm02NCcsXG4gICAgICBIYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBNZW1vcnlTaXplOiAyNTYsXG4gICAgICBUaW1lb3V0OiAxMjBcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBxdWVyeSBMYW1iZGEgZnVuY3Rpb24nLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCB7XG4gICAgICBGdW5jdGlvbk5hbWU6ICdnYW1lLWF1ZGl0LXF1ZXJ5LXRlc3QnLFxuICAgICAgUnVudGltZTogJ25vZGVqczIwLngnLFxuICAgICAgQXJjaGl0ZWN0dXJlOiAnYXJtNjQnLFxuICAgICAgSGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgTWVtb3J5U2l6ZTogNTEyLFxuICAgICAgVGltZW91dDogMzBcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBhbm9tYWx5IGRldGVjdGlvbiBMYW1iZGEgZnVuY3Rpb24nLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCB7XG4gICAgICBGdW5jdGlvbk5hbWU6ICdnYW1lLWF1ZGl0LWFub21hbHktdGVzdCcsXG4gICAgICBSdW50aW1lOiAnbm9kZWpzMjAueCcsXG4gICAgICBBcmNoaXRlY3R1cmU6ICdhcm02NCcsXG4gICAgICBIYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBNZW1vcnlTaXplOiA1MTIsXG4gICAgICBUaW1lb3V0OiAzMDBcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBFdmVudEJyaWRnZSBydWxlcyBmb3IgYXVkaXQgZXZlbnRzJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpFdmVudHM6OlJ1bGUnLCB7XG4gICAgICBOYW1lOiAnbG91cGVlbi1hdXRoLWV2ZW50cy10ZXN0JyxcbiAgICAgIEV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnbG91cGVlbi5hdXRoJywgJ2xvdXBlZW4uYXV0aHonXSxcbiAgICAgICAgJ2RldGFpbC10eXBlJzogW1xuICAgICAgICAgICdBdXRoZW50aWNhdGlvbiBFdmVudCcsXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24gRXZlbnQnLFxuICAgICAgICAgICdUb2tlbiBFdmVudCcsXG4gICAgICAgICAgJ1Blcm1pc3Npb24gQ2hhbmdlJ1xuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgU3RhdGU6ICdFTkFCTEVEJ1xuICAgIH0pO1xuXG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkV2ZW50czo6UnVsZScsIHtcbiAgICAgIE5hbWU6ICdsb3VwZWVuLWhpZ2gtcmlzay1ldmVudHMtdGVzdCcsXG4gICAgICBFdmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2xvdXBlZW4uc2VjdXJpdHknXSxcbiAgICAgICAgZGV0YWlsOiB7XG4gICAgICAgICAgcmlza0xldmVsOiBbJ0NSSVRJQ0FMJywgJ0hJR0gnXVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgU3RhdGU6ICdFTkFCTEVEJ1xuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdjcmVhdGVzIGFub21hbHkgZGV0ZWN0aW9uIHNjaGVkdWxlJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpFdmVudHM6OlJ1bGUnLCB7XG4gICAgICBOYW1lOiAnbG91cGVlbi1hbm9tYWx5LWRldGVjdGlvbi10ZXN0JyxcbiAgICAgIFNjaGVkdWxlRXhwcmVzc2lvbjogJ3JhdGUoMSBob3VyKScsXG4gICAgICBTdGF0ZTogJ0VOQUJMRUQnXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ2NyZWF0ZXMgSUFNIHJvbGUgZm9yIGF1ZGl0IHB1Ymxpc2hlcnMnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OklBTTo6Um9sZScsIHtcbiAgICAgIFJvbGVOYW1lOiAnbG91cGVlbi1hdWRpdC1wdWJsaXNoZXItdGVzdCcsXG4gICAgICBBc3N1bWVSb2xlUG9saWN5RG9jdW1lbnQ6IHtcbiAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgRWZmZWN0OiAnQWxsb3cnLFxuICAgICAgICAgICAgUHJpbmNpcGFsOiB7XG4gICAgICAgICAgICAgIFNlcnZpY2U6ICdsYW1iZGEuYW1hem9uYXdzLmNvbSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBBY3Rpb246ICdzdHM6QXNzdW1lUm9sZSdcbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnY3JlYXRlcyBDbG91ZFdhdGNoIGRhc2hib2FyZCcsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6Q2xvdWRXYXRjaDo6RGFzaGJvYXJkJywge1xuICAgICAgRGFzaGJvYXJkTmFtZTogJ2xvdXBlZW4tYXVkaXQtc2VydmljZS10ZXN0J1xuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdncmFudHMgY29ycmVjdCBEeW5hbW9EQiBwZXJtaXNzaW9ucycsICgpID0+IHtcbiAgICAvLyBDaGVjayB0aGF0IGluZ2VzdGlvbiBmdW5jdGlvbiBoYXMgd3JpdGUgcGVybWlzc2lvbnNcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6SUFNOjpQb2xpY3knLCB7XG4gICAgICBQb2xpY3lEb2N1bWVudDoge1xuICAgICAgICBTdGF0ZW1lbnQ6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBFZmZlY3Q6ICdBbGxvdycsXG4gICAgICAgICAgICBBY3Rpb246IFtcbiAgICAgICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJyxcbiAgICAgICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJ1xuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFJlc291cmNlOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAnRm46OkdldEF0dCc6IFtcbiAgICAgICAgICAgICAgICAgICdBdWRpdEV2ZW50c1RhYmxlJyxcbiAgICAgICAgICAgICAgICAgICdBcm4nXG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDaGVjayB0aGF0IHF1ZXJ5IGZ1bmN0aW9uIGhhcyByZWFkIHBlcm1pc3Npb25zXG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OklBTTo6UG9saWN5Jywge1xuICAgICAgUG9saWN5RG9jdW1lbnQ6IHtcbiAgICAgICAgU3RhdGVtZW50OiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgRWZmZWN0OiAnQWxsb3cnLFxuICAgICAgICAgICAgQWN0aW9uOiBbXG4gICAgICAgICAgICAgICdkeW5hbW9kYjpCYXRjaEdldEl0ZW0nLFxuICAgICAgICAgICAgICAnZHluYW1vZGI6R2V0UmVjb3JkcycsXG4gICAgICAgICAgICAgICdkeW5hbW9kYjpHZXRTaGFyZEl0ZXJhdG9yJyxcbiAgICAgICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxuICAgICAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgICAgICAgICdkeW5hbW9kYjpDb25kaXRpb25DaGVja0l0ZW0nXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgUmVzb3VyY2U6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICdGbjo6R2V0QXR0JzogW1xuICAgICAgICAgICAgICAgICAgJ0F1ZGl0RXZlbnRzVGFibGUnLFxuICAgICAgICAgICAgICAgICAgJ0FybidcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAnRm46OkpvaW4nOiBbXG4gICAgICAgICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICdGbjo6R2V0QXR0JzogW1xuICAgICAgICAgICAgICAgICAgICAgICAgJ0F1ZGl0RXZlbnRzVGFibGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0FybidcbiAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICcvaW5kZXgvKidcbiAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnaGFzIGNvcnJlY3Qgc3RhY2sgb3V0cHV0cycsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNPdXRwdXQoJ0F1ZGl0VGFibGVOYW1lJywge1xuICAgICAgVmFsdWU6IHtcbiAgICAgICAgUmVmOiAnQXVkaXRFdmVudHNUYWJsZSdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRlbXBsYXRlLmhhc091dHB1dCgnRXZlbnRJbmdlc3Rpb25GdW5jdGlvbkFybicsIHtcbiAgICAgIFZhbHVlOiB7XG4gICAgICAgICdGbjo6R2V0QXR0JzogW1xuICAgICAgICAgICdFdmVudEluZ2VzdGlvbkZ1bmN0aW9uJyxcbiAgICAgICAgICAnQXJuJ1xuICAgICAgICBdXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0ZW1wbGF0ZS5oYXNPdXRwdXQoJ1F1ZXJ5RnVuY3Rpb25Bcm4nLCB7XG4gICAgICBWYWx1ZToge1xuICAgICAgICAnRm46OkdldEF0dCc6IFtcbiAgICAgICAgICAnUXVlcnlGdW5jdGlvbicsXG4gICAgICAgICAgJ0FybidcbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdjb25maWd1cmVzIGRpZmZlcmVudCBzZXR0aW5ncyBmb3IgcHJvZHVjdGlvbiBlbnZpcm9ubWVudCcsICgpID0+IHtcbiAgICBjb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuICAgIGNvbnN0IHByb2RTdGFjayA9IG5ldyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2soYXBwLCAnUHJvZEdhbWVBdWRpdFNlcnZpY2VTdGFjaycsIHtcbiAgICAgIGVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXG4gICAgICByZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgYWNjb3VudElkOiAnMTIzNDU2Nzg5MDEyJyxcbiAgICAgIGxvZ1JldGVudGlvbkRheXM6IDI1NTUsXG4gICAgICBlbnY6IHtcbiAgICAgICAgYWNjb3VudDogJzEyMzQ1Njc4OTAxMicsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMSdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHByb2RUZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhwcm9kU3RhY2spO1xuXG4gICAgLy8gUHJvZHVjdGlvbiBzaG91bGQgdXNlIFBBWV9QRVJfUkVRVUVTVCBiaWxsaW5nXG4gICAgcHJvZFRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpEeW5hbW9EQjo6VGFibGUnLCB7XG4gICAgICBCaWxsaW5nTW9kZTogJ1BBWV9QRVJfUkVRVUVTVCdcbiAgICB9KTtcblxuICAgIC8vIFByb2R1Y3Rpb24gZnVuY3Rpb25zIHNob3VsZCBoYXZlIG1vcmUgbWVtb3J5XG4gICAgcHJvZFRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpMYW1iZGE6OkZ1bmN0aW9uJywge1xuICAgICAgRnVuY3Rpb25OYW1lOiAnZ2FtZS1hdWRpdC1pbmdlc3Rpb24tcHJvZHVjdGlvbicsXG4gICAgICBNZW1vcnlTaXplOiA1MTJcbiAgICB9KTtcbiAgfSk7XG59KTsiXX0=