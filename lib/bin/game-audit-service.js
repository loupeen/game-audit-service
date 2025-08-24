#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const game_audit_service_stack_1 = require("../lib/game-audit-service-stack");
const app = new cdk.App();
const environment = app.node.tryGetContext('environment') || process.env.CDK_ENVIRONMENT || 'test';
const region = app.node.tryGetContext('region') || process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION;
const account = process.env.CDK_DEFAULT_ACCOUNT;
console.log(`🛡️ Deploying Game Audit Service to environment: ${environment}`);
try {
    const envConfigs = {
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
        throw new Error(`❌ Account mismatch! Current account: ${account}, Expected for ${environment}: ${envConfig.awsAccountId}`);
    }
    // Determine deployment region
    const deploymentRegion = region || envConfig.primaryRegion;
    console.log(`🌍 Deploying to region: ${deploymentRegion}`);
    // Create the audit service stack
    const stackName = `GameAuditService-${environment}${region && region !== envConfig.primaryRegion ? `-${region}` : ''}`;
    new game_audit_service_stack_1.GameAuditServiceStack(app, stackName, {
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
}
catch (error) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2dhbWUtYXVkaXQtc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDhFQUF3RTtBQUV4RSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsSUFBSSxNQUFNLENBQUM7QUFDbkcsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQztBQUM1RyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO0FBRWhELE9BQU8sQ0FBQyxHQUFHLENBQUMsb0RBQW9ELFdBQVcsRUFBRSxDQUFDLENBQUM7QUFFL0UsSUFBSSxDQUFDO0lBQ0gsTUFBTSxVQUFVLEdBQXdCO1FBQ3RDLElBQUksRUFBRTtZQUNKLElBQUksRUFBRSxNQUFNO1lBQ1osWUFBWSxFQUFFLGNBQWM7WUFDNUIsYUFBYSxFQUFFLFlBQVk7WUFDM0IsZ0JBQWdCLEVBQUUsRUFBRTtZQUNwQixnQkFBZ0IsRUFBRSxFQUFFO1lBQ3BCLFVBQVUsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUU7U0FDNUI7UUFDRCxFQUFFLEVBQUU7WUFDRixJQUFJLEVBQUUsSUFBSTtZQUNWLFlBQVksRUFBRSxjQUFjO1lBQzVCLGFBQWEsRUFBRSxXQUFXO1lBQzFCLGdCQUFnQixFQUFFLENBQUMs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LENBQUMsQ0FBQztJQUN2RCxPQUFPLENBQUMsR0FBRyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7SUFDakUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLENBQUMsQ0FBQztJQUN4RCxPQUFPLENBQUMsR0FBRyxDQUFDLG1FQUFtRSxDQUFDLENBQUM7SUFDakYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO0lBQ2hELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEIsQ0FBQztBQUVELHFCQUFxQjtBQUNyQixHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgR2FtZUF1ZGl0U2VydmljZVN0YWNrIH0gZnJvbSAnLi4vbGliL2dhbWUtYXVkaXQtc2VydmljZS1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IGVudmlyb25tZW50ID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCBwcm9jZXNzLmVudi5DREtfRU5WSVJPTk1FTlQgfHwgJ3Rlc3QnO1xuY29uc3QgcmVnaW9uID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgncmVnaW9uJykgfHwgcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fCBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT047XG5jb25zdCBhY2NvdW50ID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVDtcblxuY29uc29sZS5sb2coYPCfm6HvuI8gRGVwbG95aW5nIEdhbWUgQXVkaXQgU2VydmljZSB0byBlbnZpcm9ubWVudDogJHtlbnZpcm9ubWVudH1gKTtcblxudHJ5IHtcbiAgY29uc3QgZW52Q29uZmlnczogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICB0ZXN0OiB7XG4gICAgICBuYW1lOiAndGVzdCcsXG4gICAgICBhd3NBY2NvdW50SWQ6ICc3Mjg0Mjc0NzAwNDYnLFxuICAgICAgcHJpbWFyeVJlZ2lvbjogJ2V1LW5vcnRoLTEnLFxuICAgICAgc2Vjb25kYXJ5UmVnaW9uczogW10sXG4gICAgICBsb2dSZXRlbnRpb25EYXlzOiA5MCxcbiAgICAgIGNvc3RCdWRnZXQ6IHsgbW9udGhseTogNTAgfVxuICAgIH0sXG4gICAgcWE6IHtcbiAgICAgIG5hbWU6ICdxYScsXG4gICAgICBhd3NBY2NvdW50SWQ6ICcwNzcwMjk3ODQyOTEnLFxuICAgICAgcHJpbWFyeVJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICBzZWNvbmRhcnlSZWdpb25zOiBbJ2V1LWNlbnRyYWwtMSddLFxuICAgICAgbG9nUmV0ZW50aW9uRGF5czogMTgwLFxuICAgICAgY29zdEJ1ZGdldDogeyBtb250aGx5OiAxMDAgfVxuICAgIH0sXG4gICAgcHJvZHVjdGlvbjoge1xuICAgICAgbmFtZTogJ3Byb2R1Y3Rpb24nLFxuICAgICAgYXdzQWNjb3VudElkOiAnVEJEJyxcbiAgICAgIHByaW1hcnlSZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgc2Vjb25kYXJ5UmVnaW9uczogWydldS1jZW50cmFsLTEnLCAnZXUtbm9ydGgtMSddLFxuICAgICAgbG9nUmV0ZW50aW9uRGF5czogMjU1NSwgLy8gNyB5ZWFycyBmb3IgY29tcGxpYW5jZVxuICAgICAgY29zdEJ1ZGdldDogeyBtb250aGx5OiA1MDAgfVxuICAgIH1cbiAgfTtcblxuICBjb25zdCBlbnZDb25maWcgPSBlbnZDb25maWdzW2Vudmlyb25tZW50XSB8fCBlbnZDb25maWdzLnRlc3Q7XG4gIFxuICBjb25zb2xlLmxvZyhg8J+TiyBBdWRpdCBTZXJ2aWNlIENvbmZpZ3VyYXRpb246YCk7XG4gIGNvbnNvbGUubG9nKGAgICBFbnZpcm9ubWVudDogJHtlbnZDb25maWcubmFtZX1gKTtcbiAgY29uc29sZS5sb2coYCAgIEFjY291bnQ6ICR7ZW52Q29uZmlnLmF3c0FjY291bnRJZH1gKTtcbiAgY29uc29sZS5sb2coYCAgIFByaW1hcnkgUmVnaW9uOiAke2VudkNvbmZpZy5wcmltYXJ5UmVnaW9ufWApO1xuICBjb25zb2xlLmxvZyhgICAgTG9nIFJldGVudGlvbjogJHtlbnZDb25maWcubG9nUmV0ZW50aW9uRGF5c30gZGF5c2ApO1xuICBjb25zb2xlLmxvZyhgICAgQ29zdCBCdWRnZXQ6ICQke2VudkNvbmZpZy5jb3N0QnVkZ2V0Lm1vbnRobHl9L21vbnRoYCk7XG5cbiAgLy8gVmFsaWRhdGUgYWNjb3VudCBpZiBwcm92aWRlZCAoc2tpcCBpbiBDSSBmb3Igc3ludGggdmFsaWRhdGlvbilcbiAgaWYgKGFjY291bnQgJiYgYWNjb3VudCAhPT0gZW52Q29uZmlnLmF3c0FjY291bnRJZCAmJiAhcHJvY2Vzcy5lbnYuQ0kpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBg4p2MIEFjY291bnQgbWlzbWF0Y2ghIEN1cnJlbnQgYWNjb3VudDogJHthY2NvdW50fSwgRXhwZWN0ZWQgZm9yICR7ZW52aXJvbm1lbnR9OiAke2VudkNvbmZpZy5hd3NBY2NvdW50SWR9YFxuICAgICk7XG4gIH1cblxuICAvLyBEZXRlcm1pbmUgZGVwbG95bWVudCByZWdpb25cbiAgY29uc3QgZGVwbG95bWVudFJlZ2lvbiA9IHJlZ2lvbiB8fCBlbnZDb25maWcucHJpbWFyeVJlZ2lvbjtcbiAgXG4gIGNvbnNvbGUubG9nKGDwn4yNIERlcGxveWluZyB0byByZWdpb246ICR7ZGVwbG95bWVudFJlZ2lvbn1gKTtcblxuICAvLyBDcmVhdGUgdGhlIGF1ZGl0IHNlcnZpY2Ugc3RhY2tcbiAgY29uc3Qgc3RhY2tOYW1lID0gYEdhbWVBdWRpdFNlcnZpY2UtJHtlbnZpcm9ubWVudH0ke3JlZ2lvbiAmJiByZWdpb24gIT09IGVudkNvbmZpZy5wcmltYXJ5UmVnaW9uID8gYC0ke3JlZ2lvbn1gIDogJyd9YDtcbiAgXG4gIG5ldyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2soYXBwLCBzdGFja05hbWUsIHtcbiAgICBlbnZpcm9ubWVudCxcbiAgICByZWdpb246IGRlcGxveW1lbnRSZWdpb24sXG4gICAgYWNjb3VudElkOiBlbnZDb25maWcuYXdzQWNjb3VudElkLFxuICAgIGxvZ1JldGVudGlvbkRheXM6IGVudkNvbmZpZy5sb2dSZXRlbnRpb25EYXlzLFxuICAgIGVudjoge1xuICAgICAgYWNjb3VudDogZW52Q29uZmlnLmF3c0FjY291bnRJZCxcbiAgICAgIHJlZ2lvbjogZGVwbG95bWVudFJlZ2lvblxuICAgIH0sXG4gICAgZGVzY3JpcHRpb246IGBHYW1lIEF1ZGl0IFNlcnZpY2UgZm9yIExvdXBlZW4gUlRTIFBsYXRmb3JtICgke2Vudmlyb25tZW50fSlgLFxuICAgIHRhZ3M6IHtcbiAgICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICAgIFNlcnZpY2U6ICdnYW1lLWF1ZGl0LXNlcnZpY2UnLFxuICAgICAgUGxhdGZvcm06ICdsb3VwZWVuLXJ0cycsXG4gICAgICBDb3N0Q2VudGVyOiBlbnZDb25maWcubmFtZSxcbiAgICAgIFJlcG9zaXRvcnk6ICdodHRwczovL2dpdGh1Yi5jb20vbG91cGVlbi9nYW1lLWF1ZGl0LXNlcnZpY2UnLFxuICAgICAgTWFuYWdlZEJ5OiAnQ0RLJyxcbiAgICAgIFNlY3VyaXR5TGV2ZWw6ICdoaWdoJyxcbiAgICAgIERhdGFDbGFzc2lmaWNhdGlvbjogJ2NvbmZpZGVudGlhbCdcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnNvbGUubG9nKGDinIUgQXVkaXQgU2VydmljZSBTdGFjayBjb25maWd1cmVkOiAke3N0YWNrTmFtZX1gKTtcblxufSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICBjb25zb2xlLmVycm9yKCfinYwgQ29uZmlndXJhdGlvbiBFcnJvcjonLCBlcnJvci5tZXNzYWdlKTtcbiAgY29uc29sZS5sb2coJ1xcbvCflKcgQXZhaWxhYmxlIGVudmlyb25tZW50czogdGVzdCwgcWEsIHByb2R1Y3Rpb24nKTtcbiAgY29uc29sZS5sb2coJ/CfkqEgVXNhZ2UgZXhhbXBsZXM6Jyk7XG4gIGNvbnNvbGUubG9nKCcgICBjZGsgZGVwbG95IC0tY29udGV4dCBlbnZpcm9ubWVudD10ZXN0Jyk7XG4gIGNvbnNvbGUubG9nKCcgICBjZGsgZGVwbG95IC0tY29udGV4dCBlbnZpcm9ubWVudD1xYSAtLWNvbnRleHQgcmVnaW9uPXVzLWVhc3QtMScpO1xuICBjb25zb2xlLmxvZygnICAgQ0RLX0VOVklST05NRU5UPXFhIGNkayBkZXBsb3knKTtcbiAgcHJvY2Vzcy5leGl0KDEpO1xufVxuXG4vLyBBZGQgc3ludGggbWV0YWRhdGFcbmFwcC5zeW50aCgpOyJdfQ==