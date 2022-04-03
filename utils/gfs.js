const mongoose = require('mongoose');

const { connection } = mongoose;

module.exports = (bucketName) => {
  const gridfs = new mongoose.mongo.GridFSBucket(connection.db, {
    bucketName,
  });
  return gridfs;
};
