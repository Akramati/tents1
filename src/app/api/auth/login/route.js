import { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const empUser = process.env.EMPLOYEE_USERNAME || "emp";
    const empPass = process.env.EMPLOYEE_PASSWORD || "emp123";

    let role = null;
    if (username === adminUser && password === adminPass) {
      role = "admin";
    } else if (username === empUser && password === empPass) {
      role = "employee";
    }

    if (!role) {
      return NextResponse.json({ success: false, error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    const token = signToken({ username, role });
    return NextResponse.json({ success: true, token, user: { username, role } });
  } catch {
    return NextResponse.json({ success: false, error: "خطأ في الخادم" }, { status: 500 });
  }
}
