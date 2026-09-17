import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { Rental } from "../models/Rental";
import { CompanySettings } from "../models/CompanySettings";
import { RentalService } from "./rental.service";
import { calculateRental, documentDayCount } from "./rental-calc";
import { AppError } from "../utils/AppError";

const FONT_DIR = path.resolve(__dirname, "../../assets/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");
const FONT_AVAILABLE = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD);

/**
 * DD.MM.YYYY formatida sana.
 * `YYYY-MM-DD` ko'rinishidagi lokal sana stringlari uchun Date orqali o'tmay
 * to'g'ridan-to'g'ri split qilinadi (UTC siljishi vaqt mintaqasiga bog'liq emas).
 */
function formatUzDate(date?: Date | string | null): string {
  if (!date) return "—";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, m, d] = date.split("T")[0].split("-");
    return `${d}.${m}.${y}`;
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

/** Narxni so'm formatida: 12 500 so'm */
function formatSum(amount: number): string {
  return `${Math.round(amount).toLocaleString("ru-RU")} so'm`;
}

/**
 * Kunlar soni — chek bilan AYNAN bir xil qoida bo'yicha (ikki chegara
 * ichiga olinadi: 01.09 → 05.09 = 5 kun). Ilgari bu yerda alohida
 * `Math.ceil` mantiqi bor edi va nakladnoy/shartnomadagi kun soni
 * chekdagidan bir kunga farq qilardi.
 */
function daysBetween(from: Date, to: Date): number {
  return documentDayCount(from, to);
}

type PdfDoc = InstanceType<typeof PDFDocument>;

function createDocument(): PdfDoc {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  if (FONT_AVAILABLE) {
    doc.registerFont("DejaVu", FONT_REGULAR);
    doc.registerFont("DejaVu-Bold", FONT_BOLD);
  }
  return doc;
}

function font(doc: PdfDoc, bold = false) {
  if (FONT_AVAILABLE) {
    doc.font(bold ? "DejaVu-Bold" : "DejaVu");
  } else {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica");
  }
  return doc;
}

function toBuffer(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

async function getSettings() {
  return (await CompanySettings.findOne()) || (await CompanySettings.create({}));
}

async function getRental(rentalId: string) {
  const rental = await Rental.findById(rentalId)
    .populate("client", "fullName phone telegramId")
    .populate("createdBy", "name");
  if (!rental) throw new AppError("Arenda topilmadi", 404);
  return rental;
}

/** Kompaniya sarlavhasi: nomi, manzili, telefon, INN */
function drawHeader(doc: PdfDoc, settings: any) {
  font(doc, true).fontSize(16).text(settings.companyName || "Lesa Lego MChJ", { align: "center" });
  font(doc).fontSize(9).fillColor("#444444");
  const headerLines = [
    settings.address || "",
    [settings.phone ? `Tel: ${settings.phone}` : "", settings.inn ? `INN: ${settings.inn}` : ""]
      .filter(Boolean)
      .join("  •  "),
  ].filter(Boolean);
  headerLines.forEach((line) => doc.text(line, { align: "center" }));
  doc.fillColor("#000000").moveDown(0.5);
}

/** Mijoz va davr ma'lumotlari bloki */
function drawClientInfo(doc: PdfDoc, rental: any) {
  const clientDoc = rental.client as any;
  font(doc).fontSize(10);
  doc.text(`Arenda raqami: ${rental.rentalNumber}`);
  doc.text(`Mijoz: ${clientDoc.fullName}`);
  doc.text(`Telefon: ${clientDoc.phone}`);
  if (rental.deliveryLocation?.label) {
    doc.text(`Yetkazish manzili: ${rental.deliveryLocation.label}`);
  }
  doc.text(`Boshlangan sana: ${formatUzDate(rental.startDate)}`);
  if (rental.endDate) {
    doc.text(`Yopilgan sana: ${formatUzDate(rental.endDate)}`);
  } else if (rental.expectedEndDate) {
    doc.text(`Kutilgan qaytarish: ${formatUzDate(rental.expectedEndDate)}`);
  }
  doc.moveDown(0.8);
}

/**
 * Umumiy mahsulotlar jadvali: № | nomi | soni | narxi/kun | kun | summa
 * `qtyFn` — har bir satr uchun ko'rsatiladigan sonni hisoblaydi (nakladnoyda faol son).
 * Returns: jami summa.
 */
function drawItemsTable(
  doc: PdfDoc,
  items: any[],
  days: number,
  qtyFn?: (item: any) => number,
) {
  const colWidths = [26, 170, 45, 65, 45, 90];
  const headers = ["№", "Jihoz nomi", "Soni", "Narxi/kun", "Kun", "Summa"];
  const tableTop = doc.y;

  font(doc, true).fontSize(9);
  let x = 50;
  headers.forEach((h, i) => {
    doc.text(h, x, tableTop, { width: colWidths[i], align: i === 0 ? "center" : "left" });
    x += colWidths[i];
  });
  doc.moveTo(50, tableTop + 14).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableTop + 14).stroke();
  doc.moveTo(50, tableTop + 15).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableTop + 15).stroke();

  font(doc).fontSize(9);
  let y = tableTop + 24;
  let grandTotal = 0;
  items.forEach((item, idx) => {
    const qty = qtyFn ? qtyFn(item) : item.quantity;
    const total = qty * item.dailyRate * days;
    grandTotal += total;

    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    x = 50;
    doc.text(String(idx + 1), x, y, { width: colWidths[0], align: "center" });
    x += colWidths[0];
    doc.text(item.equipmentName, x, y, { width: colWidths[1] });
    x += colWidths[1];
    doc.text(`${qty}`, x, y, { width: colWidths[2], align: "center" });
    x += colWidths[2];
    doc.text(`${Math.round(item.dailyRate).toLocaleString("ru-RU")}`, x, y, { width: colWidths[3], align: "right" });
    x += colWidths[3];
    doc.text(`${days}`, x, y, { width: colWidths[4], align: "center" });
    x += colWidths[4];
    doc.text(formatSum(total), x, y, { width: colWidths[5], align: "right" });
    x += colWidths[5];
    y += 20;
  });

  return grandTotal;
}

