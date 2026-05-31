/* eslint-disable */
// __IIFE_WRAPPED__
(function () {

// Home / marketing landing — signed-out users only. Mirrors the structure of
// src/app/page.tsx (hero, features, how it works, who it's for, final CTA)
// but brings it into the dark design system. Uses the four section accents
// to telegraph what the product is built around.

const { TopNav, BottomNav } = window.NavChrome;

const C = {
  bg: '#0b0d11', paper: '#15181f', paperHi: '#1c2029', sheet: '#1a1e26',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  plans: '#7aa7ff', plansDim: 'rgba(122,167,255,0.14)',
  shop: '#6fcf97', shopDim: 'rgba(111,207,151,0.14)',
  recipes: '#e8a86b', recipesDim: 'rgba(232,168,107,0.14)',
  pantry: '#c79bff', pantryDim: 'rgba(199,155,255,0.14)',
  success: '#8edcb4',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

const btnPrimary = {
  height: 48, padding: '0 22px', borderRadius: 999,
  background: C.ink, color: '#0c1118', border: 'none',
  fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
const btnGhost = {
  height: 48, padding: '0 22px', borderRadius: 999,
  background: 'transparent', color: C.ink, border: `1px solid ${C.edgeHi}`,
  fontSize: 15, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};

function MuiIcon({ name, size = 20, color }) {
  return (
    <span className="ms" style={{
      fontSize: size, color: color || 'inherit', lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 24",
    }}>{name}</span>
  );
}

// App icon (squircled BM-α — used on the landing where it actually wants the
// container, not the in-app logomark).
function AppIconSq({ size = 32 }) {
  const blocks = [
    { color: C.plans,   x: 12, w: 32 },
    { color: C.recipes, x: 16, w: 36 },
    { color: C.shop,    x: 12, w: 26 },
    { color: C.pantry,  x: 18, w: 32 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="64" height="64" rx="14" fill="#000" />
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={12 + i * 8} width={b.w} height="5" rx="1" fill={b.color} />
      ))}
      <path d="M 8 47 L 56 47 Q 56 56 32 56 Q 8 56 8 47 Z" fill="#22252d" />
      <rect x="8" y="47" width="48" height="1.5" fill="#2d3038" />
    </svg>
  );
}

// ─── Marketing top nav (different from in-app TopNav) ──────────────────────
function MarketingNavDesktop() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 56px',
      background: 'rgba(11,13,17,0.75)', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${C.edge}`,
      position: 'sticky', top: 0, zIndex: 10,
      fontFamily: sans, color: C.ink,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AppIconSq size={34} />
        <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Weekly Eats</div>
      </div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', fontSize: 14, color: C.dim }}>
        <span style={{ cursor: 'pointer' }}>Features</span>
        <span style={{ cursor: 'pointer' }}>How it works</span>
        <span style={{ cursor: 'pointer' }}>Who it's for</span>
        <button style={{ ...btnGhost, height: 40, padding: '0 18px', fontSize: 14 }}>Sign in</button>
      </div>
    </div>
  );
}

function MarketingNavMobile() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px',
      background: 'rgba(11,13,17,0.75)', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${C.edge}`,
      fontFamily: sans, color: C.ink,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AppIconSq size={28} />
        <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>Weekly Eats</div>
      </div>
      <button style={{ ...btnGhost, height: 34, padding: '0 14px', fontSize: 13 }}>Sign in</button>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────
// The image is bright/saturated — we lay it inside a rounded card with a
// strong gradient overlay so the dark headline stays legible.
function Hero({ desktop }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: desktop ? 24 : 18,
      overflow: 'hidden',
      border: `1px solid ${C.edge}`,
      boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
    }}>
      {/* Background image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${(typeof window !== 'undefined' && window.__resources && window.__resources.heroImg) || 'home_hero.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      {/* Dark wash so headline reads */}
      <div style={{
        position: 'absolute', inset: 0,
        background: desktop
          ? 'linear-gradient(95deg, rgba(11,13,17,0.94) 0%, rgba(11,13,17,0.78) 40%, rgba(11,13,17,0.25) 100%)'
          : 'linear-gradient(180deg, rgba(11,13,17,0.55) 0%, rgba(11,13,17,0.92) 75%, rgba(11,13,17,0.96) 100%)',
      }} />
      {/* Content */}
      <div style={{
        position: 'relative',
        padding: desktop ? '88px 64px 92px' : '180px 24px 32px',
        maxWidth: desktop ? '60%' : 'none',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${C.edgeHi}`, borderRadius: 999,
          fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: C.dim,
          marginBottom: 24,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: C.success }} />
          Now in limited beta
        </div>
        <div style={{
          fontFamily: display,
          fontSize: desktop ? 64 : 38,
          fontWeight: 700, letterSpacing: '-0.03em',
          lineHeight: 1.02,
          color: C.ink,
        }}>
          Simplify getting meals on the table.
        </div>
        <div style={{
          fontSize: desktop ? 19 : 16,
          color: C.dim, lineHeight: 1.5,
          marginTop: 22, maxWidth: 480,
        }}>
          Weekly Eats turns your weekly meal plan into a live, shared shopping list — so the only thing left to figure out is what's for dinner.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 32, flexWrap: 'wrap' }}>
          <button style={{ ...btnPrimary, background: C.ink, color: '#0c1118' }}>
            Get started
            <MuiIcon name="arrow_forward" size={16} />
          </button>
          <button style={btnGhost}>See how it works</button>
        </div>
        <div style={{ fontSize: 12, color: C.mute, marginTop: 18 }}>
          Sign-ups are reviewed by an admin — usually within a day.
        </div>
      </div>
    </div>
  );
}

// ─── Flow demo — meal plan → shopping list (with pantry check) ───────────
// The reason the product exists. Mini meal-plan card on the left, mini
// shopping-list card on the right, an arrow between with the pantry-check
// label so it's clear what the magic is.

const FLOW_PLAN = [
  { day: 'Mon', recipe: 'Lemon ricotta pasta', emoji: '🍝' },
  { day: 'Tue', recipe: 'Sheet-pan tacos',     emoji: '🌮' },
  { day: 'Wed', recipe: 'Coconut curry',       emoji: '🍲' },
  { day: 'Thu', recipe: 'Stir fry kit',        emoji: '🍱' },
];
const FLOW_LIST = [
  { name: 'spaghetti',     qty: '1 lb',    skip: false },
  { name: 'lemons',        qty: '3 each',  skip: false },
  { name: 'parmesan',      qty: '0.5 lb',  skip: false },
  { name: 'kosher salt',   qty: '1 tsp',   skip: true  },
  { name: 'olive oil',     qty: '0.25 cup',skip: true  },
  { name: 'red onion',     qty: '1 each',  skip: false },
  { name: 'coconut milk',  qty: '1 can',   skip: false },
  { name: 'unsalted butter', qty: '4 tbsp', skip: true  },
];

function MiniPlanCard({ desktop }) {
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 16,
      padding: desktop ? '18px 18px 16px' : '16px 14px 14px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MuiIcon name="event_note" size={16} color={C.plans} />
          <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>This week</div>
        </div>
        <div style={{ fontSize: 10, color: C.mute, letterSpacing: '0.08em', textTransform: 'uppercase' }}>May 25 – 31</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FLOW_PLAN.map((p, i) => (
          <div key={p.day} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            background: i === 0 ? C.plansDim : C.paperHi,
            border: i === 0 ? `1px solid ${C.plans}55` : `1px solid ${C.edge}`,
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', width: 28 }}>{p.day}</div>
            <span style={{ fontSize: 16 }}>{p.emoji}</span>
            <div style={{ flex: 1, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.recipe}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniListCard({ desktop }) {
  const skipping = FLOW_LIST.filter((i) => i.skip).length;
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 16,
      padding: desktop ? '18px 18px 14px' : '16px 14px 12px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MuiIcon name="shopping_cart" size={16} color={C.shop} />
          <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Corner market</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.pantry, background: C.pantryDim, padding: '3px 8px', borderRadius: 999 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: C.pantry }} />
          {skipping} from pantry
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {FLOW_LIST.map((it, i) => (
          <div key={it.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 4px',
            borderTop: i === 0 ? 'none' : `1px solid ${C.edge}`,
            opacity: it.skip ? 0.45 : 1,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              border: `1.5px solid ${it.skip ? C.pantry : C.edgeHi}`,
              background: it.skip ? C.pantry : 'transparent',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {it.skip && <MuiIcon name="close" size={11} color="#1a0f24" />}
            </div>
            <div style={{ flex: 1, fontSize: 13, color: C.ink, textDecoration: it.skip ? 'line-through' : 'none' }}>{it.name}</div>
            <div style={{ fontSize: 11.5, color: C.mute, fontVariantNumeric: 'tabular-nums' }}>{it.qty}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowConnector({ horizontal }) {
  if (horizontal) {
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 4px', minWidth: 100 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', background: C.pantryDim,
          border: `1px solid ${C.pantry}55`, borderRadius: 999,
          color: C.pantry, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          <MuiIcon name="kitchen" size={12} color={C.pantry} />
          Pantry check
        </div>
        <div style={{ position: 'relative', width: '100%', height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.plans}, ${C.pantry}, ${C.shop})` }} />
          <MuiIcon name="arrow_forward" size={18} color={C.shop} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <div style={{ width: 1, height: 20, background: C.plans, opacity: 0.6 }} />
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', background: C.pantryDim,
        border: `1px solid ${C.pantry}55`, borderRadius: 999,
        color: C.pantry, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <MuiIcon name="kitchen" size={12} color={C.pantry} />
        + Pantry check
      </div>
      <MuiIcon name="arrow_downward" size={20} color={C.shop} />
    </div>
  );
}

