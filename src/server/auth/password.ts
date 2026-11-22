import crypto from "crypto";

/**
 * Hashes a plaintext password using Node's native scrypt.
 * Output format: <salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored <salt_hex>:<hash_hex> string.
 */
export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, storedHash] = combinedHash.split(":");
    if (!salt || !storedHash) return false;
    const computedHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(computedHash, "hex"));
  } catch {
    return false;
  }
}
