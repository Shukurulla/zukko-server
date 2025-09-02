import express from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { Readable } from "stream";
import Client from "ssh2-sftp-client";
import Certificate from "../models/Certificate.js";
import Student from "../models/student.model.js";
import authMiddleware from "../middlewares/authmiddleware.js";
import path from "path";
import studentModel from "../models/student.model.js";
import { studentVideos } from "../constants/index.js";

const router = express.Router();

// Function to upload PDF to SFTP using ssh2-sftp-client
const uploadToSftp = async (pdfBuffer, userId) => {
  const sftp = new Client();
  try {
    console.log("SFTP serverga ulanish boshlanmoqda...");
    await sftp.connect({
      host: "185.197.195.71",
      port: 22,
      username: "root",
      password: "J?ea&DqT47!:",
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

    return `https://vpsserver.kerek.uz/certificates/${userId}.pdf`;
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

    const existingCertificate = await Certificate.findOne({ userId });
    if (existingCertificate) {
      return res.status(200).json({
        message: "Sertifikat allaqachon mavjud",
        certificateUrl: existingCertificate.certificateUrl,
      });
    }

    const certificateUrl = `https://vpsserver.kerek.uz/certificates/${userId}.pdf`;
    const qrCodeData = await QRCode.toDataURL(certificateUrl);

    const doc = new PDFDocument({ size: [842, 595] });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      try {
        const uploadedUrl = await uploadToSftp(pdfBuffer, userId);

        const newCertificate = new Certificate({
          userId,
          username: student.firstname,
          lastname: student.lastname,
          certificateUrl: uploadedUrl,
        });
        await newCertificate.save();

        res.status(201).json({
          message: "Sertifikat muvaffaqiyatli yaratildi va yuklandi",
          certificateUrl: uploadedUrl,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
      }
    });

    // Orqa fon rasmini qo'shish
    const backgroundPath = path.join(
      process.cwd(),
      "assets",
      "certificate-bg.png"
    );
    doc.image(backgroundPath, 0, 0, { width: 842, height: 595 });

    // Title - SERTIFIKAT (qalinroq va rang o'zgartirildi)
    doc
      .font("Helvetica-Bold") // Qalin shrift
      .fontSize(30)
      .fillColor("#215A7A") // Rangni o'zgartirish
      .text("SERTIFIKAT", 0, 100, { align: "center", width: 842 });

    // Mental Arifmetika Kursi (pastga tushirildi)
    doc
      .font("Helvetica") // Oddiy shrift
      .fontSize(14)
      .fillColor("black") // Standart qora rang
      .text("Mental Arifmetika Kursi", 0, 140, { align: "center", width: 842 }); // 80 dan 90 ga tushirildi

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

    // Main body text (kattalashtirildi)
    doc
      .fontSize(14) // 12 dan 14 ga oshirildi
      .text(
        "Mental arifmetika kursini muvaffaqiyatli tamomlagani uchun taqdirlanadi.\n" +
          "Sizning bu yutug'ingizdan faxrlanamiz! Kelajakda ham muvaffaqiyatlar tilaymiz!",
        0,
        240,
        { align: "center", width: 842 }
      );

    // Signatures
    doc.fontSize(12).text("Direktor", 170, 400);
    doc.text("_________________", 170, 420);
    doc.text("Tashkilotchi", 570, 400);
    doc.text("_________________", 570, 420);

    // Add QR code
    doc.image(qrCodeData, 370, 350, { width: 100, height: 100 });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server xatosi" });
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
          `https://vpsserver.kerek.uz/certificates/${userId}.pdf`,
        previewUrl:
          existingCertificate?.certificateUrl ||
          `https://vpsserver.kerek.uz/certificates/${userId}.pdf`,
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

router.delete("/all-delete", async (req, res) => {
  try {
    const certificates = await Certificate.find();
    for (let i = 0; i < certificates.length; i++) {
      await Certificate.findByIdAndDelete(certificates[i]._id);
    }
    res.json({ message: "clear" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
