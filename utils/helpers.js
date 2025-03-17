const { DEVELOPERS, WORKERS } = require('../config/env');

const isDeveloper = (username) => {
  if (!username) return false;
  return DEVELOPERS.map(dev => dev.toLowerCase()).includes(username.toLowerCase());
};

const isWorker = (username) => {
  if (!username) return false;
  return WORKERS.map(worker => worker.toLowerCase()).includes(username.toLowerCase());
};

module.exports = { isDeveloper, isWorker };
