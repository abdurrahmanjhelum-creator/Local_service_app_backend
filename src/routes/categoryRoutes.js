const express = require('express');
const router = express.Router();
const { getCategories, createCategory } = require('../controllers/categoryController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route: Koi bhi categories dekh sakta hai
router.get('/', getCategories);

// Protected route: Category create karne ke liye login zaroori hai
router.post('/', authMiddleware, createCategory);

module.exports = router;