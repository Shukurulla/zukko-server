import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/authmiddleware.js";
import { studentVideos } from "../constants/index.js";
import studentModel from "../models/student.model.js";
import teacherModel from "../models/teacher.model.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create certificates directory if it doesn't exist
const certificatesDir = path.join(__dirname, "..", "public", "certificates");
if (!fs.existsSync(certificatesDir)) {
  fs.mkdirSync(certificatesDir, { recursive: true });
}

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

// Certificate generation function
const generateCertificate = async (user) => {
  try {
    // Create filename for the certificate
    const filename = `${user._id.toString()}.pdf`;
    const certificatePath = path.join(certificatesDir, filename);

    // Check if certificate already exists
    if (fs.existsSync(certificatePath)) {
      return {
        exists: true,
        path: certificatePath,
        filename: filename,
      };
    }

    // If certificate doesn't exist, generate it
    // Here we'd normally use a PDF generation library like PDFKit
    // For demonstration, we'll create a simple text file
    const certificateContent = `
      CERTIFICATE OF COMPLETION
      
      This certifies that
      
      ${user.firstname} ${user.lastname}
      
      has successfully completed the Mental Arifmetika
      course on ${new Date().toLocaleDateString()}
      
      Certificate ID: CERT-${user._id.toString().substring(0, 8)}
    `;

    // Write the certificate file
    fs.writeFileSync(certificatePath, certificateContent);

    // Add certificate info to user record
    await studentModel.findByIdAndUpdate(user._id, {
      $set: {
        certificate: {
          id: `CERT-${user._id.toString().substring(0, 8)}`,
          issueDate: new Date(),
          filename: filename,
        },
      },
    });

    return {
      exists: false,
      path: certificatePath,
      filename: filename,
    };
  } catch (error) {
    console.error("Error generating certificate:", error);
    throw error;
  }
};

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
      // Check if user already has a certificate
      let certificateInfo;
      if (findUser.certificate) {
        // Certificate already exists in user record
        certificateInfo = {
          exists: true,
          filename: findUser.certificate.filename,
        };
      } else {
        // Generate a new certificate
        certificateInfo = await generateCertificate(findUser);
      }

      // Get the server base URL
      const baseUrl =
        process.env.SERVER_URL || "https://zukko-server.vercel.app";

      // Generate certificate data
      const certificateData = {
        available: true,
        studentName: `${findUser.firstname} ${findUser.lastname}`,
        issueDate: findUser.certificate?.issueDate
          ? new Date(findUser.certificate.issueDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        certificateId:
          findUser.certificate?.id ||
          `CERT-${findUser._id.toString().substring(0, 8)}`,
        downloadUrl: `${baseUrl}/public/certificates/${certificateInfo.filename}`,
        previewUrl: `${baseUrl}/public/certificates/${certificateInfo.filename}`,
        justGenerated: !certificateInfo.exists,
      };

      res.json({
        status: "success",
        message: certificateInfo.exists
          ? "Sertifikat mavjud"
          : "Sertifikat endigina tayyorlandi",
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

// Endpoint to serve certificate files
router.get("/certificate/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const certificatePath = path.join(certificatesDir, filename);

    // Check if file exists
    if (!fs.existsSync(certificatePath)) {
      return res.status(404).json({
        status: "error",
        message: "Sertifikat topilmadi",
      });
    }

    // Set appropriate headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    // Send the file
    const fileStream = fs.createReadStream(certificatePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
