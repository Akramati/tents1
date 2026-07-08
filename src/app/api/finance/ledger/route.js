import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getFinanceLedger, addFinanceEntry, updateFinanceEntry, deleteFinanceEntry, getCumulativeCashBalances } from "@/lib/sheets";
import { getFinanceEntryByJournalId } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

function getTransferPairId(notes) {
  const m = (notes || "").match(/🔗تحويلة:(\d+)/);
  return m ? m[1] : null;
}

async function ensureSheet() {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A1",
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Finance_Ledger" } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["JournalID", "Date", "AccountCode", "EntryType", "Amount", "LinkedBookingID", "Notes", "CreatedAt", "CostCenter", "CostCenterType", "TransportType", "CashAccountCode", "Branch"]],
      },
    });
  }
}

export async function GET(request) {
  try {
    await ensureSheet();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const accountCode = searchParams.get("accountCode") || "";
    const limit = parseInt(searchParams.get("limit") || "0", 10);
    const [entries, cumulativeBalances] = await Promise.all([
      getFinanceLedger(from, to, accountCode, limit),
      getCumulativeCashBalances(),
    ]);
    return NextResponse.json({ success: true, entries, cumulativeBalances });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    await ensureSheet();
    const body = await request.json();
    const { date, accountCode, entryType, amount, linkedBookingId, notes, cashAccountCode, costCenter, costCenterType, transportType, branch } = body;
    if (!date || !accountCode || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "التاريخ وكود الحساب والمبلغ مطلوبون" }, { status: 400 });
    }
    // Validate income entries match booking type
    if ((entryType || "expense") === "income" && linkedBookingId) {
      const bookRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Bookings!K:L",
      });
      const bookRows = (bookRes.data.values || []).slice(1);
      const bookingRow = bookRows.find((r) => r[0] === linkedBookingId.toString());
      if (bookingRow) {
        const bookingType = bookingRow[1] || "";
        const typeRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A2:F",
        });
        const typeMatch = (typeRes.data.values || []).find((r) => r[0] === bookingType);
        const expectedAcct = typeMatch?.[4];
        if (expectedAcct && accountCode !== expectedAcct && !accountCode.startsWith(expectedAcct + "-") && !expectedAcct.startsWith(accountCode + "-")) {
          return NextResponse.json({ success: false, error: `نوع الحجز "${bookingType}" لا يتوافق مع الحساب المحدد` }, { status: 400 });
        }
      }
    }
    const amt = parseFloat(amount);
    const id = await addFinanceEntry({
      date, accountCode, entryType: entryType || "expense",
      amount: amt, linkedBookingId: linkedBookingId || "", notes: notes || "",
      cashAccountCode, costCenter, costCenterType, transportType, branch,
    });

    // If income entry linked to a booking, update the booking's paidAmount
    if ((entryType || "expense") === "income" && linkedBookingId) {
      try {
        const bookRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: "Bookings!A:O",
        });
        const bookRows = bookRes.data.values || [];
        const bookIdx = bookRows.findIndex((r) => r[0] === linkedBookingId.toString());
        if (bookIdx > 0) {
          const currentPaid = parseFloat(bookRows[bookIdx][6] || 0);
          const currentTotal = parseFloat(bookRows[bookIdx][5] || 0);
          const newPaid = currentPaid + amt;
          const newRemaining = Math.max(0, currentTotal - newPaid);
          const rowNum = bookIdx + 1;
          let newStatus = bookRows[bookIdx][8] || "";
          if (newRemaining <= 0 && newStatus !== "ملغي") {
            newStatus = "مدفوع";
          }
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Bookings!G${rowNum}:I${rowNum}`,
            valueInputOption: "RAW",
            requestBody: { values: [[newPaid.toString(), newRemaining.toString(), newStatus]] },
          });
        }
      } catch (bookErr) {
        console.error("Failed to update booking paidAmount:", bookErr);
      }
    }

    return NextResponse.json({ success: true, message: "تم تسجيل القيد", journalId: id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    await ensureSheet();
    const body = await request.json();
    const { journalId, date, accountCode, entryType, amount, linkedBookingId, notes, cashAccountCode, costCenter, costCenterType, transportType } = body;
    if (!journalId) {
      return NextResponse.json({ success: false, error: "رقم القيد مطلوب" }, { status: 400 });
    }
    const entry = await getFinanceEntryByJournalId(journalId);
    if (!entry) {
      return NextResponse.json({ success: false, error: "القيد غير موجود" }, { status: 404 });
    }
    await updateFinanceEntry(journalId, { date, accountCode, entryType, amount, linkedBookingId, notes, cashAccountCode, costCenter, costCenterType, transportType });
    // Cascade edit for transfer pairs (sync date, amount, notes; keep account/type/cashCode)
    const pairId = getTransferPairId(entry.notes);
    if (pairId) {
      const pairEntry = await getFinanceEntryByJournalId(pairId);
      if (pairEntry) {
        await updateFinanceEntry(pairId, { date: date || pairEntry.date, amount: amount ?? pairEntry.amount, notes: notes ? notes.replace(/🔗تحويلة:\d+/, `🔗تحويلة:${journalId}`) : pairEntry.notes });
      }
    }
    return NextResponse.json({ success: true, message: "تم تحديث القيد" + (pairId ? " والتحويلة المرتبطة" : "") });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    await ensureSheet();
    const { searchParams } = new URL(request.url);
    const journalId = searchParams.get("journalId");
    if (!journalId) {
      return NextResponse.json({ success: false, error: "رقم القيد مطلوب" }, { status: 400 });
    }
    const entry = await getFinanceEntryByJournalId(journalId);
    if (!entry) {
      return NextResponse.json({ success: false, error: "القيد غير موجود" }, { status: 404 });
    }
    // Cascade delete for transfer pairs
    const pairId = getTransferPairId(entry.notes);
    await deleteFinanceEntry(journalId);
    if (pairId) await deleteFinanceEntry(pairId);
    return NextResponse.json({ success: true, message: "تم حذف القيد" + (pairId ? " والتحويلة المرتبطة" : "") });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