// Hero feature card — folds the auto-generation + pantry check story into Features
// instead of standing as its own section.
function HeroFeatureCard({ desktop }) {
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.edge}`,
      borderRadius: 16, padding: desktop ? '32px' : '24px 22px',
      position: 'relative', overflow: 'hidden',
      marginBottom: 18,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.pantry }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: desktop ? '0.9fr 1.1fr' : '1fr',
        gap: desktop ? 40 : 24,
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: C.pantryDim, color: C.pantry,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <MuiIcon name="auto_awesome" size={22} color={C.pantry} />
          </div>
          <div style={{
            fontFamily: display, fontSize: desktop ? 24 : 20,
            fontWeight: 700, letterSpacing: '-0.015em',
            color: C.ink, lineHeight: 1.2, marginBottom: 10,
          }}>
            Auto-generated shopping lists, minus what's already in your pantry.
          </div>
          <div style={{ fontSize: desktop ? 15 : 14.5, color: C.dim, lineHeight: 1.55 }}>
            Every other app makes you copy the list by hand. This one builds it from your plan, then quietly drops items you've already got. You only buy what you actually need.
          </div>
        </div>

        {desktop ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 6 }}>
            <MiniPlanCard desktop />
            <FlowConnector horizontal />
            <MiniListCard desktop />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <MiniPlanCard />
            <FlowConnector />
            <MiniListCard />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kicker + heading + body block ────────────────────────────────────────
function SectionHeader({ kicker, title, sub, kickerColor = C.dim, desktop }) {
  return (
    <div style={{ marginBottom: desktop ? 36 : 24, maxWidth: 720 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
        color: kickerColor, marginBottom: 12, fontFamily: sans,
      }}>
        {kicker}
      </div>
      <div style={{
        fontFamily: display, fontSize: desktop ? 38 : 26, fontWeight: 700,
        letterSpacing: '-0.025em', lineHeight: 1.1, color: C.ink,
      }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: desktop ? 16 : 15, color: C.dim, marginTop: 14, lineHeight: 1.55 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Features grid ─────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: 'event_note', color: 'plans',
    title: 'Smart weekly meal plans',
    body: 'Build flexible plans that match real life — recipes, staples, and ingredient groups all in one view. Reuse what worked, tweak what didn\'t.',
  },
  {
    icon: 'shopping_cart', color: 'shop',
    title: 'Live, shared shopping lists',
    body: 'Everyone sees the same list. Check items off and watch them disappear in real time across devices, with presence indicators so you know who\'s shopping.',
  },
];

function FeatureCard({ feature, desktop }) {
  const colorMap = { plans: C.plans, shop: C.shop, recipes: C.recipes, pantry: C.pantry };
  const dimMap   = { plans: C.plansDim, shop: C.shopDim, recipes: C.recipesDim, pantry: C.pantryDim };
  const color = colorMap[feature.color];
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.edge}`,
      borderRadius: 16, padding: desktop ? '32px 28px 28px' : '24px 22px 22px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Tinted accent stripe at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: dimMap[feature.color],
        color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <MuiIcon name={feature.icon} size={22} color={color} />
      </div>
      <div style={{ fontFamily: display, fontSize: desktop ? 19 : 18, fontWeight: 700, letterSpacing: '-0.015em', color: C.ink, marginBottom: 8 }}>
        {feature.title}
      </div>
      <div style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.55 }}>{feature.body}</div>
    </div>
  );
}

