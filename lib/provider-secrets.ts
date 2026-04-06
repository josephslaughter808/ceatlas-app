import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getSecretKey() {
  const secret = process.env.PROVIDER_ACCOUNT_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing PROVIDER_ACCOUNT_ENCRYPTION_KEY");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptProviderSecret(value: string) {
  const iv = randomBytes(12);
  const key = getSecretKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptProviderSecret(payload: string) {
  const [ivPart, tagPart, encryptedPart] = String(payload || "").split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Invalid encrypted provider secret");
  }

  const key = getSecretKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskProviderLogin(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  if (trimmed.includes("@")) {
    const [name, domain] = trimmed.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }

  if (trimmed.length <= 4) {
    return `${trimmed.slice(0, 1)}***`;
  }

  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

