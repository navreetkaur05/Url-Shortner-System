import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import authRouter from "./routes/auth.js";
import urlsRouter from "./routes/urls.js";

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 });
});
app.use("/api/auth", authRouter);
app.use("/api/urls", urlsRouter);
app.use("/", urlsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required. Add it to server/.env.");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET is required and must be at least 32 characters.");
  }

  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`URL shortener API listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start the URL shortener API:", error);
  process.exitCode = 1;
});
