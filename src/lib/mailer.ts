import nodemailer from "nodemailer";

/* Email delivery. With SMTP configured (Gmail or any provider) mail is sent
   for real; without it the message is logged to the console so the reset flow
   is still testable in development. */

const { SMTP_HOST, SMTP_PORT, SMTP_PASS, SMTP_FROM, APP_URL } = process.env;

// USER_EMAIL is accepted as an alias for SMTP_USER
const SMTP_USER = process.env.SMTP_USER || process.env.USER_EMAIL;

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export const appUrl = () => APP_URL ?? "http://localhost:3000";

type Mail = { to: string; subject: string; html: string; text: string };

export const sendMail = async ({ to, subject, html, text }: Mail) => {
  if (!transporter) {
    console.log(
      `\n📧 [dev] SMTP not configured — email not sent.\n   To: ${to}\n   Subject: ${subject}\n   ${text}\n`
    );
    return { delivered: false };
  }
  await transporter.sendMail({
    from: SMTP_FROM ?? `Tredella <${SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return { delivered: true };
};

export const passwordResetEmail = (name: string, link: string): Mail => ({
  to: "",
  subject: "Reset your Tredella password",
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
