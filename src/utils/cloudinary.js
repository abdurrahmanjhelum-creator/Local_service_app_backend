const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const hasCloudinary =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

if (hasCloudinary) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (file.mimetype.startsWith('image/')) {
            return callback(null, true);
        }
        callback(new Error('Only image files are allowed (received: ' + file.mimetype + ')'));
    }
});

// Upload to Cloudinary if configured, otherwise return local path
const uploadToCloudinary = async (filePath, folder = 'local_services_app/profiles') => {
    if (!hasCloudinary) {
        return null;
    }

    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder,
            transformation: [{ width: 800, height: 800, crop: 'limit' }],
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
        });
        
        // Delete local file after successful upload
        await fs.unlink(filePath);
        
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        return null;
    }
};

const uploadImage = async (req, res, next) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: 'Image upload failed: ' + err.message });
        }

        if (!req.file) {
            return next();
        }

        try {
            if (hasCloudinary) {
                const cloudinaryUrl = await uploadToCloudinary(req.file.path);
                if (cloudinaryUrl) {
                    req.file.cloudinaryUrl = cloudinaryUrl;
                    req.file.path = cloudinaryUrl;
                }
            }
            next();
        } catch (error) {
            return res.status(500).json({ message: 'Image processing failed: ' + error.message });
        }
    });
};

module.exports = { cloudinary, upload, uploadImage, uploadToCloudinary };
