module.exports = {
  chainWebpack: config => {
    config.module
      .rule('csv')
      .test(/\.csv$/)
      .use('file-loader')
      .loader('file-loader');
  }
};
