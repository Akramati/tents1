import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function POST(request) {
  try {
    const body = await request.json();
    const { startDate, endDate, excludeBookingId, typeName, shift } = body;
    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: "مطلوب تاريخ البداية والنهاية" }, { status: 400 });
    }

    const isCourtyard = (typeName || "").includes("حوش");

    function sameDayOverlap(aStart, aEnd, bStart, bEnd) {
      const s1 = new Date(aStart); s1.setHours(0, 0, 0, 0);
      const e1 = new Date(aEnd); e1.setHours(23, 59, 59, 0);
      const s2 = new Date(bStart); s2.setHours(0, 0, 0, 0);
      const e2 = new Date(bEnd); e2.setHours(23, 59, 59, 0);
      return s1 <= e2 && s2 <= e1;
    }

    const rows = await getSheetData("Bookings", "A2:AF");
    const conflicts = [];

    for (const r of rows) {
      const bType = (r[11] || "").trim();
      const bStatus = (r[8] || "").trim();
      const fStatus = (r[14] || "").trim();
      const bId = r[0] || "";

      if (!bType.includes("صالة") && !bType.includes("حوش")) continue;
      if (bStatus === "مكتمل" || bStatus === "ملغي") continue;
      if (fStatus === "completed" || fStatus === "cancelled" || fStatus === "archived") continue;
      if (excludeBookingId && bId === excludeBookingId) continue;

      const bStart = r[3] || "";
      const bEnd = r[4] || "";
      if (!bStart || !bEnd) continue;
      if (!sameDayOverlap(startDate, endDate, bStart, bEnd)) continue;

      // Date overlap exists — now check if it's a real conflict
      const existingIsHall = bType.includes("صالة") && !bType.includes("حوش");
      const existingIsCourtyard = bType.includes("حوش");

      // Different types → independent, no conflict
      if ((isCourtyard && existingIsHall) || (!isCourtyard && existingIsCourtyard)) continue;

      const existingShift = (r[16] || "").trim();

      let isConflict = false;
      if (shift === "يوم كامل" || existingShift === "يوم كامل") {
        isConflict = true;
      } else if (shift && existingShift && shift === existingShift) {
        isConflict = true;
      }
      // Different shifts → no conflict

      if (isConflict) {
        conflicts.push({
          bookingId: bId,
          customerName: r[1] || "",
          startDate: bStart,
          endDate: bEnd,
          shift: existingShift,
          eventType: (r[15] || "").trim(),
          typeName: bType,
        });
      }
    }

    return NextResponse.json({ success: true, conflict: conflicts.length > 0, bookings: conflicts });
  } catch (error) {
    console.error("POST /api/bookings/check-hall error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
