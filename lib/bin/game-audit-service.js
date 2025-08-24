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
    // Validate account if provided
    if (account && account !== envConfig.awsAccountId) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2dhbWUtYXVkaXQtc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDhFQUF3RTtBQUV4RSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsSUFBSSxNQUFNLENBQUM7QUFDbkcsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQztBQUM1RyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO0FBRWhELE9BQU8sQ0FBQyxHQUFHLENBQUMsb0RBQW9ELFdBQVcsRUFBRSxDQUFDLENBQUM7QUFFL0UsSUFBSSxDQUFDO0lBQ0gsTUFBTSxVQUFVLEdBQXdCO1FBQ3RDLElBQUksRUFBRTtZQUNKLElBQUksRUFBRSxNQUFNO1lBQ1osWUFBWSxFQUFFLGNBQWM7WUFDNUIsYUFBYSxFQUFFLFlBQVk7WUFDM0IsZ0JBQWdCLEVBQUUsRUFBRTtZQUNwQixnQkFBZ0IsRUFBRSxFQUFFO1lBQ3BCLFVBQVUsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUU7U0FDNUI7UUFDRCxFQUFFLEVBQUU7WUFDRixJQUFJLEVBQUUsSUFBSTtZQUNWLFlBQVksRUFBRSxjQUFjO1lBQzVCLGFBQWEsRUFBRSxXQUFXO1lBQzFCLGdCQUFnQixFQUFFLENBQUMs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QyxtREFBbUQsQ0FBQyxDQUFDO0lBQ2pFLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUNsQyxPQUFPLENBQUMsR0FBRyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7SUFDeEQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtRUFBbUUsQ0FBQyxDQUFDO0lBQ2pGLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0NBQWtDLENBQUMsQ0FBQztJQUNoRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xCLENBQUM7QUFFRCxxQkFBcUI7QUFDckIsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IEdhbWVBdWRpdFNlcnZpY2VTdGFjayB9IGZyb20gJy4uL2xpYi9nYW1lLWF1ZGl0LXNlcnZpY2Utc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG5jb25zdCBlbnZpcm9ubWVudCA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgcHJvY2Vzcy5lbnYuQ0RLX0VOVklST05NRU5UIHx8ICd0ZXN0JztcbmNvbnN0IHJlZ2lvbiA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3JlZ2lvbicpIHx8IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfHwgcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OO1xuY29uc3QgYWNjb3VudCA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQ7XG5cbmNvbnNvbGUubG9nKGDwn5uh77iPIERlcGxveWluZyBHYW1lIEF1ZGl0IFNlcnZpY2UgdG8gZW52aXJvbm1lbnQ6ICR7ZW52aXJvbm1lbnR9YCk7XG5cbnRyeSB7XG4gIGNvbnN0IGVudkNvbmZpZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gICAgdGVzdDoge1xuICAgICAgbmFtZTogJ3Rlc3QnLFxuICAgICAgYXdzQWNjb3VudElkOiAnNzI4NDI3NDcwMDQ2JyxcbiAgICAgIHByaW1hcnlSZWdpb246ICdldS1ub3J0aC0xJyxcbiAgICAgIHNlY29uZGFyeVJlZ2lvbnM6IFtdLFxuICAgICAgbG9nUmV0ZW50aW9uRGF5czogOTAsXG4gICAgICBjb3N0QnVkZ2V0OiB7IG1vbnRobHk6IDUwIH1cbiAgICB9LFxuICAgIHFhOiB7XG4gICAgICBuYW1lOiAncWEnLFxuICAgICAgYXdzQWNjb3VudElkOiAnMDc3MDI5Nzg0MjkxJyxcbiAgICAgIHByaW1hcnlSZWdpb246ICd1cy1lYXN0LTEnLFxuICAgICAgc2Vjb25kYXJ5UmVnaW9uczogWydldS1jZW50cmFsLTEnXSxcbiAgICAgIGxvZ1JldGVudGlvbkRheXM6IDE4MCxcbiAgICAgIGNvc3RCdWRnZXQ6IHsgbW9udGhseTogMTAwIH1cbiAgICB9LFxuICAgIHByb2R1Y3Rpb246IHtcbiAgICAgIG5hbWU6ICdwcm9kdWN0aW9uJyxcbiAgICAgIGF3c0FjY291bnRJZDogJ1RCRCcsXG4gICAgICBwcmltYXJ5UmVnaW9uOiAndXMtZWFzdC0xJyxcbiAgICAgIHNlY29uZGFyeVJlZ2lvbnM6IFsnZXUtY2VudHJhbC0xJywgJ2V1LW5vcnRoLTEnXSxcbiAgICAgIGxvZ1JldGVudGlvbkRheXM6IDI1NTUsIC8vIDcgeWVhcnMgZm9yIGNvbXBsaWFuY2VcbiAgICAgIGNvc3RCdWRnZXQ6IHsgbW9udGhseTogNTAwIH1cbiAgICB9XG4gIH07XG5cbiAgY29uc3QgZW52Q29uZmlnID0gZW52Q29uZmlnc1tlbnZpcm9ubWVudF0gfHwgZW52Q29uZmlncy50ZXN0O1xuICBcbiAgY29uc29sZS5sb2coYPCfk4sgQXVkaXQgU2VydmljZSBDb25maWd1cmF0aW9uOmApO1xuICBjb25zb2xlLmxvZyhgICAgRW52aXJvbm1lbnQ6ICR7ZW52Q29uZmlnLm5hbWV9YCk7XG4gIGNvbnNvbGUubG9nKGAgICBBY2NvdW50OiAke2VudkNvbmZpZy5hd3NBY2NvdW50SWR9YCk7XG4gIGNvbnNvbGUubG9nKGAgICBQcmltYXJ5IFJlZ2lvbjogJHtlbnZDb25maWcucHJpbWFyeVJlZ2lvbn1gKTtcbiAgY29uc29sZS5sb2coYCAgIExvZyBSZXRlbnRpb246ICR7ZW52Q29uZmlnLmxvZ1JldGVudGlvbkRheXN9IGRheXNgKTtcbiAgY29uc29sZS5sb2coYCAgIENvc3QgQnVkZ2V0OiAkJHtlbnZDb25maWcuY29zdEJ1ZGdldC5tb250aGx5fS9tb250aGApO1xuXG4gIC8vIFZhbGlkYXRlIGFjY291bnQgaWYgcHJvdmlkZWRcbiAgaWYgKGFjY291bnQgJiYgYWNjb3VudCAhPT0gZW52Q29uZmlnLmF3c0FjY291bnRJZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGDinYwgQWNjb3VudCBtaXNtYXRjaCEgQ3VycmVudCBhY2NvdW50OiAke2FjY291bnR9LCBFeHBlY3RlZCBmb3IgJHtlbnZpcm9ubWVudH06ICR7ZW52Q29uZmlnLmF3c0FjY291bnRJZH1gXG4gICAgKTtcbiAgfVxuXG4gIC8vIERldGVybWluZSBkZXBsb3ltZW50IHJlZ2lvblxuICBjb25zdCBkZXBsb3ltZW50UmVnaW9uID0gcmVnaW9uIHx8IGVudkNvbmZpZy5wcmltYXJ5UmVnaW9uO1xuICBcbiAgY29uc29sZS5sb2coYPCfjI0gRGVwbG95aW5nIHRvIHJlZ2lvbjogJHtkZXBsb3ltZW50UmVnaW9ufWApO1xuXG4gIC8vIENyZWF0ZSB0aGUgYXVkaXQgc2VydmljZSBzdGFja1xuICBjb25zdCBzdGFja05hbWUgPSBgR2FtZUF1ZGl0U2VydmljZS0ke2Vudmlyb25tZW50fSR7cmVnaW9uICYmIHJlZ2lvbiAhPT0gZW52Q29uZmlnLnByaW1hcnlSZWdpb24gPyBgLSR7cmVnaW9ufWAgOiAnJ31gO1xuICBcbiAgbmV3IEdhbWVBdWRpdFNlcnZpY2VTdGFjayhhcHAsIHN0YWNrTmFtZSwge1xuICAgIGVudmlyb25tZW50LFxuICAgIHJlZ2lvbjogZGVwbG95bWVudFJlZ2lvbixcbiAgICBhY2NvdW50SWQ6IGVudkNvbmZpZy5hd3NBY2NvdW50SWQsXG4gICAgbG9nUmV0ZW50aW9uRGF5czogZW52Q29uZmlnLmxvZ1JldGVudGlvbkRheXMsXG4gICAgZW52OiB7XG4gICAgICBhY2NvdW50OiBlbnZDb25maWcuYXdzQWNjb3VudElkLFxuICAgICAgcmVnaW9uOiBkZXBsb3ltZW50UmVnaW9uXG4gICAgfSxcbiAgICBkZXNjcmlwdGlvbjogYEdhbWUgQXVkaXQgU2VydmljZSBmb3IgTG91cGVlbiBSVFMgUGxhdGZvcm0gKCR7ZW52aXJvbm1lbnR9KWAsXG4gICAgdGFnczoge1xuICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgICAgU2VydmljZTogJ2dhbWUtYXVkaXQtc2VydmljZScsXG4gICAgICBQbGF0Zm9ybTogJ2xvdXBlZW4tcnRzJyxcbiAgICAgIENvc3RDZW50ZXI6IGVudkNvbmZpZy5uYW1lLFxuICAgICAgUmVwb3NpdG9yeTogJ2h0dHBzOi8vZ2l0aHViLmNvbS9sb3VwZWVuL2dhbWUtYXVkaXQtc2VydmljZScsXG4gICAgICBNYW5hZ2VkQnk6ICdDREsnLFxuICAgICAgU2VjdXJpdHlMZXZlbDogJ2hpZ2gnLFxuICAgICAgRGF0YUNsYXNzaWZpY2F0aW9uOiAnY29uZmlkZW50aWFsJ1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc29sZS5sb2coYOKchSBBdWRpdCBTZXJ2aWNlIFN0YWNrIGNvbmZpZ3VyZWQ6ICR7c3RhY2tOYW1lfWApO1xuXG59IGNhdGNoIChlcnJvcjogYW55KSB7XG4gIGNvbnNvbGUuZXJyb3IoJ+KdjCBDb25maWd1cmF0aW9uIEVycm9yOicsIGVycm9yLm1lc3NhZ2UpO1xuICBjb25zb2xlLmxvZygnXFxu8J+UpyBBdmFpbGFibGUgZW52aXJvbm1lbnRzOiB0ZXN0LCBxYSwgcHJvZHVjdGlvbicpO1xuICBjb25zb2xlLmxvZygn8J+SoSBVc2FnZSBleGFtcGxlczonKTtcbiAgY29uc29sZS5sb2coJyAgIGNkayBkZXBsb3kgLS1jb250ZXh0IGVudmlyb25tZW50PXRlc3QnKTtcbiAgY29uc29sZS5sb2coJyAgIGNkayBkZXBsb3kgLS1jb250ZXh0IGVudmlyb25tZW50PXFhIC0tY29udGV4dCByZWdpb249dXMtZWFzdC0xJyk7XG4gIGNvbnNvbGUubG9nKCcgICBDREtfRU5WSVJPTk1FTlQ9cWEgY2RrIGRlcGxveScpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG5cbi8vIEFkZCBzeW50aCBtZXRhZGF0YVxuYXBwLnN5bnRoKCk7Il19