// ─── How it works ──────────────────────────────────────────────────────────
const STEPS = [
  { kicker: 'Step 1', color: 'plans',   icon: 'event_note',   title: 'Plan',     body: 'Drop recipes and staples onto each day of the week. Keep your weekly favorites as a template you can reuse.' },
  { kicker: 'Step 2', color: 'recipes', icon: 'auto_awesome', title: 'Generate', body: 'Turn your plan into a grouped, per-store shopping list. Units are consolidated automatically.' },
  { kicker: 'Step 3', color: 'shop',    icon: 'group_add',    title: 'Share',    body: 'Invite family or roommates so everyone shops from the same live list — no more “did you get the milk?” texts.' },
  { kicker: 'Step 4', color: 'pantry',  icon: 'done_all',     title: 'Shop',     body: 'Check off items as you go. Your list stays in sync for everyone in real time and the trip lands in your purchase history.' },
];

function StepCard({ step, idx, desktop }) {
  const colorMap = { plans: C.plans, shop: C.shop, recipes: C.recipes, pantry: C.pantry };
  const color = colorMap[step.color];
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.edge}`,
      borderRadius: 16, padding: desktop ? '26px 24px 22px' : '22px 20px',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -14, left: 20,
        background: C.bg,
        padding: '0 10px',
      }}>
        <div style={{
          fontFamily: display, fontSize: 26, fontWeight: 700, color,
          letterSpacing: '-0.04em', lineHeight: 1,
        }}>0{idx + 1}</div>
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <MuiIcon name={step.icon} size={18} color={color} />
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: '-0.015em' }}>{step.title}</div>
      </div>
      <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.55 }}>{step.body}</div>
    </div>
  );
}

// ─── For who ───────────────────────────────────────────────────────────────
const AUDIENCES = [
  {
    icon: 'family_restroom', color: 'plans',
    title: 'Busy families',
    body: 'Share the plan, share the list, and let anyone jump in to help without losing track of what\'s still needed.',
  },
  {
    icon: 'apartment', color: 'shop',
    title: 'Roommates & partners',
    body: 'Coordinate meals and staples so you stop buying duplicate milk and forgetting the basics every week.',
  },
];

function AudienceCard({ a, desktop }) {
  const colorMap = { plans: C.plans, shop: C.shop, recipes: C.recipes, pantry: C.pantry };
  const dimMap   = { plans: C.plansDim, shop: C.shopDim, recipes: C.recipesDim, pantry: C.pantryDim };
  const color = colorMap[a.color];
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.edge}`,
      borderRadius: 16, padding: desktop ? '28px' : '24px 22px',
      display: 'flex', gap: 18, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: dimMap[a.color],
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <MuiIcon name={a.icon} size={28} color={color} />
      </div>
      <div>
        <div style={{ fontFamily: display, fontSize: desktop ? 19 : 18, fontWeight: 700, letterSpacing: '-0.015em', color: C.ink, marginBottom: 8 }}>
          {a.title}
        </div>
        <div style={{ fontSize: 14.5, color: C.dim, lineHeight: 1.55 }}>{a.body}</div>
      </div>
    </div>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────
