import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
export interface GameAuditServiceStackProps extends cdk.StackProps {
    environment: string;
    region: string;
    accountId: string;
    logRetentionDays: number;
}
export declare class GameAuditServiceStack extends cdk.Stack {
    readonly auditTable: dynamodb.Table;
    readonly eventIngestionFunction: lambda.Function;
    readonly queryFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: GameAuditServiceStackProps);
}
