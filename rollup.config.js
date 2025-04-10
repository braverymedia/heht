import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';

// Set environment variables
const isProduction = process.env.NODE_ENV === 'production';
console.log('Rollup Build:', { isProduction, NODE_ENV: process.env.NODE_ENV });

const baseConfig = {
  input: 'src/assets/js/index.js',
  output: {
    file: 'src/assets/js/bundle.js',
    format: 'es',
    sourcemap: !isProduction,
    name: 'app'
  },
  plugins: [
    resolve(),
    commonjs(),
    esbuild({
      minify: isProduction,
      target: 'es2020',
      sourceMap: !isProduction,
      drop: isProduction ? ['console', 'debugger'] : []
    })
  ]
};

export default baseConfig;
