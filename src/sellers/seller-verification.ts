import { badInput } from '../common/errors';

/* Format rules for the UAE trade-registration fields. Kept apart from the
   service so the shapes are readable in one place and testable on their own. */

/** 784-YYYY-NNNNNNN-N → 15 digits. Stored normalised, without dashes. */
export const normaliseEmiratesId = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 15 || !digits.startsWith('784'))
    throw badInput(
      'Enter a valid Emirates ID — 15 digits in the form 784-YYYY-NNNNNNN-N.',
    );
  return digits;
};

/** UAE VAT numbers are 15 digits. Empty is allowed: registration is optional. */
export const normaliseTrn = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length !== 15)
    throw badInput('A TRN is 15 digits. Leave it empty if you are not VAT registered.');
  return digits;
};

/** Accepts 05XXXXXXXX, 5XXXXXXXX or +9715XXXXXXXX; stores +9715XXXXXXXX. */
export const normaliseUaePhone = (value: string): string => {
  const digits = value.replace(/[^\d]/g, '');
  const local = digits
    .replace(/^00971/, '')
    .replace(/^971/, '')
    .replace(/^0/, '');
  if (!/^5\d{8}$/.test(local))
    throw badInput(
      'Enter a UAE mobile number, for example +971 50 123 4567.',
    );
  return `+971${local}`;
};

export const normaliseTradeLicenseNumber = (value: string): string => {
  const trimmed = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9\-/]{2,29}$/.test(trimmed))
    throw badInput('Enter the licence number exactly as printed on the licence.');
  return trimmed;
};

/**
 * Licences are renewed annually, so an expired one cannot back a live store.
 * Parsed as a UTC date to keep the check independent of server timezone.
 */
export const parseLicenseExpiry = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw badInput('Enter the licence expiry date as YYYY-MM-DD.');

  const expiry = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(expiry.getTime()))
    throw badInput('That licence expiry date is not a real date.');

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (expiry < todayUtc)
    throw badInput(
      'That trade licence has already expired. Renew it, then submit the current one.',
    );
  return expiry;
};
