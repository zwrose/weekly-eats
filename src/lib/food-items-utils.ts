// Food unit definitions with singular and plural forms
export interface FoodUnit {
  singular: string;
  plural: string;
  abbreviation?: string;
  abbreviationPlural?: string;
}

export const FOOD_UNITS: FoodUnit[] = [
  // Weighed Items
  { singular: 'gram', plural: 'grams', abbreviation: 'g', abbreviationPlural: 'gs' },
  { singular: 'kilogram', plural: 'kilograms', abbreviation: 'kg', abbreviationPlural: 'kgs' },
  { singular: 'ounce', plural: 'ounces', abbreviation: 'oz', abbreviationPlural: 'oz' },
  { singular: 'pound', plural: 'pounds', abbreviation: 'lb', abbreviationPlural: 'lbs' },

  // Measured Items
  { singular: 'cup', plural: 'cups', abbreviation: 'c', abbreviationPlural: 'c' },
  { singular: 'fluid ounce', plural: 'fluid ounces', abbreviation: 'fl oz', abbreviationPlural: 'fl oz' },
  { singular: 'gallon', plural: 'gallons', abbreviation: 'gal', abbreviationPlural: 'gals' },
  { singular: 'milliliter', plural: 'milliliters', abbreviation: 'ml', abbreviationPlural: 'mls' },
  { singular: 'liter', plural: 'liters', abbreviation: 'l', abbreviationPlural: 'l' },
  { singular: 'pint', plural: 'pints', abbreviation: 'pt', abbreviationPlural: 'pts' },
  { singular: 'quart', plural: 'quarts', abbreviation: 'qt', abbreviationPlural: 'qts' },
  { singular: 'tablespoon', plural: 'tablespoons', abbreviation: 'tbsp', abbreviationPlural: 'tbsp' },
  { singular: 'teaspoon', plural: 'teaspoons', abbreviation: 'tsp', abbreviationPlural: 'tsp' },

  // Countable Items
  { singular: 'each', plural: 'each', abbreviation: 'each', abbreviationPlural: 'each' },
  { singular: 'piece', plural: 'pieces', abbreviation: 'pc', abbreviationPlural: 'pcs' },
  { singular: 'slice', plural: 'slices', abbreviation: 'slice', abbreviationPlural: 'slices' },
  { singular: 'can', plural: 'cans', abbreviation: 'can', abbreviationPlural: 'cans' },
  { singular: 'jar', plural: 'jars', abbreviation: 'jar', abbreviationPlural: 'jars' },
  { singular: 'bag', plural: 'bags', abbreviation: 'bag', abbreviationPlural: 'bags' },
  { singular: 'bottle', plural: 'bottles', abbreviation: 'bottle', abbreviationPlural: 'bottles' },
  { singular: 'pack', plural: 'packs', abbreviation: 'pack', abbreviationPlural: 'packs' },
  { singular: 'package', plural: 'packages', abbreviation: 'pkg', abbreviationPlural: 'pkgs' },
  { singular: 'packet', plural: 'packets', abbreviation: 'pkt', abbreviationPlural: 'pkts' },
  { singular: 'bunch', plural: 'bunches', abbreviation: 'bunch', abbreviationPlural: 'bunches' },
  { singular: 'head', plural: 'heads', abbreviation: 'head', abbreviationPlural: 'heads' },
  { singular: 'ear', plural: 'ears', abbreviation: 'ear', abbreviationPlural: 'ears' },
  { singular: 'clove', plural: 'cloves', abbreviation: 'clove', abbreviationPlural: 'cloves' },
  { singular: 'stalk', plural: 'stalks', abbreviation: 'stalk', abbreviationPlural: 'stalks' },
  { singular: 'sprig', plural: 'sprigs', abbreviation: 'sprig', abbreviationPlural: 'sprigs' },
  { singular: 'pinch', plural: 'pinches', abbreviation: 'pinch', abbreviationPlural: 'pinches' },
  { singular: 'dash', plural: 'dashes', abbreviation: 'dash', abbreviationPlural: 'dashes' },
  { singular: 'drop', plural: 'drops', abbreviation: 'drop', abbreviationPlural: 'drops' },
  { singular: 'scoop', plural: 'scoops', abbreviation: 'scoop', abbreviationPlural: 'scoops' },
  { singular: 'dozen', plural: 'dozen', abbreviation: 'dozen', abbreviationPlural: 'dozen' },
  { singular: 'box', plural: 'boxes', abbreviation: 'box', abbreviationPlural: 'boxes' },
  { singular: 'loaf', plural: 'loaves', abbreviation: 'loaf', abbreviationPlural: 'loaves' },

  // Size modifiers
  { singular: 'large', plural: 'large', abbreviation: 'lg', abbreviationPlural: 'lg' },
  { singular: 'medium', plural: 'medium', abbreviation: 'med', abbreviationPlural: 'med' },
  { singular: 'small', plural: 'small', abbreviation: 'sm', abbreviationPlural: 'sm' },

  // Container types
  { singular: 'container', plural: 'containers', abbreviation: 'container', abbreviationPlural: 'containers' },
  { singular: 'pouch', plural: 'pouches', abbreviation: 'pouch', abbreviationPlural: 'pouches' },

  // Special combinations
  { singular: 'fluid ounce can', plural: 'fluid ounce cans', abbreviation: 'fl oz can', abbreviationPlural: 'fl oz cans' },
  { singular: 'fluid ounce container', plural: 'fluid ounce containers', abbreviation: 'fl oz container', abbreviationPlural: 'fl oz containers' },
  { singular: 'fluid ounce jar', plural: 'fluid ounce jars', abbreviation: 'fl oz jar', abbreviationPlural: 'fl oz jars' },
  { singular: 'fluid ounce pouch', plural: 'fluid ounce pouches', abbreviation: 'fl oz pouch', abbreviationPlural: 'fl oz pouches' },
  { singular: 'fluid ounce bottle', plural: 'fluid ounce bottles', abbreviation: 'fl oz bottle', abbreviationPlural: 'fl oz bottles' },
  { singular: 'pint container', plural: 'pint containers', abbreviation: 'pt container', abbreviationPlural: 'pt containers' },
  { singular: 'pound bag', plural: 'pound bags', abbreviation: 'lb bag', abbreviationPlural: 'lb bags' },
  { singular: 'pound can', plural: 'pound cans', abbreviation: 'lb can', abbreviationPlural: 'lb cans' },
  { singular: 'pound container', plural: 'pound containers', abbreviation: 'lb container', abbreviationPlural: 'lb containers' },
  { singular: 'ounce bag', plural: 'ounce bags', abbreviation: 'oz bag', abbreviationPlural: 'oz bags' },
  { singular: 'ounce can', plural: 'ounce cans', abbreviation: 'oz can', abbreviationPlural: 'oz cans' },
  { singular: 'ounce container', plural: 'ounce containers', abbreviation: 'oz container', abbreviationPlural: 'oz containers' },
  { singular: 'small ear', plural: 'small ears', abbreviation: 'sm ear', abbreviationPlural: 'sm ears' },
  { singular: 'small head', plural: 'small heads', abbreviation: 'sm head', abbreviationPlural: 'sm heads' },
  { singular: 'medium ear', plural: 'medium ears', abbreviation: 'med ear', abbreviationPlural: 'med ears' },
  { singular: 'medium head', plural: 'medium heads', abbreviation: 'med head', abbreviationPlural: 'med heads' },
  { singular: 'large ear', plural: 'large ears', abbreviation: 'lg ear', abbreviationPlural: 'lg ears' },
  { singular: 'large head', plural: 'large heads', abbreviation: 'lg head', abbreviationPlural: 'lg heads' }
];

