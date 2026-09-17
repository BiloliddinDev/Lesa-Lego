/**
 * Qidiruv matnini regex sifatida xavfsiz ishlatish uchun maxsus belgilarni
 * ekranlaydi. Ilgari foydalanuvchi kiritgan matn to'g'ridan-to'g'ri `$regex`
 * ga uzatilardi: `(` kabi belgi so'rovni yiqitardi, `(a+)+` esa serverni
 * uzoq vaqt band qilishi mumkin edi.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
