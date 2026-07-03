import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const EPSON_EMAIL = "hwy80305686jqg@print.epsonconnect.com";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request) {
  try {
    const { pdfBase64, title } = await request.json();
    if (!pdfBase64) {
      return NextResponse.json({ success: false, error: "PDF data required" }, { status: 400 });
    }

    const raw = Buffer.from(pdfBase64, "base64");

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: EPSON_EMAIL,
      subject: "طباعة - " + (title || "مستند"),
      text: "مستند للطباعة من نظام هابي لاند",
      attachments: [{ filename: (title || "مستند") + ".pdf", content: raw }],
    });

    return NextResponse.json({ success: true, message: "تم إرسال المستند للطابعة بنجاح" });
  } catch (error) {
    console.error("POST /api/print/epson error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
