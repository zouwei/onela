/**
 * Jest 配置文件
 * Onela ORM Framework 测试配置
 */

/** @type {import('jest').Config} */
const config = {
  // 使用 ts-jest 转换 TypeScript 文件
  preset: 'ts-jest/presets/default-esm',

  // Node.js 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.ts',
  ],

  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // 路径别名映射
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // 转换配置
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'Node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          target: 'ES2020',
          strict: false,
          skipLibCheck: true,
        },
      },
    ],
  },

  // 忽略转换的模块
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],

  // ESM 支持
  extensionsToTreatAsEsm: ['.ts'],

  // 测试超时时间 (30秒)
  testTimeout: 30000,

  // 详细输出
  verbose: true,

  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],

  // 覆盖率目录
  coverageDirectory: 'coverage',

  // 根目录
  rootDir: '.',

  // 全局设置
  globals: {},
};

export default config;
