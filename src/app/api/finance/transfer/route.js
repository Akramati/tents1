import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { addFinanceEntry, updateFinanceEntry } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { fromAccount, toAccount, amount, date, notes } = body;

    if (!fromAccount || !toAccount || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "الحساب المصدر والحساب الهدف والمبلغ مطلوبون" }, { status: 400 });
    }
    if (fromAccount === toAccount) {
      return NextResponse.json({ success: false, error: "لا يمكن التحويل لنفس الحساب" }, { status: 400 });
    }

    const amt = parseFloat(amount);
    const transferDate = date || new Date().toLocaleDateString("en-CA");
    const transferNotes = notes || `تحويل من ${fromAccount} إلى ${toAccount}`;

    const id1 = await addFinanceEntry({
      date: transferDate,
      accountCode: "5007",
      entryType: "expense",
      amount: amt,
      linkedBookingId: "",
      notes: `تحويل إلى ${toAccount} - ${transferNotes}`,
      cashAccountCode: fromAccount,
    });

    const id2 = await addFinanceEntry({
      date: transferDate,
      accountCode: "5007",
      entryType: "income",
      amount: amt,
      linkedBookingId: "",
      notes: `تحويل من ${fromAccount} - ${transferNotes}`,
      cashAccountCode: toAccount,
    });

    // Update both entries' notes with pair reference
    await updateFinanceEntry(id1, { notes: `تحويل إلى ${toAccount} - ${transferNotes} | 🔗تحويلة:${id2}` });
    await updateFinanceEntry(id2, { notes: `تحويل من ${fromAccount} - ${transferNotes} | 🔗تحويلة:${id1}` });

    return NextResponse.json({
      success: true,
      message: "تم التحويل الداخلي",
      journalIds: [id1, id2],
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
