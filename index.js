import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { config } from "dotenv";
config();
import UserRouter from "./routers/user.routes.js";
import TeacherRouter from "./routers/teacher.routes.js";
import StudentRouter from "./routers/student.routes.js";
import certificateRoutes from "./routers/certificate.routes.js";
const app = express();

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log("database connected");
});

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all routes for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use("/api/user", UserRouter);
app.use("/api/teacher", TeacherRouter);
app.use("/api/student", StudentRouter);
app.use("/api/certificate", certificateRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is healthy" });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    status: "error",
    message: "Server xatosi",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 7777;

app.listen(PORT, () => {
  console.log(`Server has been started on port ${PORT}`);
});

export default app;
