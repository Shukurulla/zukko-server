import express from "express";
import mongoose from "mongoose";
import { config } from "dotenv";
import cors from "cors";
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

app.use("/api/user", UserRouter);
app.use("/api/teacher", TeacherRouter);
app.use("/api/student", StudentRouter);
app.use("/api/certificate", certificateRoutes);

app.listen(7777, () => {
  console.log("server has ben started on port 7777");
});
