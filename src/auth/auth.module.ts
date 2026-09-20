import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { SocialAuthController } from './social-auth.controller';
import { SocialAuthService } from './social-auth.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SocialAuthController],
  providers: [AuthResolver, AuthService, SocialAuthService],
  exports: [AuthService],
})
export class AuthModule {}
