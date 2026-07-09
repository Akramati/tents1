import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import TOOLS, { callTool } from "@/lib/gemini";

const GEMINI_MODEL = "gemini-2.0-flash";
const OR_BASE = "https://openrouter.ai/api/v1";
const OR_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

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

  if (r.status === 429) return { _quotaExceeded: true };

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Gemini API error ${r.status}: ${errText}`);
  }

  return r.json();
}

async function openRouterChat(messages, tools) {
  const TODAY = new Date().toLocaleDateString("en-CA");
  const orMessages = [
    { role: "system", content: SYSTEM_PROMPT + `\nتاريخ اليوم هو ${TODAY}.` },
    ...messages,
  ];
  const body = {
    model: OR_MODEL,
    messages: orMessages,
    tools: tools ? TOOLS.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: { type: "object", properties: t.parameters.properties, required: t.parameters.required } },
    })) : undefined,
  };
  const r = await fetch(`${OR_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`OpenRouter API error ${r.status}: ${errText}`);
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

function extractORFunctionCall(response) {
  const choice = response.choices?.[0];
  if (choice?.finish_reason === "tool_calls" && choice.message?.tool_calls) {
    const call = choice.message.tool_calls[0];
    return { name: call.function.name, args: JSON.parse(call.function.arguments) };
  }
  return null;
}

function extractORText(response) {
  return response.choices?.[0]?.message?.content || null;
}

async function callAI(messages, tools, useGemini) {
  if (useGemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    try {
      const result = await geminiChat(messages, tools, apiKey);
      if (result._quotaExceeded) return null;
      return { provider: "gemini", data: result };
    } catch {
      return null;
    }
  }
  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) return null;
  try {
    const result = await openRouterChat(messages, false);
    return { provider: "openrouter", data: result };
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const { message, token, history = [] } = await request.json();
    if (!message) return NextResponse.json({ success: false, error: "الرسالة مطلوبة" }, { status: 400 });
    if (!token) return NextResponse.json({ success: false, error: "التوكن مطلوب" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "توكن غير صالح أو منتهي" }, { status: 401 });

    const recentHistory = history.slice(-10);
    const messages = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    // Try Gemini first, fallback to OpenRouter
    let result = await callAI(messages, true, true);
    if (!result) result = await callAI(messages, true, false);
    if (!result) return NextResponse.json({ success: false, error: "جميع خدمات الذكاء الاصطناعي غير متاحة حالياً — جرب لاحقاً" }, { status: 503 });

    let functionCall = result.provider === "gemini"
      ? extractFunctionCall(result.data)
      : extractORFunctionCall(result.data);

    if (functionCall) {
      const funcName = functionCall.name;
      const funcArgs = functionCall.args || {};
      const toolResult = await callTool(funcName, funcArgs, token);

      const messagesWithTool = [
        ...messages,
        { role: "assistant", content: `[استدعاء أداة: ${funcName}]` },
        { role: "user", content: `نتيجة الأداة ${funcName}: ${toolResult}` },
      ];

      let result2 = await callAI(messagesWithTool, false, true);
      if (!result2) result2 = await callAI(messagesWithTool, false, false);

      const reply = result2
        ? (result2.provider === "gemini" ? extractText(result2.data) : extractORText(result2.data)) || toolResult
        : toolResult;
      return NextResponse.json({ success: true, reply, role: payload.role });
    }

    // Fallback: regex patterns for all commands
    const msg = message.trim();
    const printMatch = msg.match(/(?:اطبع|طباعة)\s*(?:كشف\s*(?:حساب)?\s*)?(?:عميل\s*)?(.+)/i);
    if (printMatch) {
      const customerName = printMatch[1].replace(/^(كشف|حساب|عميل)\s*/i, "").trim();
      const toolResult = await callTool("print_statement", { customerName }, token);
      return NextResponse.json({ success: true, reply: toolResult, role: payload.role });
    }

    const payMatch = msg.match(/(?:سدد|تسديد|دفعة|ادفع)\s*(?:لـ|ل)?(.+?)\s*(?:مبلغ|قيمة|رسوم)?\s*(\d[\d,]*)/i);
    if (payMatch) {
      const customerName = payMatch[1].trim();
      const amount = parseFloat(payMatch[2].replace(/,/g, ""));
      const toolResult = await callTool("add_payment", { customerName, amount }, token);
      return NextResponse.json({ success: true, reply: toolResult, role: payload.role });
    }

    const checkMatch = msg.match(/(?:فحص|افحص|تحقق|هل\s*متاح)\s*(?:إتاحة|تاريخ)?\s*(?:في\s*)?(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i);
    if (checkMatch) {
      const date = checkMatch[1].replace(/\//g, "-");
      const toolResult = await callTool("check_availability", { date }, token);
      return NextResponse.json({ success: true, reply: toolResult, role: payload.role });
    }

    const balanceMatch = msg.match(/(?:رصيد|استعلام|عرض)\s*(?:مورد|المورد)\s*(.+)/i);
    if (balanceMatch) {
      const supplierName = balanceMatch[1].trim();
      const toolResult = await callTool("get_supplier_balance", { supplierName }, token);
      return NextResponse.json({ success: true, reply: toolResult, role: payload.role });
    }

    const provider = result.provider;
    const reply = provider === "gemini" ? extractText(result.data) : extractORText(result.data);
    return NextResponse.json({ success: true, reply: reply || "عذراً، لم أستطع فهم طلبك.", role: payload.role });

  } catch (error) {
    console.error("POST /api/ai/chat error:", error);
    const userMessage = error.message?.includes("API error")
      ? "خطأ في الاتصال بالذكاء الاصطناعي — يرجى المحاولة لاحقاً"
      : error.message || "خطأ في الاتصال";
    return NextResponse.json({ success: false, error: userMessage }, { status: 500 });
  }
}