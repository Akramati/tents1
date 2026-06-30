import { NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ success: false, error: "انتهت الجلسة" }, { status: 401 });
  }
  return NextResponse.json({ success: true, user: payload });
}
