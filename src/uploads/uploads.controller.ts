import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { BearerAuthGuard } from '../common/guards/bearer-auth.guard';
import { JsonErrorFilter } from '../common/filters/json-error.filter';
import { StorageService } from '../storage/storage.service';
import {
  ALLOWED_MIME,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MIME,
  MAX_BYTES,
  MAX_FILES,
} from './uploads.constants';

/* Everything here goes through StorageService, which means Cloudinary whenever
   credentials are configured and local disk only as a development fallback.
   These two endpoints used to write straight to disk with multer.diskStorage,
   which cannot work on a serverless host at all — the filesystem is read-only,
   so every review photo and chat attachment failed in production while working
   perfectly on a laptop.

   Files are buffered in memory rather than spooled to disk because
   StorageService forwards the buffer to Cloudinary. The size limits below are
   what keeps that safe. */
const memory = multer.memoryStorage();

@Controller('upload')
@UseFilters(JsonErrorFilter)
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  private assertStorage(): void {
    if (!this.storage.available)
      throw new ServiceUnavailableException(this.storage.unavailableReason);
  }

  @Post('review-images')
  @HttpCode(HttpStatus.OK) // the web clients were built against 200, not Nest's 201
  @UseGuards(BearerAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES, {
      storage: memory,
      limits: { fileSize: MAX_BYTES, files: MAX_FILES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype))
          return cb(
            new BadRequestException(
              'Only JPEG, PNG, WebP or GIF images are allowed.',
            ),
            false,
          );
        cb(null, true);
      },
    }),
  )
  async uploadReviewImages(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<{ urls: string[] }> {
    this.assertStorage();

    /* Public: a review photo is shown to every shopper reading the review, so
       an authenticated object would simply fail to load for them. */
    const stored = await Promise.all(
      (files ?? []).map((file) =>
        this.storage.upload(file, 'review-images', 'public'),
      ),
    );

    return { urls: stored.map((entry) => entry.url) };
  }

  /**
   * One file to hang off a chat message.
   *
   * The original name and size come back so the client can draw the file card
   * without fetching the thing first — a stored filename is randomised, so the
   * URL on its own cannot say what the file was called.
   */
  @Post('chat-attachment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BearerAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memory,
      limits: { fileSize: CHAT_ATTACHMENT_MAX_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!CHAT_ATTACHMENT_MIME.has(file.mimetype))
          return cb(
            new BadRequestException(
              'Attach a PDF, JPEG, PNG, WebP or GIF file.',
            ),
            false,
          );
        cb(null, true);
      },
    }),
  )
  async uploadChatAttachment(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{
    url: string;
    name: string;
    sizeBytes: number;
    mimeType: string;
  }> {
    if (!file) throw new BadRequestException('No file was attached.');
    this.assertStorage();

    /* Public for the same reason: the other party renders it straight from the
       URL. Worth revisiting with signed URLs if attachments ever carry
       anything more sensitive than an order photo. */
    const stored = await this.storage.upload(file, 'chat', 'public');

    return {
      url: stored.url,
      name: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    };
  }
}
