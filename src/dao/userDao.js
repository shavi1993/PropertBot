const User = require('../models/User');

/**
 * Find a user by WhatsApp ID, or create one with step = 'ask_name'
 */
async function findOrCreate(waId) {
  let user = await User.findOne({ waId });
  if (!user) {
    user = await User.create({ waId, step: 'ask_name' });
  }
  return user;
}

/**
 * Update arbitrary fields on a user record
 */
async function updateUser(waId, fields) {
  return User.findOneAndUpdate(
    { waId },
    { $set: fields },  // ← add $set here
    { new: true }
  );
}

module.exports = { findOrCreate, updateUser };