import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import TOOLS, { callTool } from "@/lib/gemini";

const GEMINI_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `أنت مساعد ذكي لنظام هابي لاند لإدارة الحجوزات والمحاسبة.
لغة التواصل هي العربية.

لديك الأدوات التالية ويجب استخدامها حصراً لتنفيذ طلبات المستخدم:
1. print_statement(customerName, bookingId) — طباعة كشف حساب عميل
2. add_payment(customerName, amount, date, notes, cashAccountCode) — تسجيل دفعة
3. check_availability(date, bookingType) — فحص إتاحة تاريخ
4. get_supplier_balance(supplierName) — رصيد مورد

تعليمات مهمة ومطلقة:
- عندما يقول المستخدم "اطبع كشف حساب فلان"، استخدم print_statement فوراً مع customerName = اسم العميل المذكور.
- عندما يقول "سدد دفعة لفلان بمبلغ X" استخدم add_payment فوراً.
- عندما يقول "افحص إتاحة تاريخ Y" استخدم check_availability فوراً.
- عندما يقول "رصيد مورد X" استخدم get_supplier_balance فوراً.
- لا تطلب تأكيداً إضافياً أبداً.
- لا تسأل عن تفاصيل أكثر — استخدم ما ورد من معلومات ونفّذ.
- لا تكتب شرحاً — نفّذ الأداة ثم أعد النتيجة.
- أجب بإيجاز ووضوح.`;

function buildGeminiTools() {
  return [{
    functionDeclarations: TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: "OBJECT",
        properties: t.parameters.properties,
        required: t.parameters.required,
      },
    })),
  }];
}

function convertHistoryToGemini(history) {
  return history.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

async function geminiChat(messages, tools, apiKey) {
  // Build the Gemini API request
  const TODAY = new Date().toLocaleDateString("en-CA");
  const systemInstruction = {
    parts: [{ text: SYSTEM_PROMPT + `\nتاريخ اليوم هو ${TODAY}.` }],
  };

  const contents = convertHistoryToGemini(messages);

  const body = {
    system_instruction: systemInstruction,
    contents,
    tools: tools ? buildGeminiTools() : undefined,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Gemini API error ${r.status}: ${errText}`);
  }

  return r.json();
}

function extractFunctionCall(response) {
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) return null;

  for (const part of candidate.content.parts) {
    if (part.functionCall) {
      return part.functionCall;
    }
  }
  return null;
}

function extractText(response) {
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) return null;

  for (const part of candidate.content.parts) {
    if (part.text) {
      return part.text;
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const { message, token, history = [] } = await request.json();
    if (!message) return NextResponse.json({ success: false, error: "الرسالة مطلوبة" }, { status: 400 });
    if (!token) return NextResponse.json({ success: false, error: "التوكن مطلوب" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "توكن غير صالح أو منتهي" }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "لم يتم تعيين مفتاح Gemini API" }, { status: 500 });
    }

    // Build conversation with history (last 10 messages max)
    const recentHistory = history.slice(-10);
    const messages = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    // First call: let Gemini decide whether to call a tool
    let data = await geminiChat(messages, true, apiKey);
    const functionCall = extractFunctionCall(data);

    if (functionCall) {
      // Execute the tool
      const funcName = functionCall.name;
      const funcArgs = functionCall.args || {};
      const toolResult = await callTool(funcName, funcArgs, token);

      // Send the tool result back to Gemini for a human-friendly response
      const messagesWithTool = [
        ...messages,
        { role: "assistant", content: `[استدعاء أداة: ${funcName}]` },
        { role: "user", content: `نتيجة الأداة ${funcName}: ${toolResult}` },
      ];

      data = await geminiChat(messagesWithTool, false, apiKey);
      const reply = extractText(data) || toolResult;
      return NextResponse.json({ success: true, reply, role: payload.role });
    }

    // No tool call — check for direct print pattern as fallback
    const printMatch = message.match(/(?:اطبع|طباعة)\s*(?:كشف\s*(?:حساب)?\s*)?(?:عميل\s*)?(.+)/i);
    if (printMatch) {
      const customerName = printMatch[1].replace(/^(كشف|حساب|عميل)\s*/i, "").trim();
      const toolResult = await callTool("print_statement", { customerName }, token);
      return NextResponse.json({ success: true, reply: toolResult, role: payload.role });
    }

    const reply = extractText(data) || "عذراً، لم أستطع فهم طلبك. حاول مرة أخرى.";
    return NextResponse.json({ success: true, reply, role: payload.role });

  } catch (error) {
    console.error("POST /api/ai/chat error:", error);
    const userMessage = error.message?.includes("API error")
      ? "خطأ في الاتصال بالذكاء الاصطناعي — يرجى المحاولة لاحقاً"
      : error.message || "خطأ في الاتصال";
    return NextResponse.json({ success: false, error: userMessage }, { status: 500 });
  }
}