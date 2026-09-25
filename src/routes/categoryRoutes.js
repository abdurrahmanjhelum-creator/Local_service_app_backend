const express = require('express');
const router = express.Router();
const { getCategories, createCategory } = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route: Fetch categories
router.get('/', getCategories);

// Protected route: Create category
router.post('/', authMiddleware, createCategory);

module.exports = router;
