import { z } from 'zod';
import type { PaginationParams } from '@/lib/pagination-utils';
import type { CreateRecipeRequest, UpdateRecipeRequest } from '@/types/recipe';
import { searchRecipes, getRecipe, createRecipe, updateRecipe } from '@/lib/services/recipes';
import { getAuthContext, runTool, type ToolExtra, type ToolResult } from '@/lib/mcp/tool-helpers';

const ingredientSchema = z.object({
  type: z.enum(['foodItem', 'recipe']),
  id: z.string(),
  quantity: z.number(),
  unit: z.string().optional(),
  prepInstructions: z.string().optional(),
});

const ingredientListSchema = z.object({
  title: z.string().optional(),
  ingredients: z.array(ingredientSchema),
  isStandalone: z.boolean().optional(),
});

export const recipesSearchInput = {
  query: z.string().optional(),
  accessLevel: z.enum(['private', 'shared-by-you', 'shared-by-others']).optional(),
  tags: z.array(z.string()).optional(),
  ratings: z.array(z.number().int()).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

export const recipesGetInput = {
  id: z.string(),
};

export const recipesCreateInput = {
  title: z.string(),
  emoji: z.string().optional(),
  instructions: z.string(),
  isGlobal: z.boolean().optional(),
  ingredients: z.array(ingredientListSchema),
};

export const recipesUpdateInput = {
  id: z.string(),
  title: z.string().optional(),
  emoji: z.string().optional(),
  instructions: z.string().optional(),
  isGlobal: z.boolean().optional(),
  ingredients: z.array(ingredientListSchema).optional(),
};

function toPagination(page?: number, limit?: number): PaginationParams {
  return { page: page ?? 1, limit: limit ?? 10, sortBy: 'updatedAt', sortOrder: -1 };
}

export async function recipesSearchHandler(
  args: {
    query?: string;
    accessLevel?: string;
    tags?: string[];
    ratings?: number[];
    page?: number;
    limit?: number;
  },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return searchRecipes(userId, {
      query: args.query,
      accessLevel: args.accessLevel,
      tags: args.tags,
      ratings: args.ratings,
      pagination: toPagination(args.page, args.limit),
    });
  });
}

export async function recipesGetHandler(
  args: { id: string },
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return getRecipe(userId, args.id);
  });
}

export async function recipesCreateHandler(
  args: CreateRecipeRequest,
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    return createRecipe(userId, args);
  });
}

export async function recipesUpdateHandler(
  args: { id: string } & UpdateRecipeRequest,
  extra: ToolExtra
): Promise<ToolResult> {
  return runTool(async () => {
    const { userId } = getAuthContext(extra);
    const { id, ...patch } = args;
    return updateRecipe(userId, id, patch);
  });
}

interface ToolServer {
  registerTool: (
    name: string,
    config: { title: string; description: string; inputSchema: Record<string, unknown> },
    handler: (args: never, extra: never) => Promise<ToolResult>
  ) => unknown;
}

export function registerRecipeTools(server: ToolServer): void {
  server.registerTool(
    'recipes_search',
    {
      title: 'Search recipes',
      description:
        "Search the user's recipes (their own plus shared/global recipes), optionally filtered by tags or ratings. Returns paginated results.",
      inputSchema: recipesSearchInput,
    },
    recipesSearchHandler as never
  );
  server.registerTool(
    'recipes_get',
    {
      title: 'Get a recipe',
      description: 'Fetch a single recipe by id with resolved ingredient names.',
      inputSchema: recipesGetInput,
    },
    recipesGetHandler as never
  );
  server.registerTool(
    'recipes_create',
    {
      title: 'Create a recipe',
      description:
        'Create a recipe. Each ingredient must reference a real food item (with a unit) or another recipe by id.',
      inputSchema: recipesCreateInput,
    },
    recipesCreateHandler as never
  );
  server.registerTool(
    'recipes_update',
    {
      title: 'Update a recipe',
      description: "Update one of the user's own recipes by id.",
      inputSchema: recipesUpdateInput,
    },
    recipesUpdateHandler as never
  );
}
