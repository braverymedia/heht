const isProduction = process.env.ELEVENTY_ENV === 'production';

module.exports = {
  plugins: {
    autoprefixer: {},
    'postcss-preset-env': {
      stage: 1,
      features: {
        // Sass already emits flat CSS, native-nesting rewrite is a no-op.
        'nesting-rules': false,
        // Our browserslist (Chrome 111+, Safari 16.4+, Firefox 113+) has
        // had native var() support for years. Disabling this stops the
        // plugin from emitting a resolved fallback before every var()
        // reference — which was the single biggest source of bloat.
        'custom-properties': false,
      }
    },
    ...(isProduction && {
      cssnano: {
        preset: [
          'default',
          {
            discardComments: {
              removeAll: true
            },
            reduceIdents: false,
            mergeLonghand: false,
            normalizeUrl: false,
            calc: false,
            reduceTransforms: false,
            zindex: false,
            minifySelectors: false,
            minifyParams: false,
            minifyFontValues: false,
            minifySelectors: {
              whitelist: ['body', 'html', 'main', 'header', 'footer', 'nav', 'article', 'section']
            }
          }
        ]
      }
    })
  }
};
