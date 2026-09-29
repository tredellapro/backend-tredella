import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { BearerAuthGuard } from '../common/guards/bearer-auth.guard';
import { JsonErrorFilter } from '../common/filters/json-error.filter';
import { DiskStorageGuard } from './disk-storage.guard';
import {
  ALLOWED_MIME,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_ATTACHMENT_MIME,
  MAX_BYTES,
  MAX_FILES,
  UPLOAD_DIR,
} from './uploads.constants';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

@Controller('upload')
@UseFilters(JsonErrorFilter)
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post('review-images')
  @HttpCode(HttpStatus.OK) // the web clients were built against 200, not Nest's 201
  @UseGuards(BearerAuthGuard, DiskStorageGuard)
  @UseInterceptors(
    FilesInterceptor('images', MAX_FILES, {
      storage,
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
  uploadReviewImages(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): { urls: string[] } {
    const publicUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:4000';
    return {
      urls: (files ?? []).map((f) => `${publicUrl}/uploads/${f.filename}`),
    };
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
  @UseGuards(BearerAuthGuard, DiskStorageGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
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
  uploadChatAttachment(@UploadedFile() file: Express.Multer.File | undefined): {
    url: string;
    name: string;
    sizeBytes: number;
    mimeType: string;
  } {
    if (!file) throw new BadRequestException('No file was attached.');

    const publicUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:4000';

    return {
      url: `${publicUrl}/uploads/${file.filename}`,
      name: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    };
  }
}
