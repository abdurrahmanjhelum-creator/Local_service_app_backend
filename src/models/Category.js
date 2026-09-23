const mongoose = require('mongoose');

// Category ka schema (bagair description ke)
const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name zaroori hai'],
        unique: true,
        trim: true
    },
    iconName: {
        type: String,
        default: 'ic_service_default'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);