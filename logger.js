
const now = () => Date.now();
const debug = require('debug')('cloudflare-key-value-worker=>logger');

const logger = async (c, next) => {
  // const path = getPathFromURL(c.req.url);

  const startTime = now();
  debug({
    info: 'received request', url: c.req.url, method: c.req.method
  });

  await next();

  debug({
    info: 'response completed',
    url: c.req.url,
    statusCode: c.res.status,
    durationMs: now() - startTime,
  });
};

module.exports = logger;
