// Package config calculation engine
// Scoring formula: qty = baseQty + tens * step10Qty + fives * step5Qty
// where tens = Math.floor((length - 10) / 10), fives = (extra % 10 >= 5 ? 1 : 0)

export function calculateQuantity(baseQty, step5Qty, step10Qty, length) {
  const len = parseFloat(length);
  if (!len || len <= 10) return baseQty;
  const extra = len - 10;
  const tens = Math.floor(extra / 10);
  const fives = (extra % 10) >= 5 ? 1 : 0;
  return baseQty + tens * step10Qty + fives * step5Qty;
}

// Calculate all items for a given width config and length
export function calculateItems(widthItems, length) {
  if (!widthItems || !Array.isArray(widthItems)) return [];
  return widthItems.map((item) => ({
    ...item,
    calculatedQuantity: calculateQuantity(item.baseQty, item.step5Qty, item.step10Qty, length),
  }));
}

// Transform flat rows from sheet into nested package structure
export function rowsToPackages(rows, inventoryMap) {
  const pkgMap = {};
  for (const row of rows) {
    const pkgId = row[0];
    const pkgName = row[1];
    const width = row[2];
    const itemId = row[3];
    const baseQty = parseFloat(row[4] || 0);
    const step5Qty = parseFloat(row[5] || 0);
    const step10Qty = parseFloat(row[6] || 0);

    if (!pkgMap[pkgId]) {
      pkgMap[pkgId] = { packageId: pkgId, packageName: pkgName, widths: {} };
    }
    if (!pkgMap[pkgId].widths[width]) {
      pkgMap[pkgId].widths[width] = [];
    }
    const inv = inventoryMap ? inventoryMap[itemId] : null;
    pkgMap[pkgId].widths[width].push({
      itemId,
      itemName: inv ? inv.itemName : (row[7] || `صنف #${itemId}`),
      baseQty,
      step5Qty,
      step10Qty,
    });
  }
  return Object.values(pkgMap).map(({ widths, ...rest }) => ({
    ...rest,
    widths: Object.fromEntries(
      Object.entries(widths).sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    ),
  }));
}

// Flatten package structure back to rows for sheet storage
export function packagesToRows(packages) {
  const rows = [];
  for (const pkg of packages) {
    for (const [width, items] of Object.entries(pkg.widths || {})) {
      for (const item of items) {
        rows.push([
          pkg.packageId?.toString() || "",
          pkg.packageName,
          width,
          item.itemId,
          (item.baseQty || 0).toString(),
          (item.step5Qty || 0).toString(),
          (item.step10Qty || 0).toString(),
          item.itemName || "",
        ]);
      }
    }
  }
  return rows;
}
