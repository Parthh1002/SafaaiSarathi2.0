import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import env from '../config/env.js';

/**
 * Photo evidence. Memory storage so the buffer goes straight to the AI service
 * before it is written anywhere.
 *
 * STORAGE_DRIVER=local writes to api/uploads. The MinIO/Cloudinary drivers are
 * S3-API-compatible, so `persist()` is the only function that changes.
 */

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only JPEG, PNG, WebP or HEIC images are accepted'), { status: 415 }));
  },
});

import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;
if (env.storageDriver === 'supabase' && env.supabase.url && env.supabase.key) {
  supabaseClient = createClient(env.supabase.url, env.supabase.key);
}

export function ensureUploadDir() {
  if (env.storageDriver === 'local' && !fs.existsSync(env.uploadDir)) {
    fs.mkdirSync(env.uploadDir, { recursive: true });
  }
  return env.uploadDir;
}

export async function persist(buffer, mimetype = 'image/jpeg', prefix = 'complaint') {
  const ext = (mimetype.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const name = `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

  if (env.storageDriver === 'supabase' && supabaseClient) {
    const { data, error } = await supabaseClient
      .storage
      .from(env.supabase.bucket)
      .upload(name, buffer, {
        contentType: mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error('Failed to upload image to Supabase');
    }

    const { data: publicUrlData } = supabaseClient
      .storage
      .from(env.supabase.bucket)
      .getPublicUrl(name);

    return publicUrlData.publicUrl;
  }

  // Fallback to local
  ensureUploadDir();
  fs.writeFileSync(path.join(env.uploadDir, name), buffer);
  return `/uploads/${name}`;
}

/** Accepts a multipart file or a base64 data URL (in-browser camera capture). */
export function fileFromRequest(req, field = 'photo') {
  if (req.file?.buffer) {
    return { buffer: req.file.buffer, mimetype: req.file.mimetype, filename: req.file.originalname };
  }
  const dataUrl = req.body?.[field] || req.body?.image || req.body?.photoBase64;
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    const [meta, b64] = dataUrl.split(',');
    const mimetype = meta.slice(5, meta.indexOf(';')) || 'image/jpeg';
    return { buffer: Buffer.from(b64, 'base64'), mimetype, filename: 'capture.jpg' };
  }
  return null;
}

export default { upload, persist, fileFromRequest, ensureUploadDir };
