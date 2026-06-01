import { NextResponse } from "next/server";
import { sheets, docs, drive, calendar } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// GET bookings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD

    // Fetch all values from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A2:K", // Skip headers
    });

    const rows = response.data.values || [];
    
    // Map rows to objects
    const bookings = rows.map((row) => ({
      bookingId: row[0],
      customerName: row[1],
      customerPhone: row[2],
      startDate: row[3],
      endDate: row[4],
      totalAmount: parseFloat(row[5] || 0),
      paidAmount: parseFloat(row[6] || 0),
      remainingAmount: parseFloat(row[7] || 0),
      status: row[8],
      contractLink: row[9] || "",
      timestamp: row[10] || "",
    }));

    // Filter by date if provided
    if (dateParam) {
      const filtered = bookings.filter((b) => {
        // A booking matches a date if the date is between startDate and endDate inclusive
        const start = new Date(b.startDate);
        const end = new Date(b.endDate);
        const target = new Date(dateParam);
        // Normalize to midnight for comparison
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        target.setHours(0,0,0,0);
        return target >= start && target <= end;
      });
      return NextResponse.json({ success: true, bookings: filtered });
    }

    return NextResponse.json({ success: true, bookings });
  } catch (error) {
    console.error("API GET Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

const TEMPLATE_ID = process.env.GOOGLE_DOC_TEMPLATE_ID;
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// POST create booking
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      startDate,
      endDate,
      totalAmount = 0,
      paidAmount = 0,
      status = "مؤكد",
    } = body;

    if (!customerName || !customerPhone || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "جميع الحقول الأساسية مطلوبة" },
        { status: 400 }
      );
    }

    const total = parseFloat(totalAmount);
    const paid = parseFloat(paidAmount);
    const remaining = total - paid;
    const bookingId = `HL-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    let warningMessage = null;
    let contractLink = "";

    try {
      if (TEMPLATE_ID && FOLDER_ID) {
        // 1. Read the template document content
        const templateDoc = await docs.documents.get({ documentId: TEMPLATE_ID });
        
        // 2. Create document directly in user's shared folder via Drive API
        //    (Docs.create fails with permission error, but Drive.files.create works
        //     when creating inside a shared folder the SA has access to)
        const createResponse = await drive.files.create({
          requestBody: {
            name: `عقد إيجار - ${customerName} - ${bookingId}`,
            mimeType: "application/vnd.google-apps.document",
            parents: [FOLDER_ID],
          },
          fields: "id",
        });
        const newDocId = createResponse.data.id;

        // 3. Copy the template text content into the new document
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

        // 4. Replace placeholders
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

        // 5. Make it publicly readable
        await drive.permissions.create({
          fileId: newDocId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

        contractLink = `https://docs.google.com/document/d/${newDocId}/edit`;
      }
    } catch (docError) {
      console.error("Failed to generate contract:", docError);
      warningMessage = "تم حفظ الحجز بنجاح، لكن تعذر إنشاء ملف العقد.";
    }

    try {
      if (CALENDAR_ID) {
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);
        // Google Calendar full-day events are exclusive of the end date, so add 1 day
        endDateTime.setDate(endDateTime.getDate() + 1);

        await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: {
            summary: `حجز خيمة - ${customerName}`,
            description: `رقم الحجز: ${bookingId}\nرقم الجوال: ${customerPhone}\nالمبلغ الإجمالي: ${total}\nالمتبقي: ${remaining}`,
            start: {
              date: startDateTime.toISOString().split("T")[0],
              timeZone: "Asia/Riyadh",
            },
            end: {
              date: endDateTime.toISOString().split("T")[0],
              timeZone: "Asia/Riyadh",
            },
          },
        });
      }
    } catch (calError) {
      console.error("Failed to add to calendar:", calError);
      warningMessage = (warningMessage ? warningMessage + " " : "") + "تعذر إضافة الحجز إلى تقويم جوجل.";
    }

    const newRow = [
      bookingId,
      customerName,
      customerPhone,
      startDate,
      endDate,
      total.toString(),
      paid.toString(),
      remaining.toString(),
      status,
      contractLink,
      timestamp,
    ];

    // Append to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Bookings!A:K",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({
      success: true,
      warning: warningMessage,
      booking: {
        bookingId,
        customerName,
        customerPhone,
        startDate,
        endDate,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: remaining,
        status,
        contractLink,
        timestamp,
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
