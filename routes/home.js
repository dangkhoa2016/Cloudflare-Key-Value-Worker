const { cache } = require('hono/cache');

module.exports = (app) => {

  app.get('/', (c) => c.text('Welcome !!!'));

  app.get('/404', (c) => {
    return c.notFound();
  });

  app.get('/favicon.ico', cache({
    cacheName: 'favicon.ico',
    cacheControl: 'max-age=7776000',
  }), async () => {
    const url = new URL("https://cdn.glitch.com/0c640c59-1ce9-47e7-9cbe-c66d0c85ee95%2F3014229.ico?v=1632009353686");
    const someCustomKey = `https://${url.hostname}${url.pathname}`;

    const response = await fetch(url, {
      cf: {
        cacheTtl: 50,
        cacheEverything: true,
        cacheKey: someCustomKey
      }
    });

    // Create an identity TransformStream (a.k.a. a pipe).
    // The readable side will become our new response body.
    const { readable, writable } = new TransformStream();

    // Start pumping the body. NOTE: No await!
    response.body.pipeTo(writable);

    // ... and deliver our Response while that’s running.
    return new Response(readable, response);
  });
};
