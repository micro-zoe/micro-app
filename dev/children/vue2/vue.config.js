const path = require('path');

module.exports = {
  publicPath: '/micro-app/vue2/',
  outputDir: 'vue2',
  productionSourceMap: false,
  devServer: {
    hot: true,
    disableHostCheck: true,
    port: 4001,
    overlay: {
      warnings: false,
      errors: true,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  lintOnSave: false,

  // 自定义webpack配置
  configureWebpack: {
    output: {
      jsonpFunction: `webpackJsonp-chile-vue2`,
      // globalObject: 'window',
    }
  },
  chainWebpack: config => {
    config.resolve.alias
      .set("@micro-zoe/micro-app", path.join(__dirname, '../../../lib/index.esm.js'))
  },
}
