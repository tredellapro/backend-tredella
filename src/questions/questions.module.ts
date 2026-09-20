import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuestionsResolver } from './questions.resolver';
import { QuestionsService } from './questions.service';

@Module({
  imports: [NotificationsModule],
  providers: [QuestionsResolver, QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
