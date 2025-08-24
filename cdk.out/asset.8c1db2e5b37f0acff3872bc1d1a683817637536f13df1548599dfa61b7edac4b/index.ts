import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeEvent, Context, Handler } from 'aws-lambda';
import { z } from 'zod';
import crypto from 'crypto';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const AuditEventSchema = z.object({
  eventType: z.string(),
  serviceName: z.string(),
  principalId: z.string().optional(),
  principalType: z.enum(['user', 'service', 'system']).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  action: z.string(),
  outcome: z.enum(['SUCCESS', 'FAILURE', 'ERROR']),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  details: z.record(z.unknown()).optional(),
  sourceIp: z.string().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  requestId: z.string().optional()
});

type AuditEvent = z.infer<typeof AuditEventSchema>;

interface AuditEventRecord {
  eventId: string;
  timestamp: string;
  eventType: string;
  serviceName: string;
  principalId?: string;
  principalType?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  outcome: string;
  riskLevel: string;
  details?: Record<string, unknown>;
  sourceIp?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  ingestionTime: string;
  ttl?: number;
}

export const handler: Handler<EventBridgeEvent<string, AuditEvent>, void> = async (
  event: EventBridgeEvent<string, AuditEvent>,
  context: Context
): Promise<void> => {
  console.log('Processing audit event:', JSON.stringify(event, null, 2));
  
  try {
    // Validate the event detail
    const auditEvent = AuditEventSchema.parse(event.detail);
    
    // Generate unique event ID
    const eventId = crypto.randomUUID();
    const timestamp = new Date(event.time).toISOString();
    const ingestionTime = new Date().toISOString();
    
    // Calculate TTL (optional data retention)
    const environment = process.env.ENVIRONMENT || 'test';
    let ttl: number | undefined;
    
    // Set TTL based on environment and risk level
    if (environment !== 'production') {
      const retentionMonths = auditEvent.riskLevel === 'CRITICAL' ? 12 : 
                              auditEvent.riskLevel === 'HIGH' ? 6 : 3;
      const ttlDate = new Date();
      ttlDate.setMonth(ttlDate.getMonth() + retentionMonths);
      ttl = Math.floor(ttlDate.getTime() / 1000);
    }
    
    // Create audit record
    const auditRecord: AuditEventRecord = {
      eventId,
      timestamp,
      eventType: auditEvent.eventType,
      serviceName: auditEvent.serviceName,
      principalId: auditEvent.principalId,
      principalType: auditEvent.principalType,
      resourceType: auditEvent.resourceType,
      resourceId: auditEvent.resourceId,
      action: auditEvent.action,
      outcome: auditEvent.outcome,
      riskLevel: auditEvent.riskLevel,
      details: auditEvent.details,
      sourceIp: auditEvent.sourceIp,
      userAgent: auditEvent.userAgent,
      sessionId: auditEvent.sessionId,
      requestId: auditEvent.requestId || context.awsRequestId,
      ingestionTime,
      ...(ttl && { ttl })
    };
    
    // Store in DynamoDB
    const command = new PutCommand({
      TableName: process.env.AUDIT_TABLE_NAME!,
      Item: auditRecord
    });
    
    await docClient.send(command);
    
    console.log(`Audit event stored successfully: ${eventId}`);
    
    // Log high-risk events for immediate attention
    if (auditEvent.riskLevel === 'CRITICAL' || auditEvent.riskLevel === 'HIGH') {
      console.warn(`HIGH-RISK AUDIT EVENT: ${auditEvent.eventType} - ${auditEvent.action}`, {
        eventId,
        principalId: auditEvent.principalId,
        riskLevel: auditEvent.riskLevel,
        outcome: auditEvent.outcome,
        details: auditEvent.details
      });
    }
    
  } catch (error) {
    console.error('Failed to process audit event:', error);
    console.error('Event details:', JSON.stringify(event, null, 2));
    
    // For critical errors, we might want to send to DLQ or SNS topic
    throw error; // This will trigger retry logic
  }
};