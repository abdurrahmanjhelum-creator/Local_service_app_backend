const User = require('../models/User');

/**
 * @desc    Get nearby providers based on user's location
 * @route   GET /api/providers/nearby
 * @access  Private
 * @query   { latitude, longitude, radius, category }
 */
const getNearbyProviders = async (req, res) => {
    try {
        const { latitude, longitude, radius, category } = req.query;
        
        // Validate required parameters
        if (!latitude || !longitude) {
            return res.status(400).json({ 
                message: 'Latitude and longitude are required for location-based search' 
            });
        }
        
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        const radiusKm = radius ? parseFloat(radius) : 5; // Default 5km radius
        
        // Validate coordinates
        if (isNaN(lat) || lat < -90 || lat > 90) {
            return res.status(400).json({ message: 'Invalid latitude value' });
        }
        if (isNaN(lon) || lon < -180 || lon > 180) {
            return res.status(400).json({ message: 'Invalid longitude value' });
        }
        if (isNaN(radiusKm) || radiusKm < 1 || radiusKm > 100) {
            return res.status(400).json({ message: 'Radius must be between 1 and 100 km' });
        }
        
        console.log(`🗺️ Finding nearby providers: lat=${lat}, lon=${lon}, radius=${radiusKm}km, category=${category || 'All'}`);
        
        // Use User model's static method for efficient radius search
        const nearbyProviders = await User.findProvidersWithinRadius(
            lat,
            lon,
            radiusKm,
            category
        );
        
        // Calculate exact distance for each provider and add to response
        const providersWithDistance = nearbyProviders.map(provider => {
            const distance = calculateDistance(
                lat,
                lon,
                provider.latitude,
                provider.longitude
            );
            
            return {
                ...provider.toObject(),
                distance: parseFloat(distance.toFixed(2)), // Distance in km
                distanceFormatted: formatDistance(distance)
            };
        });
        
        console.log(`✅ Found ${providersWithDistance.length} nearby providers`);
        
        res.json(providersWithDistance);
    } catch (error) {
        console.error('Error getting nearby providers:', error);
        res.status(500).json({ 
            message: 'Error finding nearby providers', 
            error: error.message 
        });
    }
};

/**
 * @desc    Update user's location
 * @route   PUT /api/users/location
 * @access  Private
 */
const updateUserLocation = async (req, res) => {
    try {
        const { latitude, longitude, address } = req.body;
        
        // Validate coordinates
        if (!latitude || !longitude) {
            return res.status(400).json({ message: 'Latitude and longitude are required' });
        }
        
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        
        if (isNaN(lat) || lat < -90 || lat > 90) {
            return res.status(400).json({ message: 'Invalid latitude value' });
        }
        if (isNaN(lon) || lon < -180 || lon > 180) {
            return res.status(400).json({ message: 'Invalid longitude value' });
        }
        
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update user location
        user.latitude = lat;
        user.longitude = lon;
        if (address) {
            user.address = address;
        }
        
        await user.save();
        
        console.log(`✅ Location updated for user ${user._id}: ${lat}, ${lon}`);
        
        res.json({
            message: 'Location updated successfully',
            location: {
                latitude: user.latitude,
                longitude: user.longitude,
                address: user.address
            }
        });
    } catch (error) {
        console.error('Error updating user location:', error);
        res.status(500).json({ 
            message: 'Error updating location', 
            error: error.message 
        });
    }
};

/**
 * @desc    Update provider's service radius
 * @route   PUT /api/providers/service-radius
 * @access  Private (Provider only)
 */
const updateServiceRadius = async (req, res) => {
    try {
        const { serviceRadius } = req.body;
        
        // Validate service radius
        if (!serviceRadius || serviceRadius < 1 || serviceRadius > 100) {
            return res.status(400).json({ 
                message: 'Service radius must be between 1 and 100 km' 
            });
        }
        
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.role !== 'provider') {
            return res.status(403).json({ message: 'Only providers can update service radius' });
        }
        
        // Update service radius
        user.serviceRadius = serviceRadius;
        await user.save();
        
        console.log(`✅ Service radius updated for provider ${user._id}: ${serviceRadius}km`);
        
        res.json({
            message: 'Service radius updated successfully',
            serviceRadius: user.serviceRadius
        });
    } catch (error) {
        console.error('Error updating service radius:', error);
        res.status(500).json({ 
            message: 'Error updating service radius', 
            error: error.message 
        });
    }
};

/**
 * @desc    Get distance between two points
 * @route   GET /api/location/distance
 * @access  Public
 * @query   { lat1, lon1, lat2, lon2 }
 */
const calculateDistanceBetweenPoints = async (req, res) => {
    try {
        const { lat1, lon1, lat2, lon2 } = req.query;
        
        if (!lat1 || !lon1 || !lat2 || !lon2) {
            return res.status(400).json({ 
                message: 'All coordinates (lat1, lon1, lat2, lon2) are required' 
            });
        }
        
        const distance = calculateDistance(
            parseFloat(lat1),
            parseFloat(lon1),
            parseFloat(lat2),
            parseFloat(lon2)
        );
        
        res.json({
            distance: parseFloat(distance.toFixed(2)),
            distanceFormatted: formatDistance(distance),
            unit: 'kilometers'
        });
    } catch (error) {
        console.error('Error calculating distance:', error);
        res.status(500).json({ 
            message: 'Error calculating distance', 
            error: error.message 
        });
    }
};

/**
 * @desc    Geocode address to coordinates
 * @route   GET /api/location/geocode
 * @access  Public
 * @query   { address }
 */
const geocodeAddress = async (req, res) => {
    try {
        const { address } = req.query;
        
        if (!address) {
            return res.status(400).json({ message: 'Address is required' });
        }
        
        // Note: This is a placeholder. In production, you would use a real geocoding service
        // like Google Maps Geocoding API, Mapbox, or OpenStreetMap Nominatim
        
        // For now, return a mock response
        res.json({
            message: 'Geocoding requires an external service (Google Maps/Mapbox)',
            address: address,
            note: 'Implement with geocoding service API'
        });
    } catch (error) {
        console.error('Error geocoding address:', error);
        res.status(500).json({ 
            message: 'Error geocoding address', 
            error: error.message 
        });
    }
};

// Helper function to calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

// Helper function to format distance in human-readable format
function formatDistance(distanceInKm) {
    if (distanceInKm < 1) {
        return `${Math.round(distanceInKm * 1000)} m`;
    } else if (distanceInKm < 10) {
        return `${distanceInKm.toFixed(1)} km`;
    } else {
        return `${distanceInKm.toFixed(0)} km`;
    }
}

module.exports = {
    getNearbyProviders,
    updateUserLocation,
    updateServiceRadius,
    calculateDistanceBetweenPoints,
    geocodeAddress
};