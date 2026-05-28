/* eslint-disable */
// __IIFE_WRAPPED__
(function () {

// Shopping Lists — per-store lists with real-time sync, drag-reorder,
// meal-plan import, pantry check, finish-shop flow. Section accent: green.

const { TopNav, BottomNav } = window.NavChrome;

const C = {
  bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a', sheet: '#1a1e26',
  paperPast: '#141619',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  // Shopping section accent
  accent: '#6fcf97', accentDim: 'rgba(111,207,151,0.14)',
  // Cross-section colors
  plans: '#7aa7ff', plansDim: 'rgba(122,167,255,0.14)',
  pantry: '#c79bff', pantryDim: 'rgba(199,155,255,0.14)',
  recipes: '#e8a86b',
  success: '#8edcb4', successDim: 'rgba(142,220,180,0.14)',
  warn: '#f0c674', warnDim: 'rgba(240,198,116,0.12)',
  danger: '#e87a8a', dangerDim: 'rgba(232,122,138,0.12)',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

// Mock stores
const STORES = [
  { id: 's1', emoji: '🛒', name: 'Corner market',     count: 11, sharedWith: ['Sara'], lastShop: '3 days ago' },
  { id: 's2', emoji: '🥬', name: 'Greenleaf',           count: 4,  sharedWith: [],       lastShop: '1 week ago' },
  { id: 's3', emoji: '🍞', name: 'Local bakery',     count: 2,  sharedWith: [],       lastShop: 'Yesterday' },
  { id: 's4', emoji: '🐠', name: 'Asian market',            count: 0,  sharedWith: ['Sara'], lastShop: 'Sunday' },
  { id: 's5', emoji: '🍷', name: 'Wine shop',        count: 1,  sharedWith: [],       lastShop: 'Last month' },
];

const PENDING_INVITE = { storeName: 'Warehouse run', storeEmoji: '📦', from: 'Casey Lin', when: 'Yesterday' };

// Mock shopping list items (Corner market)
const TJ_ITEMS = [
  { id: 'i1',  name: 'bananas',                 qty: 6,    unit: 'each',  checked: false, group: 'produce' },
  { id: 'i2',  name: 'lemons',                  qty: 3,    unit: 'each',  checked: false, group: 'produce' },
  { id: 'i3',  name: 'cilantro',                qty: 1,    unit: 'bunch', checked: false, group: 'produce' },
  { id: 'i4',  name: 'shallots',                qty: 4,    unit: 'each',  checked: false, group: 'produce' },
  { id: 'i5',  name: 'whole milk',              qty: 1,    unit: 'half gallon', checked: false, group: 'dairy' },
  { id: 'i6',  name: 'eggs',                    qty: 1,    unit: 'dozen', checked: false, group: 'dairy' },
  { id: 'i7',  name: 'unsalted butter',         qty: 1,    unit: 'lb',    checked: false, group: 'dairy' },
  { id: 'i8',  name: 'parmesan',                qty: 0.5,  unit: 'lb',    checked: true,  group: 'dairy' },
  { id: 'i9',  name: 'green grapes',            qty: 1,    unit: 'bunch', checked: true,  group: 'produce' },
  { id: 'i10', name: 'spaghetti',               qty: 2,    unit: 'lb',    checked: true,  group: 'dry' },
  { id: 'i11', name: 'coconut milk',            qty: 2,    unit: 'can',   checked: true,  group: 'canned' },
];

const PRESENCE = [
  { name: 'Sara Rose',  initials: 'SR', color: '#8c5b6d' },
];

// ─── Atoms ──────────────────────────────────────────────────────────────
function MuiIcon({ name, size = 18, color }) {
  return (
    <span className="ms" style={{
      fontSize: size, color: color || 'inherit', lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 24",
    }}>{name}</span>
  );
}

function Avatar({ name, size = 28, color = '#5b6d8c' }) {
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${color}, ${color}aa)`,
      color: C.ink, fontSize: size * 0.4, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: sans, flexShrink: 0,
    }}>{initials}</div>
  );
}

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

const btnPrimary = { height: 36, padding: '0 14px', borderRadius: 9, background: C.accent, color: '#0c1a13', border: 'none', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
const btnGhost   = { height: 36, padding: '0 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' };
const btnGhostIcon = { width: 36, height: 36, borderRadius: 9, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' };

// =============================================================================
// MOBILE · STORE LIST (index)
// =============================================================================
function MobileStoreList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ padding: '10px 18px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Shopping</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
            <span style={{ color: C.accent, fontWeight: 600 }}>{STORES.length}</span> stores · <span style={{ color: C.accent, fontWeight: 600 }}>{STORES.reduce((s, x) => s + x.count, 0)}</span> items to buy
          </div>
        </div>
        <button style={{ ...btnPrimary, height: 36, padding: '0 12px', whiteSpace: 'nowrap' }}>+ Store</button>
      </div>

      <div style={{ padding: '0 14px', overflowY: 'auto', height: 'calc(100% - 200px)' }}>
        {/* Pending invitation banner */}
        <div style={{ background: C.warnDim, border: `1px solid ${C.warn}55`, borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>{PENDING_INVITE.storeEmoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.warn, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Invitation</div>
            <div style={{ fontSize: 13.5, color: C.ink, marginTop: 2 }}>{PENDING_INVITE.from} shared <b>{PENDING_INVITE.storeName}</b></div>
          </div>
          <button style={{ width: 30, height: 30, borderRadius: 8, background: C.successDim, color: C.success, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><MuiIcon name="check" size={16} /></button>
          <button style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', color: C.dim, border: `1px solid ${C.edge}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><MuiIcon name="close" size={16} /></button>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', margin: '6px 4px 8px' }}>Your stores</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STORES.map((s) => <StoreCardMobile key={s.id} store={s} />)}
        </div>
      </div>

      {window.NavChrome && React.createElement(window.NavChrome.BottomNav, { active: 'shop' })}
    </div>
  );
}

function StoreCardMobile({ store }) {
  return (
    <div style={{
      background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12,
      padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: C.paperHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{store.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.name}</div>
          {store.sharedWith.length > 0 && <MuiIcon name="group" size={13} color={C.dim} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {store.count > 0 ? (
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{store.count} to buy</span>
          ) : (
            <span style={{ fontSize: 12, color: C.mute }}>List empty</span>
          )}
          <span style={{ fontSize: 11, color: C.mute }}>· last shop {store.lastShop}</span>
        </div>
      </div>
      <span style={{ color: C.dim, fontSize: 14 }}>›</span>
    </div>
  );
}

// =============================================================================
// MOBILE · SHOPPING LIST (the meat — items + presence + sticky actions)
// =============================================================================
function MobileShoppingList() {
  const unchecked = TJ_ITEMS.filter((i) => !i.checked);
  const checked = TJ_ITEMS.filter((i) => i.checked);
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 10px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <MuiIcon name="chevron_left" size={18} /> Stores
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Live pill — confirms real-time connection state. Avatar(s) only, no
              name; status dot communicates connection. See LivePillStates artboard
              for all variants. */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 3px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 999 }}>
            <Avatar name="Sara Rose" size={20} color="#8c5b6d" />
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.success, display: 'inline-block' }} />
          </div>
          <button style={{ ...btnGhostIcon, width: 32, height: 32 }} aria-label="More"><MuiIcon name="more_vert" size={18} /></button>
        </div>
      </div>

      <div style={{ padding: '12px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 30 }}>{STORES[0].emoji}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{STORES[0].name}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
              <span style={{ color: C.accent, fontWeight: 600 }}>{unchecked.length}</span> to buy · {checked.length} in cart
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 14px 100px', overflowY: 'auto', height: 'calc(100% - 240px)' }}>
        {/* Unchecked items */}
        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, overflow: 'hidden' }}>
          {unchecked.map((it, i, arr) => <ItemRowMobile key={it.id} item={it} isLast={i === arr.length - 1} />)}
        </div>
        {/* Add row */}
        <button style={{
          width: '100%', marginTop: 10, padding: '12px 14px',
          background: 'transparent', border: `1px dashed ${C.edgeHi}`, borderRadius: 12,
          color: C.accent, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <MuiIcon name="add" size={16} />
          Add item
        </button>

        {/* Checked items section */}
        {checked.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 4px 10px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>In cart · {checked.length}</span>
              <div style={{ flex: 1, height: 1, background: C.edge }} />
            </div>
            <div style={{ background: C.paperPast, border: `1px solid ${C.edge}`, borderRadius: 12, overflow: 'hidden' }}>
              {checked.map((it, i, arr) => <ItemRowMobile key={it.id} item={it} isLast={i === arr.length - 1} />)}
            </div>
          </>
        )}
      </div>

      {/* Solid finish-shop bar with a hard top edge — no gradient fade, so the
          boundary between scrollable list and the button area is unambiguous. */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 22px', background: C.bg, borderTop: `1px solid ${C.edge}` }}>
        <button style={{
          width: '100%', height: 48, padding: '0 18px',
          background: C.accent, color: '#0c1a13', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <MuiIcon name="done_all" size={18} />
          Finish shop · {checked.length} bought
        </button>
      </div>
    </div>
  );
}

function ItemRowMobile({ item, isLast }) {
  const past = item.checked;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: isLast ? 'none' : `1px solid ${C.edge}`,
      opacity: past ? 0.6 : 1,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: past ? C.accent : 'transparent',
        border: `1.5px solid ${past ? C.accent : C.edgeHi}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {past && <MuiIcon name="check" size={14} color="#0c1a13" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, color: C.ink, fontWeight: 500, textDecoration: past ? 'line-through' : 'none' }}>{item.name}</div>
        <div style={{ fontSize: 11.5, color: C.mute, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{item.qty} {item.unit === 'each' ? 'each' : item.unit}{item.qty !== 1 && item.unit !== 'each' && !item.unit.endsWith('s') ? 's' : ''}</div>
      </div>
      <MuiIcon name="drag_indicator" size={18} color={C.mute} />
    </div>
  );
}

// =============================================================================
// MOBILE · ACTIONS MENU (over the shopping list)
// =============================================================================
function MobileActionsMenu() {
  const items = [
    { icon: 'event_note',  label: 'Import from meal plans', color: C.plans },
    { icon: 'kitchen',     label: 'Check against pantry',   color: C.pantry },
    { icon: 'history',     label: 'Purchase history',       color: C.dim },
    { icon: 'group_add',   label: 'Share this store',       color: C.success, divider: true },
    { icon: 'edit',        label: 'Rename store',           color: C.dim },
    { icon: 'delete',      label: 'Delete store',           color: C.danger },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 10px', borderBottom: `1px solid ${C.edge}` }}>
          <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14 }}><MuiIcon name="chevron_left" size={18} /></button>
          <Avatar name="Sara Rose" size={22} color="#8c5b6d" />
        </div>
        <div style={{ padding: '12px 18px' }}>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700 }}>{STORES[0].name}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
        padding: '12px 0 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 10px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        {items.map((it, i) => (
          <React.Fragment key={it.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', cursor: 'pointer' }}>
              <MuiIcon name={it.icon} size={20} color={it.color} />
              <div style={{ fontSize: 15, color: it.color === C.danger ? C.danger : C.ink, flex: 1 }}>{it.label}</div>
            </div>
            {it.divider && <div style={{ height: 1, background: C.edge, margin: '4px 16px' }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · ITEM EDITOR (add or edit)
// =============================================================================
function MobileItemEditor({ mode = 'add' }) {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>{mode === 'add' ? 'Add item' : 'Edit item'}</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>{mode === 'add' ? 'Add' : 'Save'}</button>
      </div>

      <div style={{ padding: '18px 18px 0', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        {/* Food item search */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Food item</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 44, background: C.paperHi, border: `1px solid ${C.accent}`, boxShadow: `0 0 0 3px ${C.accentDim}`, borderRadius: 12 }}>
          <MuiIcon name="search" size={16} color={C.dim} />
          <div style={{ flex: 1, fontSize: 14.5, color: C.ink }}>{mode === 'add' ? 'shall' : 'shallots'}{mode === 'add' && <span style={{ color: C.accent }}>|</span>}</div>
        </div>

        {/* Autocomplete results (only shown when typing) */}
        {mode === 'add' && (
          <div style={{ marginTop: 8, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: C.accentDim }}>
              <div style={{ fontSize: 14, color: C.ink, flex: 1 }}>shallot</div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.accent }}>↵</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: `1px solid ${C.edge}` }}>
              <div style={{ fontSize: 14, color: C.mute, flex: 1 }}>shallot (already in list)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: `1px solid ${C.edge}` }}>
              <MuiIcon name="add" size={14} color={C.dim} />
              <div style={{ fontSize: 13, color: C.dim, flex: 1 }}>Create "shall"</div>
            </div>
          </div>
        )}

        <div style={{ height: 18 }} />

        {/* Quantity + Unit */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Quantity</div>
            <div style={{ display: 'flex', alignItems: 'center', height: 44, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, padding: '0 4px' }}>
              <button style={{ ...btnGhostIcon, width: 32, height: 32, border: 'none', color: C.dim }}><MuiIcon name="remove" size={16} /></button>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: C.ink }}>{mode === 'add' ? '1' : '4'}</div>
              <button style={{ ...btnGhostIcon, width: 32, height: 32, border: 'none', color: C.dim }}><MuiIcon name="add" size={16} /></button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 44, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12 }}>
              <div style={{ flex: 1, fontSize: 14.5, color: C.ink }}>each</div>
              <MuiIcon name="expand_more" size={16} color={C.dim} />
            </div>
          </div>
        </div>

        {mode === 'edit' && (
          <button style={{
            marginTop: 26, width: '100%', height: 44,
            background: C.dangerDim, color: C.danger,
            border: `1px solid ${C.danger}55`, borderRadius: 10,
            fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <MuiIcon name="delete" size={15} />
            Remove from list
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · IMPORT FROM MEAL PLANS (selection)
// =============================================================================
function MobileImport() {
  const plans = [
    { name: 'Week of May 25', range: 'May 25 – 31', selected: true,  count: 14 },
    { name: 'Week of May 18', range: 'May 18 – 24', selected: false, count: 11 },
    { name: 'Sara · Week of May 25', range: 'May 25 – 31', selected: false, count: 9, shared: 'Sara' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Import from plans</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Import</button>
      </div>
      <div style={{ padding: '18px 18px 0', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 14, lineHeight: 1.45 }}>
          Pull all the food items from these plans into <b style={{ color: C.ink }}>Corner market</b>. We'll merge quantities and ask about unit conflicts.
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Recent plans</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map((p) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: p.selected ? C.accentDim : C.paper, border: `1px solid ${p.selected ? C.accent : C.edge}`, borderRadius: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: p.selected ? C.accent : 'transparent',
                border: `1.5px solid ${p.selected ? C.accent : C.edgeHi}`,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {p.selected && <MuiIcon name="check" size={14} color="#0c1a13" />}
              </div>
              <MuiIcon name="event_note" size={18} color={C.plans} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, color: C.ink }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: C.dim, marginTop: 2 }}>{p.range} · {p.count} items{p.shared ? ` · shared by ${p.shared}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · UNIT CONFLICT (1 of N stepper)
// =============================================================================
function MobileUnitConflict() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4 }}>
        <div style={{ padding: '12px 18px' }}>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700 }}>Importing…</div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
        padding: '12px 22px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 12px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>Unit conflict · 1 of 3</div>
        <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 4 }}>How much olive oil?</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
            <MuiIcon name="event_note" size={14} color={C.plans} />
            <div style={{ flex: 1, fontSize: 13.5, color: C.ink }}>2 tbsp <span style={{ color: C.dim }}>· Week of May 25</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
            <MuiIcon name="event_note" size={14} color={C.plans} />
            <div style={{ flex: 1, fontSize: 13.5, color: C.ink }}>0.25 cup <span style={{ color: C.dim }}>· Sara's plan</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
            <MuiIcon name="shopping_cart" size={14} color={C.accent} />
            <div style={{ flex: 1, fontSize: 13.5, color: C.ink }}>1 cup <span style={{ color: C.dim }}>· already in list</span></div>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: '12px 14px', background: C.accentDim, border: `1px solid ${C.accent}33`, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <MuiIcon name="auto_fix_high" size={14} color={C.accent} />
          <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>
            We can convert these to a single unit. Suggested: <b style={{ color: C.accent }}>1.31 cups</b>.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 10, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Quantity</div>
            <div style={{ display: 'flex', alignItems: 'center', height: 40, background: C.paperHi, border: `1px solid ${C.accent}`, borderRadius: 10, padding: '0 12px', fontSize: 16, fontWeight: 600, color: C.ink }}>1.31</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.accent}`, borderRadius: 10 }}>
              <div style={{ flex: 1, fontSize: 14, color: C.ink }}>cups</div>
              <MuiIcon name="expand_more" size={14} color={C.dim} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button style={{ ...btnGhost, flex: 1, height: 44 }}>‹ Back</button>
          <button style={{ ...btnPrimary, flex: 1.4, height: 44 }}>Next conflict ›</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · PANTRY CHECK
// =============================================================================
function MobilePantryCheck() {
  // skip = remove from the shopping list because it's already in the pantry
  const matches = [
    { name: 'unsalted butter',  list: '1 lb',     skip: true  },
    { name: 'eggs',             list: '1 dozen',  skip: true  },
    { name: 'parmesan',         list: '0.5 lb',   skip: false },
    { name: 'kosher salt',      list: '1 each',   skip: true  },
  ];
  const removing = matches.filter((m) => m.skip).length;
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Pantry check</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Apply</button>
      </div>

      <div style={{ padding: '18px 18px 0', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        {/* Summary banner — explains the running tally */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: C.pantryDim, border: `1px solid ${C.pantry}44`, borderRadius: 12, marginBottom: 16 }}>
          <MuiIcon name="kitchen" size={18} color={C.pantry} />
          <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>
            <b>{matches.length} items</b> on your list are in your pantry. Toggle <i>Skip</i> on the ones you don't need to buy — they'll drop off the list when you apply.
          </div>
        </div>

        {/* Tally pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 999, marginBottom: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: C.danger, display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: C.dim }}>
            <span style={{ color: C.danger, fontWeight: 700 }}>{removing}</span> dropping off · <span style={{ color: C.ink, fontWeight: 600 }}>{matches.length - removing}</span> still on list
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map((m) => (
            <div key={m.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 14px',
              background: m.skip ? C.dangerDim : C.paper,
              border: `1px solid ${m.skip ? C.danger + '55' : C.edge}`,
              borderRadius: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: display, fontSize: 14.5, fontWeight: 700,
                  color: m.skip ? C.mute : C.ink,
                  textDecoration: m.skip ? 'line-through' : 'none',
                }}>{m.name}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
                  {m.list} on list
                </div>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ display: 'inline-flex', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 999, padding: 2 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '5px 11px', borderRadius: 999,
                    background: !m.skip ? C.success : 'transparent',
                    color: !m.skip ? '#0c1a13' : C.dim,
                  }}>Keep</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '5px 11px', borderRadius: 999,
                    background: m.skip ? C.danger : 'transparent',
                    color: m.skip ? '#1a0f0f' : C.dim,
                  }}>Skip</span>
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · CREATE STORE SHEET (with searchable emoji picker, flat grid)
// =============================================================================
function MobileCreateStore() {
  const emojis = [
    '🛒','🥬','🍞','🐠','🍷','🧀','🥩','🌮','🍣','🥕','🍅','📦',
    '🏪','🛍️','🥖','🥨','🥯','🥐','🍕','🍔','🌭','🍟','🥗','🥙',
    '🌯','🥘','🍱','🍙','🍚','🍜','🍝','🍰','🧁','🍮','🍩','🍪',
    '🍯','🥛','🍵','☕','🍺','🥂','🥢','🍇','🍉','🍊','🍋','🍌',
    '🍎','🍐','🍑','🍓','🥝','🥥','🥑','🥦','🥒','🌶','🌽','🥔',
    '🍠','🍆','🧅','🧄','🍄','🍗','🍖','🥓','🦞','🦀','🐟','🥚',
  ];
  const selected = '🥬';
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>New store</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Create</button>
      </div>

      <div style={{ padding: '18px 18px 0', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        {/* Selected preview + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: C.paperHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{selected}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 4 }}>Name</div>
            <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.paperHi, border: `1px solid ${C.accent}`, boxShadow: `0 0 0 3px ${C.accentDim}`, borderRadius: 8, padding: '0 12px' }}>
              <div style={{ flex: 1, fontSize: 14, color: C.ink }}>Greenleaf<span style={{ color: C.accent }}>|</span></div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, marginBottom: 12 }}>
          <MuiIcon name="search" size={16} color={C.dim} />
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search emoji…</div>
        </div>

        {/* Flat emoji grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {emojis.map((e, i) => (
            <button key={`${i}-${e}`} style={{
              width: '100%', aspectRatio: '1', fontSize: 22,
              background: e === selected ? C.accentDim : 'transparent',
              border: `1px solid ${e === selected ? C.accent : 'transparent'}`,
              borderRadius: 8, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{e}</button>
          ))}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · SHARE STORE
// =============================================================================
function MobileShare() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 12px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Share Corner market</div>
        <div style={{ minWidth: 60 }} />
      </div>
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 14, lineHeight: 1.45 }}>
          Invite someone to shop this store with you. They'll see the list in real time and any changes sync instantly.
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Invite by email</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 44, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, padding: '0 14px' }}>
            <div style={{ flex: 1, fontSize: 14, color: C.mute }}>name@example.com</div>
          </div>
          <button style={{ ...btnPrimary, height: 44 }}>Invite</button>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', margin: '20px 0 8px' }}>Shared with</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
          <Avatar name="Sara Rose" size={34} color="#8c5b6d" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>Sara Rose</div>
            <div style={{ fontSize: 11.5, color: C.dim }}>sara.rose@gmail.com</div>
          </div>
          <button style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: `1px solid ${C.edge}`, color: C.danger, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><MuiIcon name="delete" size={14} /></button>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', margin: '20px 0 8px' }}>Pending invitations</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.paper, border: `1px dashed ${C.edge}`, borderRadius: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.warnDim, color: C.warn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <MuiIcon name="hourglass_empty" size={16} color={C.warn} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>jamie.k@gmail.com</div>
            <div style={{ fontSize: 11.5, color: C.dim }}>Invited 2 days ago · awaiting response</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · STORE LIST
// =============================================================================
function DesktopStoreList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Shopping</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>
              <span style={{ color: C.accent, fontWeight: 600 }}>{STORES.length}</span> stores · <span style={{ color: C.accent, fontWeight: 600 }}>{STORES.reduce((s, x) => s + x.count, 0)}</span> items to buy across all
            </div>
          </div>
          <button style={btnPrimary}>+ Add store</button>
        </div>

        {/* Pending invitation banner */}
        <div style={{ background: C.warnDim, border: `1px solid ${C.warn}55`, borderRadius: 14, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>{PENDING_INVITE.storeEmoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.warn, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase' }}>Pending invitation</div>
            <div style={{ fontSize: 14, color: C.ink, marginTop: 4 }}><b>{PENDING_INVITE.from}</b> invited you to <b>{PENDING_INVITE.storeName}</b> · {PENDING_INVITE.when}</div>
          </div>
          <button style={{ ...btnGhost, height: 34, padding: '0 14px' }}>Decline</button>
          <button style={{ ...btnPrimary, height: 34, padding: '0 16px' }}>Accept</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, maxWidth: 360, marginBottom: 16 }}>
          <MuiIcon name="search" size={16} color={C.dim} />
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search stores…</div>
        </div>

        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 140px 180px 140px 90px', padding: '12px 22px', borderBottom: `1px solid ${C.edge}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>
            <div></div><div>Name</div><div>To buy</div><div>Shared with</div><div>Last shop</div><div style={{ textAlign: 'right' }}></div>
          </div>
          {STORES.map((s, i) => (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 140px 180px 140px 90px',
              alignItems: 'center', padding: '14px 22px',
              borderBottom: i < STORES.length - 1 ? `1px solid ${C.edge}` : 'none',
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: 24 }}>{s.emoji}</span>
              <div style={{ fontFamily: display, fontSize: 16, fontWeight: 700, color: C.ink }}>{s.name}</div>
              <div>{s.count > 0
                ? <span style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>{s.count} items</span>
                : <span style={{ fontSize: 13, color: C.mute }}>Empty</span>}
              </div>
              <div style={{ fontSize: 13, color: s.sharedWith.length ? C.ink : C.mute }}>
                {s.sharedWith.length
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MuiIcon name="group" size={14} color={C.dim} />with {s.sharedWith.join(', ')}</span>
                  : 'Just you'}
              </div>
              <div style={{ fontSize: 12, color: C.dim }}>{s.lastShop}</div>
              <div style={{ textAlign: 'right' }}>
                <MuiIcon name="chevron_right" size={18} color={C.dim} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · SHOPPING LIST (focused view with sidebar context)
// =============================================================================
function DesktopShoppingList() {
  const unchecked = TJ_ITEMS.filter((i) => !i.checked);
  const checked = TJ_ITEMS.filter((i) => i.checked);
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden' }}>
      <TopNav active="shop" />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: 'calc(100% - 75px)' }}>
        {/* Sidebar: store list */}
        <div style={{ borderRight: `1px solid ${C.edge}`, padding: '20px 14px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700 }}>Stores</div>
            <button style={{ ...btnGhostIcon, width: 28, height: 28 }} aria-label="Add"><MuiIcon name="add" size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {STORES.map((s, i) => {
              const on = i === 0;
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8,
                  background: on ? C.accentDim : 'transparent',
                  border: on ? `1px solid ${C.accent}55` : '1px solid transparent',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 18 }}>{s.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  </div>
                  {s.count > 0 && <span style={{ fontSize: 11, color: on ? C.accent : C.mute, fontWeight: 600 }}>{s.count}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', padding: '24px 32px 110px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 40 }}>{STORES[0].emoji}</span>
              <div>
                <div style={{ fontFamily: display, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em' }}>{STORES[0].name}</div>
                <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>
                  <span style={{ color: C.accent, fontWeight: 600 }}>{unchecked.length}</span> to buy · {checked.length} in cart
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Presence pill — avatar only, no name. Hover/click shows full list. */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 999 }}>
                <div style={{ display: 'flex' }}>
                  {PRESENCE.map((p) => (
                    <div key={p.name} style={{ border: `2px solid ${C.paper}`, borderRadius: '50%' }}>
                      <Avatar name={p.name} size={26} color={p.color} />
                    </div>
                  ))}
                </div>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: C.success, display: 'inline-block' }} />
              </div>
              <button style={{ ...btnGhost, height: 36, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MuiIcon name="event_note" size={14} color={C.plans} />
                Import from plans
              </button>
              <button style={{ ...btnGhost, height: 36, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MuiIcon name="kitchen" size={14} color={C.pantry} />
                Pantry check
              </button>
              <button style={{ ...btnGhostIcon, width: 36, height: 36 }} aria-label="More"><MuiIcon name="more_vert" size={18} /></button>
            </div>
          </div>

          {/* Unchecked items */}
          <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden' }}>
            {unchecked.map((it, i, arr) => <ItemRowDesktop key={it.id} item={it} isLast={i === arr.length - 1} />)}
          </div>

          {/* Add row */}
          <button style={{
            width: '100%', marginTop: 12, padding: '13px 16px',
            background: 'transparent', border: `1px dashed ${C.edgeHi}`, borderRadius: 12,
            color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <MuiIcon name="add" size={16} />
            Add item
          </button>

          {/* Checked items */}
          {checked.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '22px 4px 10px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>In cart · {checked.length}</span>
                <div style={{ flex: 1, height: 1, background: C.edge }} />
                <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Uncheck all</button>
              </div>
              <div style={{ background: C.paperPast, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden' }}>
                {checked.map((it, i, arr) => <ItemRowDesktop key={it.id} item={it} isLast={i === arr.length - 1} />)}
              </div>
            </>
          )}

          {/* Sticky finish-shop bar \u2014 solid, hard top edge to prevent items\n              from sliding visually behind the button. */}\n          <div style={{ position: 'absolute', left: 280, right: 0, bottom: 0, padding: '14px 32px 22px', background: C.bg, borderTop: `1px solid ${C.edge}`, textAlign: 'right' }}>
            <button style={{
              height: 46, padding: '0 22px',
              background: C.accent, color: '#0c1a13', border: 'none', borderRadius: 12,
              fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <MuiIcon name="done_all" size={18} />
              Finish shop · {checked.length} bought
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemRowDesktop({ item, isLast }) {
  const past = item.checked;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px',
      borderBottom: isLast ? 'none' : `1px solid ${C.edge}`,
      opacity: past ? 0.55 : 1,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: past ? C.accent : 'transparent',
        border: `1.5px solid ${past ? C.accent : C.edgeHi}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        cursor: 'pointer',
      }}>
        {past && <MuiIcon name="check" size={14} color="#0c1a13" />}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10, cursor: 'pointer' }}>
        <div style={{ fontSize: 15, color: C.ink, fontWeight: 500, textDecoration: past ? 'line-through' : 'none' }}>{item.name}</div>
        <div style={{ fontSize: 12.5, color: C.mute, fontVariantNumeric: 'tabular-nums' }}>{item.qty} {item.unit}</div>
      </div>
      <MuiIcon name="drag_indicator" size={18} color={C.mute} />
    </div>
  );
}

// =============================================================================
// DESKTOP · ITEM EDITOR DIALOG
// =============================================================================
function DesktopItemEditor() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Corner market</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 480, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px 4px', borderBottom: `1px solid ${C.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Add item</div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30 }}><MuiIcon name="close" size={14} /></button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Food item</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.accent}`, boxShadow: `0 0 0 3px ${C.accentDim}`, borderRadius: 10 }}>
            <MuiIcon name="search" size={14} color={C.dim} />
            <div style={{ flex: 1, fontSize: 14, color: C.ink }}>shall<span style={{ color: C.accent }}>|</span></div>
          </div>
          <div style={{ marginTop: 6, background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: C.accentDim }}>
              <div style={{ fontSize: 14, color: C.ink, flex: 1 }}>shallot</div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: C.accent }}>↵</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: `1px solid ${C.edge}` }}>
              <div style={{ fontSize: 14, color: C.mute, flex: 1 }}>shallot — already in list</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Quantity</div>
              <div style={{ display: 'flex', alignItems: 'center', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10, padding: '0 4px' }}>
                <button style={{ ...btnGhostIcon, width: 28, height: 28, border: 'none', color: C.dim }}><MuiIcon name="remove" size={14} /></button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>1</div>
                <button style={{ ...btnGhostIcon, width: 28, height: 28, border: 'none', color: C.dim }}><MuiIcon name="add" size={14} /></button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
                <div style={{ flex: 1, fontSize: 14, color: C.ink }}>each</div>
                <MuiIcon name="expand_more" size={14} color={C.dim} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Add to list</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · UNIT CONFLICT DIALOG (1 of 3)
// =============================================================================
function DesktopUnitConflict() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Corner market</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 560, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 24px 4px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>Unit conflict · 1 of 3</div>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 4, marginBottom: 14 }}>How much olive oil?</div>
        </div>

        <div style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
              <MuiIcon name="event_note" size={14} color={C.plans} />
              <div style={{ flex: 1, fontSize: 13.5, color: C.ink }}>2 tbsp</div>
              <div style={{ fontSize: 12, color: C.dim }}>Week of May 25</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
              <MuiIcon name="event_note" size={14} color={C.plans} />
              <div style={{ flex: 1, fontSize: 13.5, color: C.ink }}>0.25 cup</div>
              <div style={{ fontSize: 12, color: C.dim }}>Sara's plan</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
              <MuiIcon name="shopping_cart" size={14} color={C.accent} />
              <div style={{ flex: 1, fontSize: 13.5, color: C.ink }}>1 cup</div>
              <div style={{ fontSize: 12, color: C.dim }}>already in list</div>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: '12px 16px', background: C.accentDim, border: `1px solid ${C.accent}33`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MuiIcon name="auto_fix_high" size={16} color={C.accent} />
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.4 }}>
              Convertible to a single unit. Suggested: <b style={{ color: C.accent }}>1.31 cups</b>.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Quantity</div>
              <div style={{ display: 'flex', alignItems: 'center', height: 40, background: C.paperHi, border: `1px solid ${C.accent}`, borderRadius: 10, padding: '0 12px', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>1.31</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.accent}`, borderRadius: 10 }}>
                <div style={{ flex: 1, fontSize: 14, color: C.ink }}>cups</div>
                <MuiIcon name="expand_more" size={14} color={C.dim} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '14px 24px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={{ ...btnGhost, opacity: 0.5 }}>‹ Back</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost}>Cancel import</button>
            <button style={btnPrimary}>Next conflict ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · FINISH SHOP CONFIRM
// =============================================================================
function DesktopFinishShop() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Corner market</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 460, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        padding: '24px 26px 22px',
      }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentDim, color: C.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <MuiIcon name="done_all" size={28} color={C.accent} />
        </div>
        <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>Finish this shop?</div>
        <div style={{ fontSize: 14, color: C.dim, marginTop: 8, lineHeight: 1.55 }}>
          <b style={{ color: C.ink }}>3 items</b> in cart will be saved to <b style={{ color: C.ink }}>Corner market</b> purchase history and cleared from the list. <b style={{ color: C.accent }}>{TJ_ITEMS.filter((i) => !i.checked).length} items</b> remain.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Save trip</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LIVE PILL · STATES (reference artboard)
// Maps to the connection states from useShoppingSync:
//   'connecting' | 'connected' | 'disconnected' | 'suspended' | 'failed'
// plus presence (activeUsers list, excluding self).
// =============================================================================
function LivePillStates() {
  const pill = (children, extraStyle) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px 3px 3px',
      background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 999,
      ...extraStyle,
    }}>{children}</div>
  );
  const dot = (color) => <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />;
  const stacked = (avatars) => (
    <div style={{ display: 'inline-flex', paddingLeft: 4 }}>
      {avatars.map((a, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? -4 : -8, border: `2px solid ${C.paper}`, borderRadius: '50%' }}>
          <Avatar name={a.name} size={20} color={a.color} />
        </div>
      ))}
    </div>
  );

  const rows = [
    {
      label: 'Connected · alone',
      desc: 'You\u2019re the only one viewing this list. Green dot confirms you\u2019re live.',
      pill: pill(
        <>
          <span style={{ paddingLeft: 4, fontSize: 11, color: C.dim, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live</span>
          {dot(C.success)}
        </>
      ),
    },
    {
      label: 'Connected · 1 other shopper',
      desc: 'Avatar disc shows who else is here. Green dot = real-time sync active.',
      pill: pill(
        <>
          <Avatar name="Sara Rose" size={20} color="#8c5b6d" />
          {dot(C.success)}
        </>,
        { padding: '3px 8px 3px 3px' }
      ),
    },
    {
      label: 'Connected · 2+ shoppers',
      desc: 'Avatars stack with a 2px paper-color outline. Past 3 we\u2019d show “+N\u201d.',
      pill: pill(
        <>
          {stacked([
            { name: 'Sara Rose', color: '#8c5b6d' },
            { name: 'Casey Lin', color: '#5b6d8c' },
          ])}
          {dot(C.success)}
        </>,
        { padding: '3px 8px 3px 0' }
      ),
    },
    {
      label: 'Connecting',
      desc: 'Initial open or transition. Amber pulsing dot + label.',
      pill: pill(
        <>
          <span style={{ paddingLeft: 4, fontSize: 11, color: C.warn, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Connecting…</span>
          {dot(C.warn)}
        </>
      ),
    },
    {
      label: 'Disconnected / suspended',
      desc: 'Red dot + label. Tappable — fires the manual reconnect from <code>useShoppingSync.reconnect()</code>.',
      pill: pill(
        <>
          <span style={{ paddingLeft: 4, fontSize: 11, color: C.danger, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Offline</span>
          {dot(C.danger)}
        </>,
        { borderColor: C.danger + '55', background: C.dangerDim }
      ),
    },
    {
      label: 'Failed',
      desc: 'Auth error or unrecoverable. Red dot + Retry affordance.',
      pill: pill(
        <>
          <span style={{ paddingLeft: 4, fontSize: 11, color: C.danger, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sync failed</span>
          <button style={{ background: C.danger, color: '#1a0f0f', border: 'none', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </>,
        { borderColor: C.danger + '55', background: C.dangerDim }
      ),
    },
  ];

  return (
    <div style={{ width: '100%', height: '100%', background: '#191b21', padding: 26, fontFamily: sans, color: C.ink, overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Live pill · states</div>
      <div style={{ fontSize: 12.5, color: C.dim, marginTop: 4, marginBottom: 18, lineHeight: 1.45 }}>
        The connection + presence pill in the shopping list header. Maps to the
        connection states from <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3 }}>useShoppingSync</code>.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', alignItems: 'center', gap: 16, padding: '14px 16px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>{r.pill}</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, fontFamily: display, letterSpacing: '-0.01em' }}>{r.label}</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 3, lineHeight: 1.45 }} dangerouslySetInnerHTML={{ __html: r.desc }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · PANTRY CHECK DIALOG (mirrors mobile)
// =============================================================================
function DesktopPantryCheck() {
  const matches = [
    { name: 'unsalted butter',  list: '1 lb',     skip: true  },
    { name: 'eggs',             list: '1 dozen',  skip: true  },
    { name: 'parmesan',         list: '0.5 lb',   skip: false },
    { name: 'kosher salt',      list: '1 each',   skip: true  },
  ];
  const removing = matches.filter((m) => m.skip).length;
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Corner market</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 560, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Pantry check</div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30 }}><MuiIcon name="close" size={14} /></button>
        </div>

        <div style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: C.pantryDim, border: `1px solid ${C.pantry}44`, borderRadius: 12, marginBottom: 14 }}>
            <MuiIcon name="kitchen" size={18} color={C.pantry} />
            <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.45 }}>
              <b>{matches.length} items</b> on your list are in your pantry. Pick which ones to skip.
            </div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 999, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: C.danger, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: C.dim }}>
              <span style={{ color: C.danger, fontWeight: 700 }}>{removing}</span> dropping off · <span style={{ color: C.ink, fontWeight: 600 }}>{matches.length - removing}</span> still on list
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matches.map((m) => (
              <div key={m.name} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px',
                background: m.skip ? C.dangerDim : C.paperHi,
                border: `1px solid ${m.skip ? C.danger + '55' : C.edge}`,
                borderRadius: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: display, fontSize: 14, fontWeight: 700,
                    color: m.skip ? C.mute : C.ink,
                    textDecoration: m.skip ? 'line-through' : 'none',
                  }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>{m.list} on list</div>
                </div>
                <label style={{ display: 'inline-flex', cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{ display: 'inline-flex', background: C.bg, border: `1px solid ${C.edge}`, borderRadius: 999, padding: 2 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '5px 11px', borderRadius: 999,
                      background: !m.skip ? C.success : 'transparent',
                      color: !m.skip ? '#0c1a13' : C.dim,
                    }}>Keep</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '5px 11px', borderRadius: 999,
                      background: m.skip ? C.danger : 'transparent',
                      color: m.skip ? '#1a0f0f' : C.dim,
                    }}>Skip</span>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · CREATE STORE DIALOG (mirrors mobile, with searchable emoji grid)
// =============================================================================
function DesktopCreateStore() {
  const emojis = [
    '🛒','🥬','🍞','🐠','🍷','🧀','🥩','🌮','🍣','🥕','🍅','📦',
    '🏪','🛍️','🥖','🥨','🥯','🥐','🍕','🍔','🌭','🍟','🥗','🥙',
    '🌯','🥘','🍱','🍙','🍚','🍜','🍝','🍰','🧁','🍮','🍩','🍪',
    '🍯','🥛','🍵','☕','🍺','🥂','🥢','🍇','🍉','🍊','🍋','🍌',
    '🍎','🍐','🍑','🍓','🥝','🥥','🥑','🥦','🥒','🌶','🌽','🥔',
    '🍠','🍆','🧅','🧄','🍄','🍗','🍖','🥓','🦞','🦀','🐟','🥚',
  ];
  const selected = '🥬';
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Shopping</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 520, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>New store</div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30 }}><MuiIcon name="close" size={14} /></button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 12, marginBottom: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>{selected}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Name</div>
              <div style={{ display: 'flex', alignItems: 'center', height: 36, background: C.bg, border: `1px solid ${C.accent}`, boxShadow: `0 0 0 3px ${C.accentDim}`, borderRadius: 8, padding: '0 12px' }}>
                <div style={{ flex: 1, fontSize: 14, color: C.ink }}>Greenleaf<span style={{ color: C.accent }}>|</span></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, marginBottom: 12 }}>
            <MuiIcon name="search" size={16} color={C.dim} />
            <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search emoji…</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
            {emojis.map((e, i) => (
              <button key={`${i}-${e}`} style={{
                width: '100%', aspectRatio: '1', fontSize: 22,
                background: e === selected ? C.accentDim : 'transparent',
                border: `1px solid ${e === selected ? C.accent : 'transparent'}`,
                borderRadius: 8, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Create store</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · ITEM EDITOR DIALOG (edit mode — with Remove button)
// =============================================================================
function DesktopItemEditorEdit() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Corner market</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 480, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px 4px', borderBottom: `1px solid ${C.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Edit item</div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30 }}><MuiIcon name="close" size={14} /></button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Food item</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
            <div style={{ flex: 1, fontSize: 14, color: C.ink }}>shallots</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Quantity</div>
              <div style={{ display: 'flex', alignItems: 'center', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10, padding: '0 4px' }}>
                <button style={{ ...btnGhostIcon, width: 28, height: 28, border: 'none', color: C.dim }}><MuiIcon name="remove" size={14} /></button>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>4</div>
                <button style={{ ...btnGhostIcon, width: 28, height: 28, border: 'none', color: C.dim }}><MuiIcon name="add" size={14} /></button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 6 }}>Unit</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
                <div style={{ flex: 1, fontSize: 14, color: C.ink }}>each</div>
                <MuiIcon name="expand_more" size={14} color={C.dim} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '14px 22px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={{
            height: 36, padding: '0 14px',
            background: 'transparent', border: `1px solid rgba(232,122,138,0.35)`,
            color: C.danger, borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <MuiIcon name="delete" size={14} />
            Remove from list
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost}>Cancel</button>
            <button style={btnPrimary}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · IMPORT FROM MEAL PLANS DIALOG (mirrors mobile)
// =============================================================================
function DesktopImport() {
  const plans = [
    { name: 'Week of May 25', range: 'May 25 – 31', selected: true,  count: 14 },
    { name: 'Week of May 18', range: 'May 18 – 24', selected: false, count: 11 },
    { name: "Sara · Week of May 25", range: 'May 25 – 31', selected: false, count: 9, shared: 'Sara' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Corner market</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 540, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Import from meal plans</div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30 }}><MuiIcon name="close" size={14} /></button>
        </div>
        <div style={{ padding: '18px 24px' }}>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 14, lineHeight: 1.5 }}>
            Pull food items from these plans into <b style={{ color: C.ink }}>Corner market</b>. We'll merge quantities and ask about unit conflicts.
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Recent plans</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plans.map((p) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: p.selected ? C.accentDim : C.paperHi, border: `1px solid ${p.selected ? C.accent : C.edge}`, borderRadius: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: p.selected ? C.accent : 'transparent',
                  border: `1.5px solid ${p.selected ? C.accent : C.edgeHi}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {p.selected && <MuiIcon name="check" size={14} color="#0c1a13" />}
                </div>
                <MuiIcon name="event_note" size={18} color={C.plans} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, color: C.ink }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: C.dim, marginTop: 2 }}>{p.range} · {p.count} items{p.shared ? ` · shared by ${p.shared}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: `1px solid ${C.edge}`, background: C.paperHi }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Import</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · SHARE STORE DIALOG (mirrors mobile)
// =============================================================================
function DesktopShare() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="shop" />
      <div style={{ padding: '24px 56px 0', maxWidth: 1100, margin: '0 auto', opacity: 0.35, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Corner market</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 540, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${C.edge}` }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Share Corner market</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>Real-time sync — invitees see and edit the list as you do.</div>
          </div>
          <button style={{ ...btnGhostIcon, width: 30, height: 30 }}><MuiIcon name="close" size={14} /></button>
        </div>
        <div style={{ padding: '18px 24px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Invite by email</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10, padding: '0 14px' }}>
              <div style={{ flex: 1, fontSize: 14, color: C.mute }}>name@example.com</div>
            </div>
            <button style={btnPrimary}>Invite</button>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Shared with</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.paperHi, border: `1px solid ${C.edge}`, borderRadius: 10, marginBottom: 16 }}>
            <Avatar name="Sara Rose" size={34} color="#8c5b6d" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>Sara Rose</div>
              <div style={{ fontSize: 11.5, color: C.dim }}>sara.rose@gmail.com</div>
            </div>
            <button style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: `1px solid ${C.edge}`, color: C.danger, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><MuiIcon name="delete" size={14} /></button>
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Pending</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.paperHi, border: `1px dashed ${C.edge}`, borderRadius: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.warnDim, color: C.warn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <MuiIcon name="hourglass_empty" size={16} color={C.warn} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>jamie.k@gmail.com</div>
              <div style={{ fontSize: 11.5, color: C.dim }}>Invited 2 days ago · awaiting response</div>
            </div>
            <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ShoppingMobileStores:    MobileStoreList,
  ShoppingMobileList:      MobileShoppingList,
  ShoppingMobileActions:   MobileActionsMenu,
  ShoppingMobileEditor:    () => <MobileItemEditor mode="add" />,
  ShoppingMobileEditorEdit:() => <MobileItemEditor mode="edit" />,
  ShoppingMobileImport:    MobileImport,
  ShoppingMobileConflict:  MobileUnitConflict,
  ShoppingMobilePantry:    MobilePantryCheck,
  ShoppingMobileCreate:    MobileCreateStore,
  ShoppingMobileShare:     MobileShare,
  ShoppingPillStates:      LivePillStates,
  ShoppingDesktopStores:   DesktopStoreList,
  ShoppingDesktopList:     DesktopShoppingList,
  ShoppingDesktopEditor:   DesktopItemEditor,
  ShoppingDesktopEditorEdit: DesktopItemEditorEdit,
  ShoppingDesktopPantry:   DesktopPantryCheck,
  ShoppingDesktopCreate:   DesktopCreateStore,
  ShoppingDesktopImport:   DesktopImport,
  ShoppingDesktopShare:    DesktopShare,
  ShoppingDesktopConflict: DesktopUnitConflict,
  ShoppingDesktopFinish:   DesktopFinishShop,
});

})();
