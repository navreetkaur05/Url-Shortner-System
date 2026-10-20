import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(user) {
  return { id: user.id, email: user.email };
}

router.post("/register", async (req, res, next) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!emailPattern.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters and no more than 72 UTF-8 bytes." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (typeof existingUser.passwordHash === "string" && existingUser.passwordHash) {
        return res.status(409).json({ error: "An account with that email already exists." });
      }

      const repairedUser = await User.findOneAndUpdate(
        {
          _id: existingUser._id,
          $or: [
            { passwordHash: { $exists: false } },
            { passwordHash: null },
            { passwordHash: "" },
          ],
        },
        { $set: { passwordHash } },
        { new: true }
      );
      if (!repairedUser) {
        return res.status(409).json({ error: "An account with that email already exists." });
      }
      return res
        .status(200)
        .json({ token: createToken(repairedUser), user: publicUser(repairedUser) });
    }

    const user = await User.create({ email, passwordHash });
    return res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (
      typeof user.passwordHash !== "string" ||
      !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.passwordHash)
    ) {
      return res.status(401).json({
        error: "This account has no password set. Choose Create an account to finish setting it up.",
      });
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("email");
    if (!user) {
      return res.status(401).json({ error: "Account not found. Please log in again." });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
