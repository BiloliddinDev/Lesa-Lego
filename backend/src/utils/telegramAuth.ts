import crypto from "node:crypto";

export function verifyTelegramWebAppData(
  initData: string,
  botToken: string,
): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const authDate = params.get("auth_date");
  if (!authDate) return false;

  const now = Math.floor(Date.now() / 1000);
  const authTimestamp = Number(authDate);
  const MAX_AGE_SECONDS = 86400;

  if (now - authTimestamp > MAX_AGE_SECONDS) {
    return false;
  }

  return calculatedHash === hash;
}
