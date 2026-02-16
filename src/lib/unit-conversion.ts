import convert, { getMeasureKind } from 'convert';

/**
 * Maps app singular unit names to `convert` library unit strings.
 * Only volume and weight families are mapped — countable/container units are excluded.
 */
const UNIT_MAP: Record<string, string> = {
  // Volume
  teaspoon: 'teaspoons',
  tablespoon: 'tablespoons',
  'fluid ounce': 'fl oz',
  cup: 'cups',
  pint: 'pints',
  quart: 'quarts',
  gallon: 'gallons',
  milliliter: 'milliliters',
  liter: 'liters',
  // Weight/Mass
  gram: 'grams',
  kilogram: 'kilograms',
  ounce: 'ounces',
  pound: 'pounds',
};

/**
 * Reverse map: convert library unit → app unit name.
 * Built from UNIT_MAP + common best-unit outputs from the convert library.
 */
const REVERSE_UNIT_MAP: Record<string, string> = {};
for (const [appUnit, convertUnit] of Object.entries(UNIT_MAP)) {
  REVERSE_UNIT_MAP[convertUnit] = appUnit;
}
// Add abbreviations/singular forms the convert library's "best" might return
const BEST_UNIT_ALIASES: Record<string, string> = {
  tsp: 'teaspoon',
  tbsp: 'tablespoon',
  'fl oz': 'fluid ounce',
  c: 'cup',
  pt: 'pint',
  qt: 'quart',
  gal: 'gallon',
  ml: 'milliliter',
  mL: 'milliliter',
  l: 'liter',
  L: 'liter',
  g: 'gram',
  kg: 'kilogram',
  oz: 'ounce',
  lb: 'pound',
  lbs: 'pound',
  // Singular forms that best might return
  teaspoon: 'teaspoon',
  tablespoon: 'tablespoon',
  'fluid ounce': 'fluid ounce',
  cup: 'cup',
  pint: 'pint',
  quart: 'quart',
  gallon: 'gallon',
  milliliter: 'milliliter',
  liter: 'liter',
  gram: 'gram',
  kilogram: 'kilogram',
  ounce: 'ounce',
  pound: 'pound',
};

/**
 * Maps an app unit name to a `convert` library unit identifier.
 * Returns `null` for non-convertible units (countable, container, unknown).
 */
export function toConvertUnit(appUnit: string): string | null {
  return UNIT_MAP[appUnit] ?? null;
}

/**
 * Checks whether two app units belong to the same measurement family
 * (both volume or both weight).
 */
export function areSameFamily(unitA: string, unitB: string): boolean {
  const convertA = toConvertUnit(unitA);
  const convertB = toConvertUnit(unitB);

  if (!convertA || !convertB) return false;

  try {
    const kindA = getMeasureKind(convertA as any);
    const kindB = getMeasureKind(convertB as any);
    return kindA !== undefined && kindB !== undefined && kindA === kindB;
  } catch {
    return false;
  }
}

/**
 * Converts a quantity from one app unit to another.
 * Returns `null` if the units are not in the same family or not convertible.
 */
export function tryConvert(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const convertFrom = toConvertUnit(fromUnit);
  const convertTo = toConvertUnit(toUnit);

  if (!convertFrom || !convertTo) return null;

  try {
    return convert(quantity, convertFrom as any).to(convertTo as any);
  } catch {
    return null;
  }
}

/**
 * Converts a given quantity+unit to the best human-readable app unit in the same family.
 * Uses the convert library's "best" with imperial preference for volume/weight.
 * Falls back to the original unit for non-convertible or unknown units.
 */
export function pickBestUnit(
  quantity: number,
  unit: string
): { quantity: number; unit: string } {
  const convertUnit = toConvertUnit(unit);

  if (!convertUnit) {
    return { quantity, unit };
  }

  if (quantity === 0) {
    return { quantity: 0, unit };
  }

  try {
    const best = convert(quantity, convertUnit as any).to('best', 'imperial');
    const bestUnitStr = String(best.unit);

    // Map the convert library's best unit back to an app unit name
    const appUnit =
      REVERSE_UNIT_MAP[bestUnitStr] ??
      BEST_UNIT_ALIASES[bestUnitStr] ??
      null;

    if (appUnit) {
      return { quantity: best.quantity, unit: appUnit };
    }

    // If we can't map back, fall back to the original unit
    return { quantity, unit };
  } catch {
    return { quantity, unit };
  }
}