export class PdfService {
  private rentalService: RentalService;

  constructor() {
    this.rentalService = new RentalService();
  }

  /**
   * CHIQARISH VARAG'I (nakladnoy) — arenda boshlanganda beriladigan hujjat.
   * Berilgan mahsulotlar ro'yxati, davr va summalar ko'rsatiladi.
   */
  async generateNakladnoy(rentalId: string): Promise<Buffer> {
    const rental = await getRental(rentalId);
    const settings = await getSettings();
    const doc = createDocument();
    const promise = toBuffer(doc);

    // Kunlar soni: kutilgan qaytarish sanasigacha (yopilgan bo'lsa yopilish sanasigacha)
    const endDate = rental.endDate || rental.expectedEndDate || new Date();
    const days = daysBetween(rental.startDate, endDate);
    // Haqiqiy hisob — chek va mijoz qarzi bilan aynan bir xil manbadan
    const calc = calculateRental(rental);

    /**
     * Bitta nusxani chizadi. Nakladnoy IKKI NUSXADA beriladi (overview.md):
     * biri jihozni beruvchida, ikkinchisi oluvchida qoladi — shuning uchun
     * bir xil mazmun ikki sahifada, har birida alohida imzo joyi bilan.
     */
    const drawCopy = (copyLabel: string) => {
      drawHeader(doc, settings);

      font(doc, true).fontSize(14).text("CHIQARISH VARAG'I (NAKLADNOY)", { align: "center" });
      font(doc).fontSize(9).fillColor("#555555").text(copyLabel, { align: "center" });
      doc.fillColor("#000000");
      doc.moveDown(0.8);

      drawClientInfo(doc, rental);

      // Nakladnoy — CHIQARISH hujjati: berilgan son bo'yicha REJADAGI summa.
      // Haqiqiy hisob-kitob quyida `rental-calc` dan alohida ko'rsatiladi,
      // shunda reja va haqiqiy summa aralashib ketmaydi.
      const plannedTotal = drawItemsTable(doc, rental.items, days, (item) => item.quantity);

      doc.moveDown(1.5);

      font(doc, true).fontSize(11);
      doc.text(`Rejadagi summa (${days} kun): ${formatSum(plannedTotal)}`, { align: "right" });
      doc.moveDown(0.3);

      font(doc).fontSize(10);
      if (calc.days > 0) {
        doc.text(`Hisoblangan summa (${calc.days} kun): ${formatSum(calc.totalAmount)}`, {
          align: "right",
        });
      }
      doc.text(`Omonat (avans): ${formatSum(calc.depositAmount)}`, { align: "right" });
      doc.text(`To'langan: ${formatSum(calc.paidAmount)}`, { align: "right" });
      font(doc, true).fontSize(10);
      doc.text(
        calc.debt > 0
          ? `Qarz: ${formatSum(calc.debt)}`
          : calc.overpaid > 0
            ? `Ortiqcha to'lov: ${formatSum(calc.overpaid)}`
            : "Qarz yo'q",
        { align: "right" },
      );
      doc.moveDown(1.5);

      // Izoh
      if (rental.note) {
        font(doc).fontSize(9).fillColor("#555555");
        doc.text(`Izoh: ${rental.note}`);
        doc.fillColor("#000000");
        doc.moveDown(1);
      }

      // Imzolar
      const y = Math.max(doc.y, 650);
      font(doc).fontSize(10);
      doc.text("Berdi: ______________________  (______________________)", 50, y);
      doc.text("Oldi: ______________________  (______________________)", 50, y + 30);
    };

    drawCopy("Beruvchi nusxasi");
    doc.addPage();
    drawCopy("Oluvchi nusxasi");

    doc.end();
    return promise;
  }

