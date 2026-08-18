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

export async function persist(input, mimetypeOrPrefix = 'image/jpeg', maybePrefix = 'complaint') {
  let buf;
  let mimetype = 'image/jpeg';
  let prefix = 'complaint';

  if (input && typeof input === 'object' && input.buffer) {
    // Called as persist(fileObject, 'complaints')
    buf = input.buffer;
    mimetype = input.mimetype || 'image/jpeg';
    prefix = typeof mimetypeOrPrefix === 'string' && mimetypeOrPrefix.indexOf('/') === -1 ? mimetypeOrPrefix : 'complaint';
  } else {
    // Called as persist(buffer, mimetype, prefix)
    buf = input;
    mimetype = mimetypeOrPrefix && mimetypeOrPrefix.indexOf('/') !== -1 ? mimetypeOrPrefix : 'image/jpeg';
    prefix = maybePrefix || 'complaint';
  }

  const ext = (mimetype.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const name = `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

  let url = `/uploads/${name}`;

  if (env.storageDriver === 'supabase' && supabaseClient) {
    try {
      const { error } = await supabaseClient.storage
        .from(env.supabase.bucket)
        .upload(name, buf, {
          contentType: mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (!error) {
        const { data: publicUrlData } = supabaseClient.storage.from(env.supabase.bucket).getPublicUrl(name);
        if (publicUrlData?.publicUrl) url = publicUrlData.publicUrl;
      }
    } catch (e) {
      console.warn('Supabase storage fallback to local:', e);
    }
  }

  if (url.startsWith('/uploads/')) {
    ensureUploadDir();
    fs.writeFileSync(path.join(env.uploadDir, name), buf);
  }

  return url;
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
