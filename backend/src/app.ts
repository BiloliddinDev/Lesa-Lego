import express from "express";
import cors from "cors";
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

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/auth", authRoutes);
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
    startBot();
    startOverdueCheckJob();
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