  /**
   * JORIY HISOB (check) — qaytarish/yopish paytida to'liq hisob-kitob.
   * Kunlik jadval, har bir jihoz bo'yicha hisob va yakuniy summalar ko'rsatiladi.
   */
  async generateCheck(rentalId: string): Promise<Buffer> {
    const check = await this.rentalService.getRentalCheck(rentalId);
    const settings = await getSettings();
    const doc = createDocument();
    const promise = toBuffer(doc);

    drawHeader(doc, settings);

    font(doc, true).fontSize(14).text("HISOB-KITOB (CHECK)", { align: "center" });
    doc.moveDown(0.8);

    font(doc).fontSize(10);
    doc.text(`Arenda raqami: ${check.rentalNumber}`);
    doc.text(`Mijoz: ${check.client.fullName}  (${check.client.phone})`);
    doc.text(`Davr: ${formatUzDate(check.startDate)}  →  ${formatUzDate(check.checkDate)}`);
    doc.text(
      `Holat: ${
        check.status === "active" ? "Faol" : check.status === "overdue" ? "Muddati o'tgan" : "Yopilgan"
      }`,
    );
    doc.moveDown(0.8);

    // Kunlik hisob-kitob jadvali
    if (check.dailySchedule && check.dailySchedule.length > 0) {
      font(doc, true).fontSize(10).text("Kunlik hisob-kitob:");
      doc.moveDown(0.3);

      const tTop = doc.y;
      const cw = [40, 90, 95, 120];
      const ch = ["Kun", "Sana", "Kunlik", "Jami"];
      font(doc, true).fontSize(9);
      let cx = 50;
      ch.forEach((h, i) => {
        doc.text(h, cx, tTop, { width: cw[i], align: i === 0 ? "center" : "right" });
        cx += cw[i];
      });
      doc.moveTo(50, tTop + 14).lineTo(50 + cw.reduce((a, b) => a + b, 0), tTop + 14).stroke();

      font(doc).fontSize(9);
      let cy = tTop + 22;
      check.dailySchedule.forEach((day: any) => {
        if (cy > 720) {
          doc.addPage();
          cy = 50;
        }
        cx = 50;
        doc.text(`#${day.dayNumber}`, cx, cy, { width: cw[0], align: "center" });
        cx += cw[0];
        doc.text(formatUzDate(day.date), cx, cy, { width: cw[1], align: "right" });
        cx += cw[1];
        doc.text(formatSum(day.dailyAmount), cx, cy, { width: cw[2], align: "right" });
        cx += cw[2];
        doc.text(formatSum(day.cumulativeAmount), cx, cy, { width: cw[3], align: "right" });
        cx += cw[3];
        cy += 17;
      });
      doc.moveDown(1.2);
    }

    // Jihozlar bo'yicha batafsil
    font(doc, true).fontSize(10).text("Jihozlar bo'yicha hisob:");
    doc.moveDown(0.3);
    check.items.forEach((item: any) => {
      if (doc.y > 720) doc.addPage();
      font(doc, true).fontSize(9.5);
      doc.text(`${item.equipmentName} — ${item.activeQuantity} dona × ${Math.round(item.dailyRate).toLocaleString("ru-RU")} so'm/kun`);
      item.segments.forEach((seg: any) => {
        font(doc).fontSize(9);
        doc.text(
          `    ${formatUzDate(seg.from)} → ${formatUzDate(seg.to)}: ${seg.quantity} dona × ${seg.days} kun = ${formatSum(seg.amount)}`,
          { indent: 10 },
        );
      });
      font(doc, true).fontSize(9.5);
      doc.text(`    Jami: ${formatSum(item.itemTotal)}`);
      doc.moveDown(0.2);
    });

    doc.moveDown(0.8);

    // Yakuniy summalar
    font(doc, true).fontSize(11);
    doc.text(`Umumiy summa: ${formatSum(check.totalAmount)}`, { align: "right" });
    font(doc).fontSize(10);
    doc.text(`Omonat: ${formatSum(check.depositAmount)}`, { align: "right" });
    doc.text(`To'langan: ${formatSum(check.paidAmount)}`, { align: "right" });
    if (check.overpaid > 0) {
      doc.text(`Ortiqcha to'lov: ${formatSum(check.overpaid)}`, { align: "right" });
    }
    doc.moveDown(0.3);
    font(doc, true).fontSize(12);
    doc.text(
      check.debt > 0 ? `Qarz: ${formatSum(check.debt)}` : "Qarz yo'q (✓)",
      { align: "right" },
    );

    doc.moveDown(1.5);
    const y = Math.max(doc.y, 660);
    font(doc).fontSize(10);
    doc.text("Berdi: ______________________  (______________________)", 50, y);
    doc.text("Oldi: ______________________  (______________________)", 50, y + 30);

    doc.end();
    return promise;
  }

