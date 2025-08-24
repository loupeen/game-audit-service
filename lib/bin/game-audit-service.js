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
// Get environment from context or default to 'test'
const environment = app.node.tryGetContext('environment') || 'test';
// Environment configuration
const envConfigs = {
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
new game_audit_service_stack_1.GameAuditServiceStack(app, `GameAuditService-${environment}`, {
    env: {
        account: envConfig.awsAccountId,
        region: envConfig.primaryRegion
    },
    environment,
    description: `Audit service for Loupeen RTS Platform (${environment})`
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1hdWRpdC1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2dhbWUtYXVkaXQtc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDhFQUF3RTtBQUV4RSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixvREFBb0Q7QUFDcEQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksTUFBTSxDQUFDO0FBRXBFLDRCQUE0QjtBQUM1QixNQUFNLFVBQVUsR0FBb0U7SUFDbEYsSUFBSSxFQUFFO1FBQ0osWUFBWSxFQUFFLGNBQWM7UUFDNUIsYUFBYSxFQUFFLFlBQVk7S0FDNUI7SUFDRCxFQUFFLEVBQUU7UUFDRixZQUFZLEVBQUUsY0FBYztRQUM1QixhQUFhLEVBQUUsV0FBVztLQUMzQjtJQUNELFVBQVUsRUFBRTtRQUNWLFlBQVksRUFBRSxjQUFjO1FBQzVCLGFBQWEsRUFBRSxXQUFXO0tBQzNCO0NBQ0YsQ0FBQztBQUVGLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDO0FBRTdELElBQUksZ0RBQXFCLENBQUMsR0FBRyxFQUFFLG9CQUFvQixXQUFXLEVBQUUsRUFBRTtJQUNoRSxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsU0FBUyxDQUFDLFlBQVk7UUFDL0IsTUFBTSxFQUFFLFNBQVMsQ0FBQyxhQUFhO0tBQ2hDO0lBQ0QsV0FBVztJQUNYLFdBQVcsRUFBRSwyQ0FBMkMsV0FBVyxHQUFHO0NBQ3ZFLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2sgfSBmcm9tICcuLi9saWIvZ2FtZS1hdWRpdC1zZXJ2aWNlLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGZyb20gY29udGV4dCBvciBkZWZhdWx0IHRvICd0ZXN0J1xuY29uc3QgZW52aXJvbm1lbnQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnZpcm9ubWVudCcpIHx8ICd0ZXN0JztcblxuLy8gRW52aXJvbm1lbnQgY29uZmlndXJhdGlvblxuY29uc3QgZW52Q29uZmlnczogUmVjb3JkPHN0cmluZywgeyBhd3NBY2NvdW50SWQ6IHN0cmluZzsgcHJpbWFyeVJlZ2lvbjogc3RyaW5nIH0+ID0ge1xuICB0ZXN0OiB7XG4gICAgYXdzQWNjb3VudElkOiAnNzI4NDI3NDcwMDQ2JyxcbiAgICBwcmltYXJ5UmVnaW9uOiAnZXUtbm9ydGgtMSdcbiAgfSxcbiAgcWE6IHtcbiAgICBhd3NBY2NvdW50SWQ6ICcwNzcwMjk3ODQyOTEnLCBcbiAgICBwcmltYXJ5UmVnaW9uOiAndXMtZWFzdC0xJ1xuICB9LFxuICBwcm9kdWN0aW9uOiB7XG4gICAgYXdzQWNjb3VudElkOiAnOTk5OTk5OTk5OTk5JyxcbiAgICBwcmltYXJ5UmVnaW9uOiAndXMtZWFzdC0xJ1xuICB9XG59O1xuXG5jb25zdCBlbnZDb25maWcgPSBlbnZDb25maWdzW2Vudmlyb25tZW50XSB8fCBlbnZDb25maWdzLnRlc3Q7XG5cbm5ldyBHYW1lQXVkaXRTZXJ2aWNlU3RhY2soYXBwLCBgR2FtZUF1ZGl0U2VydmljZS0ke2Vudmlyb25tZW50fWAsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogZW52Q29uZmlnLmF3c0FjY291bnRJZCxcbiAgICByZWdpb246IGVudkNvbmZpZy5wcmltYXJ5UmVnaW9uXG4gIH0sXG4gIGVudmlyb25tZW50LFxuICBkZXNjcmlwdGlvbjogYEF1ZGl0IHNlcnZpY2UgZm9yIExvdXBlZW4gUlRTIFBsYXRmb3JtICgke2Vudmlyb25tZW50fSlgXG59KTsiXX0=