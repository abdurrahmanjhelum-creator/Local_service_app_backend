const Category = require('../models/Category');
const seedCategories = require('../utils/seedCategories');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
    try {
        let categories = await Category.find({}).sort({ name: 1 });
        // Auto-seed defaults if DB has none (common on fresh Vercel MongoDB)
        if (categories.length === 0) {
            await seedCategories();
            categories = await Category.find({}).sort({ name: 1 });
        }
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private
const createCategory = async (req, res) => {
    try {
        const { name, icon, iconName } = req.body;

        const categoryExists = await Category.findOne({ name });
        if (categoryExists) {
            return res.status(400).json({ message: 'Category already exists.' });
        }

        const category = await Category.create({
            name,
            iconName: iconName || icon || 'ic_service_default'
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getCategories, createCategory };
