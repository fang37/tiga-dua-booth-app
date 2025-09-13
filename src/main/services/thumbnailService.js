import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const THUMB_DIR = path.join(app.getPath('userData'), 'thumbnails');

// Ensure the thumbnail directory exists
if (!fs.existsSync(THUMB_DIR)) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

export async function generateThumbnail(originalPath) {
  try {
    const thumbFileName = `${path.basename(originalPath, path.extname(originalPath))}.jpg`;
    const thumbPath = path.join(THUMB_DIR, thumbFileName);

    // If thumbnail already exists, just return its path
    if (fs.existsSync(thumbPath)) {
      return thumbPath;
    }

    // Create a 200px wide thumbnail, convert to JPG for consistency
    await sharp(originalPath)
      .resize(200)
      .jpeg({ quality: 80 })
      .toFile(thumbPath);

    return thumbPath;
  } catch (error) {
    console.error(`Failed to generate thumbnail for ${originalPath}:`, error);
    return null; // Return null on error
  }
}