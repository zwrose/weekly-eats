/* eslint-disable */
// __IIFE_WRAPPED__
(function () {

// User Management (admin) + Pending Approval. Both reached outside the
// normal section nav: user-management via the avatar menu (admin-only),
// pending-approval is the gate a new user sits behind until an admin
// approves them. Same cool-slate utility accent as Food Items + Settings.

const { TopNav, BottomNav } = window.NavChrome;

const C = {
  bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a', sheet: '#1a1e26',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  accent: '#9aa4b3', accentDim: 'rgba(154,164,179,0.16)',
  success: '#8edcb4', successDim: 'rgba(142,220,180,0.14)',
  warn: '#f0c674', warnDim: 'rgba(240,198,116,0.12)',
  danger: '#e87a8a', dangerDim: 'rgba(232,122,138,0.12)',
  admin: '#7aa7ff', adminDim: 'rgba(122,167,255,0.14)',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

// Mock data
const PENDING = [
  { name: 'Maya Patel',    email: 'maya.patel@gmail.com',     reg: 'May 23, 2026' },
  { name: 'Tomás Vargas',  email: 'tomas.v@hey.com',          reg: 'May 22, 2026' },
  { name: 'Aiyana Cloud',  email: 'aiyana.cloud@proton.me',   reg: 'May 21, 2026' },
];
const ACTIVE = [
  { name: 'Zach Rose',     email: 'zach@weeklyeats.app',     admin: true,  self: true },
  { name: 'Sara Rose',     email: 'sara.rose@gmail.com',     admin: true  },
  { name: 'Casey Lin',     email: 'casey.lin@gmail.com',     admin: false },
  { name: 'Jordan Reeves', email: 'jordan.reeves@me.com',    admin: false },
  { name: 'Priya Shah',    email: 'priya@shahworks.co',      admin: false },
  { name: 'Marcus Kim',    email: 'marcus.k@gmail.com',      admin: false },
  { name: 'Lila Okonkwo',  email: 'lila.okonkwo@gmail.com',  admin: false },
  { name: 'Sam Patel',     email: 'sam.patel@outlook.com',   admin: false },
];

// ─── Shared atoms ───────────────────────────────────────────────────────
function MuiIcon({ name, size = 18, color }) {
  return (
    <span className="ms" style={{
      fontSize: size, color: color || 'inherit', lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 24",
    }}>{name}</span>
  );
}

function Avatar({ name, size = 36 }) {
  const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  // Deterministic-ish color tint by first char.
  const hash = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  const hues = ['#5b6d8c', '#8c5b6d', '#6d8c5b', '#8c7a5b'];
  const bg = hues[hash % hues.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${bg}, ${bg}aa)`,
      color: C.ink, fontSize: size * 0.4, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: sans, flexShrink: 0,
    }}>{initials}</div>
  );
}

function StatusPill({ kind, children }) {
  const map = {
    admin:    { color: C.admin,   bg: C.adminDim   },
    user:     { color: C.dim,     bg: 'transparent', border: C.edge },
    pending:  { color: C.warn,    bg: C.warnDim    },
    you:      { color: C.success, bg: C.successDim },
  }[kind];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: map.color, background: map.bg,
      padding: '3px 8px', border: `1px solid ${map.border || map.color + '55'}`,
      borderRadius: 999, fontFamily: sans, whiteSpace: 'nowrap',
    }}>{children}</span>
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

function BackChevron({ label = 'Back' }) {
  return (
    <span style={{ color: C.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: sans, fontSize: 13 }}>
      <MuiIcon name="chevron_left" size={16} />
      {label}
    </span>
  );
}

const btnPrimary = { height: 36, padding: '0 14px', borderRadius: 9, background: C.accent, color: '#0c1118', border: 'none', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
const btnGhost   = { height: 36, padding: '0 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' };

// ─── Action button (small) ─────────────────────────────────────────────
function ActionBtn({ tone, icon, children, onClick }) {
  const map = {
    success: { color: C.success, bg: C.successDim, border: C.success + '66' },
    danger:  { color: C.danger,  bg: C.dangerDim,  border: C.danger + '66' },
    admin:   { color: C.admin,   bg: C.adminDim,   border: C.admin + '66' },
    warn:    { color: C.warn,    bg: C.warnDim,    border: C.warn + '66' },
  }[tone];
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 30, padding: '0 12px',
      background: map.bg, color: map.color,
      border: `1px solid ${map.border}`, borderRadius: 8,
      fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {icon && <MuiIcon name={icon} size={14} />}
      {children}
    </button>
  );
}

// =============================================================================
// MOBILE · USER MANAGEMENT LIST
// =============================================================================
function MobileUserList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ padding: '6px 18px 0' }}><BackChevron /></div>
      <div style={{ padding: '6px 18px 12px' }}>
        <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Users</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
          <span style={{ color: C.warn, fontWeight: 600 }}>{PENDING.length}</span> pending · <span style={{ color: C.accent, fontWeight: 600 }}>{ACTIVE.length}</span> active
        </div>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12 }}>
          <MuiIcon name="search" size={16} color={C.dim} />
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search by name or email…</div>
        </div>
      </div>

      <div style={{ overflowY: 'auto', height: 'calc(100% - 250px)', padding: '0 14px 100px' }}>
        {/* Pending section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px 10px' }}>
          <MuiIcon name="hourglass_empty" size={14} color={C.warn} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>Pending approval · {PENDING.length}</span>
          <div style={{ flex: 1, height: 1, background: C.edge }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {PENDING.map((u) => (
            <div key={u.email} style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <ActionBtn tone="success" icon="check"  >Approve</ActionBtn>
                <ActionBtn tone="danger"  icon="close"  >Deny</ActionBtn>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 11, color: C.mute, alignSelf: 'center' }}>{u.reg}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Active section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px 10px' }}>
          <MuiIcon name="admin_panel_settings" size={14} color={C.admin} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>Active users · {ACTIVE.length}</span>
          <div style={{ flex: 1, height: 1, background: C.edge }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ACTIVE.slice(0, 6).map((u) => (
            <div key={u.email} style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    {u.self && <StatusPill kind="you">You</StatusPill>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <div style={{ fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                </div>
                {u.admin && <StatusPill kind="admin">Admin</StatusPill>}
              </div>
              {!u.self && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {u.admin
                    ? <ActionBtn tone="warn"  icon="remove_moderator">Revoke admin</ActionBtn>
                    : <ActionBtn tone="admin" icon="shield">Make admin</ActionBtn>}
                  <ActionBtn tone="danger" icon="block">Revoke access</ActionBtn>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · CONFIRM SHEET (e.g., grant admin)
// =============================================================================
function MobileConfirm() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ opacity: 0.4, padding: '6px 18px 12px' }}>
        <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Users</div>
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
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Grant admin access?</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 12px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 10 }}>
          <Avatar name="Casey Lin" size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>Casey Lin</div>
            <div style={{ fontSize: 11, color: C.dim }}>casey.lin@gmail.com</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: C.dim, marginTop: 12, lineHeight: 1.45 }}>
          Admins can approve new users, manage other admins, and edit global food items.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button style={{ ...btnGhost, flex: 1, height: 44 }}>Cancel</button>
          <button style={{ ...btnPrimary, flex: 1, height: 44, background: C.admin, color: '#0c1118' }}>Grant admin</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE · PENDING APPROVAL (full-screen, no nav)
// =============================================================================
function MobilePendingApproval() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, position: 'relative', overflow: 'hidden' }}>
      <StatusBar />

      <div style={{ padding: '32px 22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: C.warnDim, color: C.warn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <MuiIcon name="hourglass_empty" size={40} color={C.warn} />
        </div>

        <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 24 }}>
          Hang tight, Maya.
        </div>
        <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: C.warn }}>
          Your account is pending approval.
        </div>

        <div style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.55, marginTop: 16, maxWidth: 320 }}>
          We've notified the Weekly Eats admins. You'll get an email when your access is granted — usually within a day.
        </div>

        <div style={{ marginTop: 32, padding: '14px 16px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, textAlign: 'left', width: '100%', maxWidth: 360, boxSizing: 'border-box' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Signed in as</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name="Maya Patel" size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Maya Patel</div>
              <div style={{ fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>maya.patel@gmail.com</div>
            </div>
          </div>
        </div>

        <button style={{ ...btnGhost, marginTop: 18, height: 42, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MuiIcon name="logout" size={15} />
          Sign out
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · USER MANAGEMENT
// =============================================================================
function DesktopUserList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto' }}>
        <BackChevron />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Users</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>
              <span style={{ color: C.warn, fontWeight: 600 }}>{PENDING.length}</span> pending approval · <span style={{ color: C.accent, fontWeight: 600 }}>{ACTIVE.length}</span> active
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 40, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 12, width: 320 }}>
            <MuiIcon name="search" size={16} color={C.dim} />
            <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search by name or email…</div>
          </div>
        </div>

        {/* Pending */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <MuiIcon name="hourglass_empty" size={16} color={C.warn} />
          <div style={{ fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Pending approval</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.warn, background: C.warnDim, padding: '2px 8px', borderRadius: 999, letterSpacing: '0.06em' }}>{PENDING.length}</span>
        </div>
        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 140px 220px', padding: '12px 22px', borderBottom: `1px solid ${C.edge}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>
            <div>Name</div><div>Email</div><div>Registered</div><div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {PENDING.map((u, i) => (
            <div key={u.email} style={{ display: 'grid', gridTemplateColumns: '320px 1fr 140px 220px', alignItems: 'center', padding: '12px 22px', borderBottom: i < PENDING.length - 1 ? `1px solid ${C.edge}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} size={32} />
                <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{u.name}</div>
              </div>
              <div style={{ fontSize: 13, color: C.dim }}>{u.email}</div>
              <div style={{ fontSize: 13, color: C.dim }}>{u.reg}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <ActionBtn tone="success" icon="check">Approve</ActionBtn>
                <ActionBtn tone="danger"  icon="close">Deny</ActionBtn>
              </div>
            </div>
          ))}
        </div>

        {/* Active */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <MuiIcon name="admin_panel_settings" size={16} color={C.admin} />
          <div style={{ fontFamily: display, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Active users</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.admin, background: C.adminDim, padding: '2px 8px', borderRadius: 999, letterSpacing: '0.06em' }}>{ACTIVE.length}</span>
        </div>
        <div style={{ background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 100px 260px', padding: '12px 22px', borderBottom: `1px solid ${C.edge}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase' }}>
            <div>Name</div><div>Email</div><div>Role</div><div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {ACTIVE.map((u, i) => (
            <div key={u.email} style={{ display: 'grid', gridTemplateColumns: '320px 1fr 100px 260px', alignItems: 'center', padding: '12px 22px', borderBottom: i < ACTIVE.length - 1 ? `1px solid ${C.edge}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} size={32} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{u.name}</div>
                  {u.self && <StatusPill kind="you">You</StatusPill>}
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.dim }}>{u.email}</div>
              <div>{u.admin ? <StatusPill kind="admin">Admin</StatusPill> : <StatusPill kind="user">User</StatusPill>}</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {u.self ? (
                  <span style={{ fontSize: 12, color: C.mute }}>—</span>
                ) : (
                  <>
                    {u.admin
                      ? <ActionBtn tone="warn"  icon="remove_moderator">Revoke admin</ActionBtn>
                      : <ActionBtn tone="admin" icon="shield">Make admin</ActionBtn>}
                    <ActionBtn tone="danger" icon="block">Revoke access</ActionBtn>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · CONFIRM DIALOG
// =============================================================================
function DesktopConfirm() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav />
      <div style={{ padding: '24px 56px 0', maxWidth: 1200, margin: '0 auto', opacity: 0.4, pointerEvents: 'none' }}>
        <div style={{ fontFamily: display, fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>Users</div>
        <div style={{ marginTop: 22, height: 600, background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 14 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 480, background: C.paper, border: `1px solid ${C.edgeHi}`,
        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '22px 24px 0' }}>
          <div style={{ fontFamily: display, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Grant admin access?</div>
        </div>
        <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Avatar name="Casey Lin" size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Casey Lin</div>
            <div style={{ fontSize: 12, color: C.dim }}>casey.lin@gmail.com</div>
          </div>
        </div>
        <div style={{ padding: '12px 24px 0', fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>
          Admins can approve new users, manage other admins, and edit global food items.
        </div>
        <div style={{ padding: '20px 24px 22px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={btnGhost}>Cancel</button>
          <button style={{ ...btnPrimary, background: C.admin }}>Grant admin</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DESKTOP · PENDING APPROVAL
// =============================================================================
function DesktopPendingApproval() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden' }}>
      {/* Slim chrome — no nav, just the wordmark + sign-out (matches main's gated state) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 56px', borderBottom: `1px solid ${C.edge}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {window.NavChrome && React.createElement(window.NavChrome.AppIcon, { size: 28 })}
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Weekly Eats</div>
        </div>
        <button style={{ ...btnGhost, height: 36, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MuiIcon name="logout" size={14} />
          Sign out
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 56px 0', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: C.warnDim, color: C.warn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <MuiIcon name="hourglass_empty" size={56} color={C.warn} />
        </div>

        <div style={{ fontFamily: display, fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', marginTop: 28 }}>
          Hang tight, Maya.
        </div>
        <div style={{ fontFamily: display, fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', color: C.warn }}>
          Your account is pending approval.
        </div>

        <div style={{ fontSize: 15, color: C.dim, lineHeight: 1.55, marginTop: 18, maxWidth: 540 }}>
          We've notified the Weekly Eats admins. You'll get an email when your access is granted — usually within a day.
        </div>

        <div style={{ marginTop: 36, padding: '16px 22px', background: C.paper, border: `1px solid ${C.edge}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14, minWidth: 360 }}>
          <Avatar name="Maya Patel" size={44} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>Signed in as</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 2 }}>Maya Patel</div>
            <div style={{ fontSize: 12, color: C.dim }}>maya.patel@gmail.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  UsersMobileList:    MobileUserList,
  UsersMobileConfirm: MobileConfirm,
  UsersMobilePending: MobilePendingApproval,
  UsersDesktopList:    DesktopUserList,
  UsersDesktopConfirm: DesktopConfirm,
  UsersDesktopPending: DesktopPendingApproval,
});

})();
