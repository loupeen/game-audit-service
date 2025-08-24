const baseConfig = require('../../jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '<rootDir>/test/integration/**/*.test.ts',
    '<rootDir>/test/integration/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/config/integration-setup.ts'
  ],
  testTimeout: 60000, // 60 seconds for integration tests
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'integration-test-results.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'integration-test-report.html',
      expand: true
    }]
  ],
  collectCoverageFrom: [
    'lambda/**/*.ts',
    'lib/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ]
};