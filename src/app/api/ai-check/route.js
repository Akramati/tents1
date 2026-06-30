import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";
import { getSheetData, getBookingExpenses, getGeneralExpenses } from "@/lib/sheets";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// POST /api/ai-check — AI-powered booking validation
export async function POST(request) {
  try {
    const body = await request.json();
    const { customerName, startDate, endDate, rentedItems = [], totalAmount, bookingType, shift } = body;

    const warnings = [];
    const suggestions = [];

    const isHall = bookingType === "حجز الصالة";

    // --- 1. Inventory availability check (skip for hall bookings) ---
    if (!isHall && rentedItems.length > 0) {
      const invRows = await getSheetData("Inventory_Stock", "A2:D");
      const invMap = {};
      for (const row of invRows) {
        invMap[row[0]] = {
          name: row[1] || "",
          total: parseInt(row[2] || 0),
          maintenance: parseInt(row[3] || 0),
          available: parseInt(row[2] || 0) - parseInt(row[3] || 0),
        };
      }

      // Check rented items for same period
      const rentRows = await getSheetData("Rented_Items", "A2:E");
      const bookings = await getSheetData("Bookings", "A2:N");
      const activeBookingIds = new Set(
        bookings
          .filter((b) => {
            const sd = b[3] || "";
            const ed = b[4] || "";
            if (!sd) return false;
            // Skip completed/cancelled bookings
            const status = (b[8] || "").trim();
            if (status === "مكتمل" || status === "ملغي") return false;
            // Overlap check: (sD <= endDate && eD >= startDate)
            return sd <= endDate && (ed >= startDate || ed === "");
          })
          .map((b) => b[0])
      );

      // Sum rented quantities per item for overlapping bookings
      const rentedInPeriod = {};
      for (const row of rentRows) {
        const bkId = row[1];
        if (activeBookingIds.has(bkId)) {
          const itemId = row[2];
          const qty = parseInt(row[3] || 0);
          rentedInPeriod[itemId] = (rentedInPeriod[itemId] || 0) + qty;
        }
      }

      for (const ri of rentedItems) {
        const inv = invMap[ri.itemId];
        if (!inv) {
          warnings.push(`الصنف "${ri.itemName}" غير موجود في المخزون`);
          continue;
        }
        const alreadyRented = rentedInPeriod[ri.itemId] || 0;
        const realAvailable = inv.available - alreadyRented;
        if (realAvailable < (ri.quantityRequested || ri.quantity || 1)) {
          warnings.push(
            `⚠️ الكمية المطلوبة من "${inv.name}" (${ri.quantityRequested || ri.quantity || 1}) ` +
            `تتجاوز المتاح (${Math.max(0, realAvailable)}) في الفترة المحددة`
          );
        }
        // Suggest price based on item (rough estimate: 10% of total per item type)
        if (!totalAmount || totalAmount <= 0) {
          // Skip pricing suggestion if no total provided
        }
      }
    }

    // --- 2. Calendar conflict check ---
    try {
      const { google } = await import("@/lib/google");
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/calendar"],
      });
      const client = await auth.getClient();
      const calendar = google.calendar({ version: "v3", auth: client });
      const calId = process.env.GOOGLE_CALENDAR_ID;

      if (startDate) {
        const eventsRes = await calendar.events.list({
          calendarId: calId,
          timeMin: new Date(startDate).toISOString(),
          timeMax: endDate
            ? new Date(new Date(endDate).getTime() + 86400000).toISOString()
            : new Date(new Date(startDate).getTime() + 86400000).toISOString(),
          singleEvents: true,
        });
        const events = eventsRes.data.items || [];
        const conflicts = events.filter((e) => {
          // Don't conflict with own events (created by this system)
          return !e.summary?.startsWith("حجز:");
        });
        if (isHall && shift) {
          // For hall bookings, check shift-specific conflicts
          const shiftConflicts = conflicts.filter((e) => {
            const desc = e.description || "";
            return desc.includes(`الفترة: ${shift}`) || desc.includes(`Shift: ${shift}`);
          });
          if (shiftConflicts.length > 0) {
            warnings.push(
              `🕐 الصالة محجوزة في الفترة "${shift}" لهذا التاريخ — يوجد ${shiftConflicts.length} حجز/حجوزات متعارضة`
            );
          } else if (conflicts.length > 0) {
            suggestions.push(`✅ الفترة "${shift}" متاحة في هذا التاريخ`);
          } else {
            suggestions.push("✅ لا توجد تعارضات في التقويم لهذه الفترة");
          }
        } else {
          if (conflicts.length > 0) {
            warnings.push(
              `📅 يوجد ${conflicts.length} حدث/أحداث في التقويم خلال هذه الفترة: ` +
              conflicts.map((e) => `"${e.summary}"`).join(", ")
            );
          } else {
            suggestions.push("✅ لا توجد تعارضات في التقويم لهذه الفترة");
          }
        }
      }
    } catch (calError) {
      console.error("Calendar check error:", calError);
      // Non-fatal
    }

    // --- 3. Duration-based pricing suggestion ---
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const days = Math.max(1, Math.ceil((e - s) / 86400000));
      if (days > 7) {
        suggestions.push(
          `💡 الحجز لمدة ${days} يوم — يمكن اقتراح خصم للأيام الإضافية`
        );
      }
      if ((bookingType === "عادية" || !bookingType) && !totalAmount) {
        suggestions.push(
          `💡 الباقة العادية لـ ${days} يوم: يمكن تسعيرها بين ${days * 200} و ${days * 400} ريال`
        );
      }
    }

    // --- 4. Outstanding balance check for returning customers ---
    if (customerName) {
      const bookings = await getSheetData("Bookings", "A2:N");
      const prevBookings = bookings.filter(
        (b) => b[1] === customerName && parseFloat(b[7] || 0) > 0
      );
      if (prevBookings.length > 0) {
        const totalDue = prevBookings.reduce((s, b) => s + parseFloat(b[7] || 0), 0);
        if (totalDue > 0) {
          warnings.push(
            `⚠️ العميل "${customerName}" لديه مستحقات سابقة بقيمة ${totalDue} ريال من ${prevBookings.length} حجز/حجوزات`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      warnings,
      suggestions,
      safe: warnings.length === 0,
      warningCount: warnings.length,
      suggestionCount: suggestions.length,
    });
  } catch (error) {
    console.error("POST /api/ai-check error:", error);
    return NextResponse.json(
      { success: false, error: "فشل التحقق الذكي" },
      { status: 500 }
    );
  }
}
