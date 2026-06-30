// Package auto-fill: generates baseline items based on tent type + size
// All quantities are editable by the user before saving

export const TENT_TYPES = ["عادية", "غداء", "ملكية"];
export const TENT_LENGTHS = ["8", "10", "12", "14", "16", "20"];
export const TENT_WIDTHS = ["6", "8", "10", "12"];

// Generate baseline items for a given tent type and size
export function generateBaselineItems(type, length, width) {
  if (!type || !length || !width) return [];
  const items = [];
  const len = parseInt(length);
  const wid = parseInt(width);

  // ── Common items (all tent types) ──
  items.push(
    { itemName: `بوابة`, quantity: 1 },
    { itemName: `خلفية`, quantity: 1 },
    { itemName: `سقوفات حديد`, quantity: Math.max(3, Math.ceil(len / 5) * 3) },
    { itemName: `طربال أرضية ${length}×${width}`, quantity: 1 },
    { itemName: `بوايك للجنبين`, quantity: Math.max(4, Math.ceil(len / 10) * 4) },
  );

  // ── Floor mats (عادية + ملكية only, NOT غداء) ──
  if (type === "عادية" || type === "ملكية") {
    const matLength = 2; // each floor mat is 2m
    const matCount = Math.max(1, Math.ceil(len / matLength));
    items.push({ itemName: `فراش أرضي 2 متر`, quantity: matCount });

    // Platform (منصة)
    items.push({ itemName: `منصة`, quantity: 1 });

    // Chairs: individual chairs = large mat area, double chairs = half middle
    // Large mats count (roughly 2 per mat length unit)
    const largeMatChairs = matCount * 4;
    const midMatChairs = Math.max(1, Math.ceil(matCount / 2)) * 2;
    items.push({ itemName: `كرسي فردي`, quantity: largeMatChairs });
    items.push({ itemName: `كرسي مزدوج`, quantity: midMatChairs });
  }

  // ── Royal-specific (ملكية) ──
  if (type === "ملكية") {
    const decorCount = Math.ceil(len / 5) * 3;
    const chiffonCount = Math.ceil(len / 5) * 2;
    items.push({ itemName: `ديكور`, quantity: decorCount });
    items.push({ itemName: `شيفون`, quantity: chiffonCount });
  }

  // ── Lunch-specific (غداء) ──
  if (type === "غداء") {
    // Tables and chairs for dining
    const tableCount = Math.max(2, Math.ceil(len / 2));
    const chairCount = tableCount * 4;
    items.push({ itemName: `طاولة طعام`, quantity: tableCount });
    items.push({ itemName: `كرسي طعام`, quantity: chairCount });
    items.push({ itemName: `مفرش طاولة`, quantity: tableCount });
  }

  return items;
}

// Resolve generated items against actual inventory by name
export function resolveItems(inventory, generatedItems) {
  return generatedItems.map((entry) => {
    const inv = inventory.find(
      (i) =>
        i.itemName?.trim().toLowerCase() === entry.itemName.trim().toLowerCase()
    );
    return {
      itemId: inv ? inv.itemId : "",
      itemName: entry.itemName,
      quantity: entry.quantity,
      resolved: !!inv,
    };
  });
}

// For backward compatibility with existing booking form
const PACKAGE_SIZE_CONFIG = {
  "خيمة الغداء": { sizes: {} },
  "الباقة الملكية": { sizes: {} },
  "الباقة العادية": { sizes: {} },
};

export default PACKAGE_SIZE_CONFIG;

export function resolvePackageItems(packageName, sizeLabel, inventory) {
  // Map old package names to types
  const typeMap = {
    "خيمة الغداء": "غداء",
    "الباقة الملكية": "ملكية",
    "الباقة العادية": "عادية",
  };
  const type = typeMap[packageName];
  if (!type) return [];
  const [len, wid] = sizeLabel.split("×");
  const generated = generateBaselineItems(type, len, wid);
  return resolveItems(inventory, generated);
}

export function getAvailableSizes(packageName) {
  const typeMap = {
    "خيمة الغداء": "غداء",
    "الباقة الملكية": "ملكية",
    "الباقة العادية": "عادية",
  };
  if (!typeMap[packageName]) return [];
  return TENT_LENGTHS.flatMap((l) => TENT_WIDTHS.map((w) => `${l}×${w}`));
}
