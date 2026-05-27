// test/manual/scenarios/user-baseline.ts
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';

const ConfigSchema = z.object({
  email: z
    .string()
    .regex(/.+@.+\..+/)
    .optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { userId: string; email: string; name: string };

const documentation: BlockDocumentation = {
  description:
    'Verifies a signed-in user exists in the worktree DB. Returns the userId for downstream blocks. Use precedence: config.email > MANUAL_TEST_USER_EMAIL env > single user.',
  configExamples: [
    { label: 'auto (single user in DB)', config: {} },
    { label: 'explicit email', config: { email: 'me@example.com' } },
  ],
  dependencies: [],
  collectionsWritten: [],
};

const block: Block<Config, State> = {
  name: 'user-baseline',
  documentation,
  validate(c) {
    return ConfigSchema.parse(c ?? {});
  },

  async apply(config, ctx) {
    const users = ctx.db.collection('users');
    const all = await users.find({}).toArray();
    if (all.length === 0) {
      throw new Error(
        'no signed-in user found in worktree DB.\n  Run `npm run dev`, open http://localhost:<PORT>, sign in with Google, then re-run.'
      );
    }
    const email = config.email ?? process.env.MANUAL_TEST_USER_EMAIL;
    let chosen: any;
    if (email) {
      chosen = all.find((u: any) => u.email === email);
      if (!chosen) {
        throw new Error(
          `user not found with email "${email}". DB has: ${all.map((u: any) => u.email).join(', ')}`
        );
      }
    } else if (all.length === 1) {
      chosen = all[0];
    } else {
      throw new Error(
        `multiple users in DB; ambiguous. found ${all.length}: ${all.map((u: any) => u.email).join(', ')}\n  hint: set MANUAL_TEST_USER_EMAIL=<email> or add config.email to the user-baseline scenario`
      );
    }
    if (chosen.isApproved !== true) {
      throw new Error(
        `user ${chosen.email} is not approved (isApproved !== true). Approve via admin UI first.`
      );
    }
    return {
      state: { userId: String(chosen._id), email: chosen.email, name: chosen.name ?? '(no name)' },
      docCount: 0,
      summary: `Signed-in user: ${chosen.email}`,
    };
  },

  async clean() {
    return { docCount: 0 };
  },

  async status(ctx) {
    const count = await ctx.db.collection('users').countDocuments({});
    return { present: count > 0, docCount: 0, configHashMatches: true };
  },
};

export default block;
