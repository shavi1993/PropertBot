const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  waId:    { type: String, required: true, unique: true }, // phone number
  name:    { type: String },
  contact: { type: String },
  onboarded: { type: Boolean, default: false },
  step:    { type: String, default: 'ask_name' }, // ask_name → ask_contact → done
  listingDraft: { type: mongoose.Schema.Types.Mixed, default: {} },
  actionDraft:  { type: mongoose.Schema.Types.Mixed, default: {} },
  searchDraft: { type: mongoose.Schema.Types.Mixed, default: {} },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);