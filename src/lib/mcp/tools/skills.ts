import { z } from 'zod';
import { logError } from '@/lib/errors';
import { listSkills, getSkill } from '@/lib/mcp/skills/registry';
import { toolText, type ToolResult, type ToolServer } from '@/lib/mcp/tool-helpers';

// --- input shapes (zod raw shapes for registerTool inputSchema) ---

export const skillsListInput = {};

export const skillsGetInput = {
  name: z.string(),
};

// --- handlers ---
// No auth context needed: skill content is static, not user-scoped. The
// withMcpAuth gate already ensures only an authenticated agent reaches here.
// Each handler has its own try/catch (not runTool — skills_get must return raw
// markdown, not JSON) so a missing/unreadable SKILL.md degrades to a clean
// isError result instead of throwing into mcp-handler.

export async function skillsListHandler(): Promise<ToolResult> {
  try {
    return toolText(JSON.stringify(listSkills()));
  } catch (error) {
    logError('McpSkillsList', error);
    return toolText('Could not load skills right now. Please try again.', true);
  }
}

export async function skillsGetHandler(args: { name: string }): Promise<ToolResult> {
  try {
    const skill = getSkill(args.name);
    if (!skill) {
      // Bound the echoed name so we never reflect unbounded agent input.
      const shown = String(args.name).slice(0, 64);
      return toolText(`Unknown skill: "${shown}". Call skills_list to see available skills.`, true);
    }
    return toolText(skill.content);
  } catch (error) {
    logError('McpSkillsGet', error);
    return toolText('Could not load that skill right now. Please try again.', true);
  }
}

// --- registration ---

export function registerSkillTools(server: ToolServer): void {
  server.registerTool(
    'skills_list',
    {
      title: 'List available skills',
      description:
        "List the guided skills (multi-step workflows) this connector provides. Returns each skill's name and description. Call this first to discover skills, then skills_get to load one.",
      inputSchema: skillsListInput,
    },
    skillsListHandler as never
  );
  server.registerTool(
    'skills_get',
    {
      title: 'Get a skill',
      description:
        'Fetch the full step-by-step instructions for a skill by name (use a name from skills_list). Load and follow the returned instructions before starting that task.',
      inputSchema: skillsGetInput,
    },
    skillsGetHandler as never
  );
}