function FinalCTA({ desktop }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: desktop ? 24 : 18,
      padding: desktop ? '64px 64px 60px' : '40px 24px',
      background: C.paper,
      border: `1px solid ${C.edge}`,
      textAlign: 'center',
    }}>
      {/* Four-color halo */}
      <div style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 200,
        background: `radial-gradient(circle, ${C.plansDim}, transparent 70%), radial-gradient(circle at 30% 50%, ${C.recipesDim}, transparent 60%), radial-gradient(circle at 70% 50%, ${C.shopDim}, transparent 60%)`,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: display, fontSize: desktop ? 38 : 28, fontWeight: 700,
          letterSpacing: '-0.025em', lineHeight: 1.1, color: C.ink,
          maxWidth: 640, margin: '0 auto',
        }}>
          Ready to make next week easier?
        </div>
        <div style={{ fontSize: desktop ? 17 : 15, color: C.dim, marginTop: 14, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Sign in with Google. We'll get you in once an admin approves your account.
        </div>
        <button style={{ ...btnPrimary, marginTop: 30 }}>
          Sign in with Google
          <MuiIcon name="arrow_forward" size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────
function Footer({ desktop }) {
  return (
    <div style={{
      padding: desktop ? '36px 56px 40px' : '28px 18px 32px',
      borderTop: `1px solid ${C.edge}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 16,
      fontFamily: sans, color: C.mute, fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AppIconSq size={24} />
        <span>Weekly Eats · ©2026</span>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP LANDING
// =============================================================================
function DesktopLanding() {
  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: sans, width: '100%' }}>
      <MarketingNavDesktop />
      <div style={{ padding: '64px 56px 0', maxWidth: 1200, margin: '0 auto' }}>
        <Hero desktop />

        <div style={{ marginTop: 96 }}>
          <SectionHeader
            kicker="Features"
            title="Everything you need from planning to pantry."
            sub="Four working surfaces, all stitched together. No more juggling a spreadsheet, a notes app, and three text threads."
            kickerColor={C.recipes}
            desktop
          />
          <HeroFeatureCard desktop />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {FEATURES.map((f) => <FeatureCard key={f.title} feature={f} desktop />)}
          </div>
        </div>

        <div style={{ marginTop: 96 }}>
          <SectionHeader
            kicker="How it works"
            title="From idea to aisle in four steps."
            kickerColor={C.shop}
            desktop
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {STEPS.map((s, i) => <StepCard key={s.title} step={s} idx={i} desktop />)}
          </div>
        </div>

        <div style={{ marginTop: 96 }}>
          <SectionHeader
            kicker="Built for real life"
            title="Great for households, roommates, and anyone tired of winging it."
            kickerColor={C.plans}
            desktop
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
            {AUDIENCES.map((a) => <AudienceCard key={a.title} a={a} desktop />)}
          </div>
        </div>

        <div style={{ marginTop: 96 }}>
          <FinalCTA desktop />
        </div>
      </div>
      <Footer desktop />
    </div>
  );
}

// =============================================================================
// MOBILE LANDING
// =============================================================================
function MobileLanding() {
  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: sans, width: '100%' }}>
      <MarketingNavMobile />
      <div style={{ padding: '24px 16px 0' }}>
        <Hero desktop={false} />

        <div style={{ marginTop: 56 }}>
          <SectionHeader
            kicker="Features"
            title="Everything from planning to pantry."
            sub="Four working surfaces, all stitched together. No spreadsheet. No notes app. No group text."
            kickerColor={C.recipes}
          />
          <HeroFeatureCard />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map((f) => <FeatureCard key={f.title} feature={f} />)}
          </div>
        </div>

        <div style={{ marginTop: 56 }}>
          <SectionHeader
            kicker="How it works"
            title="From idea to aisle in four steps."
            kickerColor={C.shop}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {STEPS.map((s, i) => <StepCard key={s.title} step={s} idx={i} />)}
          </div>
        </div>

        <div style={{ marginTop: 56 }}>
          <SectionHeader
            kicker="Built for real life"
            title="Great for households + roommates."
            kickerColor={C.plans}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {AUDIENCES.map((a) => <AudienceCard key={a.title} a={a} />)}
          </div>
        </div>

        <div style={{ marginTop: 56 }}>
          <FinalCTA />
        </div>
      </div>
      <Footer />
    </div>
  );
}

Object.assign(window, {
  HomeDesktop: DesktopLanding,
  HomeMobile: MobileLanding,
});

})();
