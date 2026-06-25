import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

// Avatar upload (single image)
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'companion_call/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  } as Record<string, unknown>,
});

// Host photos (multiple, up to 6)
const photoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'companion_call/host_photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 1000, crop: 'fill' }],
  } as Record<string, unknown>,
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('avatar');

export const uploadHostPhotos = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
}).array('photos', 6);
