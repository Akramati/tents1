import { NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

export async function POST(request) {
  try {
    const { pdfBase64, title } = await request.json();
    if (!pdfBase64) {
      return NextResponse.json({ success: false, error: "PDF data required" }, { status: 400 });
    }
    if (!APPS_SCRIPT_URL) {
      return NextResponse.json({ success: false, error: "Google Apps Script URL not configured" }, { status: 500 });
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ pdfBase64, title: title || "مستند" }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ success: false, error: "استجابة غير متوقعة من خدمة الطباعة", responseText: text.substring(0, 500) }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("POST /api/print/epson error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
