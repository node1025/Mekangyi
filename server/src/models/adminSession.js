const { Schema, ObjectId, createModel } = require('./mariaSchema');
const schema = new Schema({
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  accessTokenHash: { type: String, required: true },
  passwordFingerprint: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });
module.exports = require('./mariaRepository')(createModel('AdminSession', schema));
