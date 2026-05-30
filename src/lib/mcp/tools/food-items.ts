import { z } from 'zod';
import type { PaginationParams } from '@/lib/pagination-utils';
import { searchFoodItems, getFoodItem, createFoodItem } from '@/lib/services/food-items';
import { getAuthContext, runTool, type ToolExtra, type ToolResult } from '@/lib/mcp/tool-helpers';

// --- input shapes (zod raw shapes for registerTool inputSchema) ---

export const foodItemsSearchInput = {
  query: z.string().optional(),
  accessLevel: z.enum(['private', 'shared-by-you', 'shared-by-others']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

export const foodItemsGetInput = {
  id: z.string(),
};

// Note: no isGlobal — MCP-created food items are always personal (A1, §6.5).
export const foodItemsCreateInput = {
  name: z.string(),
  singularName: z.string(),
  pluralName: z.string(),
  unit: z.string(),
};

function toPagination(page?: number, limit?: number): PaginationParams {
  return {
    page: page ?? 1,
    limit: limit ?? 10,
    sortBy: 'name',
    sortOrder: 1,
  };
}

// --- handlers ---

export async function foodItemsSearchHandler(
  args: { query?: string; accessLevel?: string; page?: number; limit?: number },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return searchFoodItems(userId, {
      query: args.query,
      accessLevel: args.accessLevel,
      pagination: toPagination(args.page, args.limit),
    });
  });
}

export async function foodItemsGetHandler(
  args: { id: string },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId, isAdmin } = getAuthContext(extra);
    return getFoodItem(userId, { id: args.id, isAdmin });
  });
}

export async function foodItemsCreateHandler(
  args: { name: string; singularName: string; pluralName: string; unit: string },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    // Force personal ownership — agents may never create global items (I3/A1).
    return createFoodItem(userId, { ...args, isGlobal: false });
  });
}

// --- registration ---

interface ToolServer {
  registerTool: (
    name: string,
    config: { title: string; description: string; inputSchema: Record<string, unknown> },
    handler: (args: never, extra: never) => Promise<ToolResult>
  ) => unknown;
}

export function registerFoodItemTools(server: ToolServer): void {
  server.registerTool(
    'food_items_search',
    {
      title: 'Search food items',
      description:
        "Search the user's food-item catalog (their personal items plus shared/global items). Returns paginated results.",
      inputSchema: foodItemsSearchInput,
    },
    foodItemsSearchHandler as never
  );
  server.registerTool(
    'food_items_get',
    {
      title: 'Get a food item',
      description: 'Fetch a single food item by its id, if the user can see it.',
      inputSchema: foodItemsGetInput,
    },
    foodItemsGetHandler as never
  );
  server.registerTool(
    'food_items_create',
    {
      title: 'Create a food item',
      description:
        "Create a new personal food item in the user's catalog. Items created via the agent are always personal (never global).",
      inputSchema: foodItemsCreateInput,
    },
    foodItemsCreateHandler as never
  );
}
