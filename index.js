process.env.DEBUG = 'cloudflare-key-value-worker*';

const { Hono } = require('hono');
const app = new Hono();
const key_values_route = require('./routes/key_values');
const home_route = require('./routes/home');
const error_route = require('./routes/errors');
// const test_route = require('./routes/test');
const middleware = require('./middleware');

middleware(app);
error_route(app);
home_route(app);
key_values_route(app);

// test
// test_route(app);

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
