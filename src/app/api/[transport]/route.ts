import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerFoodItemTools } from '@/lib/mcp/tools/food-items';
import { registerRecipeTools } from '@/lib/mcp/tools/recipes';
import { registerSkillTools } from '@/lib/mcp/tools/skills';
import { verifyToken } from '@/lib/mcp/verify-token';

// Vercel function timeout (Fluid Compute). Raise if tool calls need longer.
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    // The SDK's McpServer.registerTool is generic over the zod input shape, so
    // it isn't structurally identical to our minimal ToolServer interface
    // (Task 11, Step 9). McpServer provides registerTool, so the cast is sound.
    registerFoodItemTools(server as never);
    registerRecipeTools(server as never);
    registerSkillTools(server as never);
  },
  {
    // Surfaced to clients on initialize. Tells the agent that beyond the data
    // tools, this connector ships guided skills it should discover (Phase 3).
    instructions:
      'Weekly Eats connector. Beyond the data tools, this server provides guided skills — multi-step workflows for common tasks. Call skills_list to discover them (for example, importing a recipe from a URL or PDF), then call skills_get with the skill name to load its step-by-step instructions before starting that task.',
  },
  { basePath: '/api' }
);

// Phase 2: OAuth-minted-token verifier (§6.4). required:true → unauthenticated
// calls get 401 + WWW-Authenticate carrying the RFC 9728 resource_metadata
// challenge (R4), pointing Claude at our Protected Resource Metadata.
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export {
  authHandler as GET,
  authHandler as POST,
  authHandler as DELETE,
  // OPTIONS (CORS preflight) goes through the un-authed base handler so the
  // browser preflight is not rejected by required:true.
  handler as OPTIONS,
};
