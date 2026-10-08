const User = require('../models/User');

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    const earthRadius = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getAllServiceProviders = async (req, res) => {
    try {
        const { 
            category, 
            search, 
            minPrice, 
            maxPrice, 
            minRating, 
            maxRating,
            isAvailable,
            isVerified,
            sortBy,
            latitude,
            longitude,
            distance,
            page = 1,
            limit = 20
        } = req.query;
        
        let query = { role: 'provider' };

        // Category filter
        if (category && category !== 'All') {
            // More flexible category matching - contains instead of exact match
            const escaped = String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.category = { $regex: escaped, $options: 'i' };
        }

        // Search filter (name or category)
        if (search && search.trim()) {
            const escapedSearch = String(search.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { name: { $regex: escapedSearch, $options: 'i' } },
                { category: { $regex: escapedSearch, $options: 'i' } }
            ];
        }

        // Price range filter
        if (minPrice !== undefined || maxPrice !== undefined) {
            query.priceStarting = {};
            if (minPrice !== undefined) {
                query.priceStarting.$gte = parseFloat(minPrice);
            }
            if (maxPrice !== undefined) {
                query.priceStarting.$lte = parseFloat(maxPrice);
            }
        }

        // Rating range filter
        if (minRating !== undefined || maxRating !== undefined) {
            query.rating = {};
            if (minRating !== undefined) {
                query.rating.$gte = parseFloat(minRating);
            }
            if (maxRating !== undefined) {
                query.rating.$lte = parseFloat(maxRating);
            }
        }

        // Availability filter
        if (isAvailable !== undefined) {
            query.isAvailable = isAvailable === 'true';
        }

        // Verification filter
        if (isVerified !== undefined) {
            query.isVerified = isVerified === 'true';
        }

        // Sorting
        let sortOptions = {};
        switch (sortBy) {
            case 'price_asc':
                sortOptions.priceStarting = 1;
                break;
            case 'price_desc':
                sortOptions.priceStarting = -1;
                break;
            case 'rating_desc':
                sortOptions.rating = -1;
                break;
            case 'rating_asc':
                sortOptions.rating = 1;
                break;
            case 'distance':
                sortOptions = {};
                break;
            case 'experience_desc':
                sortOptions.experienceYears = -1;
                break;
            case 'newest':
                sortOptions.createdAt = -1;
                break;
            default:
                sortOptions.rating = -1; // Default: highest rated first
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        // Get total count for pagination
        const total = await User.countDocuments(query);

        let serviceProviders = await User.find(query)
            .select('-password')
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum);

        const parsedLatitude = latitude !== undefined ? parseFloat(latitude) : null;
        const parsedLongitude = longitude !== undefined ? parseFloat(longitude) : null;
        const maxDistanceKm = distance !== undefined ? parseFloat(distance) : null;

        if (sortBy === 'distance' && parsedLatitude !== null && parsedLongitude !== null) {
            serviceProviders = serviceProviders
                .map((provider) => {
                    if (provider.latitude == null || provider.longitude == null) {
                        return { provider, distanceKm: Number.MAX_SAFE_INTEGER };
                    }
                    const distanceKm = calculateDistanceKm(
                        parsedLatitude,
                        parsedLongitude,
                        provider.latitude,
                        provider.longitude
                    );
                    return { provider, distanceKm };
                })
                .filter(({ distanceKm }) => {
                    if (maxDistanceKm != null) {
                        return distanceKm <= maxDistanceKm;
                    }
                    return true;
                })
                .sort((a, b) => a.distanceKm - b.distanceKm)
                .map(({ provider }) => provider);
        } else if (maxDistanceKm != null && parsedLatitude !== null && parsedLongitude !== null) {
            serviceProviders = serviceProviders.filter((provider) => {
                if (provider.latitude == null || provider.longitude == null) {
                    return false;
                }
                const distanceKm = calculateDistanceKm(
                    parsedLatitude,
                    parsedLongitude,
                    provider.latitude,
                    provider.longitude
                );
                return distanceKm <= maxDistanceKm;
            });
        }

        res.json({
            providers: serviceProviders,
            pagination: {
                total,
                page: parseInt(page),
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Server Error' });
    }
};          

const getServiceProviderById = async (req, res) => {
    try {
        if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid provider id' });
        }

        // Ensure user is a provider and exclude password
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
