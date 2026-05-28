/* eslint-disable */
// __IIFE_WRAPPED__
(function () {

// Nav redesign specimen. Mirrors Header.tsx + BottomNav.tsx with the
// design-system treatment: real app icon, themed SVG icons, in-line
// icons+text on desktop, avatar+name, full avatar menu.
// Also includes an exploration of accent options for the "utility cluster"
// (Food Items / Settings / User Management).

const C = {
  bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a', sheet: '#1a1e26',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  // Section accents (dark mode), straight from the design system.
  plans:   '#7aa7ff',
  shop:    '#6fcf97',
  recipes: '#e8a86b',
  pantry:  '#c79bff',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

// ─── App icon ─────────────────────────────────────────────────────────────
// BM-α as a logomark — no black squircle behind the marks, so the blocks +
// bowl float in the nav chrome with full contrast. The bowl gets a lighter
// fill so it reads against the dark nav background. The squircled version
// stays for the actual app icon (home screen / app store).
function AppIcon({ size = 32 }) {
  const blocks = [
    { color: C.plans,   x: 12, w: 32 },
    { color: C.recipes, x: 16, w: 36 },
    { color: C.shop,    x: 12, w: 26 },
    { color: C.pantry,  x: 18, w: 32 },
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

// ─── MUI icons via Material Symbols Outlined font ───────────────────────
// Names match what main imports from @mui/icons-material (e.g. CalendarMonth
// → calendar_month). Single ligature font: write the name as the text.
function MuiIcon({ name, size = 20, weight = 400 }) {
  return (
    <span className="ms" style={{
      fontSize: size, color: 'inherit', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      width: size, height: size, flexShrink: 0,
      fontVariationSettings: `'FILL' 0, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
    }}>{name}</span>
  );
}

const Icon = {
  Calendar: ({ size }) => <MuiIcon name="calendar_month" size={size} />,
  Cart:     ({ size }) => <MuiIcon name="shopping_cart" size={size} />,
  Recipes:  ({ size }) => <MuiIcon name="restaurant" size={size} />,
  Pantry:   ({ size }) => <MuiIcon name="kitchen" size={size} />,
  Settings: ({ size }) => <MuiIcon name="settings" size={size} />,
  Person:   ({ size }) => <MuiIcon name="person" size={size} />,
  List:     ({ size }) => <MuiIcon name="format_list_bulleted" size={size} />,
  Logout:   ({ size }) => <MuiIcon name="logout" size={size} />,
  Chevron:  ({ size }) => <MuiIcon name="chevron_right" size={size} />,
};

// ─── Avatar (mock initials in colored disc) ───────────────────────────────
function Avatar({ size = 32, name = 'Zach Rose' }) {
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #5b6d8c, #3d4a64)',
      color: C.ink, fontSize: size * 0.4, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: sans, flexShrink: 0,
    }}>{initials}</div>
  );
}

// =============================================================================
// DESKTOP TOP NAV
// =============================================================================
function DesktopNav({ active = 'plans' }) {
  const items = [
    { key: 'plans',   label: 'Meal Plans',     icon: Icon.Calendar, color: C.plans },
    { key: 'shop',    label: 'Shopping Lists', icon: Icon.Cart,     color: C.shop },
    { key: 'recipes', label: 'Recipes',        icon: Icon.Recipes,  color: C.recipes },
    { key: 'pantry',  label: 'Pantry',         icon: Icon.Pantry,   color: C.pantry },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '12px 28px',
      background: C.bg, color: C.ink, fontFamily: sans,
      borderBottom: `1px solid ${C.edge}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <AppIcon size={30} />
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Weekly Eats</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginLeft: 28, flex: 1 }}>
        {items.map((it) => {
          const on = it.key === active;
          const IconCmp = it.icon;
          return (
            <button key={it.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '0 14px', height: 50,
              background: 'transparent', border: 'none',
              color: on ? C.ink : C.dim,
              borderBottom: on ? `2.5px solid ${it.color}` : `2.5px solid transparent`,
              fontFamily: 'inherit', fontSize: 14.5, fontWeight: on ? 600 : 500,
              cursor: 'pointer',
            }}>
              <span style={{ color: it.color, display: 'inline-flex' }}><IconCmp size={18} /></span>
              {it.label}
            </button>
          );
        })}
      </div>

      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '6px 12px 6px 6px', height: 40,
        background: 'transparent', border: `1px solid ${C.edge}`,
        borderRadius: 999,
        color: C.ink, fontFamily: 'inherit', fontSize: 14,
        cursor: 'pointer',
      }}>
        <Avatar size={28} />
        Zach Rose
      </button>
    </div>
  );
}

// =============================================================================
// MOBILE BOTTOM NAV — labels kept per design call
// =============================================================================
function MobileBottomNav({ active = 'plans' }) {
  const items = [
    { key: 'plans',   label: 'Plans',   icon: Icon.Calendar, color: C.plans },
    { key: 'shop',    label: 'Shop',    icon: Icon.Cart,     color: C.shop },
    { key: 'recipes', label: 'Recipes', icon: Icon.Recipes,  color: C.recipes },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      padding: '8px 0 22px',
      background: C.paper, borderTop: `1px solid ${C.edge}`,
      color: C.dim, fontFamily: sans,
    }}>
      {items.map((it) => {
        const on = it.key === active;
        const IconCmp = it.icon;
        return (
          <div key={it.key} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: on ? it.color : C.dim,
          }}>
            <IconCmp size={22} />
            {it.label}
          </div>
        );
      })}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: active === 'avatar' ? C.ink : C.dim }}>
        <Avatar size={22} />
        You
      </div>
    </div>
  );
}

