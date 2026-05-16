const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    return (req, res, next) => {
      // /data/ 경로로 들어오는 요청을 가로채서 public/data/ 폴더의 파일을 제공
      if (req.url.startsWith('/data/')) {
        const filePath = path.join(__dirname, 'public', req.url);
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(fs.readFileSync(filePath));
          return;
        } else {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
