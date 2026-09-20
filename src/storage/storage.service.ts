import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
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

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly useCloudinary: boolean;
  private readonly diskAvailable: boolean;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('CLOUDINARY_URL');
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    this.useCloudinary = Boolean(url || (cloudName && apiKey && apiSecret));
    if (this.useCloudinary) {
      // CLOUDINARY_URL is picked up from the environment on its own
      if (cloudName && apiKey && apiSecret)
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      cloudinary.config({ secure: true });
    }

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
  ): Promise<StoredFile> {
    return this.useCloudinary
      ? this.uploadToCloudinary(file, folder)
      : this.uploadToDisk(file, folder);
  }

  private uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
  ): Promise<StoredFile> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `tredella/${folder}`,
          // "auto" lets one call take both PDFs and images
          resource_type: 'auto',
          // KYC documents are not public gallery content
          type: 'upload',
          access_mode: 'authenticated',
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
        await cloudinary.uploader.destroy(key, { resource_type: 'image' });
        return;
      }
      await fs.promises.unlink(path.join(UPLOAD_DIR, key));
    } catch (error) {
      this.logger.warn(`Could not remove stored file ${key}: ${String(error)}`);
    }
  }
}
