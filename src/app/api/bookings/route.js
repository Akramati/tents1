import { NextResponse } from "next/server";
import { sheets, docs, drive, calendar } from "@/lib/google";
import { getIncomeAccountForBooking, addFinanceEntry, getFinanceLedger, updateFinanceEntry, deleteFinanceEntry, appendRow } from "@/lib/sheets";
import { requireAuth } from "@/lib/auth";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const TEMPLATE_ID = process.env.GOOGLE_DOC_TEMPLATE_ID;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// GET /api/bookings?page=1&limit=10&search=محمد&date=2026-06-06
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const dateParam = searchParams.get("date") || "";
    const showCancelled = searchParams.get("showCancelled") === "true";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A2:AF",
    });
    const rows = response.data.values || [];

    // Auto-expire bookings whose end date has passed
    const todayStr = new Date().toLocaleDateString("en-CA");
    const toExpire = [];
    for (let i = 0; i < rows.length; i++) {
      const status = rows[i][8] || "";
      const endDate = rows[i][4] || "";
      if (status === "مؤكد" && endDate && endDate < todayStr) {
        toExpire.push(i + 2); // +2 because sheet starts at row 2
      }
    }
    if (toExpire.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: toExpire.map(rowNum => ({ range: `Bookings!I${rowNum}`, values: [["منتهي"]] })),
        },
      });
      // Update in-memory rows too
      toExpire.forEach(rowNum => { rows[rowNum - 2][8] = "منتهي"; });
    }

    // Filter out rows without a bookingId (empty/partial rows)
    const validRows = rows.filter(r => r[0] && r[0].trim());

    let bookings = validRows.map((row) => ({
      bookingId: row[0],
      customerName: row[1] || "",
      customerPhone: row[2] || "",
      startDate: row[3] || "",
      endDate: row[4] || "",
      totalAmount: parseFloat(row[5] || 0),
      paidAmount: parseFloat(row[6] || 0),
      remainingAmount: parseFloat(row[7] || 0),
      status: row[8] || "",
      contractLink: row[9] || "",
      timestamp: row[10] || "",
      bookingType: row[11] || "",
      packageUsed: row[12] || "",
      notes: row[13] || "",
      fieldStatus: row[14] || "",
      eventType: row[15] || "",
      shift: row[16] || "",
      tentLength: row[17] || "",
      tentWidth: row[18] || "",
      tentCount: row[19] || "1",
      pricingType: row[20] || "",
      depositType: row[21] || "",
      guarantorName: row[22] || "",
      guarantorPhone: row[23] || "",
      guarantorId: row[24] || "",
      transResponsibility: row[25] || "",
      transCost: parseFloat(row[26] || 0),
      customFields: row[27] ? JSON.parse(row[27]) : {},
      customerIdNumber: row[28] || "",
      customerIdPhoto: row[29] || "",
      customerAddress: row[30] || "",
      guarantorIdPhoto: row[31] || "",
    }));

    if (dateParam) {
      bookings = bookings.filter((b) => {
        if (!b.startDate || !b.endDate) return false;
        const start = new Date(b.startDate);
        const end = new Date(b.endDate);
        const target = new Date(dateParam);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        return target >= start && target <= end;
      });
    }

    if (search) {
      const term = search.toLowerCase();
      bookings = bookings.filter((b) =>
        b.customerName.toLowerCase().includes(term) ||
        b.customerPhone.includes(term) ||
        b.bookingId.toLowerCase().includes(term)
      );
    }

    if (!showCancelled) {
      bookings = bookings.filter((b) => b.status !== "ملغي");
    }

    const totalCount = bookings.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedBookings = bookings.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      bookings: paginatedBookings,
      pagination: { totalCount, totalPages, currentPage: page, limit },
    });
  } catch (error) {
    console.error("API GET Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST create booking
export async function POST(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      startDate,
      endDate,
      totalAmount = 0,
      paidAmount = 0,
      status = "مؤكد",
      bookingType = "",
      packageUsed = "",
      notes = "",
      rentedItems = [],
      eventType = "",
      shift = "",
      tentLength = "",
      tentWidth = "",
      tentCount = "1",
      pricingType = "",
      depositType = "",
      guarantorName = "",
      guarantorPhone = "",
      guarantorId = "",
      transResponsibility = "",
      transCost = 0,
      customFields = {},
      customerIdNumber = "",
      customerIdPhoto = "",
      customerAddress = "",
      guarantorIdPhoto = "",
      costCenter = "",
      costCenterType = "",
      transportType = "",
    } = body;

    if (!customerName || !customerPhone || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "جميع الحقول الأساسية مطلوبة" },
        { status: 400 }
      );
    }

    // Hall booking validation: eventType and shift required
    if ((bookingType.includes("صالة") || bookingType.includes("حوش")) && (!eventType || !shift)) {
      return NextResponse.json(
        { success: false, error: "نوع المناسبة والفترة مطلوبان" },
        { status: 400 }
      );
    }

    // Prevent double booking of hall-type on same day/shift (same type only)
    if (bookingType.includes("صالة") || bookingType.includes("حوش")) {
      const allBookRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Bookings!A:T",
      });
      const allRows = allBookRes.data.values || [];
      const requestingIsHall = bookingType.includes("صالة") && !bookingType.includes("حوش");
      const requestingIsCourtyard = bookingType.includes("حوش");
      const hallConflict = allRows.some((r) => {
        const bType = (r[11] || "").trim();
        const bStatus = (r[8] || "").trim();
        const fStatus = (r[14] || "").trim();
        if (!bType.includes("صالة") && !bType.includes("حوش")) return false;
        if (bStatus === "مكتمل" || bStatus === "ملغي") return false;
        if (fStatus === "completed" || fStatus === "cancelled" || fStatus === "archived") return false;
        const existingIsHall = bType.includes("صالة") && !bType.includes("حوش");
        const existingIsCourtyard = bType.includes("حوش");
        // Different types (hall vs courtyard) → independent, no conflict
        if ((requestingIsHall && existingIsCourtyard) || (requestingIsCourtyard && existingIsHall)) return false;
        const bStart = new Date(r[3]);
        const bEnd = new Date(r[4]);
        const reqStart = new Date(startDate);
        const reqEnd = new Date(endDate);
        bStart.setHours(0,0,0,0); bEnd.setHours(0,0,0,0);
        reqStart.setHours(0,0,0,0); reqEnd.setHours(0,0,0,0);
        if (!(reqStart <= bEnd && reqEnd >= bStart)) return false;
        // Same type — check shift
        const existingShift = (r[16] || "").trim();
        if (shift === "يوم كامل" || existingShift === "يوم كامل") return true;
        if (shift && existingShift && shift === existingShift) return true;
        return false; // different shifts → allowed
      });
      if (hallConflict) {
        return NextResponse.json(
          { success: false, error: "التاريخ أو الفترة محجوزة مسبقاً — لا يمكن تكرار الحجز" },
          { status: 409 }
        );
      }
    }

    const effectiveEnd = startDate > endDate ? startDate : endDate;

    const total = parseFloat(totalAmount);
    const paid = parseFloat(paidAmount);
    const remaining = total - paid;
    const finalStatus = paid > 0 ? status : "قيد الانتظار";
    const bookingId = `HL-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    let warningMessage = null;
    let contractLink = "";

    try {
      if (TEMPLATE_ID && FOLDER_ID) {
        const templateDoc = await docs.documents.get({ documentId: TEMPLATE_ID });
        const createResponse = await drive.files.create({
          requestBody: {
            name: `عقد إيجار - ${customerName} - ${bookingId}`,
            mimeType: "application/vnd.google-apps.document",
            parents: [FOLDER_ID],
          },
          fields: "id",
        });
        const newDocId = createResponse.data.id;

        const templateContent = templateDoc.data.body.content;
        const insertRequests = [];
        let insertIndex = 1;
        for (const element of templateContent) {
          if (element.paragraph) {
            const paragraphText = element.paragraph.elements
              .map((el) => el.textRun?.content || "")
              .join("");
            if (paragraphText) {
              insertRequests.push({
                insertText: {
                  location: { index: insertIndex },
                  text: paragraphText,
                },
              });
              insertIndex += paragraphText.length;
            }
          }
        }

        if (insertRequests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: newDocId,
            requestBody: { requests: insertRequests },
          });
        }

        const replaceRequests = [
          { replaceAllText: { containsText: { text: "{{CustomerName}}", matchCase: true }, replaceText: customerName } },
          { replaceAllText: { containsText: { text: "{{CustomerPhone}}", matchCase: true }, replaceText: customerPhone } },
          { replaceAllText: { containsText: { text: "{{StartDate}}", matchCase: true }, replaceText: startDate } },
          { replaceAllText: { containsText: { text: "{{EndDate}}", matchCase: true }, replaceText: endDate } },
          { replaceAllText: { containsText: { text: "{{TotalAmount}}", matchCase: true }, replaceText: total.toString() } },
          { replaceAllText: { containsText: { text: "{{PaidAmount}}", matchCase: true }, replaceText: paid.toString() } },
          { replaceAllText: { containsText: { text: "{{RemainingAmount}}", matchCase: true }, replaceText: remaining.toString() } },
        ];

        await docs.documents.batchUpdate({
          documentId: newDocId,
          requestBody: { requests: replaceRequests },
        });

        await drive.permissions.create({
          fileId: newDocId,
          requestBody: { role: "reader", type: "anyone" },
        });

        contractLink = `https://docs.google.com/document/d/${newDocId}/edit`;
      }
    } catch (docError) {
      console.error("Failed to generate contract:", docError);
      warningMessage = "تم حفظ الحجز بنجاح، لكن تعذر إنشاء ملف العقد.";
    }

    if (finalStatus === "مؤكد") {
      try {
        if (CALENDAR_ID) {
          const startDateTime = new Date(startDate);
          const endDateTime = new Date(effectiveEnd);
          endDateTime.setDate(endDateTime.getDate() + 1);

          const calDesc = `رقم الحجز: ${bookingId}\nرقم الجوال: ${customerPhone}\nالمبلغ الإجمالي: ${total}\nالمتبقي: ${remaining}\nنوع الحجز: ${bookingType}\nالباقة: ${packageUsed}\nعرض الخيمة: ${tentWidth}م\nطول الخيمة: ${tentLength}م\nعدد الخيام: ${tentCount}\nنوع الفعالية: ${eventType}\nالفترة: ${shift}\nنوع التسعير: ${pricingType}\nنوع الضمان: ${depositType}\nالضامن: ${guarantorName}\nجوال الضامن: ${guarantorPhone}\nهوية الضامن: ${guarantorId}\nتكاليف النقل: ${transResponsibility}\nمبلغ النقل: ${transCost}`;
          await calendar.events.insert({
            calendarId: CALENDAR_ID,
            requestBody: {
              summary: bookingType === "حجز الصالة" ? `حجز صالة - ${customerName}` : `حجز خيمة - ${customerName}`,
              description: calDesc,
              start: { date: startDateTime.toISOString().split("T")[0], timeZone: "Asia/Riyadh" },
              end: { date: endDateTime.toISOString().split("T")[0], timeZone: "Asia/Riyadh" },
              extendedProperties: {
                private: {
                  bookingId,
                  pricingType, depositType, guarantorName, guarantorPhone, guarantorId,
                  transResponsibility, transCost: transCost.toString(),
                },
              },
            },
          });
        }
      } catch (calError) {
        console.error("Failed to add to calendar:", calError);
        warningMessage = (warningMessage ? warningMessage + " " : "") + "تعذر إضافة الحجز إلى تقويم جوجل.";
      }
    }

    // Delete calendar event if booking is being cancelled
    if (finalStatus === "ملغي" && CALENDAR_ID) {
      try {
        const evRes = await calendar.events.list({
          calendarId: CALENDAR_ID,
          q: bookingId,
          maxResults: 10,
        });
        for (const ev of (evRes.data.items || [])) {
          if (ev.description && ev.description.includes(bookingId)) {
            await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: ev.id });
          }
        }
      } catch (calError) {
        console.error("Failed to delete calendar event on cancel:", calError);
      }
    }

    // Save rented items (always — needed for tracking even in pending bookings)
    if (rentedItems.length > 0) {
      try {
        const existingRent = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Rented_Items!A:A",
        });
        const rentRows = existingRent.data.values || [];
        let nextId = 1;
        for (const r of rentRows) {
          const n = parseInt(r[0]);
          if (n >= nextId) nextId = n + 1;
        }

        const rowsToInsert = rentedItems.map((ri) => [
          (nextId++).toString(),
          bookingId,
          ri.itemId,
          (ri.quantityRequested || 1).toString(),
          (ri.unitPrice || 0).toString(),
        ]);

        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Rented_Items!A:E",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: rowsToInsert },
        });
      } catch (rentError) {
        console.error("Failed to save rented items:", rentError);
        warningMessage = (warningMessage ? warningMessage + " " : "") + "تعذر حفظ الأصناف المستأجرة.";
      }
    }

    const newRow = [
      bookingId, customerName, customerPhone, startDate, endDate,
      total.toString(), paid.toString(), remaining.toString(), finalStatus,
      contractLink, timestamp, bookingType, packageUsed, notes,
      "", eventType, shift, tentLength, tentWidth, tentCount,
      pricingType, depositType, guarantorName, guarantorPhone,
      guarantorId, transResponsibility, transCost.toString(),
      JSON.stringify(customFields),
      customerIdNumber, customerIdPhoto, customerAddress, guarantorIdPhoto,
    ];

    await appendRow("Bookings", "A1:AF1", newRow);

    // Auto-create finance ledger entry for the payment (عربون — liability)
    if (paid > 0) {
      try {
        await addFinanceEntry({
          date: new Date().toLocaleDateString("en-CA"),
          accountCode: "2300",
          entryType: "liability",
          amount: paid,
          linkedBookingId: bookingId,
          notes: `عربون من ${customerName} - ${bookingType}${packageUsed ? ` (${packageUsed})` : ""}`,
          cashAccountCode: body.cashAccountCode || "",
          costCenter: costCenter || "",
          costCenterType: costCenterType || "",
          transportType: transportType || "",
        });
      } catch (finError) {
        console.error("Failed to create finance entry:", finError);
        warningMessage = (warningMessage ? warningMessage + " " : "") + "تعذر تسجيل العربون.";
      }
    }

    return NextResponse.json({
      success: true,
      warning: warningMessage,
      booking: {
        bookingId, customerName, customerPhone, startDate, endDate,
        totalAmount: total, paidAmount: paid, remainingAmount: remaining,
        finalStatus, contractLink, timestamp, bookingType, packageUsed,
        notes, eventType, shift, tentLength, tentWidth, tentCount,
        pricingType, depositType, guarantorName, guarantorPhone, guarantorId,
        transResponsibility, transCost,
        customerIdNumber, customerIdPhoto, customerAddress, guarantorIdPhoto,
      },
    });
  } catch (error) {
    console.error("API POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/bookings — تعديل حجز موجود
export async function PUT(request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body = await request.json();
    const {
      bookingId, customerName, customerPhone, startDate, endDate,
      totalAmount = 0, paidAmount = 0, status = "مؤكد",
      bookingType = "",       packageUsed = "", notes = "",
      eventType = "", shift = "", tentLength = "", tentWidth = "",
      tentCount = "1", rentedItems = [],
      pricingType = "", depositType = "",
      guarantorName = "", guarantorPhone = "", guarantorId = "",
      transResponsibility = "", transCost = 0,
      customFields = {},
      customerIdNumber = "", customerIdPhoto = "", customerAddress = "", guarantorIdPhoto = "",
      costCenter = "", costCenterType = "", transportType = "",
    } = body;

    if (!bookingId || !customerName || !customerPhone || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "جميع الحقول الأساسية مطلوبة" },
        { status: 400 }
      );
    }

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A:T",
    });
    const rows = existing.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === bookingId);

    // Hall booking validation: eventType and shift required
    if ((bookingType.includes("صالة") || bookingType.includes("حوش")) && (!eventType || !shift)) {
      return NextResponse.json(
        { success: false, error: "نوع المناسبة والفترة مطلوبان" },
        { status: 400 }
      );
    }

    // Prevent double booking of hall-type on same day/shift (exclude current booking)
    if (bookingType.includes("صالة") || bookingType.includes("حوش")) {
      const requestingIsHall = bookingType.includes("صالة") && !bookingType.includes("حوش");
      const requestingIsCourtyard = bookingType.includes("حوش");
      const hallConflict = rows.some((r) => {
        const bType = (r[11] || "").trim();
        const bStatus = (r[8] || "").trim();
        const fStatus = (r[14] || "").trim();
        if (r[0] === bookingId) return false;
        if (!bType.includes("صالة") && !bType.includes("حوش")) return false;
        if (bStatus === "مكتمل" || bStatus === "ملغي") return false;
        if (fStatus === "completed" || fStatus === "cancelled" || fStatus === "archived") return false;
        const existingIsHall = bType.includes("صالة") && !bType.includes("حوش");
        const existingIsCourtyard = bType.includes("حوش");
        if ((requestingIsHall && existingIsCourtyard) || (requestingIsCourtyard && existingIsHall)) return false;
        const bStart = new Date(r[3]);
        const bEnd = new Date(r[4]);
        const reqStart = new Date(startDate);
        const reqEnd = new Date(endDate);
        bStart.setHours(0,0,0,0); bEnd.setHours(0,0,0,0);
        reqStart.setHours(0,0,0,0); reqEnd.setHours(0,0,0,0);
        if (!(reqStart <= bEnd && reqEnd >= bStart)) return false;
        const existingShift = (r[16] || "").trim();
        if (shift === "يوم كامل" || existingShift === "يوم كامل") return true;
        if (shift && existingShift && shift === existingShift) return true;
        return false;
      });
      if (hallConflict) {
        return NextResponse.json(
          { success: false, error: "التاريخ أو الفترة محجوزة مسبقاً — لا يمكن تكرار الحجز" },
          { status: 409 }
        );
      }
    }
    if (rowIndex < 0) {
      return NextResponse.json(
        { success: false, error: "الحجز غير موجود" },
        { status: 404 }
      );
    }

    const sheetRow = rowIndex + 1;
    const total = parseFloat(totalAmount);
    const paid = parseFloat(paidAmount);
    const remaining = total - paid;
    const finalStatus = paid > 0 ? status : "قيد الانتظار";
    const existingStatus = rows[rowIndex][8] || "";
    if (existingStatus === "مؤكد" && finalStatus === "قيد الانتظار") {
      return NextResponse.json({
        success: false,
        error: "لا يمكن تغيير حجز مؤكد إلى قيد الانتظار. يمكنك إلغاء الحجز فقط.",
      }, { status: 400 });
    }
    const contractLink = rows[rowIndex][9] || "";
    const timestamp = rows[rowIndex][10] || "";
    const fieldStatus = rows[rowIndex][14] || "";

    const updatedRow = [
      bookingId, customerName, customerPhone, startDate, endDate,
      total.toString(), paid.toString(), remaining.toString(), finalStatus,
      contractLink, timestamp, bookingType, packageUsed, notes,
      fieldStatus, eventType, shift, tentLength, tentWidth, tentCount,
      pricingType, depositType, guarantorName, guarantorPhone,
      guarantorId, transResponsibility, transCost.toString(),
      JSON.stringify(customFields),
      customerIdNumber, customerIdPhoto, customerAddress, guarantorIdPhoto,
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Bookings!A${sheetRow}:AF${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [updatedRow] },
    });

    // Delete calendar event if booking is being cancelled
    if (finalStatus === "ملغي" && CALENDAR_ID) {
      try {
        const evRes = await calendar.events.list({
          calendarId: CALENDAR_ID,
          q: bookingId,
          maxResults: 10,
        });
        for (const ev of (evRes.data.items || [])) {
          if (ev.description && ev.description.includes(bookingId)) {
            await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: ev.id });
          }
        }
      } catch (calError) {
        console.error("Failed to delete calendar event on cancel:", calError);
      }
    }

    // Save rented items (always — even for pending bookings)
    if (rentedItems.length > 0) {
      const [sy,sm,sd]=startDate.split("-").map(Number);
      const [ey,em,ed]=endDate.split("-").map(Number);
      const start = new Date(sy, sm-1, sd);
      const end = new Date(ey, em-1, ed);
      const datesToCheck = [];
      function fmt(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToCheck.push(fmt(d));
      }

      // Check inventory availability only for confirmed bookings
      if (finalStatus === "مؤكد") {
        const invRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Inventory_Stock!A:D",
        });
        const invRows = invRes.data.values || [];
        const inventory = {};
        for (const ir of invRows) {
          if (ir[0]) inventory[ir[0]] = {
            itemName: ir[1] || "",
            totalQuantity: parseInt(ir[2] || 0),
            underMaintenance: parseInt(ir[3] || 0),
          };
        }

        const bookRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Bookings!A2:T",
        });
        const allBookings = (bookRes.data.values || []).filter((b) => b[0] !== bookingId);

        const rentRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Rented_Items!A:E",
        });
        const allRentRows = rentRes.data.values || [];

          for (const d of datesToCheck) {
            const activeOnDay = allBookings.filter((b) => {
              const s = b[3], e = b[4];
              if (!s || !e) return false;
              const mainSt = (b[8] || "").trim();
              if (mainSt === "مكتمل" || mainSt === "ملغي" || mainSt === "منتهي") return false;
              const fieldSt = (b[14] || "").trim();
              if (fieldSt === "cancelled" || fieldSt === "archived") return false;
              if (fieldSt === "completed") return false;
              const isHall = (b[11] || "").trim().includes("صالة");
              const bs = new Date(s), be = new Date(e), td = new Date(d);
              bs.setHours(0,0,0,0); be.setHours(0,0,0,0); td.setHours(0,0,0,0);
              return td >= bs && td <= be;
            });
          const activeIds = new Set(activeOnDay.map((b) => b[0]));
          const daySum = {};
          for (const r of allRentRows) {
            if (activeIds.has(r[1])) {
              daySum[r[2]] = (daySum[r[2]] || 0) + parseInt(r[3] || 0);
            }
          }
          for (const ri of rentedItems) {
            if (!ri.itemId) continue;
            const qtyNeeded = parseInt(ri.quantityRequested || ri.quantity || 1);
            const inv = inventory[ri.itemId];
            if (inv) {
              const available = inv.totalQuantity - inv.underMaintenance - (daySum[ri.itemId] || 0);
              if (available < qtyNeeded) {
                return NextResponse.json({
                  success: false,
                  error: `تعارض في المخزون: ${inv.itemName} — تحتاج ${qtyNeeded}، المتاح ${available} في تاريخ ${d}`,
                }, { status: 409 });
              }
            }
          }
        }
      }

      // Save/replace rented items (regardless of status)
      const rentRes2 = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Rented_Items!A:E",
      });
      const allRentRows2 = rentRes2.data.values || [];
      const keptRows = allRentRows2.filter((r, i) => i === 0 || r[1] !== bookingId);
      let maxId = 0;
      for (const r of keptRows) {
        const n = parseInt(r[0]);
        if (n > maxId) maxId = n;
      }
      const newRentRows = rentedItems.filter((ri) => ri.itemId).map((ri) => [
        (++maxId).toString(), bookingId, ri.itemId,
        (ri.quantityRequested || 1).toString(), (ri.unitPrice || 0).toString(),
      ]);
      await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "Rented_Items!A:E" });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Rented_Items!A:E",
        valueInputOption: "RAW",
        requestBody: { values: [...keptRows, ...newRentRows] },
      });
    }

    // Create calendar event for rebooked / updated confirmed bookings
    if (finalStatus === "مؤكد") {
      try {
        if (CALENDAR_ID) {
          const startDateTime = new Date(startDate);
          const endDateTime = new Date(startDate > endDate ? startDate : endDate);
          endDateTime.setDate(endDateTime.getDate() + 1);
          const calDesc = `رقم الحجز: ${bookingId}\nرقم الجوال: ${customerPhone}\nالمبلغ الإجمالي: ${total}\nالمتبقي: ${remaining}\nنوع الحجز: ${bookingType}\nالباقة: ${packageUsed}\nعرض الخيمة: ${tentWidth}م\nطول الخيمة: ${tentLength}م\nعدد الخيام: ${tentCount}\nنوع الفعالية: ${eventType}\nالفترة: ${shift}\nنوع التسعير: ${pricingType}\nنوع الضمان: ${depositType}\nالضامن: ${guarantorName}\nجوال الضامن: ${guarantorPhone}\nهوية الضامن: ${guarantorId}\nتكاليف النقل: ${transResponsibility}\nمبلغ النقل: ${transCost}`;
          await calendar.events.insert({
            calendarId: CALENDAR_ID,
            requestBody: {
              summary: bookingType === "حجز الصالة" ? `حجز صالة - ${customerName}` : `حجز خيمة - ${customerName}`,
              description: calDesc,
              start: { date: startDateTime.toISOString().split("T")[0], timeZone: "Asia/Riyadh" },
              end: { date: endDateTime.toISOString().split("T")[0], timeZone: "Asia/Riyadh" },
              extendedProperties: {
                private: {
                  bookingId,
                  pricingType, depositType, guarantorName, guarantorPhone, guarantorId,
                  transResponsibility, transCost: transCost.toString(),
                },
              },
            },
          });
        }
      } catch (calError) {
        console.error("Failed to create calendar event in PUT:", calError);
      }
    }

    // Sync finance ledger — difference‑based: only create new entry for additional payment
    try {
      const existingFinanceRows = await getFinanceLedger();
      const existingEntries = existingFinanceRows.filter((e) => e.linkedBookingId === bookingId && (e.entryType === "income" || e.entryType === "liability"));
      const sumExisting = existingEntries.reduce((s, e) => s + e.amount, 0);
      const diff = paid - sumExisting;

      if (diff > 0.01) {
        await addFinanceEntry({
          date: new Date().toLocaleDateString("en-CA"),
          accountCode: "2300",
          entryType: "liability",
          amount: diff,
          linkedBookingId: bookingId,
          notes: `قسط إضافي من ${customerName} - ${bookingType}${packageUsed ? ` (${packageUsed})` : ""}`,
          cashAccountCode: body.cashAccountCode || "",
          costCenter: costCenter || "",
          costCenterType: costCenterType || "",
          transportType: transportType || "",
        });
      }
      // If diff <= 0, do nothing — preserve existing payment records
    } catch (finError) {
      console.error("Failed to sync finance entry:", finError);
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث الحجز بنجاح",
      booking: {
        bookingId, customerName, customerPhone, startDate, endDate,
        totalAmount: total, paidAmount: paid, remainingAmount: remaining,
        finalStatus, contractLink, timestamp, bookingType, packageUsed,
        notes, eventType, shift, tentLength, tentWidth, tentCount,
        pricingType, depositType, guarantorName, guarantorPhone, guarantorId,
        transResponsibility, transCost,
      },
    });
  } catch (error) {
    console.error("API PUT Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}


