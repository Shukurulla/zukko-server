import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/authmiddleware.js";
import { materials, teacherVideos } from "../constants/index.js";
import teacherModel from "../models/teacher.model.js";
import studentModel from "../models/student.model.js";

const router = express.Router();
router.post("/sign", async (req, res) => {
  try {
    const { password, login } = req.body;
    const findStudent = await studentModel.findOne({ login });
    const findTeacher = await teacherModel.findOne({ login });
    if (findStudent || findTeacher) {
      return res.status(400).json({
        status: "error",
        message: "bunday login oldin ishlatilgan",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await teacherModel.create({
      ...req.body,
      password: hashedPassword,
    });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });
    res.json({ status: "success", data: { user, token } });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { password, login } = req.body;
    const findStudent = await teacherModel.findOne({ login });
    const findTeacher = await studentModel.findOne({ login });
    const findUser = findStudent || findTeacher;
    if (!findUser) {
      return res.status(400).json({
        status: "error",
        message: "bunday login foydalanuvchisi topilmadi",
      });
    }
    const compare = await bcrypt.compare(password, findUser.password);
    if (!compare) {
      return res
        .status(401)
        .json({ status: "error", message: "password mos kelmadi" });
    }
    const token = jwt.sign({ userId: findUser._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });
    res.json({ status: "success", data: { user: findUser, token } });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findUser = await teacherModel.findById(userId);
    if (!findUser) {
      return res.status(400).json({
        status: "error",
        message: "bunday  foydalanuvchi topilmadi",
      });
    }

    res.json({ status: "success", data: { user: findUser } });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/lessons", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findUser = await teacherModel.findById(userId);

    if (!findUser) {
      return res.status(400).json({
        status: "error",
        message: "Bunday foydalanuvchi topilmadi",
      });
    }

    const videosWithStatus = teacherVideos.map((video) => ({
      ...video,
      complate: findUser.complateLessons.find((c) => c == video.id.toString())
        ? true
        : false,
    }));

    res.json({ status: "success", data: videosWithStatus });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/lesson/complate/:id", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findUser = await teacherModel.findById(userId);
    if (!findUser) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday foydalanuvchi topilmadi" });
    }
    const findVideo = teacherVideos.find((c) => c.id == req.params.id);
    if (!findVideo) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday video topilmadi" });
    }
    if (findUser.complateLessons.find((c) => c == req.params.id)) {
      return res.json({
        status: "success",
        message: "Video oldin tamomlangan",
        data: findUser,
      });
    }
    const updateUser = await teacherModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          complateLessons: [...findUser.complateLessons, req.params.id],
        },
      },
      { new: true }
    );
    res.json({ status: "success", message: "success", data: updateUser });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/materials", authMiddleware, async (req, res) => {
  try {
    res.json({ status: "success", data: materials });
  } catch (error) {
    res.json({ status: "error", message: error.message });
  }
});

export default router;
