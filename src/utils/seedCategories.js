const mongoose = require('mongoose');
const Category = require('../models/Category');

const defaultCategories = [
    { name: 'Electrician', iconName: 'electrician' },
    { name: 'Plumber', iconName: 'plumber' },
    { name: 'AC Repair', iconName: 'ac_repair' },
    { name: 'Carpenter', iconName: 'carpenter' },
    { name: 'Painter', iconName: 'painter' },
    { name: 'Cleaner', iconName: 'cleaner' }
];

const seedCategories = async () => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return;
        }
        for (const item of defaultCategories) {
            await Category.updateOne(
                { name: item.name },
                { $setOnInsert: item },
                { upsert: true }
            );
        }
        console.log('Default categories ready');
    } catch (error) {
        console.error('Category seed failed:', error.message);
    }
};

module.exports = seedCategories;
