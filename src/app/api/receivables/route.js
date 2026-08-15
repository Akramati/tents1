import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function POST(request) {
  try {
    const body = await request.json();
    const { bookingId, amount } = body;

    if (!bookingId || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "رقم الحجز والمبلغ مطلوبان" }, { status: 400 });
    }

    // Validate the booking exists. The transfer keeps the remaining amount (H)
    // on the booking so the customer's debt ( ذمم مدينة ) stays visible in the
    // customers / receivables lists in financial ops. Revenue recognition for the
    // receivable amount happens on gerd completion, not here.
    const rows = await getSheetData("Bookings", "A:O");
    const idx = rows.findIndex((r) => r[0] === bookingId);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "الحجز غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ success: true, bookingId, transferredAmount: amount });
  } catch (err) {
    console.error("Error creating receivable entry:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
