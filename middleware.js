
const debug = require('debug')('cloudflare-key-value-worker=>middleware');
const { cors } = require('hono/cors');
const logger = require('./logger');
const { mustExcludes, statusCodes, namespace, } = require('./libs/variables');
const Crypto = require('./libs/master_crypto');
const maxFailedAttemps = 5;
const blockDuration = 60 * 60 * 5; //5 hours
const moment = require('moment');
const timeHelper = require('./libs/time_helpers');

const deleteIP = async (kv, clientIp) => {
  try {
    await kv.delete(`${namespace}:${clientIp}`);
  } catch (error) {
    debug(`guard: Error delete blocked IP [${clientIp}]`, error);
  }
};

const handleBlockIP = async (c, { clientIp, failedCount, statusCode }) => {
  failedCount += 1;
  const remain = maxFailedAttemps - failedCount;
  if (remain <= 0) {
    debug('handleBlockIP: invalid auth token too many time');
    try {
      await c.env.BLOCKED_IPS.put(`${namespace}:${clientIp}`,
        JSON.stringify({ failedCount, blockedUntil: moment().add(blockDuration, 'seconds'), }),
        { expirationTtl: blockDuration });
    } catch (error) {
      debug(`guard: Error block IP [${clientIp}]`, error);
    }

    return c.json({
      humanReadable: timeHelper.formatHumanReadable(blockDuration)
    }, statusCodes.INVALID_REQUEST_SO_MANY_TIMES);
  }

  try {
    await c.env.BLOCKED_IPS.put(`${namespace}:${clientIp}`,
      JSON.stringify({ failedCount, blockedUntil: null, }));
  } catch (error) {
    debug(`guard: Error save failedCount blocked IP [${clientIp}]`, error);
  }

  debug('guard: remain', remain);
  c.res.headers.append('Remain', remain);

  return c.text(null, statusCode);
};

const handleBlockedIP = async (c, { blockedUntil, clientIp, failedCount }) => {
  debug('handleBlockedIP: failedCount', failedCount);
  if (failedCount >= maxFailedAttemps) {
    const retrySecs = moment(blockedUntil || undefined).diff(moment(), 'seconds');
    if (retrySecs > 0) {
      debug(`handleBlockedIP: IP [${clientIp}] already block, wait for ${retrySecs}`);
      c.res.headers.append('Retry-After', retrySecs);

      return c.json({
        humanReadable: timeHelper.formatHumanReadable(retrySecs)
      }, statusCodes.INVALID_REQUEST_SO_MANY_TIMES);
    } else {
      await deleteIP(c.env.BLOCKED_IPS, clientIp);
    }
  }

  return false;
};

const verifyToken = async (c, { token, savedIP, clientIp, failedCount }) => {
  debug('verifyToken', token);
  if (token === c.env.MASTER_KEY) {
    if (savedIP)
      await deleteIP(c.env.BLOCKED_IPS, clientIp);
    return null;
  }

  return handleBlockIP(c, { clientIp, failedCount, statusCode: statusCodes.INVALID_AUTH_TOKEN });
}

const checkTokenValid = async (c, { clientIp, savedIP, failedCount }) => {
  const masterCrypto = new Crypto(c.env.CONTENT_SECRET);
  let token = (c.req.headers.get('authorization') || '').split(' ').pop();
  token = token || c.req.query('auth_token');
  // debug('guard: token', token);

  if (!token)
    return handleBlockIP(c, { clientIp, failedCount, statusCode: statusCodes.MISSING_TOKEN });

  try {
    token = await masterCrypto.decrypt(token);
  } catch (error) {
    debug('guard: token is invalid', token, error);
    return handleBlockIP(c, { clientIp, failedCount, statusCode: statusCodes.INVALID_AUTH_TOKEN });
  }

  return verifyToken(c, { token, savedIP, clientIp, failedCount });
};

const verifyBeforeAction = async (c, { savedIP, clientIp }) => {
  let result = null;
  let failedCount = 0;

  if (savedIP) {
    failedCount = Number(savedIP.failedCount) || 0;
    result = await handleBlockedIP(c, { blockedUntil: savedIP.blockedUntil, clientIp, failedCount });
    if (result) return result;
  }

  return checkTokenValid(c, { savedIP, clientIp, failedCount });
};

const startVerify = async (c, clientIp) => {
  // check if already blocked
  let savedIP = null;
  try {
    savedIP = await c.env.BLOCKED_IPS.get(`${namespace}:${clientIp}`, { type: 'json' });
  } catch (error) {
    debug(`guard: Error get saved IP [${clientIp}]`, error);
    return c.text('Please retry in a few seconds', statusCodes.INTERNAL_SERVER_ERROR);
  }

  return verifyBeforeAction(c, { savedIP, clientIp });
};

const guard = async (c, next) => {
  const { pathname, } = new URL(c.req.url);
  const query = c.req.query();

  debug('guard', { pathname, query: JSON.stringify(query), });
  // const queries = c.req.queries('x[]');
  // debug({ queries: JSON.stringify(queries) });

  const clientIp = c.req.header('CF-Connecting-IP');
  if (!clientIp)
    return c.text(null, statusCodes.MUST_PROVIDE_USER_IP_ADDRESS);

  // https://www.cloudflare.com/cdn-cgi/trace
  // https://github.com/fawazahmed0/cloudflare-trace-api
  c.res.headers.append('Your-IP', clientIp);
  c.res.headers.append('Your-Country', c.req.header('CF-IPCountry'));

  if (!mustExcludes.includes(pathname)) {
    const result = await startVerify(c, clientIp);
    if (result) return result;
  }

  await next();
};

module.exports = (app) => {

  app.use('*', cors(), logger, guard);

};
