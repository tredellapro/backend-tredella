import {
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
} from '@nestjs/common';
import { diskAvailable } from './uploads.constants';

/* Runs before the multer interceptor so a read-only filesystem is reported
   clearly instead of failing mid-write. */
@Injectable()
export class DiskStorageGuard implements CanActivate {
  canActivate(): boolean {
    if (!diskAvailable)
      throw new ServiceUnavailableException(
        'Photo uploads are not available on this deployment. Configure object storage (S3 or Cloudinary) to enable them.',
      );
    return true;
  }
}
