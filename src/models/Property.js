const mongoose = require('mongoose');
const CONST_KEY = require("../utils/constKey");

const propertySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        country: {
            type: String,
            default: 'India',
           
           
        },
        state: {
            type: String,
            default: 'Punjab',
           
           
        },
        city: {
            type: String,
            default: 'Mohali',
            lowercase: true,
            
        },
        area: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Area',
            default: null,
        },
        price: {
            type: Number,   // changed from String → Number so min: 0 works correctly
           
            min: 0,
        },
        type: {
            type: String,
            enum: [CONST_KEY.PROPERTY_TYPE.RENT, CONST_KEY.PROPERTY_TYPE.SALE],
            required: true,
        },
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        sellerContact: {
            type: String,
            required: true,
        },
        property_status: {
            type: String,
            enum: [CONST_KEY.PROPERTY_STATUS.ACTIVE, CONST_KEY.PROPERTY_STATUS.SOLD,
            CONST_KEY.PROPERTY_STATUS.RENTED, CONST_KEY.PROPERTY_STATUS.DELETED],
            default: CONST_KEY.PROPERTY_STATUS.ACTIVE,
        },
        viewCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Property', propertySchema);