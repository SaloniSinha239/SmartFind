const mongoose = require('mongoose');
const { Readable } = require('stream');

let bucket;

/**
 * Initialize GridFS bucket — called once after MongoDB connection.
 */
function initGridFS(connection) {
  bucket = new mongoose.mongo.GridFSBucket(connection.db, {
    bucketName: 'uploads'
  });
}

/**
 * Get the GridFS bucket instance.
 */
function getBucket() {
  if (!bucket) throw new Error('GridFS not initialized');
  return bucket;
}

/**
 * Upload a buffer to GridFS.
 * @returns {Promise<ObjectId>} The GridFS file ID.
 */
function uploadToGridFS(buffer, filename, mimetype) {
  return new Promise((resolve, reject) => {
    const readStream = Readable.from(buffer);
    const uploadStream = getBucket().openUploadStream(filename, {
      contentType: mimetype
    });
    readStream.pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id));
  });
}

/**
 * Get a readable stream for a GridFS file.
 * @returns {GridFSBucketReadStream}
 */
function getFileStream(fileId) {
  return getBucket().openDownloadStream(new mongoose.Types.ObjectId(fileId));
}

/**
 * Delete a file from GridFS.
 */
async function deleteFile(fileId) {
  await getBucket().delete(new mongoose.Types.ObjectId(fileId));
}

module.exports = { initGridFS, getBucket, uploadToGridFS, getFileStream, deleteFile };
