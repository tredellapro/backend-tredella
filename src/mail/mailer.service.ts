import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/* Email delivery. With SMTP configured (Gmail or any provider) mail is sent
   for real; without it the message is logged so the reset flow stays testable
   in development. */

export type Mail = { to: string; subject: string; html: string; text: string };

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    // USER_EMAIL is accepted as an alias for SMTP_USER
    const user =
      this.config.get<string>('SMTP_USER') ||
      this.config.get<string>('USER_EMAIL');
    const pass = this.config.get<string>('SMTP_PASS');

    this.from = this.config.get<string>('SMTP_FROM') ?? `Tredella <${user}>`;
    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          })
        : null;
  }

  /** Public URL of the storefront — used to build links inside emails. */
  appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  async send({ to, subject, html, text }: Mail): Promise<{ delivered: boolean }> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP not configured — email not sent.\n   To: ${to}\n   Subject: ${subject}\n   ${text}`,
      );
      return { delivered: false };
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
    return { delivered: true };
  }
}

export const passwordResetEmail = (name: string, link: string): Mail => ({
  to: '',
  subject: 'Reset your Tredella password',
  text: `Hi ${name},\n\nReset your password using this link (valid for 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
  html: `
    <div style="font-family:Poppins,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#4b566b">
      <h1 style="color:#2b3445;font-size:20px;margin:0 0 16px">Reset your password</h1>
      <p style="margin:0 0 12px">Hi ${name},</p>
      <p style="margin:0 0 24px">
        We received a request to reset your Tredella password. Click the button
        below to choose a new one. This link is valid for <strong>1 hour</strong>.
      </p>
      <a href="${link}"
         style="display:inline-block;background:#e94560;color:#fff;text-decoration:none;
                padding:12px 28px;border-radius:4px;font-weight:600">
        Reset Password
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#7d879c">
        If the button doesn't work, copy this link into your browser:<br>
        <span style="word-break:break-all">${link}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#7d879c">
        Didn't request this? You can safely ignore this email — your password
        stays unchanged.
      </p>
    </div>
  `,
});
