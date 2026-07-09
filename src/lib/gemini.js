const TOOLS = [
  {
    name: "print_statement",
    description: "طباعة كشف حساب عميل على الطابعة عن بعد (Epson). يبحث عن الحجز باسم العميل أو رقم الحجز، يولد PDF ويرسله للطابعة.",
    parameters: {
      type: "OBJECT",
      properties: {
        customerName: { type: "STRING", description: "اسم العميل للبحث عنه" },
        bookingId: { type: "STRING", description: "رقم الحجز (اختياري إذا كان اسم العميل موجوداً)" },
      },
      required: [],
    },
  },
  {
    name: "add_payment",
    description: "تسجيل دفعة جديدة لعميل في دفتر الأستاذ. يبحث عن الحجز بالاسم أو الرقم ويسجل الدفعة.",
    parameters: {
      type: "OBJECT",
      properties: {
        customerName: { type: "STRING", description: "اسم العميل" },
        amount: { type: "NUMBER", description: "المبلغ المدفوع" },
        date: { type: "STRING", description: "تاريخ الدفع بصيغة YYYY-MM-DD (اختياري، الافتراضي اليوم)" },
        notes: { type: "STRING", description: "ملاحظات إضافية (اختياري)" },
        cashAccountCode: { type: "STRING", description: "رمز حساب الخزينة (اختياري، الافتراضي 1101)" },
      },
      required: ["customerName", "amount"],
    },
  },
  {
    name: "check_availability",
    description: "فحص إتاحة قاعة أو صالة أو خيمة في تاريخ معين. يبحث في جدول الحجوزات عن تعارضات.",
    parameters: {
      type: "OBJECT",
      properties: {
        date: { type: "STRING", description: "التاريخ المطلوب بصيغة YYYY-MM-DD" },
        bookingType: { type: "STRING", description: "نوع الحجز: 'حجوزات الصالة هابي لاند' أو 'حجوزات الخيام' أو أي نوع آخر (اختياري)" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_supplier_balance",
    description: "جلب معلومات ورصيد مورد معين بالاسم. يبحث في جدول الموردين.",
    parameters: {
      type: "OBJECT",
      properties: {
        supplierName: { type: "STRING", description: "اسم المورد للبحث عنه" },
      },
      required: ["supplierName"],
    },
  },
];

export async function callTool(name, args, token) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/ai-commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ command: name, ...args }),
  });
  const data = await r.json();
  return data.success ? data.message : data.error;
}

export default TOOLS;