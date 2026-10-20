import { randomBytes, randomUUID } from "node:crypto";
import { Router } from "express";
import Click from "../models/Click.js";
import Url from "../models/Url.js";
import requireAuth, { optionalAuth } from "../middleware/requireAuth.js";

const router = Router();
const validShortCode = /^[A-Za-z0-9_-]{3,32}$/;
const reservedShortCodes = new Set([
  "analytics",
  "api",
  "favicon.ico",
  "mine",
  "robots.txt",
]);

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getShortUrl(req, shortCode) {
  const publicBaseUrl =
    process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
    `${req.protocol}://${req.get("host")}`;
  return `${publicBaseUrl}/${shortCode}`;
}

function serializeUrl(req, url, clicks = 0) {
  return {
    id: url.id,
    originalUrl: url.originalUrl,
    shortCode: url.shortCode,
    shortUrl: getShortUrl(req, url.shortCode),
    clicks,
    createdAt: url.createdAt,
    expiresAt: url.expiresAt || null,
    expired: Boolean(url.expiresAt && url.expiresAt <= new Date()),
  };
}

router.post("/", optionalAuth, async (req, res, next) => {
  const originalUrl =
    typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!originalUrl) {
    return res.status(400).json({ error: "Please enter a URL." });
  }
  if (!isValidHttpUrl(originalUrl)) {
    return res
      .status(400)
      .json({ error: "Enter a valid URL starting with http:// or https://." });
  }

  const requestedCode =
    typeof req.body?.customCode === "string" ? req.body.customCode.trim().toLowerCase() : "";
  if (
    requestedCode &&
    (!validShortCode.test(requestedCode) ||
      reservedShortCodes.has(requestedCode.toLowerCase()))
  ) {
    return res.status(400).json({
      error: "Custom links must be 3–32 characters using letters, numbers, hyphens, or underscores.",
    });
  }

  let expiresAt;
  if (req.body?.expiresAt) {
    expiresAt = new Date(req.body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: "Enter a valid expiration date." });
    }
    if (expiresAt <= new Date()) {
      return res.status(400).json({ error: "Expiration must be a future date." });
    }
  }

  try {
    let savedUrl;
    const attempts = requestedCode ? 1 : 5;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const shortCode =
        requestedCode || randomBytes(6).toString("base64url").slice(0, 7).toLowerCase();
      try {
        savedUrl = await Url.create({
          originalUrl,
          shortCode,
          ...(req.userId ? { owner: req.userId } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        });
        break;
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
        if (requestedCode) {
          return res.status(409).json({ error: "That custom link is already in use." });
        }
      }
    }

    if (!savedUrl) {
      return res
        .status(503)
        .json({ error: "Could not create a short link. Please try again." });
    }

    return res.status(201).json(serializeUrl(req, savedUrl));
  } catch (error) {
    return next(error);
  }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const urls = await Url.find({ owner: req.userId }).sort({ createdAt: -1 });
    const ids = urls.map((url) => url._id);
    const clickCounts = ids.length
      ? await Click.aggregate([
          { $match: { url: { $in: ids } } },
          { $group: { _id: "$url", clicks: { $sum: 1 } } },
        ])
      : [];
    const clicksByUrl = new Map(clickCounts.map((item) => [String(item._id), item.clicks]));
    return res.json({
      urls: urls.map((url) => serializeUrl(req, url, clicksByUrl.get(String(url._id)) || 0)),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/analytics", requireAuth, async (req, res, next) => {
  try {
    const urls = await Url.find({ owner: req.userId }).sort({ createdAt: -1 });
    const ids = urls.map((url) => url._id);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 29);

    if (ids.length === 0) {
      return res.json({
        totalLinks: 0,
        activeLinks: 0,
        totalClicks: 0,
        uniqueVisitors: 0,
        popularLinks: [],
        clicksOverTime: [],
      });
    }

    const [counts, uniqueVisitors, dailyClicks] = await Promise.all([
      Click.aggregate([
        { $match: { url: { $in: ids } } },
        { $group: { _id: "$url", clicks: { $sum: 1 } } },
      ]),
      Click.distinct("visitorId", { url: { $in: ids } }),
      Click.aggregate([
        { $match: { url: { $in: ids }, clickedAt: { $gte: start } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$clickedAt", timezone: "UTC" },
            },
            clicks: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const clicksByUrl = new Map(counts.map((item) => [String(item._id), item.clicks]));
    const popularLinks = urls
      .map((url) => ({
        ...serializeUrl(req, url, clicksByUrl.get(String(url._id)) || 0),
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);
    const dailyByDate = new Map(dailyClicks.map((item) => [item._id, item.clicks]));
    const clicksOverTime = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      return { date, clicks: dailyByDate.get(date) || 0 };
    });

    return res.json({
      totalLinks: urls.length,
      activeLinks: urls.filter((url) => !url.expiresAt || url.expiresAt > new Date()).length,
      totalClicks: counts.reduce((total, item) => total + item.clicks, 0),
      uniqueVisitors: uniqueVisitors.length,
      popularLinks,
      clicksOverTime,
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:shortCode", requireAuth, async (req, res, next) => {
  try {
    const deleted = await Url.findOneAndDelete({
      shortCode: req.params.shortCode,
      owner: req.userId,
    });
    if (!deleted) {
      return res.status(404).json({ error: "Link not found in your account." });
    }
    await Click.deleteMany({ url: deleted._id });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

router.get("/:shortCode", async (req, res, next) => {
  const shortCode = req.params.shortCode;
  if (
    !validShortCode.test(shortCode) ||
    reservedShortCodes.has(shortCode.toLowerCase())
  ) {
    return res.status(404).json({ error: "Short URL not found." });
  }

  try {
    const savedUrl = await Url.findOne({ shortCode });
    if (!savedUrl) {
      return res.status(404).json({ error: "Short URL not found." });
    }
    if (savedUrl.expiresAt && savedUrl.expiresAt <= new Date()) {
      return res.status(410).send("This short link has expired.");
    }

    const cookieName = `shortly_visitor_${shortCode}`;
    const cookieHeader = req.get("cookie") || "";
    const visitorCookie = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`));
    const visitorId = visitorCookie?.slice(cookieName.length + 1) || randomUUID();

    if (!visitorCookie) {
      res.append(
        "Set-Cookie",
        `${cookieName}=${visitorId}; Path=/${shortCode}; Max-Age=31536000; HttpOnly; SameSite=Lax${req.secure ? "; Secure" : ""}`
      );
    }

    await Click.create({ url: savedUrl._id, visitorId });
    return res.redirect(302, savedUrl.originalUrl);
  } catch (error) {
    return next(error);
  }
});

export default router;
