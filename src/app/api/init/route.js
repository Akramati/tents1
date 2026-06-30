import { NextResponse } from "next/server";
import { sheets } from "@/lib/google";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const NEW_TABS = [
  {
    title: "Inventory_Stock",
    headers: ["ItemID", "ItemName", "TotalQuantity", "UnderMaintenance"],
  },
  {
    title: "Asset_Maintenance_Logs",
    headers: ["LogID", "ItemID", "StartDate", "EndDate", "Reason"],
  },
  {
    title: "Package_Config",
    headers: ["PackageID", "PackageName", "Width", "ItemID", "BaseQty", "Step5Qty", "Step10Qty", "ItemName"],
  },
  {
    title: "Rented_Items",
    headers: ["ID", "BookingID", "ItemID", "QuantityRequested", "UnitPrice"],
  },
  {
    title: "Booking_Types",
    headers: ["TypeName", "Behavior", "Icon", "IsActive", "AccountCode", "TypeCode"],
  },
  {
    title: "Type_Fields",
    headers: ["TypeName", "FieldKey", "FieldLabel", "FieldType", "Options", "Required", "IsActive"],
  },
  {
    title: "Expense_Categories",
    headers: ["Category", "SubCategory", "LinkedBookingType", "DetailName", "EntryType", "IsActive"],
  },
  {
    title: "Chart_Of_Accounts",
    headers: ["AccountCode", "AccountName", "AccountType", "ParentCode", "LinkedBookingType", "IsActive"],
  },
  {
    title: "Finance_Ledger",
    headers: ["JournalID", "Date", "AccountCode", "EntryType", "Amount", "LinkedBookingID", "Notes", "CreatedAt", "CostCenter", "CostCenterType", "TransportType", "CashAccountCode"],
  },
  {
    title: "Package_Flexible",
    headers: ["TypeName", "PackageName", "ItemID", "BaseQty", "DimDef", "WidthDef"],
  },
  {
    title: "Cost_Centers",
    headers: ["Code", "Name", "Type", "IsActive"],
  },
  {
    title: "System_Settings",
    headers: ["Key", "Value"],
  },
  {
    title: "Branches",
    headers: ["Code", "Name", "IsActive"],
  },
  {
    title: "Suppliers",
    headers: ["SupplierID", "SupplierName", "Phone", "Address", "Balance", "Notes", "IsActive"],
  },
  {
    title: "Supplier_Transactions",
    headers: ["TransID", "SupplierID", "Date", "Type", "Amount", "PurchaseID", "Notes"],
  },
  {
    title: "Supplier_Purchases",
    headers: ["PurchaseID", "SupplierID", "Date", "Description", "TotalAmount", "PaidAmount", "CostCenter", "Notes", "Status", "ImageURL"],
  },
];

const BOOKING_NEW_HEADERS = ["BookingType", "PackageUsed", "Notes"];
const BOOKING_FIELD_HEADER = ["FieldStatus"];
const BOOKING_EXTRA_HEADERS = ["EventType", "Shift", "TentLength", "TentWidth"];

