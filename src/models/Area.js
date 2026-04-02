const mongoose = require('mongoose');
const CONST_KEY = require("../utils/constKey");

const areaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
        type: Number,
        enum: [CONST_KEY.STATUS.INACTIVE, CONST_KEY.STATUS.ACTIVE, CONST_KEY.STATUS.DELETED],// ( 0 inactive, 1 active ,2 delete )
        default: CONST_KEY.STATUS.ACTIVE,
      },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Area', areaSchema);