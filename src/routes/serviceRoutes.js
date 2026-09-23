const express = require('express');
const router = express.Router();
const { 
    getAllServiceProviders, 
    getServiceProviderById 
} = require('../controllers/serviceController');

// All Providers GET route (filters by ?category=Electrician if provided)
router.get('/providers', getAllServiceProviders);

// Single Provider Details GET route
router.get('/providers/:id', getServiceProviderById);

module.exports = router;