export async function POST() {
  try {
    // 1. Get existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const existingTitles = spreadsheet.data.sheets.map(
      (s) => s.properties.title
    );

    const results = [];

    // 2. Add new tabs
    for (const tab of NEW_TABS) {
      if (existingTitles.includes(tab.title)) {
        results.push(`${tab.title}: موجود مسبقًا`);
        continue;
      }
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: tab.title },
              },
            },
          ],
        },
      });
      // Write header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab.title}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [tab.headers],
        },
      });
      results.push(`${tab.title}: تم الإنشاء`);

      // Seed initial data for Branches
      if (tab.title === "Branches") {
        const branchRows = [
          ["DHM", "ذمار", "TRUE"],
        ];
        const existingData = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Branches!A2:A",
        });
        if (!existingData.data.values || existingData.data.values.length === 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: "Branches!A2",
            valueInputOption: "RAW",
            requestBody: { values: branchRows },
          });
          results.push("Branches: تمت تعبئة البيانات الافتراضية (ذمار)");
        }
      }

      // Seed initial data for Booking_Types
      if (tab.title === "Booking_Types") {
        const typeRows = [
          ["حجز خيام وباقات", "packages", "⛺", "TRUE", "4001-02", "TENTS"],
          ["تأجير مفردات", "individual", "📦", "TRUE", "4001-02", "ITEMS"],
          ["حجز الصالة", "hall", "🏛️", "TRUE", "4001-01", "HALL"],
        ];
        const existingData = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Booking_Types!A2:A",
        });
        if (!existingData.data.values || existingData.data.values.length === 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: "Booking_Types!A2",
            valueInputOption: "RAW",
            requestBody: { values: typeRows },
          });
          results.push("Booking_Types: تمت تعبئة البيانات الافتراضية");
        }
      }
    }

    // 3. Expand Bookings tab with new columns (L, M, N, O)
    if (existingTitles.includes("Bookings")) {
      // Read existing header to check if columns already exist
      const headerRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Bookings!A1:O1",
      });
      const existingHeaders = headerRow.data.values?.[0] || [];

      const newCols = BOOKING_NEW_HEADERS.filter(
        (h) => !existingHeaders.includes(h)
      );
      if (newCols.length > 0) {
        const startCol = String.fromCharCode(65 + existingHeaders.length - newCols.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Bookings!${startCol}1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [newCols],
          },
        });
        results.push(`Bookings: أضيفت أعمدة ${newCols.join(", ")}`);
      }

      // Add FieldStatus column (O)
      if (!existingHeaders.includes("FieldStatus")) {
        const colO = existingHeaders.length >= 14 ? "O" : String.fromCharCode(65 + existingHeaders.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Bookings!${colO}1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [BOOKING_FIELD_HEADER],
          },
        });
        results.push("Bookings: تم إضافة عمود FieldStatus");
      } else {
        results.push("Bookings: FieldStatus موجود مسبقًا");
      }

      // Add EventType, Shift, TentLength, TentWidth columns (P, Q, R, S)
      const extraMissing = BOOKING_EXTRA_HEADERS.filter(
        (h) => !existingHeaders.includes(h)
      );
      if (extraMissing.length > 0) {
        const startCol = existingHeaders.length >= 16
          ? String.fromCharCode(65 + existingHeaders.length)
          : "P";
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Bookings!${startCol}1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [extraMissing],
          },
        });
        results.push(`Bookings: أضيفت أعمدة ${extraMissing.join(", ")}`);
      } else {
        results.push("Bookings: الأعمدة الإضافية موجودة مسبقًا");
      }
    }

    // 4. Ensure CustomFields column (AB) in Bookings
    if (existingTitles.includes("Bookings")) {
      const headerRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Bookings!A1:AF1",
      });
      const existingHeaders = headerRow.data.values?.[0] || [];

      const newStandardCols = [
        "CustomFields", "CustomerIdNumber", "CustomerIdPhoto",
        "CustomerAddress", "GuarantorIdPhoto",
      ];
      for (const col of newStandardCols) {
        if (!existingHeaders.includes(col)) {
          const colLetter = String.fromCharCode(64 + existingHeaders.length + 1);
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Bookings!${colLetter}1`,
            valueInputOption: "RAW",
            requestBody: { values: [[col]] },
          });
          existingHeaders.push(col);
          results.push(`Bookings: تم إضافة عمود ${col}`);
        }
      }
    }

    // Add AccountCode column to existing Booking_Types if missing
    if (existingTitles.includes("Booking_Types")) {
      const typeHeaderRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Booking_Types!A1:E1",
      });
      const typeHeaders = typeHeaderRow.data.values?.[0] || [];
      if (!typeHeaders.includes("AccountCode")) {
        const colLetter = String.fromCharCode(64 + typeHeaders.length + 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Booking_Types!${colLetter}1`,
          valueInputOption: "RAW",
          requestBody: { values: [["AccountCode"]] },
        });
        // Fill defaults for existing types
        const existingTypes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: "Booking_Types!A2:B",
        });
        const existingRows = existingTypes.data.values || [];
        const fillValues = existingRows.map((r) => {
          const behavior = (r[1] || "").trim();
          if (behavior === "hall") return ["4001-01"];
          return ["4001-02"];
        });
        if (fillValues.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Booking_Types!${colLetter}2`,
            valueInputOption: "RAW",
            requestBody: { values: fillValues },
          });
        }
        results.push("Booking_Types: تم إضافة عمود AccountCode وتعيين القيم الافتراضية");
      } else {
        results.push("Booking_Types: AccountCode موجود مسبقًا");
      }
    }

    // Add WidthDef column to existing Package_Flexible if missing
    if (existingTitles.includes("Package_Flexible")) {
      const flexHeaderRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Package_Flexible!A1:F1",
      });
      const flexHeaders = flexHeaderRow.data.values?.[0] || [];
      if (!flexHeaders.includes("WidthDef")) {
        const colLetter = String.fromCharCode(64 + flexHeaders.length + 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Package_Flexible!${colLetter}1`,
          valueInputOption: "RAW",
          requestBody: { values: [["WidthDef"]] },
        });
        results.push("Package_Flexible: تم إضافة عمود WidthDef");
      } else {
        results.push("Package_Flexible: WidthDef موجود مسبقًا");
      }
    }

    // Migration: IsActive column for Type_Fields
    if (existingTitles.includes("Type_Fields")) {
      const tfHeaderRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Type_Fields!A1:G1",
      });
      const tfHeaders = tfHeaderRow.data.values?.[0] || [];
      if (!tfHeaders.includes("IsActive")) {
        const colLetter = String.fromCharCode(64 + tfHeaders.length + 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Type_Fields!${colLetter}1`,
          valueInputOption: "RAW", requestBody: { values: [["IsActive"]] },
        });
        results.push("Type_Fields: تم إضافة عمود IsActive");
      } else {
        results.push("Type_Fields: IsActive موجود مسبقًا");
      }
    }

    // 5. Seed example fields for default types
    if (existingTitles.includes("Type_Fields")) {
      const existingFields = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Type_Fields!A2:A",
      });
      if (!existingFields.data.values || existingFields.data.values.length === 0) {
        const fieldRows = [
          ["حجز خيام وباقات", "eventLocation", "موقع الفعالية", "text", "", "FALSE"],
          ["حجز خيام وباقات", "decoration", "ديكور", "select", "بسيط,متوسط,فاخر", "FALSE"],
          ["حجز خيام وباقات", "catering", "مشروبات وضيافة", "checkbox", "", "FALSE"],
          ["تأجير مفردات", "deliveryDate", "تاريخ التوصيل", "date", "", "TRUE"],
          ["تأجير مفردات", "pickupDate", "تاريخ الاستلام", "date", "", "TRUE"],
          ["حجز الصالة", "guestCount", "عدد الضيوف", "number", "", "TRUE"],
          ["حجز الصالة", "cateringType", "نوع التقديم", "select", "بوفيه مفتوح,طاولات,وجبات فردية", "FALSE"],
        ];
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: "Type_Fields!A2",
          valueInputOption: "RAW",
          requestBody: { values: fieldRows },
        });
        results.push("Type_Fields: تمت تعبئة الحقول الافتراضية");
      }
    }

    // Migration: TypeCode column for Booking_Types
    if (existingTitles.includes("Booking_Types")) {
      const btHeaderRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A1:F1",
      });
      const btHeaders = btHeaderRow.data.values?.[0] || [];
      if (!btHeaders.includes("TypeCode")) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!F1",
          valueInputOption: "RAW",
          requestBody: { values: [["TypeCode"]] },
        });
        const existingTypes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A2:B",
        });
        const etRows = existingTypes.data.values || [];
        const fillTC = etRows.map((r) => {
          const nm = (r[0] || "").trim();
          const bh = (r[1] || "").trim();
          if (bh === "hall" || nm.includes("صالة")) return ["HALL"];
          if (nm.includes("خيام") || nm.includes("باقات")) return ["TENTS"];
          if (nm.includes("مفردات")) return ["ITEMS"];
          if (nm.includes("كوش")) return ["KOSH"];
          return ["OTHER"];
        });
        if (fillTC.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!F2",
            valueInputOption: "RAW", requestBody: { values: fillTC },
          });
        }
        results.push("Booking_Types: تم إضافة عمود TypeCode");
      } else {
        results.push("Booking_Types: TypeCode موجود مسبقًا");
      }
    }

    // Migration: CostCenter column for Finance_Ledger
    if (existingTitles.includes("Finance_Ledger")) {
      const flHeaderRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A1:I1",
      });
      const flHeaders = flHeaderRow.data.values?.[0] || [];
      if (!flHeaders.includes("CostCenter")) {
        const colLetter = String.fromCharCode(64 + flHeaders.length + 1);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Finance_Ledger!${colLetter}1`,
          valueInputOption: "RAW", requestBody: { values: [["CostCenter"]] },
        });
        results.push("Finance_Ledger: تم إضافة عمود CostCenter");
      } else {
        results.push("Finance_Ledger: CostCenter موجود مسبقًا");
      }
    }

    // Migration: CostCenterType and TransportType columns for Finance_Ledger
    if (existingTitles.includes("Finance_Ledger")) {
      const flHeaderRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A1:K1",
      });
      const flHeaders = flHeaderRow.data.values?.[0] || [];
      if (!flHeaders.includes("CostCenterType")) {
        const existingCols = flHeaders.length;
        const newCols2 = ["CostCenterType", "TransportType"].filter((h) => !flHeaders.includes(h));
        for (let i = 0; i < newCols2.length; i++) {
          const colLetter = String.fromCharCode(65 + existingCols + i);
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID, range: `Finance_Ledger!${colLetter}1`,
            valueInputOption: "RAW", requestBody: { values: [[newCols2[i]]] },
          });
        }
        results.push(`Finance_Ledger: تم إضافة أعمدة ${newCols2.join(", ")}`);
      } else {
        results.push("Finance_Ledger: CostCenterType و TransportType موجودان مسبقًا");
      }
    }

    // Seed Cost_Centers with additional centers + hierarchical
    if (existingTitles.includes("Cost_Centers")) {
      const existingCC = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A2:A",
      });
      const existingCodes = new Set((existingCC.data.values || []).map((r) => r[0]));
      const seedCenters = [
        ["ADM-OFF", "المكتب الرئيسي", "administrative", "TRUE"],
        ["ADM-WRH", "المخزن", "administrative", "TRUE"],
        ["CC-DHM-OFFICE", "ذمار - مكتبي", "administrative", "TRUE"],
        ["VEH-02", "دينا رقم 2", "vehicle", "TRUE"],
      ];
      for (const row of seedCenters) {
        if (!existingCodes.has(row[0])) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:D",
            valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
            requestBody: { values: [row] },
          });
          results.push(`Cost_Centers: تم إضافة ${row[1]}`);
        }
      }
      // Auto-create hierarchical cost centers from branches × booking types
      try {
        const [branchesRes, typesRes] = await Promise.all([
          sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: "Branches!A:C",
          }),
          sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID, range: "Booking_Types!A2:F",
          }),
        ]);
        const branches = (branchesRes.data.values || []).slice(1).filter((r) => r[0] && r[2] !== "FALSE");
        const types = (typesRes.data.values || []).filter((r) => r[0] && r[3] !== "FALSE");
        const hierarchicalInsert = [];
        for (const branch of branches) {
          const bc = branch[0];
          const bn = branch[1] || "";
          for (const t of types) {
            const tc = t[5] || "OTHER";
            const tn = t[0] || "";
            const code = `CC-${bc}-${tc}`;
            if (!existingCodes.has(code)) {
              hierarchicalInsert.push([code, `${bn} - ${tn}`, "booking", "TRUE"]);
            }
          }
          const adminCode = `CC-${bc}-ADMIN`;
          if (!existingCodes.has(adminCode)) {
            hierarchicalInsert.push([adminCode, `${bn} - إداري`, "administrative", "TRUE"]);
          }
        }
        if (hierarchicalInsert.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: "Cost_Centers!A:D",
            valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
            requestBody: { values: hierarchicalInsert },
          });
          results.push(`Cost_Centers: تم إنشاء ${hierarchicalInsert.length} مركز تكلفة هرمي`);
        }
      } catch (seedErr) {
        console.error("Failed to seed hierarchical cost centers:", seedErr);
      }
    }

    // Seed System_Settings with default values
    if (existingTitles.includes("System_Settings")) {
      const existingSettings = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A2:A",
      });
      const existingKeys = new Set((existingSettings.data.values || []).map((r) => r[0]));
      const seedSettings = [
        ["DEFAULT_CASH_ACCOUNT", "1101"],
      ];
      for (const row of seedSettings) {
        if (!existingKeys.has(row[0])) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID, range: "System_Settings!A:B",
            valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
            requestBody: { values: [row] },
          });
          results.push(`System_Settings: تم إضافة ${row[0]}`);
        }
      }
    }

    // Migration: CashAccountCode column for Finance_Ledger
    if (existingTitles.includes("Finance_Ledger")) {
      const flHeaderRow = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Finance_Ledger!A1:L1",
      });
      const flHeaders = flHeaderRow.data.values?.[0] || [];
      if (!flHeaders.includes("CashAccountCode")) {
        const colLetter = String.fromCharCode(65 + flHeaders.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID, range: `Finance_Ledger!${colLetter}1`,
          valueInputOption: "RAW", requestBody: { values: [["CashAccountCode"]] },
        });
        results.push("Finance_Ledger: تم إضافة عمود CashAccountCode (L)");
      } else {
        results.push("Finance_Ledger: CashAccountCode موجود مسبقًا");
      }
    }

    // Migration: Fix account types for 2100, 2101, 2200
    if (existingTitles.includes("Chart_Of_Accounts")) {
      const acctRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: "Chart_Of_Accounts!A:G",
      });
      const acctRows = acctRes.data.values || [];
      const fixMap = { "2100": ["liability", ""], "2101": ["liability", "2100"], "2200": ["equity", ""] };
      for (const [code, [type, parent]] of Object.entries(fixMap)) {
        const idx = acctRows.findIndex((r, i) => i > 0 && r[0] === code);
        if (idx > 0) {
          const sheetRow = idx + 1;
          const current = acctRows[idx];
          // Update columns C (AccountType) and D (ParentCode) if different
          if (current[2] !== type || (current[3] || "") !== parent) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID, range: `Chart_Of_Accounts!C${sheetRow}:D${sheetRow}`,
              valueInputOption: "RAW", requestBody: { values: [[type, parent]] },
            });
            results.push(`Chart_Of_Accounts: تم تصحيح ${code} → ${type}`);
          }
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Init error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
