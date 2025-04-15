import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const __dirname = path.dirname(new URL('.', import.meta.url).pathname);
const stylesDir = path.resolve(__dirname, 'src/assets/styles');
const nodeModulesDir = path.resolve(__dirname, 'node_modules');

export default {
  input: 'src/assets/styles/main.scss',
  output: {
    file: 'src/_includes/assets/__ignore.js', // dummy JS file, not used
    format: 'es',
  },
  plugins: [
    postcss({
      extract: 'assets/main.css',
      minimize: isProduction,
      sourceMap: !isProduction,
      plugins: [
        autoprefixer(),
        ...(isProduction ? [cssnano()] : [])
      ],
      use: [
        [
          'sass',
          {
            includePaths: [stylesDir, nodeModulesDir]
          }
        ]
      ]
    })
  ]
};