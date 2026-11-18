const { Schema, ObjectId, createModel } = require('./mariaSchema');

const wishlistSchema = new Schema({
  userId: {
    type: ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    productId: {
      type: ObjectId,
      ref: 'Product',
      required: true
    }
  }]
}, { timestamps: true });

module.exports = require('./mariaRepository')(createModel('Wishlist', wishlistSchema));
