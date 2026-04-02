const Area = require('../models/Area');

/**
 * Fetch all active areas from the database.
 * @returns {Promise<Area[]>}
 */
async function getAllAreas() {
  return Area.find({ status: 1 }).select('_id title').lean(); // only active areas
}

/**
 * Fetch a single area by its ObjectId.
 * @param {string} id
 * @returns {Promise<Area|null>}
 */
async function getAreaById(id) {
  return Area.findById(id).lean();
}

module.exports = { getAllAreas, getAreaById };