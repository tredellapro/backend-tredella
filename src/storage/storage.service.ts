import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { v2 as CloudinaryApi, UploadApiResponse } from 'cloudinary';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/* One place that knows where uploaded files land.
 *
 * Cloudinary when CLOUDINARY_URL (or the three CLOUDINARY_* vars) is set —
 * required in production, because serverless hosts have a read-only filesystem
 * and no persistence between invocations. Local disk otherwise, so development
 * needs no account. Callers only ever get a URL back. */

export type StoredFile = {
  url: string;
  /** Provider handle, kept so the file can be deleted later. */
  key: string;
};

/** Cloudinary access_mode. 'authenticated' keeps an object off the public CDN. */
export type Visibility = 'public' | 'authenticated';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * A CLOUDINARY_URL that is present but unusable must not count as configured.
 * The obvious case is someone copying .env.example and leaving the placeholder
 * in — treat that as "no object storage" and fall back to disk.
 */
const isUsableCloudinaryUrl = (url?: string): boolean => {
  if (!url || url.includes('<') || url.includes('>')) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'cloudinary:' &&
      Boolean(parsed.username && parsed.password && parsed.hostname)
    );
  } catch {
    return false;
  }
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly useCloudinary: boolean;
  private readonly diskAvailable: boolean;
  private readonly publicUrl: string;
  private readonly explicitCredentials: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
  } | null;
  private sdk: typeof CloudinaryApi | null = null;

  /**
   * Loaded on first use, never at import: the cloudinary package parses
   * CLOUDINARY_URL as the module loads and throws on a malformed one, which
   * would take the whole API down at boot rather than just disabling uploads.
   */
  private cloudinary(): typeof CloudinaryApi {
    if (!this.sdk) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('cloudinary') as { v2: typeof CloudinaryApi };
      if (this.explicitCredentials) mod.v2.config(this.explicitCredentials);
      mod.v2.config({ secure: true });
      this.sdk = mod.v2;
    }
    return this.sdk;
  }

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('CLOUDINARY_URL');
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    this.explicitCredentials =
      cloudName && apiKey && apiSecret
        ? { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret }
        : null;

    this.useCloudinary = Boolean(
      this.explicitCredentials || isUsableCloudinaryUrl(url),
    );

    if (url && !isUsableCloudinaryUrl(url) && !this.explicitCredentials)
      this.logger.warn(
        'CLOUDINARY_URL is set but not a usable cloudinary:// URL — falling back to local disk.',
      );

    this.diskAvailable = !this.useCloudinary && this.ensureDiskDir();
    this.publicUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:4000';

    if (!this.useCloudinary && !this.diskAvailable)
      this.logger.warn(
        'No file storage available: set CLOUDINARY_URL to enable uploads on this deployment.',
      );
  }

  private ensureDiskDir(): boolean {
    if (process.env.VERCEL) return false;
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  get available(): boolean {
    return this.useCloudinary || this.diskAvailable;
  }

  /** Human-readable reason for the 503 when `available` is false. */
  get unavailableReason(): string {
    return 'File uploads are not configured on this deployment. Set CLOUDINARY_URL to enable them.';
  }

  /**
   * @param folder logical grouping, e.g. `seller-documents/<sellerId>`
   */
  async upload(
    file: Express.Multer.File,
    folder: string,
    visibility: Visibility = 'authenticated',
  ): Promise<StoredFile> {
    return this.useCloudinary
      ? this.uploadToCloudinary(file, folder, visibility)
      : this.uploadToDisk(file, folder);
  }

  private uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
    visibility: Visibility,
  ): Promise<StoredFile> {
    return new Promise((resolve, reject) => {
      const stream = this.cloudinary().uploader.upload_stream(
        {
          folder: `tredella/${folder}`,
          // "auto" lets one call take both PDFs and images
          resource_type: 'auto',
          type: 'upload',
          /* KYC paperwork stays off the public CDN; a review photo or a chat
             attachment has to be fetchable by whoever is looking at it, and
             uploading those as authenticated makes them silently fail to
             load. */
          access_mode: visibility,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result)
            return reject(
              error instanceof Error
                ? error
                : new Error('Upload to Cloudinary failed.'),
            );
          resolve({ url: result.secure_url, key: result.public_id });
        },
      );
      stream.end(file.buffer);
    });
  }

  private async uploadToDisk(
    file: Express.Multer.File,
    folder: string,
  ): Promise<StoredFile> {
    const dir = path.join(UPLOAD_DIR, folder);
    await fs.promises.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await fs.promises.writeFile(path.join(dir, name), file.buffer);

    const key = `${folder}/${name}`;
    return { url: `${this.publicUrl}/uploads/${key}`, key };
  }

  /** Best-effort: a failed cleanup must not fail the request that triggered it. */
  async remove(key: string): Promise<void> {
    try {
      if (this.useCloudinary) {
        await this.cloudinary().uploader.destroy(key, { resource_type: 'image' });
        return;
      }
      await fs.promises.unlink(path.join(UPLOAD_DIR, key));
    } catch (error) {
      this.logger.warn(`Could not remove stored file ${key}: ${String(error)}`);
    }
  }
}
