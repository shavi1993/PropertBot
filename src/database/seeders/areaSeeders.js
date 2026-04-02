const Area = require('../../models/Area');

const areas = [
  // ─── Special Zones ───────────────────────────────────
  "Aerocity",
  "Aerotropolis",
  "IT City Mohali",
  "Industrial Area Phase 7",
  "Industrial Area Phase 8",
  "Industrial Area Phase 9",
  "Airport Road (PR-7)",
  "JLPL Industrial Area",
  "Bestech Square Area",
  "Quark City",
  "Mohali Hills",
  "Sunny Enclave (Urban Extension)",

  // ─── Sectors ─────────────────────────────────────────
  "Sector 48", "Sector 51", "Sector 52", "Sector 54",
  "Sector 55 (Phase 1)", "Sector 56 (Phase 2)", "Sector 57 (Phase 3)",
  "Sector 58 (Phase 4)", "Sector 59 (Phase 5)", "Sector 60 (Phase 6)",
  "Sector 61 (Phase 7)", "Sector 62 (Phase 8)", "Sector 63 (Phase 9)",
  "Sector 64 (Phase 10)", "Sector 65 (Phase 11)",
  "Sector 66", "Sector 67", "Sector 68", "Sector 69", "Sector 70",
  "Sector 71", "Sector 72", "Sector 73", "Sector 74", "Sector 75",
  "Sector 76", "Sector 77", "Sector 78", "Sector 79", "Sector 80",
  "Sector 81", "Sector 82", "Sector 82A", "Sector 83", "Sector 83A",
  "Sector 84", "Sector 85", "Sector 86", "Sector 87", "Sector 88",
  "Sector 89", "Sector 90", "Sector 91", "Sector 92", "Sector 92A",
  "Sector 93", "Sector 94", "Sector 95", "Sector 96", "Sector 97",
  "Sector 98", "Sector 99", "Sector 100", "Sector 101", "Sector 102",
  "Sector 103", "Sector 104", "Sector 105", "Sector 106", "Sector 107",
  "Sector 108", "Sector 109", "Sector 110", "Sector 111", "Sector 112",
  "Sector 113", "Sector 114", "Sector 115", "Sector 116", "Sector 117",
  "Sector 118", "Sector 119", "Sector 120", "Sector 121", "Sector 122",
  "Sector 123", "Sector 124", "Sector 125", "Sector 126", "Sector 127",
  "Sector 128",
];

async function seedAreas() {
  try {
    const existing = await Area.countDocuments();
    if (existing > 0) {
      console.log(`⏭️  Areas already seeded (${existing} records). Skipping.`);
      return;
    }

    // ✅ No need to set status — schema defaults to CONST_KEY.STATUS.ACTIVE (1)
    const docs = areas.map((title) => ({ title }));
    await Area.insertMany(docs);
    console.log(`✅ Seeded ${docs.length} areas successfully.`);
  } catch (err) {
    console.error('❌ Area seeding failed:', err.message);
  }
}

module.exports = seedAreas;