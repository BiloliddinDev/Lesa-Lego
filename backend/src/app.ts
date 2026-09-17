import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { swaggerDocument } from "./config/swagger.js";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import categoryRoutes from "./routes/category.routes";
import equipmentRoutes from "./routes/equipment.routes";
import clientRoutes from "./routes/client.routes";
import rentalRoutes from "./routes/rental.routes";
import paymentRoutes from "./routes/payment.routes";
import debtRoutes from "./routes/debt.routes";
import settingsRoutes from "./routes/settings.routes";
import reportRoutes from "./routes/report.routes";
import { errorHandler } from "./middleware/errorHandler";
import { startBot } from "./bot/index";
import { startOverdueCheckJob } from "./jobs/overdue-check";
import { reconcileAll } from "./services/maintenance.service";

const app = express();

// Reverse-proxy (nginx) ortida ishlaganda rate-limit haqiqiy IP ni ko'rishi uchun
app.set("trust proxy", 1);

// Xavfsizlik header'lari. `contentSecurityPolicy` o'chirilgan: Swagger UI
// o'zining inline skriptlarini yuklay olmay qolardi, API esa HTML bermaydi.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS ataylab ochiq: Telegram WebApp turli domenlardan (web.telegram.org,
// mobil klientlar) ochiladi, ruxsat ro'yxati esa ilovani ishlamay qo'yadi.
// Himoya JWT va Telegram initData tekshiruvi orqali beriladi.
app.use(cors());

// PDF uchun logotip/pechat base64 ko'rinishida keladi — standart 100kb kam
app.use(express.json({ limit: "5mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

/**
 * So'rov chegaralari. Ilgari umuman yo'q edi: login endpointiga cheksiz
 * urinish mumkin edi.
 * `/health` va `/api-docs` chegaradan tashqarida (monitoring uzilmasligi uchun).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring" },
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Ombor sahifasi bir ochilishda o'nlab so'rov yuboradi — chegara keng
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Juda ko'p so'rov. Birozdan keyin qayta urinib ko'ring" },
  },
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/rentals", rentalRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportRoutes);

app.use(errorHandler);

const start = async () => {
  try {
    await connectDB();

    // Eski xatolar qoldirgan nomuvofiqliklarni tuzatamiz (ombor sanog'i va
    // mijoz qarzlari). Xato bo'lsa ham server ko'tarilishi to'xtamaydi.
    try {
      const result = await reconcileAll();
      console.log(
        `[Reconcile] Ombor: ${result.stock.fixed}/${result.stock.checked} jihoz tuzatildi, ` +
          `${result.clientsRecalculated} mijoz qarzi qayta hisoblandi`,
      );
    } catch (err) {
      console.error("[Reconcile] Bazani tuzatib bo'lmadi:", err);
    }

    if (env.ENABLE_BOT) {
      startBot();
    } else {
      console.log("[Bot] ENABLE_BOT=false — bot ishga tushirilmadi");
    }

    if (env.ENABLE_CRON) {
      startOverdueCheckJob();
    } else {
      console.log("[Cron] ENABLE_CRON=false — jadval ishga tushirilmadi");
    }
    app.listen(env.PORT, () => {
      console.log(
        `Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`,
      );
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
};

start();

export default app;
