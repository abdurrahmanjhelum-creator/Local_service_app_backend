const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
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

const path = require('path');

const storage = hasCloudinary
    ? new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'local_services_app/profiles',
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
            transformation: [{ width: 800, height: 800, crop: 'limit' }]
        }
    })
    : multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, path.join(__dirname, '../../uploads'));
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
        console.log('Multer receiving file:', file.originalname, 'MimeType:', file.mimetype);
        if (file.mimetype.startsWith('image/')) {
            return callback(null, true);
        }
        callback(new Error('Only image files are allowed (received: ' + file.mimetype + ')'));
    }
});

const uploadImage = (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Image upload error:', err);
            return res.status(400).json({ message: 'Image upload failed: ' + err.message });
        }
        if (req.file) {
            console.log('Image uploaded successfully:', req.file.path || req.file.filename);
        } else {
            console.log('No image file in request');
        }
        next();
    });
};

module.exports = { cloudinary, upload, uploadImage };
