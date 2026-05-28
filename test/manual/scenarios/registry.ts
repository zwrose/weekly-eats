// test/manual/scenarios/registry.ts
import type { Block } from '../types.js';
import { block as userBaseline } from './user-baseline.js';
import { block as foodItems } from './food-items.js';
import { block as recipes } from './recipes.js';
import { block as mealPlanTemplate } from './meal-plan-template.js';
import { block as mealPlan } from './meal-plan.js';
import { block as pantry } from './pantry.js';
import { block as stores } from './stores.js';
import { block as shoppingList } from './shopping-list.js';
import { block as purchaseHistory } from './purchase-history.js';
import { block as pendingApprovalUser } from './pending-approval-user.js';

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
