import { NextResponse } from "next/server";
import { addFinanceEntry, getCumulativeCashBalances } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { cashAccountCode, correctBalance, date, notes } = body;

    if (!cashAccountCode || correctBalance === undefined || correctBalance === null) {
      return NextResponse.json({ success: false, error: "كود الحساب والرصيد الصحيح مطلوبان" }, { status: 400 });
    }

    const balances = await getCumulativeCashBalances();
    const currentBalance = balances[cashAccountCode] || 0;
    const difference = parseFloat(correctBalance) - currentBalance;
    const diffAbs = Math.abs(difference);

    if (Math.abs(difference) < 0.01) {
      return NextResponse.json({ success: true, message: "الرصيد صحيح — لا يوجد فرق", noChange: true });
    }

    if (difference > 0) {
      // Need to add income to increase balance
      await addFinanceEntry({
        date: date || new Date().toLocaleDateString("en-CA"),
        accountCode: "4003",
        entryType: "income",
        amount: diffAbs,
        linkedBookingId: "",
        notes: notes || `تسوية رصيد افتتاحي — رصيد سابق ${currentBalance} الرصيد الجديد ${correctBalance}`,
        cashAccountCode,
      });
    } else {
      // Need to add expense to decrease balance
      await addFinanceEntry({
        date: date || new Date().toLocaleDateString("en-CA"),
        accountCode: "5100",
        entryType: "expense",
        amount: diffAbs,
        linkedBookingId: "",
        notes: notes || `تسوية رصيد افتتاحي — رصيد سابق ${currentBalance} الرصيد الجديد ${correctBalance}`,
        cashAccountCode,
      });
    }

    return NextResponse.json({
      success: true,
      message: `تم ضبط الرصيد: ${currentBalance} ← ${correctBalance} (${difference > 0 ? "+" : ""}${difference})`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
