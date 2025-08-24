module.exports = {
  displayName: 'Unit Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: [
    '<rootDir>/test/unit/**/*.test.ts',
    '<rootDir>/test/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/test/integration/',
    '<rootDir>/test/performance/'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'clover'],
  collectCoverageFrom: [
    'lib/**/*.ts',
    'lambda/**/*.ts',
    '!lib/**/*.d.ts',
    '!lib/**/*.js',
    '!**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 75,
      lines: 80
    }
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'unit-test-results.xml'
    }],
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'unit-test-report.html',
      expand: true
    }]
  ]
};