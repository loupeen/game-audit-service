"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
// Extend Jest timeout for integration tests
globals_1.jest.setTimeout(30000);
// Global test setup
beforeAll(async () => {
    // Suppress console logs during tests (unless debugging)
    if (!process.env.DEBUG_TESTS) {
        global.console = {
            ...console,
            log: globals_1.jest.fn(),
            debug: globals_1.jest.fn(),
            info: globals_1.jest.fn(),
            warn: globals_1.jest.fn(),
            error: console.error // Keep errors visible
        };
    }
    // Set AWS configuration for tests
    process.env.AWS_REGION = process.env.TEST_REGION || 'eu-north-1';
    // Ensure we don't accidentally hit production
    if (process.env.TEST_ENV === 'production') {
        throw new Error('Cannot run tests against production environment');
    }
    // Mock environment variables
    process.env.AUDIT_TABLE_NAME = 'test-audit-events-table';
    process.env.ENVIRONMENT = 'test';
    process.env.LOG_LEVEL = 'DEBUG';
});
// Global test teardown
afterAll(async () => {
    // Add any global cleanup here
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi90ZXN0L3NldHVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMkNBQXFDO0FBRXJDLDRDQUE0QztBQUM1QyxjQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRXZCLG9CQUFvQjtBQUNwQixTQUFTLENBQUMsS0FBSyxJQUFJLEVBQUU7SUFDbkIsd0RBQXdEO0lBQ3hELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzdCLE1BQU0sQ0FBQyxPQUFPLEdBQUc7WUFDZixHQUFHLE9BQU87WUFDVixHQUFHLEVBQUUsY0FBSSxDQUFDLEVBQUUsRUFBRTtZQUNkLEtBQUssRUFBRSxjQUFJLENBQUMsRUFBRSxFQUFFO1lBQ2hCLElBQUksRUFBRSxjQUFJLENBQUMsRUFBRSxFQUFFO1lBQ2YsSUFBSSxFQUFFLGNBQUksQ0FBQyxFQUFFLEVBQUU7WUFDZixLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0I7U0FDNUMsQ0FBQztJQUNKLENBQUM7SUFFRCxrQ0FBa0M7SUFDbEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksWUFBWSxDQUFDO0lBRWpFLDhDQUE4QztJQUM5QyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLFlBQVksRUFBRSxDQUFDO1FBQzFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRUQsNkJBQTZCO0lBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEdBQUcseUJBQXlCLENBQUM7SUFDekQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDO0lBQ2pDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQztBQUNsQyxDQUFDLENBQUMsQ0FBQztBQUVILHVCQUF1QjtBQUN2QixRQUFRLENBQUMsS0FBSyxJQUFJLEVBQUU7SUFDbEIsOEJBQThCO0FBQ2hDLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgamVzdCB9IGZyb20gJ0BqZXN0L2dsb2JhbHMnO1xuXG4vLyBFeHRlbmQgSmVzdCB0aW1lb3V0IGZvciBpbnRlZ3JhdGlvbiB0ZXN0c1xuamVzdC5zZXRUaW1lb3V0KDMwMDAwKTtcblxuLy8gR2xvYmFsIHRlc3Qgc2V0dXBcbmJlZm9yZUFsbChhc3luYyAoKSA9PiB7XG4gIC8vIFN1cHByZXNzIGNvbnNvbGUgbG9ncyBkdXJpbmcgdGVzdHMgKHVubGVzcyBkZWJ1Z2dpbmcpXG4gIGlmICghcHJvY2Vzcy5lbnYuREVCVUdfVEVTVFMpIHtcbiAgICBnbG9iYWwuY29uc29sZSA9IHtcbiAgICAgIC4uLmNvbnNvbGUsXG4gICAgICBsb2c6IGplc3QuZm4oKSxcbiAgICAgIGRlYnVnOiBqZXN0LmZuKCksXG4gICAgICBpbmZvOiBqZXN0LmZuKCksXG4gICAgICB3YXJuOiBqZXN0LmZuKCksXG4gICAgICBlcnJvcjogY29uc29sZS5lcnJvciAvLyBLZWVwIGVycm9ycyB2aXNpYmxlXG4gICAgfTtcbiAgfVxuXG4gIC8vIFNldCBBV1MgY29uZmlndXJhdGlvbiBmb3IgdGVzdHNcbiAgcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiA9IHByb2Nlc3MuZW52LlRFU1RfUkVHSU9OIHx8ICdldS1ub3J0aC0xJztcbiAgXG4gIC8vIEVuc3VyZSB3ZSBkb24ndCBhY2NpZGVudGFsbHkgaGl0IHByb2R1Y3Rpb25cbiAgaWYgKHByb2Nlc3MuZW52LlRFU1RfRU5WID09PSAncHJvZHVjdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBydW4gdGVzdHMgYWdhaW5zdCBwcm9kdWN0aW9uIGVudmlyb25tZW50Jyk7XG4gIH1cbiAgXG4gIC8vIE1vY2sgZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gIHByb2Nlc3MuZW52LkFVRElUX1RBQkxFX05BTUUgPSAndGVzdC1hdWRpdC1ldmVudHMtdGFibGUnO1xuICBwcm9jZXNzLmVudi5FTlZJUk9OTUVOVCA9ICd0ZXN0JztcbiAgcHJvY2Vzcy5lbnYuTE9HX0xFVkVMID0gJ0RFQlVHJztcbn0pO1xuXG4vLyBHbG9iYWwgdGVzdCB0ZWFyZG93blxuYWZ0ZXJBbGwoYXN5bmMgKCkgPT4ge1xuICAvLyBBZGQgYW55IGdsb2JhbCBjbGVhbnVwIGhlcmVcbn0pO1xuXG5leHBvcnQge307Il19