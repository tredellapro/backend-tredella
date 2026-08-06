import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { Express } from "express";
import express from "express";
import multer from "multer";
import { userFromAuthHeader } from "./context.js";

/* Review photo uploads. Files land on local disk under /uploads and are served
   back statically — swap the storage engine for S3/Cloudinary in production
   without touching the callers, since the API still just returns URLs. */

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype))
      return cb(new Error("Only JPEG, PNG, WebP or GIF images are allowed."));
    cb(null, true);
  },
});

export const registerUploadRoutes = (app: Express, publicUrl: string) => {
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d" }));

  app.post("/upload/review-images", (req, res) => {
    // only signed-in shoppers may upload
    if (!userFromAuthHeader(req.headers.authorization))
      return res.status(401).json({ error: "Please sign in to upload photos." });

    upload.array("images", MAX_FILES)(req, res, (err) => {
      if (err)
        return res
          .status(400)
          .json({ error: err instanceof Error ? err.message : "Upload failed." });

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      res.json({
        urls: files.map((f) => `${publicUrl}/uploads/${f.filename}`),
      });
    });
  });
};
