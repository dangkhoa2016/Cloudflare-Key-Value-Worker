const debug = require('debug')('cloudflare-key-value-worker=>libs=>helpers');
const AdmZip = require('adm-zip');
const moment = require('moment');
const { ISO8601format, } = require('./variables');

const isValidDate = (date) => {
  return date && Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date);
};

const parseDate = (date) => {
  if (!date)
    return null;

  if (isValidDate(date))
    return moment(date);

  if (typeof (date) === 'number' && date > 28800000) // January 1, 1970 on Unix like systems.
    return moment(date);

  const mm = moment(date, ISO8601format, true);
  return mm.isValid() ? mm : null;
};

const getExpiredDateValue = (expirationTime) => {
  if (!expirationTime)
    return null;

  const parsedDate = parseDate(expirationTime);
  if (!parsedDate)
    return null;

  if (parsedDate <= moment()) {
    debug(`getExpiredDateValue: time [${parsedDate.toDate()} is in the past, can not use.`);
    return null;
  } else
    return parsedDate.valueOf();
};

const checkErrorId = (id) => {
  if (!id) {
    return {
      error: 'Please provide key id.'
    };
  }

  const [schema, ...value] = id.split(':');
  if (!schema || value.length === 0) {
    return {
      error: 'Please provide key id in format [Schema]:[Value].'
    };
  }

  return null;
};

const replacer = (key, value) => (value === null ? '' : value);
const processRow = (row, header) => {
  return header.map(fieldName => {
    return row[fieldName] ? JSON.stringify(row[fieldName], replacer).replace(/\\"/g, '""') : '';
  }).join(',');
};
const jsonToCSV = (arrayOfJson, csv = null) => {
  const header = Object.keys(arrayOfJson[0]);
  const arr = arrayOfJson.map(row => (processRow(row, header)));

  if (csv === null) {
    arr.unshift(header.join(','));
    csv = [];
  }

  return csv.concat(arr);
};

const jsonToZip = (type, arrayOfJson, zip = null) => {
  // creating archives
  if (zip === null)
    zip = new AdmZip();

  for (const record of arrayOfJson) {
    zip.addFile(`${type}_${record.id}.json`, Buffer.from(JSON.stringify(record), 'utf8'));
  }

  return zip;
};

const streamToString = (stream) => {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  })
};

module.exports = {
  getExpiredDateValue, parseDate,
  checkErrorId, jsonToCSV,
  streamToString, jsonToZip,
}
