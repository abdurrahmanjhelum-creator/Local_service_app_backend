const User = require('../models/User');

const getAllServiceProviders = async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = { role: 'provider' };

        if (category && category !== 'All') {
            const escaped = String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.category = { $regex: `^${escaped}$`, $options: 'i' };
        }

        if (search && search.trim()) {
            const escapedSearch = String(search.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { category: { $regex: escapedSearch, $options: 'i' } }
            ];
        }

        // .select('-password') se password response mein nahi jayega
        const serviceProviders = await User.find(query).select('-password');
        res.json(serviceProviders);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Server Error' });
    }
};          

const getServiceProviderById = async (req, res) => {
    try {
        if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid provider id' });
        }

        // Ensure karein ke ID provider ki hi ho aur password hide ho
        const serviceProvider = await User.findOne({ 
            _id: req.params.id, 
            role: 'provider' 
        }).select('-password');     

        if (!serviceProvider) {
            return res.status(404).json({ message: 'Service Provider not found' });
        }
        res.json(serviceProvider);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Server Error' });
    }
};

module.exports = {
    getAllServiceProviders,
    getServiceProviderById
};