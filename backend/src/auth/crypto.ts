import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../env.js';

/**
 * Provider tokens at rest.
 *
 * An access or refresh token in the decision graph is encrypted with
 * AES-256-GCM under TOKEN_ENCRYPTION_KEY before it is written, so a database
 * dump does not hand somebody live access to a customer's ad account. The
 * plaintext exists only in memory, for the length of one provider call.
 *
 * Without a key configured the value is stored as-is and marked, so nothing
 * silently claims to be encrypted when it is not.
 */

const PREFIX = 'enc.v1.';

function key(): Buffer | null {
  const raw = env.session.tokenEncryptionKey;
  if (!raw) return null;
  // Accept standard or url-safe base64, with or without padding.
  const normalised = raw.replace(/-/g, '+').replace(/_/g, '/');
  const buffer = Buffer.from(normalised, 'base64');
  return buffer.length === 32 ? buffer : null;
}

export function encryptionAvailable(): boolean {
  return key() !== null;
}

export function encryptSecret(plaintext: string): string {
  const secret = key();
  if (!secret || !plaintext) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored?.startsWith(PREFIX)) return stored;
  const secret = key();
  if (!secret) throw new Error('A stored token is encrypted but TOKEN_ENCRYPTION_KEY is not set');

  const [ivPart, tagPart, dataPart] = stored.slice(PREFIX.length).split('.');
  const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
