// test/manual/scenarios/pending-approval-user.ts
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Block, BlockDocumentation } from '../types.js';
import { seedTag, SEED_TITLE_PREFIX } from '../seedTag.js';

// ─── Config schema ───────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  name: z.string().optional(),
});
type Config = z.infer<typeof ConfigSchema>;
type State = { pendingUserId: ObjectId; email: string };

// ─── Documentation ───────────────────────────────────────────────────────────

const documentation: BlockDocumentation = {
  description:
    'Inserts one pending (unapproved) user into the users collection. ' +
    'The email is ALWAYS auto-generated as "manual-test+<randomHex8>@manual-test.invalid". ' +
    'The @manual-test.invalid domain is RFC 2606 reserved and will never resolve to a real address. ' +
    'No email config is accepted — the domain is forced to prevent accidental real-user pollution. ' +
    'Set `name` to control the display name (default: "Manual Test Pending User"). ' +
    'This block has NO dependencies — it is independent of user-baseline and other blocks. ' +
    'clean() is tag-scoped and will NOT delete real users.',
  configExamples: [
    { label: 'default pending user', config: {} },
    { label: 'named pending user', config: { name: 'Jane Pending' } },
  ],
  dependencies: [],
  collectionsWritten: ['users'],
};

// ─── Block ───────────────────────────────────────────────────────────────────

export const block: Block<Config, State> = {
  name: 'pending-approval-user',
  documentation,

  validate(c) {
    return ConfigSchema.parse(c);
  },

  async apply(config, ctx) {
    const tagFilter = seedTag(ctx);

    const usersCol = ctx.db.collection('users');

    // ── Idempotency: return existing if tagged user already present ──
    const existing = await usersCol.find(tagFilter).toArray();
    if (existing.length > 0) {
      const doc = existing[0];
      return {
        state: {
          pendingUserId: doc._id as ObjectId,
          email: doc.email as string,
        },
        docCount: 1,
        summary: `pending user ${doc.email as string} (already present)`,
      };
    }

    // ── Generate forced @manual-test.invalid email ──
    const hex = crypto.randomBytes(4).toString('hex');
    const email = `manual-test+${hex}@manual-test.invalid`;

    // ── Insert user ──
    const now = new Date();
    const result = await usersCol.insertOne({
      email,
      name: config.name ?? `${SEED_TITLE_PREFIX}Pending User [${ctx.label}]`,
      isApproved: false,
      image: null,
      emailVerified: null,
      createdAt: now,
      updatedAt: now,
      ...tagFilter,
    });

    return {
      state: { pendingUserId: result.insertedId as ObjectId, email },
      docCount: 1,
      summary: `pending user ${email}`,
    };
  },

  async clean(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const result = await ctx.db.collection('users').deleteMany(tagFilter);
    return { docCount: result.deletedCount ?? 0 };
  },

  async status(ctx) {
    const tagFilter = {
      _seedManifestId: ctx.manifestId,
      _seedScenarioId: ctx.scenarioId,
    };
    const count = await ctx.db.collection('users').countDocuments(tagFilter);
    return { present: count > 0, docCount: count, configHashMatches: true };
  },
};
