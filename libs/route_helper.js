const debug = require('debug')('cloudflare-key-value-worker=>libs=>route_helper');
const { jsonToCSV, jsonToZip, streamToString, } = require('./helpers');
const { statusCodes, namespace, } = require('./variables');
const Promise = require('bluebird');

const returnValue = (key, value, metadata) => {
  debug(`returnValue: key [${key}]`, JSON.stringify(value, metadata));
  if (value)
    value = value.x;

  return { result: metadata ? { value, metadata } : (value || undefined), code: statusCodes.OK };
};

const getKeyValueObject = async (key, kv, getMeta = false) => {
  if (!key) {
    debug('getKeyValueObject: No key params');
    return { result: null, code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  /*
  const validateResult = checkErrorId(key);
  if (validateResult) {
    return { result: validateResult.error, code: statusCodes.UNPROCESSABLE_ENTITY };
  }
  */

  let value = null;
  let metadata = null;
  const options = { type: 'json', cacheTtl: 3600 };

  try {
    if (getMeta) {
      const result = await kv.getWithMetadata(`${namespace}:${key}`, options);
      value = result.value;
      metadata = result.metadata;
    } else
      value = await kv.get(`${namespace}:${key}`, options);

  } catch (error) {
    debug('getKeyValueObject: Error get key', error);
    return { result: null, code: statusCodes.INTERNAL_SERVER_ERROR };
  }

  return returnValue(key, value, metadata);
};

const handleGetKey = async (c) => {
  const data = await getKeyValueObject(c.req.param('key'), c.env.REFRESH_TOKEN, c.req.query('meta'));

  const { code, result } = data;
  if (code === statusCodes.OK)
    return c.json(result);
  else
    return c.text(result, code);
};

const listKeys = async ({ prefix = '', limit = 0, cursor }, kv) => {
  let result = null;
  limit = Number(limit) || 0;
  if (limit <= 0 || limit > 1000)
    limit = 1000;

  try {
    // refer: https://developers.cloudflare.com/workers/runtime-apis/kv/#listing-keys
    // sample: {"list_complete":true/false, "keys":[{"name":"user:lllll"},{"name":"user:xxx"}]
    result = await kv.list({ prefix: `${namespace}:${prefix}`, limit, cursor, });
  } catch (error) {
    debug('listKeys: Error list key', error);
    return { result, code: statusCodes.INTERNAL_SERVER_ERROR };
  }

  if (result && Array.isArray(result.keys)) {
    result.keys = result.keys.map(key => {
      return { name: key.name.replace(`${namespace}:`, '') };
    });
  }

  return { result, code: statusCodes.OK };
};

/*
const listAllKeys = async ({ prefix = '', limit, cursor }, kv) => {
  let is_continue = true;
  const data = { result: [], code: statusCodes.OK };
  while (is_continue) {
    const { result = {} } = await listKeys({ prefix, limit, cursor }, kv);
    debug('listAllKeys', JSON.stringify(result));
    if (result)
      data.result = data.result.concat(result.keys || []);

    cursor = (result.cursor || '');
    is_continue = cursor.length > 0;
  }

  return data;
};
*/

const handleListKeys = async (c) => {
  const { prefix = '', limit = 0, cursor, } = c.req.query();
  const { result: { keys }, code } = await listKeys({ prefix, limit, cursor }, c.env.REFRESH_TOKEN);

  return c.json(keys, code);
};

const handleDeleteKey = async (c) => {
  const { key } = c.req.param();
  try {
    const result = await c.env.REFRESH_TOKEN.delete(`${namespace}:${key}`);
    debug('handleDeleteKey: result', `${namespace}:${key}`, result);
  } catch (error) {
    debug('handleDeleteKey: Error delete key', error);
    return c.text(null, statusCodes.INTERNAL_SERVER_ERROR);
  }

  return c.text(null, statusCodes.NO_CONTENT);
};

const getExportData = async (c, { prefix = '', limit, cursor }, export_type = 'json') => {
  let { /*code, */result: { keys: arr = [] } } = await listKeys({ prefix, limit, cursor }, c.env.REFRESH_TOKEN);

  if (arr.length === 0) {
    debug('getExportData: No key-values for export.');
    return null;
  }

  arr = await Promise.map(arr, async item => {
    const { result = '' } = await getKeyValueObject(item.name, c.env.REFRESH_TOKEN, true);
    return { key: item.name, value: (result && result.metadata) ? { ...result } : result };
  }, { concurrency: 4 });

  switch (export_type.toLowerCase()) {
    case 'zip':
      return jsonToZip('KeyValue', arr).toBuffer();
    case 'csv':
      return Buffer.from(jsonToCSV(arr).join('\n'));
    default:
      return Buffer.from(JSON.stringify(arr));
  }
};

const handleExportKeys = async (c) => {
  const { prefix = '', limit, cursor, format = 'json', } = c.req.query();
  let buf = null;

  try {
    buf = await getExportData(c, { limit, prefix, cursor }, format);
    debug('handleExportKeys', buf);
  } catch (error) {
    debug('/export Error', error);
    return c.text(null, statusCodes.INTERNAL_SERVER_ERROR);
  }

  const fileName = `export-key-value-${(new Date()).valueOf()}.${format.toLowerCase()}`;
  c.res.headers.append('Content-Disposition', `attachment; filename=${fileName}`);
  c.res.headers.append('Content-Type', 'application/octet-stream');

  return c.body(buf);
};

const getExpired = (expirationTtl, expiration) => {
  const params = { };
  if (expiration)
    params.expiration = expiration;
  else if (expirationTtl)
    params.expirationTtl = expirationTtl;

  return params;
};

const saveKey = async (body, kv) => {
  const { key, value, expirationTtl, expiration, metadata, } = (body || {});

  if (!key || typeof key !== 'string') {
    debug('saveKey: Invalid key', key);
    return { code: statusCodes.UNPROCESSABLE_ENTITY, result: null };
  }

  const params = { metadata, ...getExpired(expirationTtl, expiration) };
  debug('saveKey: params', params);

  try {
    await kv.put(`${namespace}:${key}`, JSON.stringify({ x: value }), params);
    return { code: statusCodes.OK, result: null };
  } catch (ex) {
    debug(`saveKey: Error save key [${key}]`, ex);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, result: null };
  }
};

const handleSaveKey = async (c) => {
  const body = await c.req.json();
  debug('handleSaveKey: json', body);

  /*
  if (!body || Object.keys(body).length === 0)
    body = await c.req.parseBody();
  debug('handleSaveKey: json', body);
  */

  let { key, value, expired, metadata, } = (body || {});
  if (!key)
    key = c.req.param('key');

  const { result, code } = await saveKey({ key, value, expired, metadata, }, c.env.REFRESH_TOKEN);
  return c.text(result, code);
};

const importData = async (data, kv) => {
  debug('importData: json data', data);

  if (!Array.isArray(data) || data.length === 0) {
    debug('importData: Nothing to import');
    return { code: statusCodes.NOTHING_TO_IMPORT };
  }

  const arr = await Promise.map(data, async row => {
    const { key, value, } = row || {};
    const result = await saveKey({ key, value }, kv);
    debug('importData: saveKey result', result);
    return result;
  }, { concurrency: 1 }).filter(f => f);

  debug(`importData: Imported ${arr.length} key-value`);
  return { code: statusCodes.OK, message: arr.length };
};

const importKeys = async ({ url, auth_token }, kv) => {
  if (!url || typeof (url) !== 'string' || !url.toLowerCase().startsWith('http')) {
    debug('importKeys: Empty url');
    return { code: statusCodes.UNPROCESSABLE_ENTITY };
  }

  const sym = url.includes('?') ? '&' : '?';
  url = `${url}${sym}auth_token=${auth_token}`;

  try {
    let { data } = (await fetch(url)) || {};

    data = await streamToString(data);
    if (data) data = JSON.parse(data);

    return await importData(data, kv);
  } catch (error) {
    debug('import: Error load json data', error);
    return { code: statusCodes.INTERNAL_SERVER_ERROR, error: error.message };
  }
};

const handleImportKeys = async (c) => {
  let { url, auth_token } = c.req.json();
  if (!url || typeof (url) !== 'string')
    return c.notFound();

  if (!auth_token) auth_token = c.req.query('auth_token');
  const { code, message, error } = await importKeys({ url, auth_token: auth_token.trim() }, c.env.REFRESH_TOKEN);
  debug('handleImportKeys: result', code, message, error);
  return c.text(code === statusCodes.INTERNAL_SERVER_ERROR ? message : undefined, code);
};

module.exports = {
  handleSaveKey, handleGetKey, handleImportKeys,
  handleListKeys, handleDeleteKey, handleExportKeys,
};

