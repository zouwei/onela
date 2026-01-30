// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const external = ['pg', 'mysql', 'mysql2', 'sqlite3', 'better-sqlite3', 'tedious', 'oracledb'];

export default {
  input: 'src/index.v2.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
      // 关键！强制开启 default import 兼容
      interop: 'auto',           // 直接写在 output 上
      esModule: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      interop: 'auto',
    }
  ],
  plugins: [
    nodeResolve({
      preferBuiltins: true,
      // 强制保留 default export
      exportConditions: ['node', 'default', 'module', 'import'],
      // 关键！允许加载 package.json
      resolveOnly: (module) => {
        return !module.includes('package.json'); // 允许加载 package.json
      },
      extensions: ['.js', '.json', '.ts'],
    }),
    commonjs({
      // 强制所有 commonjs 模块都有 default 导出
      defaultIsModuleExports: true,
    }),
    typescript({ 
      tsconfig: './tsconfig.json',
      // 强制生成 default export
      compilerOptions: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }),
    terser()
  ],
  external,
  // 删除这行！Rollup 不认！
  // build: { rollupOptions: { ... } }
};