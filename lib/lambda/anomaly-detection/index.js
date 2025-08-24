"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_eventbridge_1 = require("@aws-sdk/client-eventbridge");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = new client_eventbridge_1.EventBridgeClient({});
const handler = async (event, context) => {
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
        }
        else {
            console.log('No anomalies detected in the current time window');
        }
    }
    catch (error) {
        console.error('Anomaly detection failed:', error);
        throw error;
    }
};
exports.handler = handler;
async function detectMultipleFailedLogins(startTime, endTime) {
    // Query for failed authentication events in time window
    const params = {
        TableName: process.env.AUDIT_TABLE_NAME,
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
    const command = new lib_dynamodb_1.QueryCommand(params);
    const response = await docClient.send(command);
    const failedLogins = response.Items || [];
    // Group by principal ID
    const loginAttempts = failedLogins.reduce((acc, item) => {
        const principalId = item.principalId || 'unknown';
        if (!acc[principalId])
            acc[principalId] = [];
        acc[principalId].push(item);
        return acc;
    }, {});
    // Detect users with excessive failed attempts (>5 in an hour)
    const anomalies = [];
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
async function detectUnusualIPActivity(startTime, endTime) {
    // Scan for events with IP addresses in time window
    const params = {
        TableName: process.env.AUDIT_TABLE_NAME,
        FilterExpression: '#timestamp BETWEEN :startTime AND :endTime AND attribute_exists(sourceIp)',
        ExpressionAttributeNames: {
            '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
            ':startTime': startTime,
            ':endTime': endTime
        }
    };
    const command = new lib_dynamodb_1.ScanCommand(params);
    const response = await docClient.send(command);
    const eventsWithIP = response.Items || [];
    // Group by IP and principal
    const ipActivity = eventsWithIP.reduce((acc, item) => {
        const ip = item.sourceIp;
        if (!acc[ip])
            acc[ip] = { users: new Set(), events: [] };
        if (item.principalId)
            acc[ip].users.add(item.principalId);
        acc[ip].events.push(item);
        return acc;
    }, {});
    const anomalies = [];
    // Detect IPs with multiple users (>3 users from same IP)
    Object.entries(ipActivity).forEach(([ip, activity]) => {
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
async function detectPermissionEscalation(startTime, endTime) {
    // Query for authorization events that might indicate privilege escalation
    const params = {
        TableName: process.env.AUDIT_TABLE_NAME,
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
    const command = new lib_dynamodb_1.QueryCommand(params);
    const response = await docClient.send(command);
    const permissionChanges = response.Items || [];
    const anomalies = [];
    // Group by principal and look for rapid permission changes
    const permissionsByPrincipal = permissionChanges.reduce((acc, item) => {
        const principalId = item.principalId || 'unknown';
        if (!acc[principalId])
            acc[principalId] = [];
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
async function detectHighRiskEventSpikes(startTime, endTime) {
    // Query high-risk events
    const params = {
        TableName: process.env.AUDIT_TABLE_NAME,
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
    const command = new lib_dynamodb_1.QueryCommand(params);
    const response = await docClient.send(command);
    const highRiskEvents = response.Items || [];
    const anomalies = [];
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
async function detectSuspiciousUserAgent(startTime, endTime) {
    // Look for suspicious user agent patterns
    const params = {
        TableName: process.env.AUDIT_TABLE_NAME,
        FilterExpression: '#timestamp BETWEEN :startTime AND :endTime AND attribute_exists(userAgent)',
        ExpressionAttributeNames: {
            '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
            ':startTime': startTime,
            ':endTime': endTime
        }
    };
    const command = new lib_dynamodb_1.ScanCommand(params);
    const response = await docClient.send(command);
    const eventsWithUserAgent = response.Items || [];
    const anomalies = [];
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
async function sendAnomalyEvents(anomalies) {
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
        const command = new client_eventbridge_1.PutEventsCommand({
            Entries: batch
        });
        await eventBridgeClient.send(command);
    }
    console.log(`Sent ${anomalies.length} anomaly events to EventBridge`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9sYW1iZGEvYW5vbWFseS1kZXRlY3Rpb24vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsOERBQTBEO0FBQzFELHdEQUEwRjtBQUMxRixvRUFBa0Y7QUFHbEYsTUFBTSxZQUFZLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sU0FBUyxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM1RCxNQUFNLGlCQUFpQixHQUFHLElBQUksc0NBQWlCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFZN0MsTUFBTSxPQUFPLEdBQWtDLEtBQUssRUFDekQsS0FBcUIsRUFDckIsT0FBZ0IsRUFDRCxFQUFFO0lBQ2pCLE9BQU8sQ0FBQyxHQUFHLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUVuRCxNQUFNLEdBQUcsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO0lBQ3ZCLE1BQU0sY0FBYyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVk7SUFDL0UsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ2xDLE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUUvQyxJQUFJLENBQUM7UUFDSCxxQ0FBcUM7UUFDckMsTUFBTSxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2xDLDBCQUEwQixDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUM7WUFDOUMsdUJBQXVCLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQztZQUMzQywwQkFBMEIsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDO1lBQzlDLHlCQUF5QixDQUFDLFNBQVMsRUFB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RSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDM0MsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUM1QixNQUFNLE9BQU8sR0FBRyxJQUFJLHFDQUFnQixDQUFDO1lBQ25DLE9BQU8sRUFBRSxLQUFLO1NBQ2YsQ0FBQyxDQUFDO1FBRUgsTUFBTSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxTQUFTLENBQUMsTUFBTSxnQ0FBZ0MsQ0FBQyxDQUFDO0FBQ3hFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBRdWVyeUNvbW1hbmQsIFNjYW5Db21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvbGliLWR5bmFtb2RiJztcbmltcG9ydCB7IEV2ZW50QnJpZGdlQ2xpZW50LCBQdXRFdmVudHNDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWV2ZW50YnJpZGdlJztcbmltcG9ydCB7IFNjaGVkdWxlZEV2ZW50LCBDb250ZXh0LCBIYW5kbGVyIH0gZnJvbSAnYXdzLWxhbWJkYSc7XG5cbmNvbnN0IGR5bmFtb0NsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7fSk7XG5jb25zdCBkb2NDbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oZHluYW1vQ2xpZW50KTtcbmNvbnN0IGV2ZW50QnJpZGdlQ2xpZW50ID0gbmV3IEV2ZW50QnJpZGdlQ2xpZW50KHt9KTtcblxuaW50ZXJmYWNlIEFub21hbHlQYXR0ZXJuIHtcbiAgdHlwZTogc3RyaW5nO1xuICBzZXZlcml0eTogJ0xPVycgfCAnTUVESVVNJyB8ICdISUdIJyB8ICdDUklUSUNBTCc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIHByaW5jaXBhbElkPzogc3RyaW5nO1xuICBjb3VudD86IG51bWJlcjtcbiAgdGltZVdpbmRvdz86IHN0cmluZztcbiAgZGV0YWlsczogUmVjb3JkPHN0cmluZywgYW55Pjtcbn1cblxuZXhwb3J0IGNvbnN0IGhhbmRsZXI6IEhhbmRsZXI8U2NoZWR1bGVkRXZlbnQsIHZvaWQ+ID0gYXN5bmMgKFxuICBldmVudDogU2NoZWR1bGVkRXZlbnQsXG4gIGNvbnRleHQ6IENvbnRleHRcbik6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zb2xlLmxvZygnU3RhcnRpbmcgYW5vbWFseSBkZXRlY3Rpb24gYW5hbHlzaXMnKTtcbiAgXG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gIGNvbnN0IGFuYWx5c2lzV2luZG93ID0gbmV3IERhdGUobm93LmdldFRpbWUoKSAtICg2MCAqIDYwICogMTAwMCkpOyAvLyBMYXN0IGhvdXJcbiAgY29uc3QgZW5kVGltZSA9IG5vdy50b0lTT1N0cmluZygpO1xuICBjb25zdCBzdGFydFRpbWUgPSBhbmFseXNpc1dpbmRvdy50b0lTT1N0cmluZygpO1xuICBcbiAgdHJ5IHtcbiAgICAvLyBSdW4gYWxsIGFub21hbHkgZGV0ZWN0aW9uIHBhdHRlcm5zXG4gICAgY29uc3QgYW5vbWFsaWVzID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgZGV0ZWN0TXVsdGlwbGVGYWlsZWRMb2dpbnMoc3RhcnRUaW1lLCBlbmRUaW1lKSxcbiAgICAgIGRldGVjdFVudXN1YWxJUEFjdGl2aXR5KHN0YXJ0VGltZSwgZW5kVGltZSksXG4gICAgICBkZXRlY3RQZXJtaXNzaW9uRXNjYWxhdGlvbihzdGFydFRpbWUsIGVuZFRpbWUpLFxuICAgICAgZGV0ZWN0SGlnaFJpc2tFdmVudFNwaWtlcyhzdGFydFRpbWUsIGVuZFRpbWUpLFxuICAgICAgZGV0ZWN0U3VzcGljaW91c1VzZXJBZ2VudChzdGFydFRpbWUsIGVuZFRpbWUpXG4gICAgXSk7XG4gICAgXG4gICAgLy8gRmxhdHRlbiByZXN1bHRzXG4gICAgY29uc3QgYWxsQW5vbWFsaWVzID0gYW5vbWFsaWVzLmZsYXQoKTtcbiAgICBcbiAgICBpZiAoYWxsQW5vbWFsaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKGBGb3VuZCAke2FsbEFub21hbGllcy5sZW5ndGh9IGFub21hbGllc2ApO1xuICAgICAgXG4gICAgICAvLyBTZW5kIGFub21hbHkgZXZlbnRzIHRvIEV2ZW50QnJpZGdlXG4gICAgICBhd2FpdCBzZW5kQW5vbWFseUV2ZW50cyhhbGxBbm9tYWxpZXMpO1xuICAgICAgXG4gICAgICAvLyBMb2cgY3JpdGljYWwgYW5vbWFsaWVzIGltbWVkaWF0ZWx5XG4gICAgICBjb25zdCBjcml0aWNhbEFub21hbGllcyA9IGFsbEFub21hbGllcy5maWx0ZXIoYSA9PiBhLnNldmVyaXR5ID09PSAnQ1JJVElDQUwnKTtcbiAgICAgIGlmIChjcml0aWNhbEFub21hbGllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYENSSVRJQ0FMIEFOT01BTElFUyBERVRFQ1RFRDpgLCBjcml0aWNhbEFub21hbGllcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUubG9nKCdObyBhbm9tYWxpZXMgZGV0ZWN0ZWQgaW4gdGhlIGN1cnJlbnQgdGltZSB3aW5kb3cnKTtcbiAgICB9XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignQW5vbWFseSBkZXRlY3Rpb24gZmFpbGVkOicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufTtcblxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0TXVsdGlwbGVGYWlsZWRMb2dpbnMoc3RhcnRUaW1lOiBzdHJpbmcsIGVuZFRpbWU6IHN0cmluZyk6IFByb21pc2U8QW5vbWFseVBhdHRlcm5bXT4ge1xuICAvLyBRdWVyeSBmb3IgZmFpbGVkIGF1dGhlbnRpY2F0aW9uIGV2ZW50cyBpbiB0aW1lIHdpbmRvd1xuICBjb25zdCBwYXJhbXMgPSB7XG4gICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5BVURJVF9UQUJMRV9OQU1FISxcbiAgICBJbmRleE5hbWU6ICdTZXJ2aWNlRXZlbnRUeXBlSW5kZXgnLFxuICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICdzZXJ2aWNlTmFtZSA9IDpzZXJ2aWNlTmFtZSBBTkQgZXZlbnRUeXBlID0gOmV2ZW50VHlwZScsXG4gICAgRmlsdGVyRXhwcmVzc2lvbjogJyN0aW1lc3RhbXAgQkVUV0VFTiA6c3RhcnRUaW1lIEFORCA6ZW5kVGltZSBBTkQgb3V0Y29tZSA9IDpvdXRjb21lJyxcbiAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICcjdGltZXN0YW1wJzogJ3RpbWVzdGFtcCdcbiAgICB9LFxuICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICc6c2VydmljZU5hbWUnOiAnbG91cGVlbi5hdXRoJyxcbiAgICAgICc6ZXZlbnRUeXBlJzogJ0F1dGhlbnRpY2F0aW9uIEV2ZW50JyxcbiAgICAgICc6c3RhcnRUaW1lJzogc3RhcnRUaW1lLFxuICAgICAgJzplbmRUaW1lJzogZW5kVGltZSxcbiAgICAgICc6b3V0Y29tZSc6ICdGQUlMVVJFJ1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNvbW1hbmQgPSBuZXcgUXVlcnlDb21tYW5kKHBhcmFtcyk7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gIGNvbnN0IGZhaWxlZExvZ2lucyA9IHJlc3BvbnNlLkl0ZW1zIHx8IFtdO1xuICBcbiAgLy8gR3JvdXAgYnkgcHJpbmNpcGFsIElEXG4gIGNvbnN0IGxvZ2luQXR0ZW1wdHMgPSBmYWlsZWRMb2dpbnMucmVkdWNlKChhY2M6IFJlY29yZDxzdHJpbmcsIGFueVtdPiwgaXRlbTogYW55KSA9PiB7XG4gICAgY29uc3QgcHJpbmNpcGFsSWQgPSBpdGVtLnByaW5jaXBhbElkIHx8ICd1bmtub3duJztcbiAgICBpZiAoIWFjY1twcmluY2lwYWxJZF0pIGFjY1twcmluY2lwYWxJZF0gPSBbXTtcbiAgICBhY2NbcHJpbmNpcGFsSWRdLnB1c2goaXRlbSk7XG4gICAgcmV0dXJuIGFjYztcbiAgfSwge30pO1xuICBcbiAgLy8gRGV0ZWN0IHVzZXJzIHdpdGggZXhjZXNzaXZlIGZhaWxlZCBhdHRlbXB0cyAoPjUgaW4gYW4gaG91cilcbiAgY29uc3QgYW5vbWFsaWVzOiBBbm9tYWx5UGF0dGVybltdID0gW107XG4gIE9iamVjdC5lbnRyaWVzKGxvZ2luQXR0ZW1wdHMpLmZvckVhY2goKFtwcmluY2lwYWxJZCwgYXR0ZW1wdHNdKSA9PiB7XG4gICAgaWYgKGF0dGVtcHRzLmxlbmd0aCA+PSA1KSB7XG4gICAgICBhbm9tYWxpZXMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdleGNlc3NpdmVfZmFpbGVkX2xvZ2lucycsXG4gICAgICAgIHNldmVyaXR5OiBhdHRlbXB0cy5sZW5ndGggPj0gMTAgPyAnQ1JJVElDQUwnIDogJ0hJR0gnLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFVzZXIgJHtwcmluY2lwYWxJZH0gaGFkICR7YXR0ZW1wdHMubGVuZ3RofSBmYWlsZWQgbG9naW4gYXR0ZW1wdHMgaW4gdGhlIGxhc3QgaG91cmAsXG4gICAgICAgIHByaW5jaXBhbElkLFxuICAgICAgICBjb3VudDogYXR0ZW1wdHMubGVuZ3RoLFxuICAgICAgICB0aW1lV2luZG93OiAnMSBob3VyJyxcbiAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgIGF0dGVtcHRzOiBhdHRlbXB0cy5tYXAoYSA9PiAoe1xuICAgICAgICAgICAgdGltZXN0YW1wOiBhLnRpbWVzdGFtcCxcbiAgICAgICAgICAgIHNvdXJjZUlwOiBhLnNvdXJjZUlwLFxuICAgICAgICAgICAgdXNlckFnZW50OiBhLnVzZXJBZ2VudFxuICAgICAgICAgIH0pKVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuICBcbiAgcmV0dXJuIGFub21hbGllcztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0VW51c3VhbElQQWN0aXZpdHkoc3RhcnRUaW1lOiBzdHJpbmcsIGVuZFRpbWU6IHN0cmluZyk6IFByb21pc2U8QW5vbWFseVBhdHRlcm5bXT4ge1xuICAvLyBTY2FuIGZvciBldmVudHMgd2l0aCBJUCBhZGRyZXNzZXMgaW4gdGltZSB3aW5kb3dcbiAgY29uc3QgcGFyYW1zID0ge1xuICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuQVVESVRfVEFCTEVfTkFNRSEsXG4gICAgRmlsdGVyRXhwcmVzc2lvbjogJyN0aW1lc3RhbXAgQkVUV0VFTiA6c3RhcnRUaW1lIEFORCA6ZW5kVGltZSBBTkQgYXR0cmlidXRlX2V4aXN0cyhzb3VyY2VJcCknLFxuICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgJyN0aW1lc3RhbXAnOiAndGltZXN0YW1wJ1xuICAgIH0sXG4gICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgJzpzdGFydFRpbWUnOiBzdGFydFRpbWUsXG4gICAgICAnOmVuZFRpbWUnOiBlbmRUaW1lXG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY29tbWFuZCA9IG5ldyBTY2FuQ29tbWFuZChwYXJhbXMpO1xuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICBjb25zdCBldmVudHNXaXRoSVAgPSByZXNwb25zZS5JdGVtcyB8fCBbXTtcbiAgXG4gIC8vIEdyb3VwIGJ5IElQIGFuZCBwcmluY2lwYWxcbiAgY29uc3QgaXBBY3Rpdml0eSA9IGV2ZW50c1dpdGhJUC5yZWR1Y2UoKGFjYzogUmVjb3JkPHN0cmluZywgYW55PiwgaXRlbTogYW55KSA9PiB7XG4gICAgY29uc3QgaXAgPSBpdGVtLnNvdXJjZUlwO1xuICAgIGlmICghYWNjW2lwXSkgYWNjW2lwXSA9IHsgdXNlcnM6IG5ldyBTZXQoKSwgZXZlbnRzOiBbXSB9O1xuICAgIGlmIChpdGVtLnByaW5jaXBhbElkKSBhY2NbaXBdLnVzZXJzLmFkZChpdGVtLnByaW5jaXBhbElkKTtcbiAgICBhY2NbaXBdLmV2ZW50cy5wdXNoKGl0ZW0pO1xuICAgIHJldHVybiBhY2M7XG4gIH0sIHt9KTtcbiAgXG4gIGNvbnN0IGFub21hbGllczogQW5vbWFseVBhdHRlcm5bXSA9IFtdO1xuICBcbiAgLy8gRGV0ZWN0IElQcyB3aXRoIG11bHRpcGxlIHVzZXJzICg+MyB1c2VycyBmcm9tIHNhbWUgSVApXG4gIE9iamVjdC5lbnRyaWVzKGlwQWN0aXZpdHkpLmZvckVhY2goKFtpcCwgYWN0aXZpdHldOiBbc3RyaW5nLCBhbnldKSA9PiB7XG4gICAgaWYgKGFjdGl2aXR5LnVzZXJzLnNpemUgPj0gMykge1xuICAgICAgYW5vbWFsaWVzLnB1c2goe1xuICAgICAgICB0eXBlOiAnbXVsdGlwbGVfdXNlcnNfc2FtZV9pcCcsXG4gICAgICAgIHNldmVyaXR5OiBhY3Rpdml0eS51c2Vycy5zaXplID49IDUgPyAnSElHSCcgOiAnTUVESVVNJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGBJUCAke2lwfSB1c2VkIGJ5ICR7YWN0aXZpdHkudXNlcnMuc2l6ZX0gZGlmZmVyZW50IHVzZXJzYCxcbiAgICAgICAgY291bnQ6IGFjdGl2aXR5LnVzZXJzLnNpemUsXG4gICAgICAgIHRpbWVXaW5kb3c6ICcxIGhvdXInLFxuICAgICAgICBkZXRhaWxzOiB7XG4gICAgICAgICAgaXAsXG4gICAgICAgICAgdXNlcnM6IEFycmF5LmZyb20oYWN0aXZpdHkudXNlcnMpLFxuICAgICAgICAgIGV2ZW50Q291bnQ6IGFjdGl2aXR5LmV2ZW50cy5sZW5ndGhcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbiAgXG4gIHJldHVybiBhbm9tYWxpZXM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRldGVjdFBlcm1pc3Npb25Fc2NhbGF0aW9uKHN0YXJ0VGltZTogc3RyaW5nLCBlbmRUaW1lOiBzdHJpbmcpOiBQcm9taXNlPEFub21hbHlQYXR0ZXJuW10+IHtcbiAgLy8gUXVlcnkgZm9yIGF1dGhvcml6YXRpb24gZXZlbnRzIHRoYXQgbWlnaHQgaW5kaWNhdGUgcHJpdmlsZWdlIGVzY2FsYXRpb25cbiAgY29uc3QgcGFyYW1zID0ge1xuICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuQVVESVRfVEFCTEVfTkFNRSEsXG4gICAgSW5kZXhOYW1lOiAnU2VydmljZUV2ZW50VHlwZUluZGV4JyxcbiAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAnc2VydmljZU5hbWUgPSA6c2VydmljZU5hbWUgQU5EIGV2ZW50VHlwZSA9IDpldmVudFR5cGUnLFxuICAgIEZpbHRlckV4cHJlc3Npb246ICcjdGltZXN0YW1wIEJFVFdFRU4gOnN0YXJ0VGltZSBBTkQgOmVuZFRpbWUgQU5EIChjb250YWlucyhhY3Rpb24sIDpwcm9tb3RlKSBPUiBjb250YWlucyhhY3Rpb24sIDpncmFudCkgT1IgY29udGFpbnMoYWN0aW9uLCA6YWRtaW4pKScsXG4gICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAnI3RpbWVzdGFtcCc6ICd0aW1lc3RhbXAnXG4gICAgfSxcbiAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAnOnNlcnZpY2VOYW1lJzogJ2xvdXBlZW4uYXV0aHonLFxuICAgICAgJzpldmVudFR5cGUnOiAnUGVybWlzc2lvbiBDaGFuZ2UnLFxuICAgICAgJzpzdGFydFRpbWUnOiBzdGFydFRpbWUsXG4gICAgICAnOmVuZFRpbWUnOiBlbmRUaW1lLFxuICAgICAgJzpwcm9tb3RlJzogJ3Byb21vdGUnLFxuICAgICAgJzpncmFudCc6ICdncmFudCcsXG4gICAgICAnOmFkbWluJzogJ2FkbWluJ1xuICAgIH1cbiAgfTtcbiAgXG4gIGNvbnN0IGNvbW1hbmQgPSBuZXcgUXVlcnlDb21tYW5kKHBhcmFtcyk7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gIGNvbnN0IHBlcm1pc3Npb25DaGFuZ2VzID0gcmVzcG9uc2UuSXRlbXMgfHwgW107XG4gIFxuICBjb25zdCBhbm9tYWxpZXM6IEFub21hbHlQYXR0ZXJuW10gPSBbXTtcbiAgXG4gIC8vIEdyb3VwIGJ5IHByaW5jaXBhbCBhbmQgbG9vayBmb3IgcmFwaWQgcGVybWlzc2lvbiBjaGFuZ2VzXG4gIGNvbnN0IHBlcm1pc3Npb25zQnlQcmluY2lwYWwgPSBwZXJtaXNzaW9uQ2hhbmdlcy5yZWR1Y2UoKGFjYzogUmVjb3JkPHN0cmluZywgYW55W10+LCBpdGVtOiBhbnkpID0+IHtcbiAgICBjb25zdCBwcmluY2lwYWxJZCA9IGl0ZW0ucHJpbmNpcGFsSWQgfHwgJ3Vua25vd24nO1xuICAgIGlmICghYWNjW3ByaW5jaXBhbElkXSkgYWNjW3ByaW5jaXBhbElkXSA9IFtdO1xuICAgIGFjY1twcmluY2lwYWxJZF0ucHVzaChpdGVtKTtcbiAgICByZXR1cm4gYWNjO1xuICB9LCB7fSk7XG4gIFxuICBPYmplY3QuZW50cmllcyhwZXJtaXNzaW9uc0J5UHJpbmNpcGFsKS5mb3JFYWNoKChbcHJpbmNpcGFsSWQsIGNoYW5nZXNdKSA9PiB7XG4gICAgaWYgKGNoYW5nZXMubGVuZ3RoID49IDMpIHsgLy8gMyBvciBtb3JlIHBlcm1pc3Npb24gY2hhbmdlcyBpbiBhbiBob3VyXG4gICAgICBhbm9tYWxpZXMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdyYXBpZF9wZXJtaXNzaW9uX2NoYW5nZXMnLFxuICAgICAgICBzZXZlcml0eTogJ0hJR0gnLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFVzZXIgJHtwcmluY2lwYWxJZH0gaGFkICR7Y2hhbmdlcy5sZW5ndGh9IHBlcm1pc3Npb24gY2hhbmdlcyBpbiB0aGUgbGFzdCBob3VyYCxcbiAgICAgICAgcHJpbmNpcGFsSWQsXG4gICAgICAgIGNvdW50OiBjaGFuZ2VzLmxlbmd0aCxcbiAgICAgICAgdGltZVdpbmRvdzogJzEgaG91cicsXG4gICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzLm1hcChjID0+ICh7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IGMudGltZXN0YW1wLFxuICAgICAgICAgICAgYWN0aW9uOiBjLmFjdGlvbixcbiAgICAgICAgICAgIG91dGNvbWU6IGMub3V0Y29tZSxcbiAgICAgICAgICAgIHJlc291cmNlSWQ6IGMucmVzb3VyY2VJZFxuICAgICAgICAgIH0pKVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuICBcbiAgcmV0dXJuIGFub21hbGllcztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0SGlnaFJpc2tFdmVudFNwaWtlcyhzdGFydFRpbWU6IHN0cmluZywgZW5kVGltZTogc3RyaW5nKTogUHJvbWlzZTxBbm9tYWx5UGF0dGVybltdPiB7XG4gIC8vIFF1ZXJ5IGhpZ2gtcmlzayBldmVudHNcbiAgY29uc3QgcGFyYW1zID0ge1xuICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuQVVESVRfVEFCTEVfTkFNRSEsXG4gICAgSW5kZXhOYW1lOiAnUmlza0xldmVsVGltZUluZGV4JyxcbiAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncmlza0xldmVsID0gOnJpc2tMZXZlbCBBTkQgI3RpbWVzdGFtcCBCRVRXRUVOIDpzdGFydFRpbWUgQU5EIDplbmRUaW1lJyxcbiAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICcjdGltZXN0YW1wJzogJ3RpbWVzdGFtcCdcbiAgICB9LFxuICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICc6cmlza0xldmVsJzogJ0hJR0gnLFxuICAgICAgJzpzdGFydFRpbWUnOiBzdGFydFRpbWUsXG4gICAgICAnOmVuZFRpbWUnOiBlbmRUaW1lXG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY29tbWFuZCA9IG5ldyBRdWVyeUNvbW1hbmQocGFyYW1zKTtcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChjb21tYW5kKTtcbiAgY29uc3QgaGlnaFJpc2tFdmVudHMgPSByZXNwb25zZS5JdGVtcyB8fCBbXTtcbiAgXG4gIGNvbnN0IGFub21hbGllczogQW5vbWFseVBhdHRlcm5bXSA9IFtdO1xuICBcbiAgLy8gSWYgd2UgaGF2ZSBtb3JlIHRoYW4gMTAgaGlnaC1yaXNrIGV2ZW50cyBpbiBhbiBob3VyLCB0aGF0J3Mgc3VzcGljaW91c1xuICBpZiAoaGlnaFJpc2tFdmVudHMubGVuZ3RoID49IDEwKSB7XG4gICAgYW5vbWFsaWVzLnB1c2goe1xuICAgICAgdHlwZTogJ2hpZ2hfcmlza19ldmVudF9zcGlrZScsXG4gICAgICBzZXZlcml0eTogJ0NSSVRJQ0FMJyxcbiAgICAgIGRlc2NyaXB0aW9uOiBgVW51c3VhbCBzcGlrZSBpbiBoaWdoLXJpc2sgZXZlbnRzOiAke2hpZ2hSaXNrRXZlbnRzLmxlbmd0aH0gZXZlbnRzIGluIHRoZSBsYXN0IGhvdXJgLFxuICAgICAgY291bnQ6IGhpZ2hSaXNrRXZlbnRzLmxlbmd0aCxcbiAgICAgIHRpbWVXaW5kb3c6ICcxIGhvdXInLFxuICAgICAgZGV0YWlsczoge1xuICAgICAgICBldmVudFR5cGVzOiBbLi4ubmV3IFNldChoaWdoUmlza0V2ZW50cy5tYXAoZSA9PiBlLmV2ZW50VHlwZSkpXSxcbiAgICAgICAgc2VydmljZXM6IFsuLi5uZXcgU2V0KGhpZ2hSaXNrRXZlbnRzLm1hcChlID0+IGUuc2VydmljZU5hbWUpKV1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBcbiAgcmV0dXJuIGFub21hbGllcztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZGV0ZWN0U3VzcGljaW91c1VzZXJBZ2VudChzdGFydFRpbWU6IHN0cmluZywgZW5kVGltZTogc3RyaW5nKTogUHJvbWlzZTxBbm9tYWx5UGF0dGVybltdPiB7XG4gIC8vIExvb2sgZm9yIHN1c3BpY2lvdXMgdXNlciBhZ2VudCBwYXR0ZXJuc1xuICBjb25zdCBwYXJhbXMgPSB7XG4gICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5BVURJVF9UQUJMRV9OQU1FISxcbiAgICBGaWx0ZXJFeHByZXNzaW9uOiAnI3RpbWVzdGFtcCBCRVRXRUVOIDpzdGFydFRpbWUgQU5EIDplbmRUaW1lIEFORCBhdHRyaWJ1dGVfZXhpc3RzKHVzZXJBZ2VudCknLFxuICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgJyN0aW1lc3RhbXAnOiAndGltZXN0YW1wJ1xuICAgIH0sXG4gICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgJzpzdGFydFRpbWUnOiBzdGFydFRpbWUsXG4gICAgICAnOmVuZFRpbWUnOiBlbmRUaW1lXG4gICAgfVxuICB9O1xuICBcbiAgY29uc3QgY29tbWFuZCA9IG5ldyBTY2FuQ29tbWFuZChwYXJhbXMpO1xuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICBjb25zdCBldmVudHNXaXRoVXNlckFnZW50ID0gcmVzcG9uc2UuSXRlbXMgfHwgW107XG4gIFxuICBjb25zdCBhbm9tYWxpZXM6IEFub21hbHlQYXR0ZXJuW10gPSBbXTtcbiAgXG4gIC8vIExvb2sgZm9yIGNvbW1vbiBhdXRvbWF0aW9uL2JvdCBwYXR0ZXJuc1xuICBjb25zdCBzdXNwaWNpb3VzUGF0dGVybnMgPSBbXG4gICAgJ2N1cmwnLFxuICAgICd3Z2V0JyxcbiAgICAncHl0aG9uLXJlcXVlc3RzJyxcbiAgICAnYm90JyxcbiAgICAnY3Jhd2xlcicsXG4gICAgJ3NjYW5uZXInXG4gIF07XG4gIFxuICBldmVudHNXaXRoVXNlckFnZW50LmZvckVhY2goZXZlbnQgPT4ge1xuICAgIGNvbnN0IHVzZXJBZ2VudCA9IGV2ZW50LnVzZXJBZ2VudD8udG9Mb3dlckNhc2UoKSB8fCAnJztcbiAgICBjb25zdCBoYXNTdXNwaWNpb3VzUGF0dGVybiA9IHN1c3BpY2lvdXNQYXR0ZXJucy5zb21lKHBhdHRlcm4gPT4gdXNlckFnZW50LmluY2x1ZGVzKHBhdHRlcm4pKTtcbiAgICBcbiAgICBpZiAoaGFzU3VzcGljaW91c1BhdHRlcm4pIHtcbiAgICAgIGFub21hbGllcy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ3N1c3BpY2lvdXNfdXNlcl9hZ2VudCcsXG4gICAgICAgIHNldmVyaXR5OiAnTUVESVVNJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGBTdXNwaWNpb3VzIHVzZXIgYWdlbnQgZGV0ZWN0ZWQ6ICR7ZXZlbnQudXNlckFnZW50fWAsXG4gICAgICAgIHByaW5jaXBhbElkOiBldmVudC5wcmluY2lwYWxJZCxcbiAgICAgICAgdGltZVdpbmRvdzogJzEgaG91cicsXG4gICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICB1c2VyQWdlbnQ6IGV2ZW50LnVzZXJBZ2VudCxcbiAgICAgICAgICBzb3VyY2VJcDogZXZlbnQuc291cmNlSXAsXG4gICAgICAgICAgZXZlbnRUeXBlOiBldmVudC5ldmVudFR5cGUsXG4gICAgICAgICAgdGltZXN0YW1wOiBldmVudC50aW1lc3RhbXBcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbiAgXG4gIHJldHVybiBhbm9tYWxpZXM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbmRBbm9tYWx5RXZlbnRzKGFub21hbGllczogQW5vbWFseVBhdHRlcm5bXSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBldmVudHMgPSBhbm9tYWxpZXMubWFwKGFub21hbHkgPT4gKHtcbiAgICBTb3VyY2U6ICdsb3VwZWVuLnNlY3VyaXR5JyxcbiAgICBEZXRhaWxUeXBlOiAnQW5vbWFseSBEZXRlY3Rpb24nLFxuICAgIERldGFpbDogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgLi4uYW5vbWFseSxcbiAgICAgIGRldGVjdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHJpc2tMZXZlbDogYW5vbWFseS5zZXZlcml0eVxuICAgIH0pLFxuICAgIFRpbWU6IG5ldyBEYXRlKClcbiAgfSkpO1xuICBcbiAgLy8gU2VuZCBpbiBiYXRjaGVzIG9mIDEwIChFdmVudEJyaWRnZSBsaW1pdClcbiAgY29uc3QgYmF0Y2hlcyA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkgKz0gMTApIHtcbiAgICBiYXRjaGVzLnB1c2goZXZlbnRzLnNsaWNlKGksIGkgKyAxMCkpO1xuICB9XG4gIFxuICBmb3IgKGNvbnN0IGJhdGNoIG9mIGJhdGNoZXMpIHtcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFB1dEV2ZW50c0NvbW1hbmQoe1xuICAgICAgRW50cmllczogYmF0Y2hcbiAgICB9KTtcbiAgICBcbiAgICBhd2FpdCBldmVudEJyaWRnZUNsaWVudC5zZW5kKGNvbW1hbmQpO1xuICB9XG4gIFxuICBjb25zb2xlLmxvZyhgU2VudCAke2Fub21hbGllcy5sZW5ndGh9IGFub21hbHkgZXZlbnRzIHRvIEV2ZW50QnJpZGdlYCk7XG59Il19