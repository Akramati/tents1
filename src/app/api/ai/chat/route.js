import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyToken } from "@/lib/auth";
import TOOLS, { callTool } from "@/lib/gemini";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `أنت مساعد ذكي لنظام هابي لاند لإدارة الحجوزات والمحاسبة.
لغة التواصل هي العربية.
لديك صلاحية تنفيذ الأوامر التالية عبر الأدوات المتاحة لك:
- طباعة كشوفات حسابات العملاء
- تسديد دفعات للعملاء
- فحص إتاحة التواريخ للحجوزات
- الاستعلام عن أرصدة الموردين

نفّذ الأمر مباشرة عند طلب المستخدم ولا تطلب تأكيداً إضافياً.`;

export async function POST(request) {
  try {
    const { message, token } = await request.json();
    if (!message) {
      return NextResponse.json({ success: false, error: "الرسالة مطلوبة" }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ success: false, error: "التوكن مطلوب" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: "توكن غير صالح أو منتهي" }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "لم يتم تعيين مفتاح Gemini API" }, { status: 500 });
    }

    const generativeModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      tools: TOOLS.map(t => ({
        functionDeclarations: [{
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }],
      })),
    });

    const chat = generativeModel.startChat({ history: [], systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] } });

    let result = await chat.sendMessage(message);
    let response = result.response;

    const calls = response.functionCalls();
    if (calls && calls.length > 0) {
      const call = calls[0];
      const toolResult = await callTool(call.name, call.args, token);
      const result2 = await chat.sendMessage([{ text: `نتيجة تنفيذ الأمر: ${toolResult}` }]);
      response = result2.response;
    }

    const reply = response.text();
    return NextResponse.json({ success: true, reply, role: payload.role });

  } catch (error) {
    console.error("POST /api/ai/chat error:", error);
    return NextResponse.json({ success: false, error: error.message || "خطأ في الاتصال" }, { status: 500 });
  }
}