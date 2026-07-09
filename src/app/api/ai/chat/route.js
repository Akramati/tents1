import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import TOOLS, { callTool } from "@/lib/gemini";

const API_BASE = "https://openrouter.ai/api/v1";
const API_MODEL = "deepseek/deepseek-chat-v3-0324";

const TODAY = new Date().toISOString().slice(0, 10);
const SYSTEM_PROMPT = `أنت مساعد ذكي لنظام هابي لاند لإدارة الحجوزات والمحاسبة.
لغة التواصل هي العربية.
تاريخ اليوم هو ${TODAY}.

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
- لا تكتب شرحاً — نفّذ الأداة ثم أعد النتيجة.`;

async function deepseekChat(messages, tools) {
  const body = {
    model: API_MODEL,
    messages,
    tools: tools ? TOOLS.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: { type: "object", properties: t.parameters.properties, required: t.parameters.required } },
    })) : undefined,
  };
  const r = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`DeepSeek API error ${r.status}: ${errText}`);
  }
  return r.json();
}

export async function POST(request) {
  try {
    const { message, token } = await request.json();
    if (!message) return NextResponse.json({ success: false, error: "الرسالة مطلوبة" }, { status: 400 });
    if (!token) return NextResponse.json({ success: false, error: "التوكن مطلوب" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: "توكن غير صالح أو منتهي" }, { status: 401 });

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ success: false, error: "لم يتم تعيين مفتاح OpenRouter API" }, { status: 500 });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ];

    let data = await deepseekChat(messages, true);
    let choice = data.choices?.[0];

    if (choice?.finish_reason === "tool_calls" && choice.message?.tool_calls) {
      const call = choice.message.tool_calls[0];
      const funcName = call.function.name;
      const funcArgs = JSON.parse(call.function.arguments);
      const toolResult = await callTool(funcName, funcArgs, token);

      messages.push(choice.message);
      messages.push({ role: "tool", tool_call_id: call.id, content: toolResult });

      data = await deepseekChat(messages, false);
      choice = data.choices?.[0];
    }

    if (!choice?.message?.tool_calls) {
      const printMatch = message.match(/(?:اطبع|طباعة)\s*(?:كشف\s*(?:حساب)?\s*)?(?:عميل\s*)?(.+)/i);
      if (printMatch) {
        const customerName = printMatch[1].replace(/^(كشف|حساب|عميل)\s*/i, "").trim();
        const toolResult = await callTool("print_statement", { customerName }, token);
        return NextResponse.json({ success: true, reply: toolResult, role: payload.role });
      }
    }

    const reply = choice?.message?.content || "عذراً، لم أستطع فهم طلبك.";
    return NextResponse.json({ success: true, reply, role: payload.role });

  } catch (error) {
    console.error("POST /api/ai/chat error:", error);
    return NextResponse.json({ success: false, error: error.message || "خطأ في الاتصال" }, { status: 500 });
  }
}