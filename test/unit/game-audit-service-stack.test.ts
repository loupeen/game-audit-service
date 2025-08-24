import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { GameAuditServiceStack } from '../../lib/game-audit-service-stack';

describe('GameAuditServiceStack', () => {
  let template: Template;
  let stack: GameAuditServiceStack;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new GameAuditServiceStack(app, 'TestGameAuditServiceStack', {
      environment: 'test',
      env: {
        account: '728427470046',
        region: 'eu-north-1'
      }
    });
    template = Template.fromStack(stack);
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
    const tableResource = Object.values(tableResources)[0] as any;
    
    expect(tableResource.Properties.GlobalSecondaryIndexes).toHaveLength(3);
    
    const indexNames = tableResource.Properties.GlobalSecondaryIndexes.map((gsi: any) => gsi.IndexName);
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
    const hasDynamoDbPolicy = Object.values(policies).some((policy: any) => {
      return policy.Properties?.PolicyDocument?.Statement?.some((statement: any) => {
        return Array.isArray(statement.Action) && 
               statement.Action.some((action: string) => action.startsWith('dynamodb:'));
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
    const prodStack = new GameAuditServiceStack(app, 'ProdGameAuditServiceStack', {
      environment: 'production',
      env: {
        account: '123456789012',
        region: 'us-east-1'
      }
    });

    const prodTemplate = Template.fromStack(prodStack);

    // Production should not have ProvisionedThroughput (uses PAY_PER_REQUEST)
    const tableResources = prodTemplate.findResources('AWS::DynamoDB::Table');
    const tableResource = Object.values(tableResources)[0] as any;
    
    expect(tableResource.Properties.ProvisionedThroughput).toBeUndefined();

    // Production functions should have more memory
    prodTemplate.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'game-audit-ingestion-production',
      MemorySize: 512,
      Architectures: ['arm64']
    });
  });
});