/* eslint-disable */
// Shared nav chrome used by every artboards file. Exposes TopNav, BottomNav,
// AppIcon, NavAvatar, MuiIcon on window.NavChrome so each per-section file
// doesn't redefine them. Lives outside any IIFE so it's a true global.

window.NavChrome = (function () {

const T = {
  bg: '#0f1115', paper: '#181b21',
  ink: '#e7e9ee', dim: '#9097a6',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  plans:   '#7aa7ff',
  shop:    '#6fcf97',
  recipes: '#e8a86b',
  pantry:  '#c79bff',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans    = `'Outfit', system-ui, sans-serif`;

function AppIcon({ size = 30 }) {
  const blocks = [
    { color: T.plans,   x: 12, w: 32 },
    { color: T.recipes, x: 16, w: 36 },
    { color: T.shop,    x: 12, w: 26 },
    { color: T.pantry,  x: 18, w: 32 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0 }}>
      {blocks.map((b, i) => (
        <rect key={i} x={b.x} y={12 + i * 8} width={b.w} height="5" rx="1" fill={b.color} />
      ))}
      <path d="M 8 47 L 56 47 Q 56 56 32 56 Q 8 56 8 47 Z" fill="#3a3d44" />
      <rect x="8" y="47" width="48" height="1.5" fill="rgba(255,255,255,0.20)" />
    </svg>
  );
}

function MuiIcon({ name, size = 20, color }) {
  return (
    <span className="ms" style={{
      fontSize: size, color: color || 'inherit', lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 24",
    }}>{name}</span>
  );
}

function NavAvatar({ size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #5b6d8c, #3d4a64)',
      color: T.ink, fontSize: size * 0.4, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: sans, flexShrink: 0,
    }}>ZR</div>
  );
}

const SECTIONS = [
  { key: 'plans',   label: 'Plans',   icon: 'calendar_month', color: T.plans },
  { key: 'shop',    label: 'Shop',    icon: 'shopping_cart',  color: T.shop },
  { key: 'recipes', label: 'Recipes', icon: 'restaurant',     color: T.recipes },
  { key: 'pantry',  label: 'Pantry',  icon: 'kitchen',        color: T.pantry },
];

function TopNav({ active }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 28px',
      background: T.bg, color: T.ink, fontFamily: sans,
      borderBottom: `1px solid ${T.edge}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <AppIcon size={30} />
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Weekly Eats</div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 28, flex: 1 }}>
        {SECTIONS.map((it) => {
          const on = it.key === active;
          return (
            <button key={it.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '0 14px', height: 50,
              background: 'transparent', border: 'none',
              color: on ? T.ink : T.dim,
              borderBottom: on ? `2.5px solid ${it.color}` : '2.5px solid transparent',
              fontFamily: 'inherit', fontSize: 14.5, fontWeight: on ? 600 : 500,
              cursor: 'pointer',
            }}>
              <MuiIcon name={it.icon} size={18} color={it.color} />
              {it.label}
            </button>
          );
        })}
      </div>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '6px 12px 6px 6px', height: 40,
        background: 'transparent', border: `1px solid ${T.edge}`,
        borderRadius: 999,
        color: T.ink, fontFamily: 'inherit', fontSize: 14,
        cursor: 'pointer',
      }}>
        <NavAvatar size={28} />
        Zach Rose
      </button>
    </div>
  );
}

function BottomNav({ active }) {
  const items = SECTIONS.slice(0, 3); // Plans, Shop, Recipes (no Pantry on mobile)
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      padding: '8px 0 22px',
      background: T.paper, borderTop: `1px solid ${T.edge}`,
      color: T.dim, fontFamily: sans,
    }}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <div key={it.key} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: on ? it.color : T.dim,
          }}>
            <MuiIcon name={it.icon} size={22} color={on ? it.color : T.dim} />
            {it.label}
          </div>
        );
      })}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        color: active === 'avatar' ? T.ink : T.dim,
      }}>
        <NavAvatar size={22} />
        Zach
      </div>
    </div>
  );
}

return { TopNav, BottomNav, AppIcon, NavAvatar, MuiIcon, SECTIONS, TOKENS: T };
})();
