import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/authmiddleware.js";
import { studentVideos } from "../constants/index.js";
import studentModel from "../models/student.model.js";
import teacherModel from "../models/teacher.model.js";

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
    const user = await studentModel.create({
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
    const findUser = await studentModel.findOne({ login });
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
    const findUser = await studentModel.findById(userId);
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
    const findUser = await studentModel.findById(userId);

    if (!findUser) {
      return res.status(400).json({
        status: "error",
        message: "Bunday foydalanuvchi topilmadi",
      });
    }

    const videosWithStatus = studentVideos.map((video) => ({
      ...video,
      complate: findUser.complateLessons.includes(video.id.toString())
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
    const findUser = await studentModel.findById(userId);
    if (!findUser) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday foydalanuvchi topilmadi" });
    }
    const findVideo = studentVideos.find((c) => c.id == req.params.id);
    if (!findVideo) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday video topilmadi" });
    }

    // Check if this video is already completed
    if (findUser.complateLessons.includes(req.params.id)) {
      return res.json({
        status: "success",
        message: "Video oldin tamomlangan",
        data: findUser,
      });
    }

    // Add the video to completed lessons
    const updateUser = await studentModel.findByIdAndUpdate(
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

// Certificate verification endpoint
router.get("/certificate", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findUser = await studentModel.findById(userId);

    if (!findUser) {
      return res.status(400).json({
        status: "error",
        message: "Bunday foydalanuvchi topilmadi",
      });
    }

    // Get all videos to check if all are completed
    const allVideos = studentVideos;

    // Check if the student has completed all videos
    const completedAll = allVideos.every((video) =>
      findUser.complateLessons.includes(video.id.toString())
    );

    if (completedAll) {
      // For completed students, provide certificate info
      // Check if user already has certificate data in their record
      const hasSavedCertificate = findUser.certificate && findUser.certificate.id;
      
      const certificateData = {
        available: true,
        studentName: `${findUser.firstname} ${findUser.lastname}`,
        issueDate: hasSavedCertificate
          ? new Date(findUser.certificate.issueDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        certificateId: hasSavedCertificate
          ? findUser.certificate.id
          : `CERT-${findUser._id.toString().substring(0, 8)}`,
        // Using kepket.uz domain for both URLs
        downloadUrl: `https://kepket.uz/media/certificates/${findUser._id}.pdf`,
        previewUrl: `https://kepket.uz/media/certificates/${findUser._id}.pdf`,
        justGenerated: false,
      };

      res.json({
        status: "success",
        message: "Sertifikat mavjud",
        data: certificateData,
      });
    } else {
      // Calculate completion percentage
      const completedCount = findUser.complateLessons.length;
      const totalVideos = allVideos.length;
      const completionPercentage = Math.floor(
        (completedCount / totalVideos) * 100
      );

      // Get IDs of videos that are not completed
      const notCompletedVideos = allVideos
        .filter(
          (video) => !findUser.complateLessons.includes(video.id.toString())
        )
        .map((video) => video.id);

      res.json({
        status: "warning",
        message:
          "Barcha videolar to'liq ko'rilmagan. Iltimos, barcha videolarni ko'rib chiqing.",
        data: {
          available: false,
          completionPercentage,
          completedCount,
          totalVideos,
          notCompletedVideos,
        },
      });
    }
  } catch (error) {
    console.error("Certificate error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;