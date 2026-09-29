import path from 'node:path';
import fs from 'node:fs';

/* Review photos land on local disk and are served back statically — swap the
   storage engine for S3/Cloudinary in production without touching the callers,
   since the API still just returns URLs.

   Serverless hosts (Vercel) have a read-only filesystem and no persistence
   between invocations, so disk storage is disabled there and the endpoint
   reports that instead of failing at import time. */

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
export const MAX_FILES = 5;
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/* Chat attachments are the same images plus a PDF, because the thing a buyer
   or a seller actually sends mid-conversation is an invoice or a spec sheet. */
export const CHAT_ATTACHMENT_MIME = new Set([
  ...ALLOWED_MIME,
  'application/pdf',
]);

export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const diskAvailable: boolean = (() => {
  if (process.env.VERCEL) return false;
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
})();
