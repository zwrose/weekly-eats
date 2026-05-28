/* eslint-disable */
// __IIFE_WRAPPED__
(function () {


const { TopNav, BottomNav } = window.NavChrome;
// Settings — just theme. The default-meal-plan-owner setting from main is
// not in scope (per product decision: not a supported use case). Uses the
// cool-slate accent for the utility cluster (Food Items / Settings / User Mgmt).

const C = {
  bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a', sheet: '#1a1e26',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  accent: '#9aa4b3', accentDim: 'rgba(154,164,179,0.16)',
  success: '#8edcb4', danger: '#e87a8a',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

// ---- shared chrome ---------------------------------------------------------
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
function Breadcrumb({ size = 'desktop' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: size === 'desktop' ? 13 : 12, color: C.dim, fontFamily: sans }}>
      <span style={{ color: C.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 500, 'opsz' 20" }}>chevron_left</span> Back</span>
    </div>
  );
}

// ---- theme option card -----------------------------------------------------
// Small preview swatches communicate the theme. A radio dot anchors the choice.
function ThemeOption({ id, label, sub, selected }) {
  const preview = {
    light: { bg: '#fafaf7', card: '#ffffff', text: '#1a1d23', accent: '#2a6fdb' },
    dark:  { bg: '#0f1115', card: '#181b21', text: '#e7e9ee', accent: '#7aa7ff' },
    system: 'split',
  }[id];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px',
      background: selected ? C.accentDim : C.paper,
      border: `1px solid ${selected ? C.accent : C.edge}`,
      borderRadius: 12,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${selected ? C.accent : C.edgeHi}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />}
      </div>

      {/* Preview swatch */}
      <div style={{
        width: 64, height: 40, borderRadius: 6, overflow: 'hidden',
        border: `1px solid ${C.edge}`, flexShrink: 0, position: 'relative',
      }}>
        {preview === 'split' ? (
          <>
            <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(0 0, 100% 0, 0 100%)', background: '#fafaf7' }}>
              <div style={{ position: 'absolute', top: 6, left: 6, width: 22, height: 5, background: '#ffffff', borderRadius: 2, boxShadow: `0 0 0 1px rgba(0,0,0,0.06)` }} />
              <div style={{ position: 'absolute', top: 14, left: 6, width: 14, height: 3, background: '#1a1d23', borderRadius: 2 }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', background: '#0f1115' }}>
              <div style={{ position: 'absolute', bottom: 6, right: 6, width: 22, height: 5, background: '#181b21', borderRadius: 2 }} />
              <div style={{ position: 'absolute', bottom: 14, right: 6, width: 14, height: 3, background: '#e7e9ee', borderRadius: 2 }} />
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, transparent 49.5%, rgba(255,255,255,0.18) 49.5%, rgba(255,255,255,0.18) 50.5%, transparent 50.5%)' }} />
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: preview.bg, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 6, left: 6, right: 6, height: 5, background: preview.card, borderRadius: 2, boxShadow: id === 'light' ? `0 0 0 1px rgba(0,0,0,0.06)` : 'none' }} />
            <div style={{ position: 'absolute', top: 14, left: 6, width: 18, height: 3, background: preview.text, borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: 14, left: 28, width: 10, height: 3, background: preview.accent, borderRadius: 2 }} />
            <div style={{ position: 'absolute', top: 22, left: 6, right: 6, height: 12, background: preview.card, borderRadius: 2, boxShadow: id === 'light' ? `0 0 0 1px rgba(0,0,0,0.06)` : 'none' }} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: selected ? 600 : 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.dim, marginTop: 2, lineHeight: 1.35 }}>{sub}</div>}
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE
// =============================================================================
function MobileSettings() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ padding: '6px 18px 0' }}><Breadcrumb size="mobile" /></div>
      <div style={{ padding: '6px 18px 18px' }}>
        <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</div>
      </div>

      <div style={{ padding: '0 18px', overflowY: 'auto', height: 'calc(100% - 200px)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 10 }}>Theme</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
          <ThemeOption id="dark" label="Dark" sub="The default. Easy on the eyes for evening meal prep." selected />
          <ThemeOption id="light" label="Light" sub="Brighter. Best in daylight." />
          <ThemeOption id="system" label="System" sub="Follow your phone's appearance setting." />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

// =============================================================================
// DESKTOP
// =============================================================================
function DesktopSettings() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 760, margin: '0 auto' }}>
        <Breadcrumb />
        <div style={{ marginTop: 8, marginBottom: 28 }}>
          <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Settings</div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 12 }}>Theme</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <ThemeOption id="dark" label="Dark" sub="The default." selected />
          <ThemeOption id="light" label="Light" sub="Best in daylight." />
          <ThemeOption id="system" label="System" sub="Follow OS setting." />
        </div>
      </div>
    </div>
  );
}

// ---- exports ---------------------------------------------------------------
Object.assign(window, {
  SettingsMobile: MobileSettings,
  SettingsDesktop: DesktopSettings,
});

})();
