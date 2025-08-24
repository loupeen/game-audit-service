# Game Audit Service

Comprehensive audit trail service for the Loupeen RTS Platform. Captures all authentication and authorization events with real-time anomaly detection and querying capabilities.

## Overview

This service provides centralized audit logging for all authentication and authorization events across the Loupeen gaming platform. It includes automated anomaly detection to identify potential security threats and suspicious activities.

## Architecture

- **DynamoDB**: Event storage with optimized GSI indexes for querying
- **Lambda Functions**: Event ingestion, querying, and anomaly detection
- **EventBridge**: Real-time event streaming and rule-based processing
- **CloudWatch**: Monitoring, dashboards, and alerting

## Features

### ✅ Implemented
- Event ingestion with comprehensive validation
- Real-time audit event streaming via EventBridge
- Multi-index DynamoDB schema for efficient querying
- Anomaly detection algorithms for security monitoring
- CloudWatch integration for monitoring and alerting
- Multi-environment deployment support

### 🔄 In Progress
- API Gateway integration for query endpoints
- Advanced ML-based anomaly detection
- Cross-account log forwarding to Log Archive

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- AWS CDK v2
- AWS CLI configured with appropriate permissions

### Installation
```bash
npm install
```

### Development
```bash
# Build the project
npm run build

# Run tests
npm test

# Watch mode for development
npm run test:watch

# Lint code
npm run lint
```

### Deployment
```bash
# Deploy to test environment
cdk deploy --context environment=test

# Deploy to QA environment
cdk deploy --context environment=qa --context region=us-east-1
```

## Event Schema

Audit events follow this schema:
```typescript
interface AuditEvent {
  eventType: string;
  serviceName: string;
  principalId?: string;
  principalType?: 'user' | 'service' | 'system';
  resourceType?: string;
  resourceId?: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'ERROR';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: Record<string, unknown>;
  sourceIp?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}
```

## Query Capabilities

The service supports multiple query patterns:
- **By Principal**: Find all events for a specific user
- **By Service**: Query events from specific services
- **By Risk Level**: Filter by security risk classification
- **By Time Range**: Date/time-based filtering

## Anomaly Detection

Automated detection includes:
- Multiple failed login attempts
- Unusual IP address patterns
- Permission escalation attempts
- High-risk event spikes
- Suspicious user agent strings

## Architecture Decisions

- **ARM64 Lambda Functions**: 20% cost savings over x86
- **DynamoDB GSI Strategy**: Optimized for common query patterns
- **EventBridge Integration**: Decoupled event processing
- **Environment-specific Configuration**: Different retention and capacity settings

## Performance Targets

- Event ingestion: <100ms end-to-end
- Query response: <500ms for standard queries
- Anomaly detection: <5 minute detection window
- Storage retention: 3-12 months based on risk level

## Security

- All data encrypted at rest (AWS managed keys)
- IAM least-privilege access policies
- VPC integration for sensitive environments
- Audit trail immutability through DynamoDB

## Monitoring

- CloudWatch dashboard for operational metrics
- Automated alerts for critical anomalies
- Performance metrics tracking
- Cost monitoring and budgeting

For complete documentation, see: [claude-docs](https://github.com/loupeen/claude-docs)

## Repository

**Issue**: [#19 Create game-audit-service Repository](https://github.com/loupeen/claude-docs/issues/18)
**Epic**: Authentication & Authorization (#2)
**Status**: ✅ Complete