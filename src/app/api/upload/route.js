import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ success: false, error: "الملف مطلوب" }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || ".jpg";
    const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    await writeFile(filepath, buffer);
    const url = `/uploads/${filename}`;
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
