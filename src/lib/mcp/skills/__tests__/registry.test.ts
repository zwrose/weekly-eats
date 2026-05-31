import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  listSkills,
  getSkill,
  SKILL_DIRECTORIES,
} from '@/lib/mcp/skills/registry';

describe('parseFrontmatter', () => {
  it('extracts key/value frontmatter and returns the body without it', () => {
    const md = '---\nname: foo\ndescription: A test skill\n---\n# Body\ntext';
    const { meta, body } = parseFrontmatter(md);
    expect(meta.name).toBe('foo');
    expect(meta.description).toBe('A test skill');
    expect(body.trim()).toBe('# Body\ntext');
  });

  it('returns empty meta and the original content when there is no frontmatter', () => {
    const { meta, body } = parseFrontmatter('# No frontmatter');
    expect(meta).toEqual({});
    expect(body).toBe('# No frontmatter');
  });

  it('keeps colons in the value (e.g. URLs)', () => {
    const { meta } = parseFrontmatter('---\nurl: https://example.com/x\n---\nbody');
    expect(meta.url).toBe('https://example.com/x');
  });

  it('parses CRLF-terminated frontmatter (Windows / git autocrlf)', () => {
    const md = '---\r\nname: foo\r\ndescription: A test skill\r\n---\r\n# Body';
    const { meta, body } = parseFrontmatter(md);
    expect(meta.name).toBe('foo');
    expect(meta.description).toBe('A test skill');
    expect(body.trim()).toBe('# Body');
  });
});

describe('listSkills', () => {
  it('lists every installed skill with its directory name and description', () => {
    const skills = listSkills();
    expect(skills.map((s) => s.name)).toEqual([...SKILL_DIRECTORIES]);
    const recipeImport = skills.find((s) => s.name === 'recipe-import');
    expect(recipeImport).toBeDefined();
    expect(recipeImport!.description.toLowerCase()).toContain('recipe');
  });
});

describe('getSkill', () => {
  it('returns the full SKILL.md body for an installed skill', () => {
    const skill = getSkill('recipe-import');
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('recipe-import');
    expect(skill!.content).toContain('recipes_create');
    expect(skill!.content).toContain('food_items_search');
    expect(skill!.content.startsWith('---')).toBe(false);
  });

  it('returns null for an unknown skill', () => {
    expect(getSkill('does-not-exist')).toBeNull();
  });

  it('returns null for a path-traversal attempt (allowlist guard)', () => {
    expect(getSkill('../../etc/passwd')).toBeNull();
    expect(getSkill('recipe-import/../recipe-import')).toBeNull();
  });
});