// ─── Avatar menu items (shared content for desktop popover + mobile sheet) ──
function AvatarMenuItems({ admin = true, mobile = false, utility = '#9aa4b3' }) {
  // Pantry sits in the avatar menu only on mobile, where it isn't a bottom-nav slot.
  // On desktop it's already a top-level nav item, so we don't duplicate it here.
  const items = [
    ...(mobile ? [{ label: 'Pantry', icon: Icon.Pantry, color: C.pantry }] : []),
    { label: 'Manage food items', icon: Icon.List,     color: utility },
    ...(admin ? [{ label: 'Manage users', icon: Icon.Person, color: utility }] : []),
    { label: 'Settings',          icon: Icon.Settings, color: utility },
  ];
  return (
    <>
      {items.map((it) => {
        const IconCmp = it.icon;
        return (
          <div key={it.label} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            color: C.ink, fontSize: 14, fontFamily: sans, cursor: 'pointer',
          }}>
            <span style={{ color: it.color, display: 'inline-flex' }}><IconCmp size={17} /></span>
            <span style={{ flex: 1 }}>{it.label}</span>
          </div>
        );
      })}
      <div style={{ height: 1, background: C.edge, margin: '6px 0' }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        color: C.ink, fontSize: 14, fontFamily: sans, cursor: 'pointer',
      }}>
        <span style={{ color: C.dim, display: 'inline-flex' }}><Icon.Logout size={17} /></span>
        Sign out
      </div>
    </>
  );
}

