const { handleSaveKey, handleGetKey, handleImportKeys,
  handleListKeys, handleDeleteKey, handleExportKeys, } = require('../libs/route_helper');
const routeMethods = ['post', 'put', 'patch'];

module.exports = (app) => {

  routeMethods.forEach(method => {
    app[method]('/', handleSaveKey);
  });

  routeMethods.forEach(method => {
    app[method]('/:key', handleSaveKey);
  });


  app.get('/search', handleListKeys);
  app.get('/export', handleExportKeys);
  app.post('/import', handleImportKeys);
  app.get('/:key', handleGetKey);
  app.delete('/:key', handleDeleteKey);

};
