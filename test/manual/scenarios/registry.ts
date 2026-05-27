// test/manual/scenarios/registry.ts
import type { Block } from '../types.js';
import userBaseline from './user-baseline.js';
import foodItems from './food-items.js';
import recipes from './recipes.js';
import mealPlanTemplate from './meal-plan-template.js';
import mealPlan from './meal-plan.js';
import pantry from './pantry.js';
import stores from './stores.js';
import shoppingList from './shopping-list.js';
import purchaseHistory from './purchase-history.js';
import pendingApprovalUser from './pending-approval-user.js';

export const registry = new Map<string, Block>([
  [userBaseline.name, userBaseline],
  [foodItems.name, foodItems],
  [recipes.name, recipes],
  [mealPlanTemplate.name, mealPlanTemplate],
  [mealPlan.name, mealPlan],
  [pantry.name, pantry],
  [stores.name, stores],
  [shoppingList.name, shoppingList],
  [purchaseHistory.name, purchaseHistory],
  [pendingApprovalUser.name, pendingApprovalUser],
]);
