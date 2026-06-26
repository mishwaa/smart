/**
 * Multer Upload Configuration
 * File upload handling with storage, size limits, and file filters
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = [
  'uploads/resumes',
  'uploads/reports',
  'uploads/certificates',
  'uploads/offer_letters',
  'uploads/profile_photos'
];

uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

/**
 * Create a multer storage engine for a specific upload category
 * @param {string} subfolder - The subfolder within uploads/ (e.g., 'resumes')
 * @returns {multer.StorageEngine}
 */
function createStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dest = path.join(__dirname, '..', 'uploads', subfolder);
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${subfolder}-${uniqueSuffix}${ext}`);
    }
  });
}

/**
 * File filter: allow only PDFs, images, and common document types
 */
function fileFilter(req, file, cb) {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, PNG, GIF, DOC, and DOCX files are allowed.'), false);
  }
}

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

// Pre-configured upload handlers for each category
const uploadResume = multer({
  storage: createStorage('resumes'),
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter
});

const uploadReport = multer({
  storage: createStorage('reports'),
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter
});

const uploadCertificate = multer({
  storage: createStorage('certificates'),
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter
});

const uploadOfferLetter = multer({
  storage: createStorage('offer_letters'),
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter
});

const uploadProfilePhoto = multer({
  storage: createStorage('profile_photos'),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, and PNG files are allowed.'), false);
    }
  }
});

module.exports = {
  uploadResume,
  uploadReport,
  uploadCertificate,
  uploadOfferLetter,
  uploadProfilePhoto,
  fileFilter,
  FILE_SIZE_LIMIT
};
