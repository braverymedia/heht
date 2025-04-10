import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: './src/assets/js/index.js',
  output: {
    file: './src/assets/js/bundle.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    nodeResolve(),
    commonjs()
  ]
}
