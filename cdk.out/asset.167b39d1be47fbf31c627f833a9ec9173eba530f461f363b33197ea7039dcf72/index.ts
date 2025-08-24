import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { ScheduledEvent, Context, Handler } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new EventBridgeClient({});

interface AnomalyPattern {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  principalId?: string;
  count?: number;
  timeWindow?: string;
  details: Record<string, any>;
}

export const handler: Handler<ScheduledEvent, void> = async (
  _event: ScheduledEvent,
  _context: Context
): Promise<void> => {
  console.log('Starting anomaly detection analysis');
  
  const now = new Date();
  const analysisWindow = new Date(now.getTime() - (60 * 60 * 1000)); // Last hour
  const endTime = now.toISOString();
  const startTime = analysisWindow.toISOString();
  
  try {
    // Run all anomaly detection patterns
    const anomalies = await Promise.all([
      detectMultipleFailedLogins(startTime, endTime),
      detectUnusualIPActivity(startTime, endTime),
      detectPermissionEscalation(startTime, endTime),
      detectHighRiskEventSpikes(startTime, endTime),
      detectSuspiciousUserAgent(startTime, endTime)
    ]);
    
    // Flatten results
    const allAnomalies = anomalies.flat();
    
    if (allAnomalies.length > 0) {
      console.log(`Found ${allAnomalies.length} anomalies`);
      
      // Send anomaly events to EventBridge
      await sendAnomalyEvents(allAnomalies);
      
      // Log critical anomalies immediately
      const criticalAnomalies = allAnomalies.filter(a => a.severity === 'CRITICAL');
      if (criticalAnomalies.length > 0) {
        console.error(`CRITICAL ANOMALIES DETECTED:`, criticalAnomalies);
      }
    } else {
      console.log('No anomalies detected in the current time window');
    }
    
  } catch (error) {
    console.error('Anomaly detection failed:', error);
    throw error;
  }
};

async function detectMultipleFailedLogins(startTime: string, endTime: string): Promise<AnomalyPattern[]> {
  // Query for failed authentication events in time window
  const params = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    IndexName: 'ServiceEventTypeIndex',
    KeyConditionExpression: 'serviceName = :serviceName AND eventType = :eventType',
    FilterExpression: '#timestamp BETWEEN :startTime AND :endTime AND outcome = :outcome',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':serviceName': 'loupeen.auth',
      ':eventType': 'Authentication Event',
      ':startTime': startTime,
      ':endTime': endTime,
      ':outcome': 'FAILURE'
    }
  };
  
  const command = new QueryCommand(params);
  const response = await docClient.send(command);
  const failedLogins = response.Items || [];
  
  // Group by principal ID
  const loginAttempts = failedLogins.reduce((acc: Record<string, any[]>, item: any) => {
    const principalId = item.principalId || 'unknown';
    if (!acc[principalId]) acc[principalId] = [];
    acc[principalId].push(item);
    return acc;
  }, {});
  
  // Detect users with excessive failed attempts (>5 in an hour)
  const anomalies: AnomalyPattern[] = [];
  Object.entries(loginAttempts).forEach(([principalId, attempts]) => {
    if (attempts.length >= 5) {
      anomalies.push({
        type: 'excessive_failed_logins',
        severity: attempts.length >= 10 ? 'CRITICAL' : 'HIGH',
        description: `User ${principalId} had ${attempts.length} failed login attempts in the last hour`,
        principalId,
        count: attempts.length,
        timeWindow: '1 hour',
        details: {
          attempts: attempts.map(a => ({
            timestamp: a.timestamp,
            sourceIp: a.sourceIp,
            userAgent: a.userAgent
          }))
        }
      });
    }
  });
  
  return anomalies;
}

async function detectUnusualIPActivity(startTime: string, endTime: string): Promise<AnomalyPattern[]> {
  // Scan for events with IP addresses in time window
  const params = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    FilterExpression: '#timestamp BETWEEN :startTime AND :endTime AND attribute_exists(sourceIp)',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':startTime': startTime,
      ':endTime': endTime
    }
  };
  
  const command = new ScanCommand(params);
  const response = await docClient.send(command);
  const eventsWithIP = response.Items || [];
  
  // Group by IP and principal
  const ipActivity = eventsWithIP.reduce((acc: Record<string, any>, item: any) => {
    const ip = item.sourceIp;
    if (!acc[ip]) acc[ip] = { users: new Set(), events: [] };
    if (item.principalId) acc[ip].users.add(item.principalId);
    acc[ip].events.push(item);
    return acc;
  }, {});
  
  const anomalies: AnomalyPattern[] = [];
  
  // Detect IPs with multiple users (>3 users from same IP)
  Object.entries(ipActivity).forEach(([ip, activity]: [string, any]) => {
    if (activity.users.size >= 3) {
      anomalies.push({
        type: 'multiple_users_same_ip',
        severity: activity.users.size >= 5 ? 'HIGH' : 'MEDIUM',
        description: `IP ${ip} used by ${activity.users.size} different users`,
        count: activity.users.size,
        timeWindow: '1 hour',
        details: {
          ip,
          users: Array.from(activity.users),
          eventCount: activity.events.length
        }
      });
    }
  });
  
  return anomalies;
}

