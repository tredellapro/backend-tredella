import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { BearerAuthGuard } from '../common/guards/bearer-auth.guard';
import { CurrentRestUser } from '../common/decorators/current-rest-user.decorator';
import { RestRolesGuard } from '../common/guards/rest-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JsonErrorFilter } from '../common/filters/json-error.filter';
import { StorageService } from '../storage/storage.service';
import type { JwtPayload } from '../auth/token.service';
import { SellerAccountService } from '../sellers/seller-account.service';
import {
  SELLER_DOCUMENT_TYPES,
  type SellerDocumentType,
} from '../common/constants';

/* Trade licences are usually PDFs, which the review-photo endpoint rejects, and
   they must survive a serverless filesystem — hence a separate route backed by
   StorageService rather than local disk. */

const MAX_BYTES = 4 * 1024 * 1024; // stays under Vercel's ~4.5MB request cap
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Controller('upload')
@UseFilters(JsonErrorFilter)
export class SellerDocumentsController {
  constructor(
    private readonly storage: StorageService,
    private readonly account: SellerAccountService,
  ) {}

  @Post('seller-document')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BearerAuthGuard, RestRolesGuard)
  @Roles('SELLER')
  @UseInterceptors(
    FileInterceptor('file', {
      // buffered, because StorageService may forward it to Cloudinary
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype))
          return cb(
            new BadRequestException(
              'Upload a PDF, JPEG, PNG or WebP of the document.',
            ),
            false,
          );
        cb(null, true);
      },
    }),
  )
  async uploadSellerDocument(
    @CurrentRestUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('type') type: string,
  ): Promise<{ document: unknown }> {
    if (!this.storage.available)
      throw new ServiceUnavailableException(this.storage.unavailableReason);
    if (!file) throw new BadRequestException('Choose a file to upload.');
    if (!isDocumentType(type))
      throw new BadRequestException('Unknown document type.');

    const document = await this.account.saveDocument(user.userId, type, file);
    return { document };
  }
}

const isDocumentType = (value: string): value is SellerDocumentType =>
  SELLER_DOCUMENT_TYPES.includes(value as SellerDocumentType);
