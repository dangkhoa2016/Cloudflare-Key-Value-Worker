const debug = require('debug')('cloudflare-key-value-worker=>routes=>test');

module.exports = (app) => {

  app.get('/user/:name', async (c) => {
    // const name = c.req.param('name');
    const { name } = c.req.param();

    const headers = c.req.header();
    debug('headers', headers);

    const query = c.req.query();
    debug('query', query);

    debug('env', c.env);
    await c.env.REFRESH_TOKEN.put('user', name);

    return c.json({ name }, 200);
  });
  
};
