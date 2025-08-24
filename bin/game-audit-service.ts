#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GameAuditServiceStack } from '../lib/game-audit-service-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || process.env.CDK_ENVIRONMENT || 'test';
const region = app.node.tryGetContext('region') || process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION;
const account = process.env.CDK_DEFAULT_ACCOUNT;

console.log(`🛡️ Deploying Game Audit Service to environment: ${environment}`);

try {
  const envConfigs: Record<string, any> = {
    test: {
      name: 'test',
      awsAccountId: '728427470046',
      primaryRegion: 'eu-north-1',
      secondaryRegions: [],
      logRetentionDays: 90,
      costBudget: { monthly: 50 }
    },
    qa: {
      name: 'qa',
      awsAccountId: '077029784291',
      primaryRegion: 'us-east-1',
      secondaryRegions: ['eu-central-1'],
      logRetentionDays: 180,
      costBudget: { monthly: 100 }
    },
    production: {
      name: 'production',
      awsAccountId: 'TBD',
      primaryRegion: 'us-east-1',
      secondaryRegions: ['eu-central-1', 'eu-north-1'],
      logRetentionDays: 2555, // 7 years for compliance
      costBudget: { monthly: 500 }
    }
  };

  const envConfig = envConfigs[environment] || envConfigs.test;
  
  console.log(`📋 Audit Service Configuration:`);
  console.log(`   Environment: ${envConfig.name}`);
  console.log(`   Account: ${envConfig.awsAccountId}`);
  console.log(`   Primary Region: ${envConfig.primaryRegion}`);
  console.log(`   Log Retention: ${envConfig.logRetentionDays} days`);
  console.log(`   Cost Budget: $${envConfig.costBudget.monthly}/month`);

  // Validate account if provided (skip in CI for synth validation)
  if (account && account !== envConfig.awsAccountId && !process.env.CI) {
    throw new Error(
      `❌ Account mismatch! Current account: ${account}, Expected for ${environment}: ${envConfig.awsAccountId}`
    );
  }

  // Determine deployment region
  const deploymentRegion = region || envConfig.primaryRegion;
  
  console.log(`🌍 Deploying to region: ${deploymentRegion}`);

  // Create the audit service stack
  const stackName = `GameAuditService-${environment}${region && region !== envConfig.primaryRegion ? `-${region}` : ''}`;
  
  new GameAuditServiceStack(app, stackName, {
    environment,
    region: deploymentRegion,
    accountId: envConfig.awsAccountId,
    logRetentionDays: envConfig.logRetentionDays,
    env: {
      account: envConfig.awsAccountId,
      region: deploymentRegion
    },
    description: `Game Audit Service for Loupeen RTS Platform (${environment})`,
    tags: {
      Environment: environment,
      Service: 'game-audit-service',
      Platform: 'loupeen-rts',
      CostCenter: envConfig.name,
      Repository: 'https://github.com/loupeen/game-audit-service',
      ManagedBy: 'CDK',
      SecurityLevel: 'high',
      DataClassification: 'confidential'
    }
  });

  console.log(`✅ Audit Service Stack configured: ${stackName}`);

} catch (error: any) {
  console.error('❌ Configuration Error:', error.message);
  console.log('\n🔧 Available environments: test, qa, production');
  console.log('💡 Usage examples:');
  console.log('   cdk deploy --context environment=test');
  console.log('   cdk deploy --context environment=qa --context region=us-east-1');
  console.log('   CDK_ENVIRONMENT=qa cdk deploy');
  process.exit(1);
}

// Add synth metadata
app.synth();