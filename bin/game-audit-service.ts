#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GameAuditServiceStack } from '../lib/game-audit-service-stack';

const app = new cdk.App();

// Get environment from context or default to 'test'
const environment = app.node.tryGetContext('environment') || 'test';

// Environment configuration
const envConfigs: Record<string, { awsAccountId: string; primaryRegion: string }> = {
  test: {
    awsAccountId: '728427470046',
    primaryRegion: 'eu-north-1'
  },
  qa: {
    awsAccountId: '077029784291', 
    primaryRegion: 'us-east-1'
  },
  production: {
    awsAccountId: '999999999999',
    primaryRegion: 'us-east-1'
  }
};

const envConfig = envConfigs[environment] || envConfigs.test;

new GameAuditServiceStack(app, `GameAuditService-${environment}`, {
  env: {
    account: envConfig.awsAccountId,
    region: envConfig.primaryRegion
  },
  environment,
  description: `Audit service for Loupeen RTS Platform (${environment})`
});