const { Schema, ObjectId, createModel } = require('./mariaSchema');

// Separate expiring records preserve the existing User schema and collections.
const passwordResetSchema = new Schema({
    userId: { type: ObjectId, ref: 'User', required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true },
    passwordFingerprint: { type: String, required: true },
    email: { type: String, required: true },
    requestedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }
});

passwordResetSchema.index({ userId: 1 }, { unique: true });
passwordResetSchema.index({ tokenHash: 1 }, { unique: true });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = require('./mariaRepository')(createModel('PasswordReset', passwordResetSchema));
