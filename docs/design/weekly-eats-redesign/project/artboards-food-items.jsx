/* eslint-disable */
// __IIFE_WRAPPED__
(function () {


const { TopNav, BottomNav } = window.NavChrome;
  // Food Items — management surface. Mirrors src/app/food-items/page.tsx and
  // AddFoodItemDialog.tsx. Faithful re-theme. Reached from the avatar menu,
  // not a top-level section. Uses the cool-slate utility accent.

  const C = {
    bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a', sheet: '#1a1e26',
    ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
    edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
    accent: '#9aa4b3', accentDim: 'rgba(154,164,179,0.16)',
    success: '#8edcb4', successDim: 'rgba(142,220,180,0.14)',
    danger: '#e87a8a'
  };
  const display = `'Bricolage Grotesque', system-ui, sans-serif`;
  const sans = `'Outfit', system-ui, sans-serif`;

  // Material Symbols icons — match MUI imports in main (Delete, Tune).
  const TrashIcon = ({ size = 14 }) =>
  <span className="ms" style={{ fontSize: size + 4, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span>;

  const FilterIcon = ({ size = 14 }) =>
  <span className="ms" style={{ fontSize: size + 4, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>tune</span>;


  // ---- mock data ------------------------------------------------------------
  // Mix of global (system + shared-by-you) + personal items. Order matches the
  // table sort (name asc).
  const ITEMS = [
  { name: 'all-purpose flour', singular: 'all-purpose flour', plural: 'all-purpose flour', unit: 'cup', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'apple', singular: 'apple', plural: 'apples', unit: 'each', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'avocado', singular: 'avocado', plural: 'avocados', unit: 'each', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'bay leaf', singular: 'bay leaf', plural: 'bay leaves', unit: 'each', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'black pepper', singular: 'black pepper', plural: 'black pepper', unit: 'tsp', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'butter', singular: 'butter', plural: 'butter', unit: 'tbsp', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'castelvetrano olive', singular: 'castelvetrano olive', plural: 'castelvetrano olives', unit: 'each', access: 'private', created: 'May 12, 2026' },
  { name: 'coconut milk', singular: 'coconut milk', plural: 'coconut milk', unit: 'can', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'cremini mushroom', singular: 'cremini mushroom', plural: 'cremini mushrooms', unit: 'oz', access: 'shared-by-you', created: 'Apr 3, 2026' },
  { name: 'egg', singular: 'egg', plural: 'eggs', unit: 'each', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'fish sauce', singular: 'fish sauce', plural: 'fish sauce', unit: 'tbsp', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'garlic', singular: 'garlic clove', plural: 'garlic cloves', unit: 'clove', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'gochugaru', singular: 'gochugaru', plural: 'gochugaru', unit: 'tsp', access: 'private', created: 'May 22, 2026' },
  { name: 'kosher salt', singular: 'kosher salt', plural: 'kosher salt', unit: 'tsp', access: 'shared-by-others', created: 'Jul 8, 2024' },
  { name: 'lemon', singular: 'lemon', plural: 'lemons', unit: 'each', access: 'shared-by-others', created: 'Jul 8, 2024' }];


  // ---- shared chrome --------------------------------------------------------
  function StatusBar() {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px 4px', fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: sans }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 6, opacity: .85, fontSize: 11 }}>
        <span>●●●</span><span>📶</span><span>100%</span>
      </span>
    </div>);

  }
  // Breadcrumb shown above the page title — Food Items is a sub-page.
  function Breadcrumb({ size = 'desktop' }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: size === 'desktop' ? 13 : 12, color: C.dim, fontFamily: sans }}>
      <span style={{ color: C.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 500, 'opsz' 20" }}>chevron_left</span> Back</span>
    </div>);

  }

  const btnPrimary = { height: 38, padding: '0 16px', borderRadius: 10, background: C.accent, color: '#0c1118', border: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
  const btnGhost = { height: 38, padding: '0 16px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' };
  const btnGhostIcon = { width: 36, height: 36, borderRadius: 10, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 16, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

  function AccessChip({ access, size = 'sm' }) {
    const map = {
      'private': { label: 'Private', color: C.dim },
      'shared-by-you': { label: 'Shared by you', color: C.success },
      'shared-by-others': { label: 'Shared by others', color: C.accent }
    }[access];
    return (
      <span style={{
        fontSize: size === 'lg' ? 11 : 10, fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: map.color,
        padding: size === 'lg' ? '4px 10px' : '3px 8px',
        border: `1px solid ${C.edge}`, borderRadius: 999,
        fontFamily: sans, whiteSpace: 'nowrap'
      }}>{map.label}</span>);

  }

  // =============================================================================
  // MOBILE · LIST
  // =============================================================================
  function MobileList() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ padding: '6px 18px 0' }}><Breadcrumb size="mobile" /></div>
      <div style={{ padding: '6px 18px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Food items</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4, whiteSpace: 'nowrap' }}>
            <span style={{ color: C.accent, fontWeight: 600 }}>248</span> in catalog · <span style={{ color: C.success, fontWeight: 600 }}>2</span> personal
          </div>
        </div>
        <button style={{ ...btnPrimary, height: 36, padding: '0 12px', whiteSpace: 'nowrap' }}>+ Add</button>
      </div>
      <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search food items…</div>
        </div>
        <button style={btnGhostIcon} aria-label="Filter" data-comment-anchor="77ecb7347f-button-144-9"><FilterIcon size={15} /></button>
      </div>
      <div style={{ overflowY: 'auto', height: 'calc(100% - 280px)', padding: '0 14px' }}>
        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, overflow: 'hidden' }}>
          {ITEMS.slice(0, 12).map((it, i, arr) =>
            <div key={it.name} style={{
              padding: '12px 14px',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.edge}` : 'none'
            }}>
              <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{it.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <AccessChip access={it.access} />
                <span style={{ fontSize: 11, color: C.mute }}>· {it.unit}</span>
                <span style={{ fontSize: 11, color: C.mute, marginLeft: 'auto' }}>›</span>
              </div>
            </div>
            )}
        </div>
        <div style={{ height: 100 }} />
      </div>
      <BottomNav />
    </div>);

  }

  // =============================================================================
  // MOBILE · FILTER SHEET
  // =============================================================================
  function MobileFilterSheet() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4 }}>
        <div style={{ padding: '6px 18px 0' }}><Breadcrumb size="mobile" /></div>
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Food items</div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
          boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
          padding: '12px 20px 26px'
        }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 10px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit' }}>Reset</button>
          <div style={{ fontFamily: display, fontSize: 16, fontWeight: 700 }}>Filter</div>
          <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontFamily: 'inherit', fontWeight: 600 }}>Done</button>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 10 }}>Access level</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['all', 'All', null],
            ['private', 'Private', 'private'],
            ['shared-by-you', 'Shared by you', 'shared-by-you'],
            ['shared-by-others', 'Shared by others', 'shared-by-others']].
            map(([val, label, accessKey], i) =>
            <div key={val} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: i === 0 ? C.accentDim : C.paper,
              border: i === 0 ? `1px solid ${C.accent}` : `1px solid ${C.edge}`,
              borderRadius: 10
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `1.5px solid ${i === 0 ? C.accent : C.edgeHi}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {i === 0 && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />}
              </div>
              <div style={{ fontSize: 14, color: C.ink, flex: 1 }}>{label}</div>
              {accessKey && <AccessChip access={accessKey} />}
            </div>
            )}
        </div>
      </div>
    </div>);

  }

  // =============================================================================
  // MOBILE · VIEW (full-screen page)
  // =============================================================================
  function MobileView() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>‹ Back</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Food item</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Edit</button>
      </div>

      <div style={{ padding: '18px 20px', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>garlic</div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <AccessChip access="shared-by-others" />
        </div>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 0, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden' }}>
          {[
            ['Default name', 'garlic'],
            ['Singular name', 'garlic clove'],
            ['Plural name', 'garlic cloves'],
            ['Typical usage unit', 'clove'],
            ['Created', 'Jul 8, 2024'],
            ['Last updated', 'Jul 8, 2024']].
            map(([k, v], i, arr) =>
            <div key={k} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${C.edge}` : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 14, color: C.ink, marginTop: 4 }}>{v}</div>
            </div>
            )}
        </div>
      </div>
    </div>);

  }

  // =============================================================================
  // MOBILE · EDIT (full-screen)
  // =============================================================================
  function MobileEdit() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Edit · garlic</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Save</button>
      </div>

      <div style={{ padding: '18px 18px 100px', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        <Field label="Default name" value="garlic" />
        <Field label="Singular name" value="garlic clove" helper="Used when referring to 1 item" />
        <Field label="Plural name" value="garlic cloves" helper="Used when referring to multiple items" />
        <Field label="Typical usage unit" value="clove" select />

        <div style={{ marginTop: 20, padding: '14px 16px', background: C.accentDim, border: `1px solid ${C.accent}33`, borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.accent, textTransform: 'uppercase', marginBottom: 4 }}>Global</div>
          <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.4 }}>This item is shared with everyone. Global items cannot be made personal.</div>
        </div>

        <button style={{
            marginTop: 22, width: '100%', height: 44,
            background: 'rgba(232,122,138,0.12)', color: C.danger,
            border: `1px solid rgba(232,122,138,0.35)`, borderRadius: 10,
            fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
          <TrashIcon size={14} />
          Delete food item
        </button>
      </div>
    </div>);

  }

  function Field({ label, value, helper, select }) {
    return (
      <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 12px', height: 40,
          background: C.paperHi, border: `1px solid ${C.edgeHi}`,
          borderRadius: 10
        }}>
        <div style={{ flex: 1, fontSize: 14, color: C.ink }}>{value}</div>
        {select && <span style={{ color: C.dim, fontSize: 12 }}>▾</span>}
      </div>
      {helper && <div style={{ fontSize: 11, color: C.mute, marginTop: 4 }}>{helper}</div>}
    </div>);

  }

  // =============================================================================
  // MOBILE · EDIT · admin viewing personal item (make-global toggle visible)
  // =============================================================================
  function MobileEditAdmin() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Edit · castelvetrano olive</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Save</button>
      </div>

      <div style={{ padding: '18px 18px 100px', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        <Field label="Default name" value="castelvetrano olive" />
        <Field label="Singular name" value="castelvetrano olive" helper="Used when referring to 1 item" />
        <Field label="Plural name" value="castelvetrano olives" helper="Used when referring to multiple items" />
        <Field label="Typical usage unit" value="each (each)" select />

        <div style={{ marginTop: 8, padding: '14px 16px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Toggle on={false} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>Make this item global</div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>Admin</span>
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 3, lineHeight: 1.4 }}>Available to all users. <b style={{ color: '#f0c674' }}>Cannot be undone.</b></div>
          </div>
        </div>

        <button style={{
            marginTop: 22, width: '100%', height: 44,
            background: 'rgba(232,122,138,0.12)', color: C.danger,
            border: `1px solid rgba(232,122,138,0.35)`, borderRadius: 10,
            fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
          <TrashIcon size={14} />
          Delete food item
        </button>
      </div>
    </div>);

  }

  // =============================================================================
  // MOBILE · ADD (default / unit-not-each)
  // =============================================================================

  function MobileDelete() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4, padding: '6px 18px 12px' }}>
        <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Food items</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
          boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
          padding: '12px 20px 28px'
        }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 10px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Delete this food item?</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
          You're about to delete <b style={{ color: C.ink }}>castelvetrano olive</b>. This can't be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button style={{ ...btnGhost, flex: 1, height: 44 }}>Cancel</button>
          <button style={{
              flex: 1, height: 44, border: 'none', borderRadius: 10,
              background: C.danger, color: '#1a0f0f', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
            <TrashIcon size={14} />
            Delete
          </button>
        </div>
      </div>
    </div>);

  }

  // =============================================================================
  // MOBILE · MAKE GLOBAL CONFIRM (bottom sheet)
  // =============================================================================
  function MobileMakeGlobal() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
          <span style={{ color: C.dim, fontSize: 14, minWidth: 60 }}>Cancel</span>
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Edit · castelvetrano olive</div>
          <span style={{ color: C.accent, fontSize: 14, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>Save</span>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />

      <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
          boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
          padding: '12px 20px 28px'
        }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 10px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Make global?</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
          Once <b style={{ color: C.ink }}>castelvetrano olive</b> is global, every user will see it in their catalog and you <b style={{ color: '#f0c674' }}>won't be able to make it personal again</b>.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button style={{ ...btnGhost, flex: 1, height: 44 }}>Cancel</button>
          <button style={{ ...btnPrimary, flex: 1, height: 44 }}>Make global</button>
        </div>
      </div>
    </div>);

  }

  // =============================================================================
  // DESKTOP · LIST
  // =============================================================================
  function DesktopList() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto' }}>
        <Breadcrumb />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Food items</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>
              <span style={{ color: C.accent, fontWeight: 600 }}>248</span> in catalog · <span style={{ color: C.success, fontWeight: 600 }}>2</span> personal
            </div>
          </div>
          <button style={btnPrimary}>+ Add food item</button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, maxWidth: 360 }}>
            <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
            <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search food items…</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, minWidth: 200 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>Access</span>
            <span style={{ flex: 1, fontSize: 13, color: C.ink, textAlign: 'right' }}>All</span>
            <span style={{ color: C.dim, fontSize: 12 }}>▾</span>
          </div>
        </div>

        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 200px 140px 160px 90px', padding: '12px 22px', borderBottom: `1px solid ${C.edge}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>
            <div>Name</div>
            <div>Access</div>
            <div>Unit</div>
            <div>Created</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {ITEMS.slice(0, 13).map((it, i, arr) =>
            <div key={it.name} style={{
              display: 'grid', gridTemplateColumns: '1.6fr 200px 140px 160px 90px',
              alignItems: 'center', padding: '12px 22px',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.edge}` : 'none',
              cursor: 'pointer'
            }}>
              <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{it.name}</div>
              <div><AccessChip access={it.access} /></div>
              <div style={{ fontSize: 13, color: C.dim }}>{it.unit}</div>
              <div style={{ fontSize: 13, color: C.dim }}>{it.created}</div>
              <div style={{ textAlign: 'right' }}>
                <button style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: `1px solid ${C.edge}`, color: C.danger, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Delete">
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, fontSize: 12, color: C.dim }}>
          <div>Showing 1–13 of 248</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ ...btnGhost, height: 32, padding: '0 10px', fontSize: 12 }}>‹</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 12px', fontSize: 12, background: C.accentDim, color: C.accent, borderColor: C.accent }}>1</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 12px', fontSize: 12 }}>2</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 12px', fontSize: 12 }}>3</button>
            <button style={{ ...btnGhost, height: 32, padding: '0 10px', fontSize: 12 }}>›</button>
          </div>
        </div>
      </div>
    </div>);

  }

  // =============================================================================
  // DESKTOP · VIEW DIALOG (read mode)
  // =============================================================================
  function DesktopView() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto', opacity: 0.4, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Food items</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 620, background: C.paper, border: `1px solid ${C.edgeHi}`,
          borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.edge}` }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>garlic</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <AccessChip access="shared-by-others" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...btnGhost, height: 34, padding: '0 14px' }}>Edit</button>
            <button style={{ ...btnGhostIcon, width: 34, height: 34, fontSize: 14 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
          {[
            ['Default name', 'garlic'],
            ['Typical usage unit', 'clove'],
            ['Singular name', 'garlic clove'],
            ['Plural name', 'garlic cloves'],
            ['Created', 'Jul 8, 2024 · 9:32 AM'],
            ['Last updated', 'Jul 8, 2024 · 9:32 AM']].
            map(([k, v]) =>
            <div key={k}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 14, color: C.ink, marginTop: 4 }}>{v}</div>
            </div>
            )}
        </div>
      </div>
    </div>);

  }

  // =============================================================================
  // DESKTOP · EDIT DIALOG (admin, personal item, "make global" toggle visible)
  // =============================================================================
  function DesktopEdit() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto', opacity: 0.4, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Food items</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 620, background: C.paper, border: `1px solid ${C.edgeHi}`,
          borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Edit · castelvetrano olive</div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30, fontSize: 14 }}>✕</button>
        </div>

        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 14px' }}>
            <DesktopField label="Default name" value="castelvetrano olive" />
            <DesktopField label="Typical usage unit" value="each (each)" select />
            <DesktopField label="Singular name" value="castelvetrano olive" />
            <DesktopField label="Plural name" value="castelvetrano olives" />
          </div>

          <div style={{ marginTop: 18, padding: '14px 16px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
            <Toggle on={false} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>Make this item global</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>Available to all users. <b style={{ color: C.warn || '#f0c674' }}>Cannot be undone.</b></div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>Admin</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={{
              height: 38, padding: '0 14px',
              background: 'transparent', border: `1px solid rgba(232,122,138,0.35)`,
              color: C.danger, borderRadius: 10, fontSize: 14, fontFamily: 'inherit',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8
            }}>
            <TrashIcon size={13} />
            Delete
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost}>Cancel</button>
            <button style={btnPrimary}>Save</button>
          </div>
        </div>
      </div>
    </div>);

  }

  function DesktopField({ label, value, select }) {
    return (
      <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 12px', height: 38,
          background: C.paperHi, border: `1px solid ${C.edgeHi}`,
          borderRadius: 10
        }}>
        <div style={{ flex: 1, fontSize: 14, color: C.ink }}>{value}</div>
        {select && <span style={{ color: C.dim, fontSize: 12 }}>▾</span>}
      </div>
    </div>);

  }
  function Toggle({ on }) {
    return (
      <div style={{
        width: 36, height: 22, borderRadius: 999,
        background: on ? C.accent : 'rgba(255,255,255,0.10)',
        position: 'relative', flexShrink: 0,
        border: `1px solid ${on ? C.accent : C.edge}`
      }}>
      <div style={{
          position: 'absolute', top: 2, left: on ? 16 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: on ? '#0c1118' : C.ink
        }} />
    </div>);

  }

  // =============================================================================
  // DESKTOP · MAKE GLOBAL CONFIRM
  // =============================================================================

  function DesktopMakeGlobal() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto', opacity: 0.3, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Food items</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />

      <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 460, background: C.paper, border: `1px solid ${C.edgeHi}`,
          borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
        <div style={{ padding: '22px 24px 4px' }}>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Make global?</div>
        </div>

        <div style={{ padding: '12px 24px 4px', fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>
          Once <b>castelvetrano olive</b> is global, every user will see it in their catalog and you <b style={{ color: '#f0c674' }}>won't be able to make it personal again</b>.
        </div>

        <div style={{ padding: '18px 24px 22px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Yes, make global</button>
        </div>
      </div>
    </div>);

  }

  // =============================================================================
  // DESKTOP · FILTER MENU (anchored dropdown)
  // =============================================================================
  function DesktopFilter() {
    const opts = [
      { val: 'all', label: 'All', accessKey: null,                selected: true },
      { val: 'private', label: 'Private', accessKey: 'private',   selected: false },
      { val: 'shared-by-you', label: 'Shared by you', accessKey: 'shared-by-you', selected: false },
      { val: 'shared-by-others', label: 'Shared by others', accessKey: 'shared-by-others', selected: false },
    ];
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto', opacity: 0.5, pointerEvents: 'none' }}>
        <Breadcrumb />
        <div style={{ marginTop: 8, marginBottom: 22 }}>
          <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Food items</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
          <div style={{ flex: 1, height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, maxWidth: 360 }} />
          <div style={{ width: 200, height: 40, background: C.paperHi, border: `1px solid ${C.accent}`, borderRadius: 12 }} />
        </div>
        <div style={{ height: 400, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>

      {/* Dropdown anchored to the Access selector */}
      <div style={{
          position: 'absolute', top: 184, right: 'calc(50% - 580px + 56px)', width: 240,
          background: C.paper, border: `1px solid ${C.edgeHi}`,
          borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          padding: 6, zIndex: 5,
        }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', padding: '8px 12px 6px' }}>Access level</div>
        {opts.map((o) =>
        <div key={o.val} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 8,
            background: o.selected ? C.accentDim : 'transparent',
            cursor: 'pointer',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: `1.5px solid ${o.selected ? C.accent : C.edgeHi}`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {o.selected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent }} />}
            </div>
            <div style={{ fontSize: 13.5, color: C.ink, flex: 1 }}>{o.label}</div>
            {o.accessKey && <AccessChip access={o.accessKey} />}
          </div>
        )}
      </div>
    </div>);

  }

  // =============================================================================
  // DESKTOP · DELETE CONFIRM DIALOG
  // =============================================================================
  function DesktopDelete() {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Food items</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 460, background: C.paper, border: `1px solid ${C.edgeHi}`,
          borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          padding: '22px 24px 20px',
        }}>
        <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Delete food item</div>
        <div style={{ fontSize: 14, color: C.dim, marginTop: 10, lineHeight: 1.55 }}>
          You're about to delete <b style={{ color: C.ink }}>castelvetrano olive</b>. This can't be undone.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button style={btnGhost}>Cancel</button>
          <button style={{ ...btnPrimary, background: C.danger, color: '#1a0f0f', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <TrashIcon size={13} />
            Delete
          </button>
        </div>
      </div>
    </div>);

  }

  // ---- exports ---------------------------------------------------------------
  Object.assign(window, {
    FIMobileList: MobileList,
    FIMobileFilter: MobileFilterSheet,
    FIMobileView: MobileView,
    FIMobileEdit: MobileEdit,
    FIMobileEditAdmin: MobileEditAdmin,
    FIMobileDelete: MobileDelete,
    FIMobileMakeGlobal: MobileMakeGlobal,
    FIDesktopList: DesktopList,
    FIDesktopFilter: DesktopFilter,
    FIDesktopView: DesktopView,
    FIDesktopEdit: DesktopEdit,
    FIDesktopDelete: DesktopDelete,
    FIDesktopMakeGlobal: DesktopMakeGlobal
  });

})();