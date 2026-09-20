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

/* The dashboards type the code straight into the reset screen, so this mail
   carries no link — nothing to point at the wrong app. */
export const passwordResetCodeEmail = (
  name: string,
  code: string,
  minutes: number,
): Mail => ({
  to: '',
  subject: `${code} is your Tredella reset code`,
  text: `Hi ${name},\n\nYour Tredella password reset code is ${code}.\nIt expires in ${minutes} minutes.\n\nIf you didn't request this, you can ignore this email — your password stays unchanged.`,
  html: `
    <div style="font-family:Poppins,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#4b566b">
      <h1 style="color:#2b3445;font-size:20px;margin:0 0 16px">Reset your password</h1>
      <p style="margin:0 0 12px">Hi ${name},</p>
      <p style="margin:0 0 24px">
        Enter this code to choose a new password. It expires in
        <strong>${minutes} minutes</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:#e94560">
        ${code}
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#7d879c">
        Didn't request this? You can safely ignore this email — your password
        stays unchanged. Never share this code with anyone.
      </p>
    </div>
  `,
});

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

/* ------------------------------------------------------ order status --- */

/** Order states a buyer is told about, matching Order.status. */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'received',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'complete',
  CANCELLED: 'cancelled',
};

const ORDER_STATUS_LINE: Record<OrderStatus, string> = {
  PENDING: 'We have received your order and are getting it ready.',
  CONFIRMED: 'Your order is confirmed and is being prepared for dispatch.',
  SHIPPED: 'Your order is on its way.',
  DELIVERED: 'Your order has been delivered.',
  COMPLETED: 'Your order is complete. Thank you for shopping with Tredella.',
  CANCELLED:
    'Your order has been cancelled. Any payment already taken will be refunded.',
};

export type OrderTracking = {
  companyName: string;
  trackingNumber?: string;
  trackingLink?: string;
};

/**
 * Sent to the buyer whenever a seller moves an order on.
 *
 * Tracking is only included once there is something to track — a "shipped"
 * mail with an empty courier box is worse than one without the box.
 */
export const orderStatusEmail = (
  name: string,
  orderId: string,
  status: OrderStatus,
  tracking?: OrderTracking | null,
  cancellationReason?: string | null,
): Mail => {
  const label = ORDER_STATUS_LABEL[status];
  const line = ORDER_STATUS_LINE[status];

  const trackingText =
    status === 'SHIPPED' && tracking
      ? `\n\nCarrier: ${tracking.companyName}${
          tracking.trackingNumber ? `\nTracking number: ${tracking.trackingNumber}` : ''
        }${tracking.trackingLink ? `\nTrack it: ${tracking.trackingLink}` : ''}`
      : '';

  const reasonText =
    status === 'CANCELLED' && cancellationReason
      ? `\n\nReason: ${cancellationReason}`
      : '';

  const trackingHtml =
    status === 'SHIPPED' && tracking
      ? `
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px">
        <tr style="background:#f6f9fc">
          <td style="padding:8px 12px;color:#7d879c">Carrier</td>
          <td style="padding:8px 12px;text-align:right;color:#2b3445;font-weight:600">${tracking.companyName}</td>
        </tr>
        ${
          tracking.trackingNumber
            ? `<tr>
          <td style="padding:8px 12px;color:#7d879c">Tracking number</td>
          <td style="padding:8px 12px;text-align:right;color:#2b3445;font-weight:600">${tracking.trackingNumber}</td>
        </tr>`
            : ''
        }
      </table>
      ${
        tracking.trackingLink
          ? `<a href="${tracking.trackingLink}"
             style="display:inline-block;background:#e94560;color:#fff;text-decoration:none;
                    padding:12px 28px;border-radius:4px;font-weight:600">
            Track your parcel
          </a>`
          : ''
      }`
      : '';

  const reasonHtml =
    status === 'CANCELLED' && cancellationReason
      ? `<p style="margin:0 0 24px;padding:12px;background:#f6f9fc;border-radius:4px">
           <strong style="color:#2b3445">Reason:</strong> ${cancellationReason}
         </p>`
      : '';

  return {
    to: '',
    subject: `Order ${orderId} — ${label}`,
    text: `Hi ${name},\n\n${line}\n\nOrder number: ${orderId}${trackingText}${reasonText}\n\nThank you for shopping with Tredella.`,
    html: `
    <div style="font-family:Poppins,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#4b566b">
      <h1 style="color:#2b3445;font-size:20px;margin:0 0 16px">Your order is ${label}</h1>
      <p style="margin:0 0 12px">Hi ${name},</p>
      <p style="margin:0 0 24px">${line}</p>
      <p style="margin:0 0 24px;font-size:14px">
        Order number: <strong style="color:#2b3445">${orderId}</strong>
      </p>
      ${reasonHtml}
      ${trackingHtml}
      <p style="margin:24px 0 0;font-size:13px;color:#7d879c">
        Questions about this order? Reply to this email and the seller will pick
        it up.
      </p>
    </div>
  `,
  };
};
