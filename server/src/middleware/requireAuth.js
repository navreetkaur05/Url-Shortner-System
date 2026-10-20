import jwt from "jsonwebtoken";

export function optionalAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  if (!authorization) return next();

  const [scheme, token, extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    return res.status(401).json({ error: "Please log in to continue." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof payload !== "object" || typeof payload.sub !== "string") {
      return res.status(401).json({ error: "Your session is invalid. Log in again." });
    }
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Log in again." });
  }
}

export default function requireAuth(req, res, next) {
  if (!req.get("authorization")) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  return optionalAuth(req, res, next);
}
