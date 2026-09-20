import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatService } from './chat.service';
import { ConversationsResolver, MessagesResolver } from './chat.resolver';

@Module({
  imports: [NotificationsModule],
  providers: [ChatService, ConversationsResolver, MessagesResolver],
  exports: [ChatService],
})
export class ChatModule {}
