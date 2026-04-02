require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const seedAreas = require('./database/seeders/areaSeeders');

const { connectDB } = require("./config/database");
const logger = require("./utils/logger");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// ─── Security & Parsing Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── HTTP Request Logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV, timestamp: new Date() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
app.use('/webhook', webhookRoutes);


// ─── Error Handling ───────────────────────────────────────────────────────────
// app.use(notFound);
// app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

const start = async () => {
  await connectDB();
  await seedAreas(); 
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT} [${process.env.NODE_ENV}]`);
  });
};

start();

module.exports = app;