import { Module } from '@nestjs/common';
import { SellersModule } from '../sellers/sellers.module';
import { UploadsController } from './uploads.controller';
import { SellerDocumentsController } from './seller-documents.controller';

@Module({
  imports: [SellersModule],
  controllers: [UploadsController, SellerDocumentsController],
})
export class UploadsModule {}
