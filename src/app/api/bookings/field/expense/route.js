import { NextResponse } from "next/server";
import { getFinanceLedger, addFinanceEntry } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const { bookingId, stage, accountCode, amount, description, date, costCenter, costCenterType, transportType, cashAccountCode } = body;

    if (!bookingId || !stage || !accountCode || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "رقم الحجز والمرحلة وكود الحساب والمبلغ مطلوبون" }, { status: 400 });
    }

    const validStages = ["preparation", "installation", "removal"];
    if (!validStages.includes(stage)) {
      return NextResponse.json({ success: false, error: "مرحلة غير صالحة" }, { status: 400 });
    }

    const entryDate = date || new Date().toLocaleDateString("en-CA");
    const amountNum = parseFloat(amount);
    const notes = `[${stage === "preparation" ? "تجهيز" : stage === "installation" ? "تركيب" : "فك"}] ${description || ""}`;

    // Dedup: check if identical entry already exists within last 5 seconds
    const existing = await getFinanceLedger();
    const dup = existing.find(
      (e) => e.linkedBookingId === bookingId
        && e.accountCode === accountCode
        && e.amount === amountNum
        && e.date === entryDate
        && e.notes === notes
    );
    if (dup) {
      return NextResponse.json({ success: true, message: "القيد موجود مسبقًا", journalId: dup.journalId, duplicated: true });
    }

    const journalId = await addFinanceEntry({
      date: entryDate,
      accountCode,
      entryType: "expense",
      amount: amountNum,
      linkedBookingId: bookingId,
      notes,
      costCenter,
      costCenterType,
      transportType,
      cashAccountCode,
    });

    return NextResponse.json({ success: true, message: "تم تسجيل المصروف", journalId });
  } catch (error) {
    console.error("POST /api/bookings/field/expense error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");

    const allEntries = await getFinanceLedger();
    const bookingEntries = allEntries.filter(
      (e) => e.linkedBookingId === bookingId && e.entryType === "expense"
    );

    const grouped = { preparation: [], installation: [], removal: [], damages: [] };
    for (const e of bookingEntries) {
      const stageMatch = e.notes?.match(/^\[(.+?)\]/);
      if (stageMatch) {
        const stageLabel = stageMatch[1];
        if (stageLabel === "تجهيز") grouped.preparation.push(e);
        else if (stageLabel === "تركيب") grouped.installation.push(e);
        else if (stageLabel === "فك") grouped.removal.push(e);
      } else if (e.accountCode?.startsWith("5104")) {
        grouped.damages.push(e);
      } else {
        grouped.removal.push(e);
      }
    }

    const totals = {};
    for (const [stage, entries] of Object.entries(grouped)) {
      totals[stage] = entries.reduce((s, e) => s + e.amount, 0);
    }

    return NextResponse.json({ success: true, grouped, totals, all: bookingEntries });
  } catch (error) {
    console.error("GET /api/bookings/field/expense error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
