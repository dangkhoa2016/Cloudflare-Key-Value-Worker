const moment = require('moment');

const secondsToTime = (secs) => {
  secs = Math.round(secs);
  const hours = Math.floor(secs / (60 * 60));

  const divisor_for_minutes = secs % (60 * 60);
  const minutes = Math.floor(divisor_for_minutes / 60);

  const divisor_for_seconds = divisor_for_minutes % 60;
  const seconds = Math.ceil(divisor_for_seconds);

  const obj = {
    "h": hours,
    "m": minutes,
    "s": seconds
  };
  return obj;
};

const formatHumanReadable = (secs) => {
  const obj = secondsToTime(secs);
  return `Vui lòng thử lại sau ${obj.h} giờ, ${obj.m} phút, ${obj.s} giây - [${moment().add(secs, 'seconds').format('LLLL')}]`;
};

const formatDuration = (ms) => {
  if (ms < 0) ms = -ms;
  const time = {
    day: Math.floor(ms / 86400000),
    hour: Math.floor(ms / 3600000) % 24,
    minute: Math.floor(ms / 60000) % 60,
    second: Math.floor(ms / 1000) % 60,
    // millisecond: Math.floor(ms) % 1000
  };
  return Object.entries(time)
    .filter(val => val[1] !== 0)
    .map(val => `${val[1]} ${(val[1] !== 1) ? `${val[0]}s` : val[0]}`)
    .join(', ');
};

module.exports = {
  formatHumanReadable,
  formatDuration,
  secondsToTime,
};