// =============================================================================
// DESKTOP NAV · AVATAR MENU OPEN (popover anchored to avatar)
// =============================================================================
function DesktopNavAvatarOpen({ utility = '#9aa4b3' }) {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <DesktopNav active="plans" />

      {/* mock page body behind */}
      <div style={{ padding: '32px 56px', opacity: 0.4, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Your plans</div>
        <div style={{ marginTop: 24, height: 320, background: C.paper, borderRadius: 14, border: `1px solid ${C.edge}` }} />
      </div>

      {/* popover */}
      <div style={{
        position: 'absolute', top: 64, right: 28, width: 260,
        background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        padding: '8px 0', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px 14px', borderBottom: `1px solid ${C.edge}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Zach Rose</div>
            <div style={{ fontSize: 11, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>zach@weeklyeats.app</div>
          </div>
        </div>
        <div style={{ padding: '4px 0' }}>
          <AvatarMenuItems utility={utility} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE STATUS BAR
// =============================================================================
function StatusBar() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px 4px', fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: sans }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 6, opacity: .85, fontSize: 11 }}>
        <span>●●●</span><span>📶</span><span>100%</span>
      </span>
    </div>
  );
}

// =============================================================================
// MOBILE · INDEX (header + bottom nav showing new chrome)
// =============================================================================
function MobilePage({ utility = '#9aa4b3' }) {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ padding: '12px 18px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <AppIcon size={26} />
        <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700 }}>Weekly Eats</div>
      </div>

      <div style={{ padding: '0 18px' }}>
        <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Your plans</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
          <span style={{ color: C.plans, fontWeight: 600 }}>3</span> active · <span style={{ color: C.dim }}>43 in history</span>
        </div>
        <div style={{ marginTop: 18, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, height: 280 }} />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <MobileBottomNav active="plans" />
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · AVATAR MENU OPEN (bottom sheet)
// =============================================================================
function MobileAvatarOpen({ utility = '#9aa4b3' }) {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4, padding: '12px 18px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <AppIcon size={26} />
        <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700 }}>Weekly Eats</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
        paddingBottom: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ padding: '12px 18px 14px', borderBottom: `1px solid ${C.edge}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={42} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: display, fontSize: 16, fontWeight: 700 }}>Zach Rose</div>
            <div style={{ fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>zach@weeklyeats.app</div>
          </div>
        </div>
        <div style={{ padding: '8px 0 4px' }}>
          <AvatarMenuItems mobile utility={utility} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// UTILITY-ACCENT EXPLORATION
// =============================================================================
// Four options for the "utility cluster" accent — non-teal, mostly muted neutrals.
// Each preview shows a sample Settings page header with the candidate accent
// applied to the back chevron + count number + breadcrumb.
const UTILITY_OPTIONS = [
  { id: 'cool-slate', name: 'Cool slate · chosen', hex: '#9aa4b3' },
];

function UtilityPreview({ option, recommended }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${recommended ? option.hex : C.edge}`,
      borderRadius: 12, overflow: 'hidden',
      boxShadow: recommended ? `0 0 0 3px ${option.hex}22` : 'none',
    }}>
      <div style={{ padding: '14px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.dim, marginBottom: 8, fontFamily: sans }}>
          <span style={{ color: option.hex, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-flex' }}><Icon.Chevron size={12} /></span>
            <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>{/* arrow already faces right; flip via wrapper */}</span>
            Back
          </span>
        </div>
        <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink }}>Food items</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
          <span style={{ color: option.hex, fontWeight: 600 }}>248</span> in catalog
        </div>
      </div>
      <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: option.hex }} />
          <div style={{ fontFamily: sans, fontSize: 13, color: C.ink, fontWeight: 600 }}>{option.name}</div>
        </div>
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11, color: C.mute }}>{option.hex}</div>
      </div>
      {recommended && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: option.hex, fontFamily: sans,
          padding: '3px 8px', border: `1px solid ${option.hex}`, borderRadius: 999,
        }}>Rec.</div>
      )}
    </div>
  );
}

function UtilityAccentExploration() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#191b21', padding: 26, fontFamily: sans, color: C.ink, overflow: 'hidden' }}>
      <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Utility accent · options</div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 4, marginBottom: 18, lineHeight: 1.45 }}>
        Used on Food Items / Settings / User Mgmt — pages reached via the avatar menu, not a section. Should sit quieter than the four section accents.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {UTILITY_OPTIONS.map((opt, i) => (
          <div key={opt.id} style={{ position: 'relative' }}>
            <UtilityPreview option={opt} recommended={i === 0} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, padding: 14, background: C.paper, borderRadius: 10, border: `1px solid ${C.edge}` }}>
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
          <b style={{ color: C.ink }}>Locked.</b> Cool slate <code>#9aa4b3</code> is the utility accent. Applied to Food Items, Settings, and User Management. Used on counts, back chevrons, and primary buttons within those pages.
        </div>
      </div>
    </div>
  );
}

// Reference comparison: original PNG at 96px so we can sanity-check the redraw.
function AppIconPng({ size = 96 }) {
  return (
    <img
      src="public/web-app-manifest-192x192.png"
      width={size} height={size}
      alt="Weekly Eats (original)"
      style={{ display: 'block', flexShrink: 0, borderRadius: size * 0.22 }}
    />
  );
}

function IconCompare() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#191b21', padding: 32, fontFamily: sans, color: C.ink, overflow: 'hidden' }}>
      <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Icon compare</div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 4, marginBottom: 24, lineHeight: 1.45 }}>
        Original PNG (left) and SVG redraw with new section colors (right).
      </div>
      {[96, 48, 28].map((px) => (
        <div key={px} style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: C.dim, width: 50, textAlign: 'right' }}>{px}px</div>
          <AppIconPng size={px} />
          <span style={{ color: C.mute, fontSize: 14 }}>→</span>
          <AppIcon size={px} />
        </div>
      ))}
    </div>
  );
}

// ─── exports ───────────────────────────────────────────────────────────────
Object.assign(window, {
  NavDesktop: () => <div style={{ background: C.bg, height: '100%' }}><DesktopNav active="plans" /></div>,
  NavDesktopAvatar: DesktopNavAvatarOpen,
  NavMobile: MobilePage,
  NavMobileAvatar: MobileAvatarOpen,
  NavUtilityExploration: UtilityAccentExploration,
  NavIconCompare: IconCompare,
});

})();
