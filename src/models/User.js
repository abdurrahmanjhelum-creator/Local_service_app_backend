const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Password is required']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required']
    },
    profileImage: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['customer', 'provider'],
        default: 'customer'
    },
    fcmToken: {
        type: String,
        default: ''
    },
    // Service Provider Specific Fields
    category: {
        type: String,
        default: ''
    },
    priceStarting: {
        type: Number,
        default: 0
    },
    experienceYears: {
        type: Number,
        default: 0
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    rating: {
        type: Number,
        default: 5.0
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    // Geolocation Fields for Map Features
    latitude: {
        type: Number,
        default: null
    },
    longitude: {
        type: Number,
        default: null
    },
    address: {
        type: String,
        default: ''
    },
    // Service Area Radius for Providers (in kilometers)
    serviceRadius: {
        type: Number,
        default: 10 // Default 10km service radius
    }
}, {
    timestamps: true
});

// Indexes for geolocation queries
userSchema.index({ latitude: 1, longitude: 1 });
userSchema.index({ role: 1, latitude: 1, longitude: 1 });
userSchema.index({ category: 1, latitude: 1, longitude: 1 });

// Static method to find providers within a radius
userSchema.statics.findProvidersWithinRadius = async function(latitude, longitude, radiusKm, category = null) {
    try {
        // Earth's radius in kilometers
        const earthRadius = 6371;
        
        // Calculate bounding box for initial filtering (approximate)
        const latDelta = radiusKm / earthRadius;
        const lngDelta = radiusKm / (earthRadius * Math.cos(latitude * Math.PI / 180));
        
        const minLat = latitude - latDelta;
        const maxLat = latitude + latDelta;
        const minLng = longitude - lngDelta;
        const maxLng = longitude + lngDelta;
        
        // Build query with bounding box filter
        let query = {
            role: 'provider',
            latitude: { $gte: minLat, $lte: maxLat },
            longitude: { $gte: minLng, $lte: maxLng },
            isAvailable: true
        };
        
        // Add category filter if specified
        if (category && category !== 'All') {
            const escaped = String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.category = { $regex: escaped, $options: 'i' };
        }
        
        // Get providers in bounding box
        let providers = await this.find(query).select('-password');
        
        // Filter by exact distance using Haversine formula
        providers = providers.filter(provider => {
            if (!provider.latitude || !provider.longitude) return false;
            
            const distance = calculateDistance(
                latitude,
                longitude,
                provider.latitude,
                provider.longitude
            );
            
            return distance <= radiusKm;
        });
        
        // Sort by distance (nearest first)
        providers.sort((a, b) => {
            const distanceA = calculateDistance(latitude, longitude, a.latitude, a.longitude);
            const distanceB = calculateDistance(latitude, longitude, b.latitude, b.longitude);
            return distanceA - distanceB;
        });
        
        return providers;
    } catch (error) {
        console.error('Error finding providers within radius:', error);
        return [];
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

module.exports = mongoose.model('User', userSchema);
