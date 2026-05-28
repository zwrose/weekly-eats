/* eslint-disable */
// Pantry surfaces — faithful re-theme. No new features.
// Mirrors src/app/pantry/page.tsx: search, list of food items, add dialog, delete confirm.
// __IIFE_WRAPPED__
(function () {


const { TopNav, BottomNav } = window.NavChrome;
const C = {
  bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a', sheet: '#1a1e26',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  accent: '#c79bff', accentDim: 'rgba(199,155,255,0.16)',
  danger: '#e87a8a',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

const ITEMS = [
  'all-purpose flour', 'balsamic vinegar', 'bay leaves', 'black beans',
  'black pepper', 'brown sugar', 'chickpeas', 'coconut milk', 'diced tomatoes',
  'dried oregano', 'eggs', 'fish sauce', 'garlic', 'ginger', 'granulated sugar',
  'ground cumin', 'honey', 'kosher salt', 'lemons', 'neutral oil', 'olive oil',
  'panko breadcrumbs', 'parmesan', 'red pepper flakes', 'rolled oats',
  'russet potatoes', 'shallots', 'smoked paprika', 'soy sauce', 'spaghetti',
  'tomato paste', 'unsalted butter', 'vanilla extract', 'white rice',
  'white wine vinegar', 'whole milk', 'yellow onions',
];

// ---- shared chrome --------------------------------------------------------
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
const btnGhostIcon = { width: 36, height: 36, borderRadius: 10, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 16, fontFamily: 'inherit', cursor: 'pointer' };
const btnPrimary = { height: 38, padding: '0 16px', borderRadius: 10, background: C.accent, color: '#1a0f24', border: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
const btnGhost = { height: 38, padding: '0 16px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' };

function Kicker({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accent, fontFamily: sans }}>{children}</div>;
}

// =============================================================================
// MOBILE · LIST
// =============================================================================
function MobileList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ padding: '14px 18px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em' }}>Pantry</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}><span style={{ color: C.accent, fontWeight: 600 }}>{ITEMS.length}</span> items</div>
        </div>
        <button style={{ ...btnPrimary, height: 36, padding: '0 12px' }}>+ Add</button>
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search your pantry…</div>
        </div>
      </div>
      <div style={{ overflowY: 'auto', height: 'calc(100% - 270px)', padding: '0 14px 100px' }}>
        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, overflow: 'hidden' }}>
          {ITEMS.map((name, i) => (
            <div key={name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              borderBottom: i < ITEMS.length - 1 ? `1px solid ${C.edge}` : 'none',
            }}>
              <div style={{ flex: 1, fontSize: 14, color: C.ink }}>{name}</div>
              <button style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}><span className="ms" style={{ fontSize: 17, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

// =============================================================================
// MOBILE · ADD DIALOG (full-screen on mobile per responsiveDialogStyle)
// =============================================================================
function MobileAdd() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Add pantry item</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Add</button>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Food item</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 42, background: C.paperHi, border: `1px solid ${C.accent}`, boxShadow: `0 0 0 3px ${C.accentDim}`, borderRadius: 12 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
          <div style={{ flex: 1, fontSize: 14, color: C.ink }}>cori<span style={{ color: C.accent }}>|</span></div>
        </div>

        <div style={{ marginTop: 10, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, overflow: 'hidden' }}>
          {[
            { name: 'coriander seeds', state: 'add', hi: true },
            { name: 'ground coriander', state: 'add' },
            { name: 'fresh cilantro (coriander)', state: 'already' },
          ].map((r, i, arr) => (
            <div key={r.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 14px',
              background: r.hi ? C.accentDim : 'transparent',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.edge}` : 'none',
            }}>
              <div style={{ flex: 1, fontSize: 14, color: r.state === 'already' ? C.mute : C.ink }}>{r.name}</div>
              {r.state === 'already'
                ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.mute, textTransform: 'uppercase' }}>Already in pantry</span>
                : <span style={{ fontSize: 11, color: r.hi ? C.accent : C.dim, fontWeight: 600 }}>↵</span>}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: `1px solid ${C.edge}` }}>
            <span style={{ fontSize: 14, color: C.dim }}>＋</span>
            <div style={{ flex: 1, fontSize: 13, color: C.dim }}>Create "<span style={{ color: C.ink }}>cori</span>"</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · DELETE CONFIRM
// =============================================================================
function MobileDelete() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4 }}>
        <div style={{ padding: '14px 18px 12px' }}>
          <div style={{ fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em' }}>Pantry</div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
        padding: '12px 20px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 10px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Remove pantry item</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
          Are you sure you want to remove <b style={{ color: C.ink }}>olive oil</b> from your pantry?
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button style={{ ...btnGhost, flex: 1, height: 44 }}>Cancel</button>
          <button style={{ ...btnPrimary, flex: 1, height: 44, background: C.danger, color: '#1a0f0f' }}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · LIST
// =============================================================================
function DesktopList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden' }}>
      <TopNav active="pantry" />
      <div style={{ padding: '28px 56px 0', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Pantry</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}><span style={{ color: C.accent, fontWeight: 600 }}>{ITEMS.length}</span> items</div>
          </div>
          <button style={btnPrimary}>+ Add item</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search your pantry…</div>
        </div>

        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', padding: '12px 22px', borderBottom: `1px solid ${C.edge}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>
            <div>Food item</div>
            <div style={{ textAlign: 'right' }}>Remove</div>
          </div>
          {ITEMS.slice(0, 14).map((name, i, arr) => (
            <div key={name} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px',
              alignItems: 'center', padding: '12px 22px',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.edge}` : 'none',
            }}>
              <div style={{ fontSize: 14, color: C.ink }}>{name}</div>
              <div style={{ textAlign: 'right' }}>
                <button style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: `1px solid ${C.edge}`, color: C.danger, cursor: 'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center' }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ ...btnGhost, height: 32, padding: '0 10px', fontSize: 12 }}>‹</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 12px', fontSize: 12, background: C.accentDim, color: C.accent, borderColor: C.accent }}>1</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 12px', fontSize: 12 }}>2</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 12px', fontSize: 12 }}>3</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 10px', fontSize: 12 }}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · ADD DIALOG
// =============================================================================
function DesktopAdd() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="pantry" />
      <div style={{ padding: '28px 56px 0', maxWidth: 900, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Pantry</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 460, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Add pantry item</div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30, fontSize: 14 }}>✕</button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Food item</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 42, background: C.paperHi, border: `1px solid ${C.accent}`, boxShadow: `0 0 0 3px ${C.accentDim}`, borderRadius: 10 }}>
            <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
            <div style={{ flex: 1, fontSize: 14, color: C.ink }}>cori<span style={{ color: C.accent }}>|</span></div>
          </div>

          <div style={{ marginTop: 10, background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
            {[
              { name: 'coriander seeds', state: 'add', hi: true },
              { name: 'ground coriander', state: 'add' },
              { name: 'fresh cilantro (coriander)', state: 'already' },
            ].map((r, i, arr) => (
              <div key={r.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: r.hi ? C.accentDim : 'transparent',
                borderBottom: i < arr.length - 1 ? `1px solid ${C.edge}` : 'none',
              }}>
                <div style={{ flex: 1, fontSize: 14, color: r.state === 'already' ? C.mute : C.ink }}>{r.name}</div>
                {r.state === 'already'
                  ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.mute, textTransform: 'uppercase' }}>Already in pantry</span>
                  : <span style={{ fontSize: 11, color: r.hi ? C.accent : C.dim, fontWeight: 600 }}>↵</span>}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: `1px solid ${C.edge}` }}>
              <span style={{ fontSize: 14, color: C.dim }}>＋</span>
              <div style={{ flex: 1, fontSize: 13, color: C.dim }}>Create "<span style={{ color: C.ink }}>cori</span>"</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Add</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · DELETE CONFIRM DIALOG
// =============================================================================
function DesktopDelete() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav />
      <div style={{ padding: '28px 56px 0', maxWidth: 900, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Pantry</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 440, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        padding: '22px 24px 20px',
      }}>
        <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Remove pantry item</div>
        <div style={{ fontSize: 14, color: C.dim, marginTop: 10, lineHeight: 1.5 }}>
          Are you sure you want to remove <b style={{ color: C.ink }}>olive oil</b> from your pantry?
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button style={btnGhost}>Cancel</button>
          <button style={{ ...btnPrimary, background: C.danger, color: '#1a0f0f' }}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ---- exports ---------------------------------------------------------------
Object.assign(window, {
  MobileList, MobileAdd, MobileDelete,
  DesktopList, DesktopAdd, DesktopDelete,
});
})();
