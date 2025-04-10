const isProduction = process.env.ELEVENTY_ENV === 'production';

module.exports = {
  plugins: {
    autoprefixer: {},
    'postcss-preset-env': {
      stage: 1,
      features: {
        'nesting-rules': true,
        'custom-properties': true,
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
