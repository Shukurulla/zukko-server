import express from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { Readable } from "stream";
import Client from "ssh2-sftp-client";
import Certificate from "../models/Certificate.js";
import Student from "../models/student.model.js";
import authMiddleware from "../middlewares/authmiddleware.js";
import studentModel from "../models/student.model.js";
import { studentVideos } from "../constants/index.js";

const router = express.Router();

// Function to upload PDF to SFTP using ssh2-sftp-client
const uploadToSftp = async (pdfBuffer, userId) => {
  const sftp = new Client();
  try {
    console.log("SFTP serverga ulanish boshlanmoqda...");
    await sftp.connect({
      host: "45.134.39.117",
      port: 22,
      username: "root",
      password: process.env.SFTP_PASSWORD,
      retries: 3,
      retryDelay: 2000,
    });
    console.log("SFTP ulanishi muvaffaqiyatli o'rnatildi");

    const remotePath = `/media/certificates/${userId}.pdf`;
    console.log(`Fayl ${remotePath} ga yuklanmoqda...`);

    const stream = new Readable();
    stream.push(pdfBuffer);
    stream.push(null);

    await sftp.put(stream, remotePath);
    console.log("Fayl muvaffaqiyatli yuklandi");

    await sftp.end();
    console.log("SFTP ulanishi yopildi");

    return `https://kepket.uz/media/certificates/${userId}.pdf`;
  } catch (error) {
    console.error("SFTP xatosi:", error);
    if (sftp) {
      try {
        await sftp.end();
      } catch (endError) {
        console.error("SFTP ulanishini yopishda xatolik:", endError);
      }
    }
    throw new Error(
      `SFTP yuklash amalga oshmadi: ${error.message || error.toString()}`
    );
  }
};

// Shared function to generate certificate data
const generateCertificateData = async (student) => {
  // Create a PDF document
  const doc = new PDFDocument({ size: [842, 595] });
  const buffers = [];

  doc.on("data", buffers.push.bind(buffers));

  // Title - SERTIFIKAT
  doc
    .font("Helvetica-Bold")
    .fontSize(30)
    .fillColor("#215A7A")
    .text("SERTIFIKAT", 0, 100, { align: "center", width: 842 });

  // Mental Arifmetika Kursi
  doc
    .font("Helvetica")
    .fontSize(14)
    .fillColor("black")
    .text("Mental Arifmetika Kursi", 0, 140, { align: "center", width: 842 });

  // Acknowledgment text
  doc
    .fontSize(12)
    .fillColor("black")
    .text("Ushbu sertifikat bilan", 0, 160, { align: "center", width: 842 });

  // Student name
  doc.fontSize(20).text(`${student.firstname} ${student.lastname}`, 0, 200, {
    align: "center",
    width: 842,
  });

  // Main body text
  doc
    .fontSize(14)
    .text(
      "Mental arifmetika kursini muvaffaqiyatli tamomlagani uchun taqdirlanadi.\n" +
        "Sizning bu yutug'ingizdan faxrlanamiz! Kelajakda ham muvaffaqiyatlar tilaymiz!",
      0,
      240,
      { align: "center", width: 842 }
    );

  // Signatures
  doc.fontSize(12).text("Direktor", 180, 400);
  doc.text("_________________", 170, 420);
  doc.text("Tashkilotchi", 570, 400);
  doc.text("_________________", 570, 420);

  // Finalize PDF
  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });
  });
};

// Route to generate certificate
router.post("/generate-certificate", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    if (!userId) {
      return res.status(400).json({ message: "userId talab qilinadi" });
    }

    const student = await Student.findById(userId);
    if (!student) {
      return res.status(404).json({ message: "Talaba topilmadi" });
    }

    // Check if student has already completed certificate
    const existingCertificate = await Certificate.findOne({ userId });
    if (existingCertificate) {
      return res.status(200).json({
        message: "Sertifikat allaqachon mavjud",
        certificateUrl: existingCertificate.certificateUrl,
      });
    }

    // Check if student has completed all videos
    const allVideos = studentVideos;
    const completedAll = allVideos.every((video) =>
      student.complateLessons.includes(video.id.toString())
    );

    if (!completedAll) {
      return res.status(400).json({
        message:
          "Barcha videolar ko'rilmagan. Sertifikat olish uchun barcha videolarni ko'rib chiqish kerak.",
      });
    }

    // Generate PDF
    const pdfBuffer = await generateCertificateData(student);

    try {
      // Upload to SFTP server
      const certificateUrl = await uploadToSftp(pdfBuffer, userId);

      // Save certificate in database
      const newCertificate = new Certificate({
        userId,
        username: student.firstname,
        lastname: student.lastname,
        certificateUrl,
      });
      await newCertificate.save();

      // Update student record with certificate info
      await studentModel.findByIdAndUpdate(userId, {
        certificate: {
          id: `CERT-${userId.toString().substring(0, 8)}`,
          issueDate: new Date(),
          filename: `${userId}.pdf`,
        },
      });

      res.status(201).json({
        message: "Sertifikat muvaffaqiyatli yaratildi va yuklandi",
        certificateUrl,
      });
    } catch (error) {
      console.error("Certificate generation error:", error);

      // Provide the user with a static URL if SFTP upload fails
      const fallbackUrl = `https://kepket.uz/media/certificates/${userId}.pdf`;

      res.status(200).json({
        message:
          "Sertifikat yaratildi, lekin serverga yuklanmadi. Keyinroq yuklanadi.",
        certificateUrl: fallbackUrl,
      });
    }
  } catch (error) {
    console.error("Certificate generation error:", error);
    res.status(500).json({ message: "Server xatosi: " + error.message });
  }
});

// Get certificate information
router.get("/", authMiddleware, async (req, res) => {
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
      // Look up certificate in the certificates collection
      const existingCertificate = await Certificate.findOne({ userId });

      const certificateData = {
        available: true,
        studentName: `${findUser.firstname} ${findUser.lastname}`,
        issueDate: findUser.certificate?.issueDate
          ? new Date(findUser.certificate.issueDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        certificateId:
          findUser.certificate?.id ||
          `CERT-${userId.toString().substring(0, 8)}`,
        downloadUrl:
          existingCertificate?.certificateUrl ||
          `https://kepket.uz/media/certificates/${userId}.pdf`,
        previewUrl:
          existingCertificate?.certificateUrl ||
          `https://kepket.uz/media/certificates/${userId}.pdf`,
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
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
