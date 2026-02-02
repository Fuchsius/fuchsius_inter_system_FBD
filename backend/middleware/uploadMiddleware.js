const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const PDF_MIME_TYPES = ['application/pdf'];

// File filter for avatar/payment slip uploads
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'avatar') {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Avatar must be an image file.'), false);
  }

  if (file.fieldname === 'paymentSlip') {
    if (IMAGE_MIME_TYPES.includes(file.mimetype) || PDF_MIME_TYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Payment slips must be an image or PDF file.'), false);
  }

  // Default behaviour for other uploads (images only)
  if (file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }

  return cb(new Error('Unsupported file type.'), false);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Single image upload middleware
const uploadSingle = upload.single('image');

// Multiple images upload middleware (if needed)
const uploadMultiple = upload.array('images', 5); // max 5 images

// Upload avatar + payment slip fields
const uploadUserFiles = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'paymentSlip', maxCount: 1 }
]);

module.exports = {
  uploadSingle,
  uploadMultiple,
  upload,
  uploadUserFiles
};