async function detectPermissionEscalation(startTime: string, endTime: string): Promise<AnomalyPattern[]> {
  // Query for authorization events that might indicate privilege escalation
  const params = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    IndexName: 'ServiceEventTypeIndex',
    KeyConditionExpression: 'serviceName = :serviceName AND eventType = :eventType',
    FilterExpression: '#timestamp BETWEEN :startTime AND :endTime AND (contains(action, :promote) OR contains(action, :grant) OR contains(action, :admin))',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':serviceName': 'loupeen.authz',
      ':eventType': 'Permission Change',
      ':startTime': startTime,
      ':endTime': endTime,
      ':promote': 'promote',
      ':grant': 'grant',
      ':admin': 'admin'
    }
  };
  
  const command = new QueryCommand(params);
  const response = await docClient.send(command);
  const permissionChanges = response.Items || [];
  
  const anomalies: AnomalyPattern[] = [];
  
  // Group by principal and look for rapid permission changes
  const permissionsByPrincipal = permissionChanges.reduce((acc: Record<string, any[]>, item: any) => {
    const principalId = item.principalId || 'unknown';
    if (!acc[principalId]) acc[principalId] = [];
    acc[principalId].push(item);
    return acc;
  }, {});
  
  Object.entries(permissionsByPrincipal).forEach(([principalId, changes]) => {
    if (changes.length >= 3) { // 3 or more permission changes in an hour
      anomalies.push({
        type: 'rapid_permission_changes',
        severity: 'HIGH',
        description: `User ${principalId} had ${changes.length} permission changes in the last hour`,
        principalId,
        count: changes.length,
        timeWindow: '1 hour',
        details: {
          changes: changes.map(c => ({
            timestamp: c.timestamp,
            action: c.action,
            outcome: c.outcome,
            resourceId: c.resourceId
          }))
        }
      });
    }
  });
  
  return anomalies;
}

async function detectHighRiskEventSpikes(startTime: string, endTime: string): Promise<AnomalyPattern[]> {
  // Query high-risk events
  const params = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    IndexName: 'RiskLevelTimeIndex',
    KeyConditionExpression: 'riskLevel = :riskLevel AND #timestamp BETWEEN :startTime AND :endTime',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':riskLevel': 'HIGH',
      ':startTime': startTime,
      ':endTime': endTime
    }
  };
  
  const command = new QueryCommand(params);
  const response = await docClient.send(command);
  const highRiskEvents = response.Items || [];
  
  const anomalies: AnomalyPattern[] = [];
  
  // If we have more than 10 high-risk events in an hour, that's suspicious
  if (highRiskEvents.length >= 10) {
    anomalies.push({
      type: 'high_risk_event_spike',
      severity: 'CRITICAL',
      description: `Unusual spike in high-risk events: ${highRiskEvents.length} events in the last hour`,
      count: highRiskEvents.length,
      timeWindow: '1 hour',
      details: {
        eventTypes: [...new Set(highRiskEvents.map(e => e.eventType))],
        services: [...new Set(highRiskEvents.map(e => e.serviceName))]
      }
    });
  }
  
  return anomalies;
}

async function detectSuspiciousUserAgent(startTime: string, endTime: string): Promise<AnomalyPattern[]> {
  // Look for suspicious user agent patterns
  const params = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    FilterExpression: '#timestamp BETWEEN :startTime AND :endTime AND attribute_exists(userAgent)',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':startTime': startTime,
      ':endTime': endTime
    }
  };
  
  const command = new ScanCommand(params);
  const response = await docClient.send(command);
  const eventsWithUserAgent = response.Items || [];
  
  const anomalies: AnomalyPattern[] = [];
  
  // Look for common automation/bot patterns
  const suspiciousPatterns = [
    'curl',
    'wget',
    'python-requests',
    'bot',
    'crawler',
    'scanner'
  ];
  
  eventsWithUserAgent.forEach(event => {
    const userAgent = event.userAgent?.toLowerCase() || '';
    const hasSuspiciousPattern = suspiciousPatterns.some(pattern => userAgent.includes(pattern));
    
    if (hasSuspiciousPattern) {
      anomalies.push({
        type: 'suspicious_user_agent',
        severity: 'MEDIUM',
        description: `Suspicious user agent detected: ${event.userAgent}`,
        principalId: event.principalId,
        timeWindow: '1 hour',
        details: {
          userAgent: event.userAgent,
          sourceIp: event.sourceIp,
          eventType: event.eventType,
          timestamp: event.timestamp
        }
      });
    }
  });
  
  return anomalies;
}

async function sendAnomalyEvents(anomalies: AnomalyPattern[]): Promise<void> {
  const events = anomalies.map(anomaly => ({
    Source: 'loupeen.security',
    DetailType: 'Anomaly Detection',
    Detail: JSON.stringify({
      ...anomaly,
      detectedAt: new Date().toISOString(),
      riskLevel: anomaly.severity
    }),
    Time: new Date()
  }));
  
  // Send in batches of 10 (EventBridge limit)
  const batches = [];
  for (let i = 0; i < events.length; i += 10) {
    batches.push(events.slice(i, i + 10));
  }
  
  for (const batch of batches) {
    const command = new PutEventsCommand({
      Entries: batch
    });
    
    await eventBridgeClient.send(command);
  }
  
  console.log(`Sent ${anomalies.length} anomaly events to EventBridge`);
}