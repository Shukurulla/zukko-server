import express from "express";
import mongoose from "mongoose";
import { config } from "dotenv";
import cors from "cors";
config();
import UserRouter from "./routers/user.routes.js";

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

app.listen(7777, () => {
  console.log("server has ben started on port 7777");
});