// Get all valid unit singular forms
export const VALID_UNITS = FOOD_UNITS.map(unit => unit.singular);
export type ValidUnit = typeof VALID_UNITS[number];

// Helper function to validate and normalize a unit to its singular form
export const normalizeUnit = (unit: string): ValidUnit | null => {
  const foodUnit = FOOD_UNITS.find(u => 
    u.singular === unit || 
    u.plural === unit || 
    u.abbreviation === unit ||
    u.abbreviationPlural === unit
  );
  
  return foodUnit ? foodUnit.singular : null;
};

// Helper function to get the appropriate unit form
export const getUnitForm = (unit: string, quantity: number): string => {
  const foodUnit = FOOD_UNITS.find(u => 
    u.singular === unit || 
    u.plural === unit || 
    u.abbreviation === unit ||
    u.abbreviationPlural === unit
  );
  
  if (!foodUnit) {
    // If not found in our list, return the original unit
    return unit;
  }
  
  // Return singular for 1, plural for everything else
  return quantity === 1 ? foodUnit.singular : foodUnit.plural;
};

// Helper function to get unit abbreviation
export const getUnitAbbreviation = (unit: string): string | undefined => {
  const foodUnit = FOOD_UNITS.find(u => 
    u.singular === unit || 
    u.plural === unit || 
    u.abbreviation === unit ||
    u.abbreviationPlural === unit
  );
  
  return foodUnit?.abbreviation;
};

// Helper function to get unit abbreviation with proper pluralization
export const getUnitAbbreviationForm = (unit: string, quantity: number): string | undefined => {
  const foodUnit = FOOD_UNITS.find(u => 
    u.singular === unit || 
    u.plural === unit || 
    u.abbreviation === unit ||
    u.abbreviationPlural === unit
  );
  
  if (!foodUnit) {
    return undefined;
  }
  
  return quantity === 1 ? foodUnit.abbreviation : foodUnit.abbreviationPlural;
};

// Get all unit options for dropdowns/selects
export const getUnitOptions = (): { value: ValidUnit; label: string }[] => {
  return FOOD_UNITS.map(unit => ({
    value: unit.singular,
    label: unit.abbreviation && unit.abbreviation !== unit.singular 
      ? `${unit.singular} (${unit.abbreviation})`
      : unit.singular
  }));
};

// Fetch food items from the API
export const fetchFoodItems = async (query?: string): Promise<Array<{ _id: string; name: string; singularName: string; pluralName: string; unit: string }>> => {
  const params = new URLSearchParams();
  if (query) {
    params.append('query', query);
  }
  // Request a high limit to get all food items
  params.append('limit', '1000');
  
  const url = `/api/food-items${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch food items');
  }
  return response.json();
}; 