const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { randomUUID } = require('crypto');
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

const uploadsDir = path.join(__dirname, '../../uploads');
const isServerless =
    Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.env.NODE_ENV === 'production';

if (!isServerless) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
});

const storage = isServerless ? multer.memoryStorage() : diskStorage;
const acceptedImageMimeTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/webp',
    'image/gif'
]);
const acceptedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const mimeType = file.mimetype.toLowerCase().split(';', 1)[0].trim();
        const extension = path.extname(file.originalname).toLowerCase();
        if (acceptedImageMimeTypes.has(mimeType) || acceptedImageExtensions.has(extension)) {
            return callback(null, true);
        }
        callback(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
});

// Upload local development files to Cloudinary when configured.
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
        await fsPromises.unlink(filePath);
        
        return result.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
};

const uploadBufferToCloudinary = (buffer, folder = 'local_services_app/profiles') =>
    new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({
            folder,
            transformation: [{ width: 800, height: 800, crop: 'limit' }],
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif']
        }, (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url) return reject(new Error('Cloudinary returned no image URL'));
            resolve(result.secure_url);
        }).end(buffer);
    });

const uploadImage = async (req, res, next) => {
    upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: 'Image upload failed: ' + err.message });
        }

        if (!req.file) {
            return next();
        }

        try {
            if (!hasCloudinary && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
                if (req.file.path) await fsPromises.unlink(req.file.path);
                return res.status(503).json({
                    message: 'Image uploads are not configured on this server.'
                });
            }
            if (!hasCloudinary) return next();

            const cloudinaryUrl = req.file.buffer
                ? await uploadBufferToCloudinary(req.file.buffer)
                : await uploadToCloudinary(req.file.path);
            req.file.cloudinaryUrl = cloudinaryUrl;
            req.file.path = cloudinaryUrl;
            next();
        } catch (error) {
            return res.status(500).json({ message: 'Image processing failed: ' + error.message });
        }
    });
};

module.exports = { cloudinary, upload, uploadImage, uploadToCloudinary };
