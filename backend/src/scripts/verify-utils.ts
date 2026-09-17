import crypto from "node:crypto";
import { escapeRegex } from "../utils/regex";
import { verifyTelegramWebAppData } from "../utils/telegramAuth";
import { Client } from "../models/Client";
import { tzDateKey } from "../utils/date";

let bad = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "OK  " : "XATO"}  ${name}${detail ? "  " + detail : ""}`);
};

console.log("=== escapeRegex ===");
check("maxsus belgilar ekranlanadi", escapeRegex("a+(b)") === "a\\+\\(b\\)", escapeRegex("a+(b)"));
check("oddiy matn o'zgarmaydi", escapeRegex("Vohid") === "Vohid");
check("ekranlangan matn regexga aylanadi", new RegExp(escapeRegex("(a+)+")).test("(a+)+"));

console.log("=== mijoz dublikat so'rovi ===");
const conditions: Record<string, unknown>[] = [{ phone: "+998901234567" }];
const filterNoTg = JSON.stringify(Client.findOne({ $or: conditions }).getFilter());
check("telegramId yo'q — bo'sh shart qo'shilmaydi", !filterNoTg.includes("{}"), filterNoTg);
conditions.push({ telegramId: 555 });
const filterTg = JSON.stringify(Client.findOne({ $or: conditions }).getFilter());
check("telegramId bor — shart qo'shiladi", filterTg.includes("555"), filterTg);

console.log("=== telegram hash (timingSafeEqual) ===");
const token = "12345:TEST";
const initDataBad = "auth_date=" + Math.floor(Date.now() / 1000) + "&user=%7B%7D&hash=deadbeef";
check("noto'g'ri hash — xato tashlamaydi, false qaytaradi", verifyTelegramWebAppData(initDataBad, token) === false);
check("hash umuman yo'q", verifyTelegramWebAppData("auth_date=1", token) === false);

// To'g'ri initData yasaymiz — haqiqiy hash bilan true qaytishi kerak
const authDate = String(Math.floor(Date.now() / 1000));
const dataCheckString = ["auth_date=" + authDate, "user={}"].sort().join("\n");
const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
const goodHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
const initDataGood = `auth_date=${authDate}&user=${encodeURIComponent("{}")}&hash=${goodHash}`;
check("to'g'ri hash — true", verifyTelegramWebAppData(initDataGood, token) === true);
check("muddati o'tgan initData — false", verifyTelegramWebAppData(
  (() => {
    const old = String(Math.floor(Date.now() / 1000) - 90000);
    const dcs = ["auth_date=" + old, "user={}"].sort().join("\n");
    const h = crypto.createHmac("sha256", secretKey).update(dcs).digest("hex");
    return `auth_date=${old}&user=${encodeURIComponent("{}")}&hash=${h}`;
  })(),
  token,
) === false);

console.log("=== arenda raqami yili (APP_TZ) ===");
check("yil mintaqa bo'yicha olinadi", tzDateKey(new Date("2026-12-31T19:30:00Z")).slice(0, 4) === "2027", tzDateKey(new Date("2026-12-31T19:30:00Z")));
check("kunduzi o'sha yil", tzDateKey(new Date("2026-12-31T10:00:00Z")).slice(0, 4) === "2026");

console.log(bad === 0 ? "\n✅ Barcha tekshiruvlar o'tdi" : `\n❌ ${bad} ta xato`);
process.exit(bad === 0 ? 0 : 1);
