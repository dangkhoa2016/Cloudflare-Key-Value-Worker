
const mustExcludes = ['/', '/favicon.ico', '/favicon.png', '/404', '/500'];
const ISO8601format = ['YYYY-MM-DDTHH:mm:ss.SSSSZ', 'YYYY-MM-DDTHH:mm:ss.sssZ', 'YYYY-MM-DDTHH:mm:ssZ'];
const namespace = 'key-value-worker';

const statusCodes = {
  MISSING_TOKEN: 425,
  INVALID_REQUEST_SO_MANY_TIMES: 428,
  NOT_FOUND: 404,
  DUPLICATED: 409,
  NOTHING_TO_IMPORT: 411,
  OK: 200,
  INTERNAL_SERVER_ERROR: 500,
  DATA_CREATED: 201,
  UNPROCESSABLE_ENTITY: 422,
  INVALID_AUTH_TOKEN: 410,
  NO_CONTENT: 204,
  TOO_MANY_REQUESTS: 429,
}

module.exports = {
  mustExcludes, namespace,
  ISO8601format, statusCodes,
}