  /**
   * IJARA SHARTNOMASI — kompaniya va mijoz ma'lumotlari, davr, narxlar va imzolar.
   */
  async generateContract(rentalId: string): Promise<Buffer> {
    const rental = await getRental(rentalId);
    const settings = await getSettings();
    const doc = createDocument();
    const promise = toBuffer(doc);

    drawHeader(doc, settings);

    font(doc, true).fontSize(14).text("IJARA SHARTNOMASI", { align: "center" });
    doc.moveDown(0.5);
    font(doc).fontSize(9).fillColor("#555555");
    doc.text(`No: ${rental.rentalNumber}    Sana: ${formatUzDate(new Date())}`, { align: "center" });
    doc.fillColor("#000000");
    doc.moveDown(0.8);

    const clientDoc = rental.client as any;
    const endDate = rental.endDate || rental.expectedEndDate || new Date();
    const days = daysBetween(rental.startDate, endDate);

    font(doc).fontSize(10);
    doc.text(`${settings.companyName || "Lesa Lego MChJ"}, ${settings.ownerName ? `muddiri ${settings.ownerName},` : ""} bir tomondan (Ijara beruvchi) va ${clientDoc.fullName} (${clientDoc.phone}), ikkinchi tomondan (Ijara oluvchi) o'rtasida quyidagi shartnoma tuzildi:`);
    doc.moveDown(0.6);

    doc.text(`1. Ijara beruvchi quyidagi jihozlarni ${days} kun muddatga (${formatUzDate(rental.startDate)} dan ${formatUzDate(endDate)} gacha) ijaraga beradi:`);
    doc.moveDown(0.4);

    // Mahsulotlar jadvali (umumiy helper)
    const grandTotal = drawItemsTable(doc, rental.items, days);
    doc.moveDown(1);

    font(doc).fontSize(10);
    doc.text(`2. Rejadagi ijara summasi: ${formatSum(grandTotal)} (${days} kun uchun). Omonat (avans): ${formatSum(rental.depositAmount)}. Yakuniy summa jihozlar qaytarilgan kunga qarab hisoblanadi.`);
    doc.moveDown(0.3);
    doc.text(`3. Ijara oluvchi jihozlarni buzilishlarsiz, belgilangan muddatda qaytarish majburiyatini oladi.`);
    doc.moveDown(0.3);
    if (settings.rentalTerms) {
      font(doc).fontSize(9).fillColor("#333333");
      settings.rentalTerms.split("\n").forEach((line: string) => doc.text(line.trim(), { indent: 10 }));
      doc.fillColor("#000000");
      doc.moveDown(0.5);
    }
    doc.text(`4. Jihozlar qaytarilganda to'liq hisob-kitob qilinadi va yakuniy qarz aniqlanadi.`);
    doc.moveDown(0.6);
    if (rental.note) {
      doc.text(`5. Izoh: ${rental.note}`);
      doc.moveDown(0.6);
    }
    doc.text(`6. Mazkur shartnoma ikki nusxada tuzildi va har ikki tomon tomonidan imzolanadi.`);
    doc.moveDown(1.5);

    const y = Math.max(doc.y, 660);
    doc.text("Ijara beruvchi: ______________________  (______________________)", 50, y);
    doc.text("Ijara oluvchi:  ______________________  (______________________)", 50, y + 30);

    doc.end();
    return promise;
  }
}

export const pdfService = new PdfService();
