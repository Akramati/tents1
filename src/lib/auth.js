import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret";

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function requireAuth(request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return { error: "غير مصرح", status: 401 };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: "انتهت الجلسة", status: 401 };
  }
  return { user: payload };
}

export function requireAdmin(request) {
  const result = requireAuth(request);
  if (result.error) return result;
  if (result.user.role !== "admin") {
    return { error: "غير مصرح — صلاحية مدير مطلوبة", status: 403 };
  }
  return { user: result.user };
}
