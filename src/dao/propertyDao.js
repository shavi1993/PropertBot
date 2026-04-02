const mongoose                       = require('mongoose');
const Property  = require('../models/Property');
const CONST_KEY = require('../utils/constKey');

// ─── CREATE ───────────────────────────────────────────────────────────────────

async function createProperty(data) {
  const property = new Property(data);
  return property.save();
}

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Get all active listings for a seller.
 * @param {ObjectId} sellerId - user._id from User model
 */
async function getPropertiesBySeller(sellerId) {
  return Property.find({
    sellerId:        sellerId,
    property_status: CONST_KEY.PROPERTY_STATUS.ACTIVE,
  }).populate('area').lean();
}

/**
 * Get a single property by its _id.
 */
async function getPropertyById(propertyId) {
  return Property.findById(propertyId).populate('area').lean();
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

/**
 * Update allowed fields on a property.
 * Only title and price can be edited via bot for safety.
 * @param {string} propertyId
 * @param {object} fields - e.g. { title: 'New Title' } or { price: 20000 }
 */
async function updateProperty(propertyId, fields) {
  const allowed = ['title', 'price'];
  const safeFields = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) safeFields[key] = fields[key];
  }

  return Property.findByIdAndUpdate(
    propertyId,
    { $set: safeFields },
    { new: true }
  );
}

// ─── DELETE (soft) ────────────────────────────────────────────────────────────

/**
 * Soft delete — sets property_status to DELETED instead of removing from DB.
 */
async function deleteProperty(propertyId) {
  return Property.findByIdAndUpdate(
    propertyId,
    { $set: { property_status: CONST_KEY.PROPERTY_STATUS.DELETED } },
    { new: true }
  );
}
async function searchProperties({ type, area, status }) {
  console.log('[searchProperties] querying with:',  { type, area, status });

  // Check what's actually in the DB for this area
  const allForArea = await Property.find({
    area: new mongoose.Types.ObjectId(area.toString())
  });
  console.log('[searchProperties] all docs for area (ignoring type/status):', allForArea.length);
  console.log('[searchProperties] sample doc:', JSON.stringify(allForArea[0], null, 2));

  const results = await Property.find({
    type,
    area:            new mongoose.Types.ObjectId(area.toString()),
    property_status: status,
  });
  console.log('[searchProperties] final results:', results.length);
  return results;
}
module.exports = {
  createProperty,
  getPropertiesBySeller,
  getPropertyById,
  updateProperty,
  deleteProperty,
  searchProperties
};