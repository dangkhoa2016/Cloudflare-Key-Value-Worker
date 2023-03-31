const { statusCodes, } = require('../libs/variables');
const debug = require('debug')('cloudflare-key-value-worker=>routes=>errors');

module.exports = (app) => {

  app.notFound((c) => {
    debug('Not Found', c.req.url);
    return c.text(null, statusCodes.NOT_FOUND);
  });

  app.onError((err, c) => {
    debug(`Server Error: ${err}`);
    return c.text(null, statusCodes.INTERNAL_SERVER_ERROR);
  });

};
