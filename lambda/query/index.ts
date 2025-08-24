import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, Handler } from 'aws-lambda';
import { z } from 'zod';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const QueryParamsSchema = z.object({
  queryType: z.enum(['byPrincipal', 'byService', 'byRiskLevel', 'byTimeRange']),
  principalId: z.string().optional(),
  serviceName: z.string().optional(),
  eventType: z.string().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  limit: z.string().optional(),
  nextToken: z.string().optional()
});

interface AuditQueryResult {
  events: any[];
  nextToken?: string;
  totalCount?: number;
}

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Processing audit query:', JSON.stringify(event.queryStringParameters, null, 2));
  
  try {
    // Parse and validate query parameters
    const queryParams = QueryParamsSchema.parse(event.queryStringParameters || {});
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    
    let result: AuditQueryResult;
    
    switch (queryParams.queryType) {
      case 'byPrincipal':
        result = await queryByPrincipal(queryParams.principalId!, queryParams.startTime, queryParams.endTime, limit, queryParams.nextToken);
        break;
        
      case 'byService':
        result = await queryByService(queryParams.serviceName!, queryParams.eventType, limit, queryParams.nextToken);
        break;
        
      case 'byRiskLevel':
        result = await queryByRiskLevel(queryParams.riskLevel!, queryParams.startTime, queryParams.endTime, limit, queryParams.nextToken);
        break;
        
      case 'byTimeRange':
        result = await queryByTimeRange(queryParams.startTime!, queryParams.endTime!, limit, queryParams.nextToken);
        break;
        
      default:
        throw new Error('Invalid query type');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Query failed:', error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid query parameters',
          details: error.errors
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

async function queryByPrincipal(
  principalId: string,
  startTime?: string,
  endTime?: string,
  limit: number = 50,
  nextToken?: string
): Promise<AuditQueryResult> {
  const params: any = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    IndexName: 'PrincipalTimeIndex',
    KeyConditionExpression: 'principalId = :principalId',
    ExpressionAttributeValues: {
      ':principalId': principalId
    },
    Limit: limit,
    ScanIndexForward: false // Most recent first
  };
  
  // Add time range filter if provided
  if (startTime && endTime) {
    params.KeyConditionExpression += ' AND #timestamp BETWEEN :startTime AND :endTime';
    params.ExpressionAttributeNames = { '#timestamp': 'timestamp' };
    params.ExpressionAttributeValues[':startTime'] = startTime;
    params.ExpressionAttributeValues[':endTime'] = endTime;
  }
  
  if (nextToken) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
  }
  
  const command = new QueryCommand(params);
  const response = await docClient.send(command);
  
  return {
    events: response.Items || [],
    nextToken: response.LastEvaluatedKey ? 
      Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') : 
      undefined
  };
}

async function queryByService(
  serviceName: string,
  eventType?: string,
  limit: number = 50,
  nextToken?: string
): Promise<AuditQueryResult> {
  const params: any = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    IndexName: 'ServiceEventTypeIndex',
    KeyConditionExpression: 'serviceName = :serviceName',
    ExpressionAttributeValues: {
      ':serviceName': serviceName
    },
    Limit: limit,
    ScanIndexForward: false
  };
  
  if (eventType) {
    params.KeyConditionExpression += ' AND eventType = :eventType';
    params.ExpressionAttributeValues[':eventType'] = eventType;
  }
  
  if (nextToken) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
  }
  
  const command = new QueryCommand(params);
  const response = await docClient.send(command);
  
  return {
    events: response.Items || [],
    nextToken: response.LastEvaluatedKey ? 
      Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') : 
      undefined
  };
}

async function queryByRiskLevel(
  riskLevel: string,
  startTime?: string,
  endTime?: string,
  limit: number = 50,
  nextToken?: string
): Promise<AuditQueryResult> {
  const params: any = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    IndexName: 'RiskLevelTimeIndex',
    KeyConditionExpression: 'riskLevel = :riskLevel',
    ExpressionAttributeValues: {
      ':riskLevel': riskLevel
    },
    Limit: limit,
    ScanIndexForward: false
  };
  
  if (startTime && endTime) {
    params.KeyConditionExpression += ' AND #timestamp BETWEEN :startTime AND :endTime';
    params.ExpressionAttributeNames = { '#timestamp': 'timestamp' };
    params.ExpressionAttributeValues[':startTime'] = startTime;
    params.ExpressionAttributeValues[':endTime'] = endTime;
  }
  
  if (nextToken) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
  }
  
  const command = new QueryCommand(params);
  const response = await docClient.send(command);
  
  return {
    events: response.Items || [],
    nextToken: response.LastEvaluatedKey ? 
      Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') : 
      undefined
  };
}

async function queryByTimeRange(
  startTime: string,
  endTime: string,
  limit: number = 50,
  nextToken?: string
): Promise<AuditQueryResult> {
  // This requires a scan operation since we don't have a GSI with just timestamp
  // In production, consider using DynamoDB Streams with time-series data patterns
  const params: any = {
    TableName: process.env.AUDIT_TABLE_NAME!,
    FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':startTime': startTime,
      ':endTime': endTime
    },
    Limit: limit
  };
  
  if (nextToken) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
  }
  
  const command = new ScanCommand(params);
  const response = await docClient.send(command);
  
  return {
    events: response.Items || [],
    nextToken: response.LastEvaluatedKey ? 
      Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') : 
      undefined
  };
}