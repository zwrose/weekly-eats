import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const listSkillsMock = vi.fn();
const getSkillMock = vi.fn();

vi.mock('@/lib/mcp/skills/registry', () => ({
  listSkills: (...a: unknown[]) => listSkillsMock(...a),
  getSkill: (...a: unknown[]) => getSkillMock(...a),
}));

const { skillsListInput, skillsGetInput, skillsListHandler, skillsGetHandler, registerSkillTools } =
  await import('@/lib/mcp/tools/skills');

beforeEach(() => {
  listSkillsMock.mockReset();
  getSkillMock.mockReset();
});

describe('skills_list tool', () => {
  it('returns the skill metadata as JSON text', async () => {
    listSkillsMock.mockReturnValueOnce([
      { name: 'recipe-import', description: 'Import a recipe.' },
    ]);
    const res = await skillsListHandler();
    expect(res.isError).toBeUndefined();
    expect(JSON.parse(res.content[0].text)).toEqual([
      { name: 'recipe-import', description: 'Import a recipe.' },
    ]);
  });

  it('returns an isError result if listSkills throws (e.g. missing bundled file)', async () => {
    listSkillsMock.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });
    const res = await skillsListHandler();
    expect(res.isError).toBe(true);
  });
});

describe('skills_get tool', () => {
  it('returns the raw SKILL.md body as text (not JSON-wrapped)', async () => {
    getSkillMock.mockReturnValueOnce({
      name: 'recipe-import',
      description: 'Import a recipe.',
      content: '# Recipe Import\nsteps...',
    });
    const res = await skillsGetHandler({ name: 'recipe-import' });
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toBe('# Recipe Import\nsteps...');
    expect(getSkillMock).toHaveBeenCalledWith('recipe-import');
  });

  it('returns an isError result pointing at skills_list for an unknown skill', async () => {
    getSkillMock.mockReturnValueOnce(null);
    const res = await skillsGetHandler({ name: 'nope' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('skills_list');
  });

  it('truncates an over-long name in the unknown-skill message (does not echo unbounded input)', async () => {
    getSkillMock.mockReturnValueOnce(null);
    const res = await skillsGetHandler({ name: 'x'.repeat(500) });
    expect(res.isError).toBe(true);
    expect(res.content[0].text.length).toBeLessThan(160);
  });

  it('returns an isError result if getSkill throws (e.g. missing bundled file)', async () => {
    getSkillMock.mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });
    const res = await skillsGetHandler({ name: 'recipe-import' });
    expect(res.isError).toBe(true);
  });
});

describe('skills tool input schemas', () => {
  it('skills_get requires a name string', () => {
    expect(z.object(skillsGetInput).safeParse({}).success).toBe(false);
    expect(z.object(skillsGetInput).safeParse({ name: 'recipe-import' }).success).toBe(true);
  });

  it('skills_list accepts an empty object', () => {
    expect(z.object(skillsListInput).safeParse({}).success).toBe(true);
  });
});

describe('registerSkillTools', () => {
  it('registers skills_list and skills_get on the server', () => {
    const registerTool = vi.fn();
    registerSkillTools({ registerTool } as never);
    const names = registerTool.mock.calls.map((c) => c[0]);
    expect(names).toEqual(['skills_list', 'skills_get']);
  });
});
