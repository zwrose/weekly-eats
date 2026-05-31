/* eslint-disable */
// Desktop · Meal plans index + create + template + sharing surfaces.
// __IIFE_WRAPPED__
(function () {


const { TopNav, BottomNav } = window.NavChrome;
const C = {
  bg:'#0f1115', paper:'#181b21', paperHi:'#1e222a', paperPast:'#141619',
  ink:'#e7e9ee', dim:'#9097a6', mute:'#5b6170', inkPast:'#7b818f',
  edge:'rgba(255,255,255,0.07)', edgeHi:'rgba(255,255,255,0.13)',
  accent:'#7aa7ff', accentDim:'rgba(122,167,255,0.16)',
  staples:'#c4a7e7', danger:'#e87a8a',
  success:'#8edcb4', successDim:'rgba(142,220,180,0.14)',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans    = `'Outfit', system-ui, sans-serif`;
const SECTION = { B: '#e8c97a', L: '#8edcb4', D: '#f0a08a' };

// ---- shared chrome ------------------------------------------------------
function BellDropdown() {
  return (
    <div style={{
      position:'absolute', right:0, top:'calc(100% + 6px)', width:320,
      background: C.paper, border:`1px solid ${C.edge}`, borderRadius:12,
      boxShadow:'0 16px 40px rgba(0,0,0,0.5)', padding:6, zIndex:10,
    }}>
      <div style={{ padding:'8px 10px 6px', fontSize:11, fontWeight:700, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase' }}>
        Invitations · 2
      </div>
      <InviteCardSmall name="Sara Rose" sub="meal plans" />
      <InviteCardSmall name="Casey Lin" sub="Corner market shopping list" />
      <button style={{ width:'100%', background:'transparent', border:'none', color: C.dim, fontSize:12, padding:'8px 10px', fontFamily:'inherit', textAlign:'left' }}>See all in You ›</button>
    </div>
  );
}
function InviteCardSmall({ name, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8 }}>
      <div style={{ width:28, height:28, borderRadius:'50%', background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11 }}>{name[0]}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color: C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name} <span style={{ color: C.dim }}>shared</span></div>
        <div style={{ fontSize:11, color: C.dim }}>{sub}</div>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        <button style={iconBtnSuccess}>✓</button>
        <button style={iconBtnDanger}>✕</button>
      </div>
    </div>
  );
}
const iconBtnSuccess = { width:24, height:24, borderRadius:6, background: C.successDim, color: C.success, border:'none', cursor:'pointer', fontSize:12, fontWeight:700 };
const iconBtnDanger  = { width:24, height:24, borderRadius:6, background:'rgba(232,122,138,0.12)', color: C.danger, border:'none', cursor:'pointer', fontSize:12, fontWeight:700 };

const btnGhost = { height:38, padding:'0 16px', borderRadius:10, background:'transparent', border:`1px solid ${C.edge}`, color: C.ink, fontSize:14, cursor:'pointer', fontFamily:'inherit' };
const btnGhostIcon = { height:38, width:38, borderRadius:10, background:'transparent', border:`1px solid ${C.edge}`, color: C.ink, fontSize:16, cursor:'pointer', fontFamily:'inherit' };
const btnPrimary = { height:38, padding:'0 18px', borderRadius:10, background: C.accent, color:'#0c1118', border:'none', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' };

function PageShell({ children, hasBell, bellOpen }) {
  return (
    <div style={{ width:'100%', height:'100%', background: C.bg, color: C.ink, fontFamily: sans, overflow:'hidden', position:'relative' }}>
      <TopNav hasBell={hasBell} bellOpen={bellOpen} />
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 32px 32px' }}>
        {children}
      </div>
    </div>
  );
}

// ---- meal-plan row ------------------------------------------------------
function PlanRow({ name, dateRange, sharedBy, current, onClick }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      padding:'14px 18px',
      background: C.paper, borderRadius:12,
      border: current ? `1px solid ${C.accent}55` : `1px solid transparent`,
      boxShadow: current ? `0 0 0 3px rgba(122,167,255,0.06)` : 'none',
      cursor:'pointer',
    }}>
      <div style={{ width:40, height:40, borderRadius:10, background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontFamily: display, fontWeight:700 }}>📅</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
          <div style={{ fontFamily: display, fontSize:16, fontWeight:700, color: C.ink }}>{name}</div>
          {current && <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: C.accent, background:'rgba(122,167,255,0.10)', padding:'2px 6px', borderRadius:999 }}>CURRENT</span>}
          {sharedBy && <span style={{ fontSize:11, color: C.dim }}>Shared by {sharedBy}</span>}
        </div>
        <div style={{ fontSize:12, color: C.dim, marginTop:2 }}>{dateRange}</div>
      </div>
      <div style={{ fontSize:12, color: C.dim }}>›</div>
    </div>
  );
}

// ============================================================================
// SHARING INVITATIONS — three options shown as different artboards
// ============================================================================

// OPTION 1 · INLINE BANNER (closest to current pattern)
function InviteBannerOption() {
  return (
    <PageShell>
      <div style={{ padding:'24px 0 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontFamily: display, fontSize:30, fontWeight:700, letterSpacing:'-0.02em' }}>Your plans</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button style={btnGhostIcon}>⚙</button>
          <button style={btnGhostIcon}>↗</button>
          <button style={btnPrimary}>+ New plan</button>
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: C.paper, border:`1px solid ${C.accent}55`, borderRadius:12,
        padding:'14px 18px', marginBottom:18,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', color: C.accent, textTransform:'uppercase' }}>Invitations</span>
          <span style={{ fontSize:11, color: C.dim }}>2 pending</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <InviteCardLarge name="Sara Rose" email="sara@example.com" what="Meal plans" />
          <InviteCardLarge name="Casey Lin" email="casey@example.com" what="Corner market shopping list" />
        </div>
      </div>

      <PlansBlock />
    </PageShell>
  );
}
function InviteCardLarge({ name, email, what }) {
  return (
    <div style={{ background: C.paperHi, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{name[0]}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color: C.ink, fontWeight:600 }}>{name}</div>
        <div style={{ fontSize:11, color: C.dim }}>invited you to <span style={{ color: C.ink }}>{what}</span></div>
      </div>
      <button style={{ ...btnGhost, height:32, padding:'0 12px', fontSize:13, color: C.success, borderColor: C.successDim }}>Accept</button>
      <button style={{ ...btnGhost, height:32, padding:'0 12px', fontSize:13, color: C.dim }}>Decline</button>
    </div>
  );
}

function PlansBlock() {
  return (
    <>
      <SectionLabel>Current</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
        <PlanRow name="Week of May 11" dateRange="May 11 – 17, 2026" current />
        <PlanRow name="Week of May 18" dateRange="May 18 – 24, 2026" />
      </div>
      <SectionLabel>Shared with you</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
        <PlanRow name="Sara's week of May 11" dateRange="May 11 – 17, 2026" sharedBy="Sara Rose" />
      </div>
      <SectionLabel>Past · last 6 weeks</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <PlanRow name="Week of May 4" dateRange="May 4 – 10, 2026" />
        <PlanRow name="Week of Apr 27" dateRange="Apr 27 – May 3, 2026" />
        <PlanRow name="Week of Apr 20" dateRange="Apr 20 – 26, 2026" />
      </div>
      <div style={{ padding:'12px 4px 0', textAlign:'right' }}>
        <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', padding:0 }}>View older →</button>
      </div>
    </>
  );
}
function SectionLabel({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase' }}>{children}</div>
      <div style={{ flex:1, height:1, background: C.edge }} />
    </div>
  );
}

// OPTION 2 · BELL DROPDOWN in top-nav (notification-style)
function InviteBellOption() {
  return (
    <PageShell hasBell bellOpen>
      <div style={{ padding:'24px 0 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontFamily: display, fontSize:30, fontWeight:700, letterSpacing:'-0.02em' }}>Your plans</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button style={btnGhostIcon}>⚙</button>
          <button style={btnGhostIcon}>↗</button>
          <button style={btnPrimary}>+ New plan</button>
        </div>
      </div>
      <PlansBlock />
    </PageShell>
  );
}

// OPTION 3 · DEDICATED PANEL — right sidebar on the index page
function InviteSidebarOption() {
  return (
    <PageShell>
      <div style={{ padding:'24px 0 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontFamily: display, fontSize:30, fontWeight:700, letterSpacing:'-0.02em' }}>Your plans</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button style={btnGhostIcon}>⚙</button>
          <button style={btnGhostIcon}>↗</button>
          <button style={btnPrimary}>+ New plan</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:24, alignItems:'flex-start' }}>
        <div><PlansBlock /></div>
        <aside>
          <div style={{
            background: C.paper, borderRadius:12, padding:'14px 16px',
            border:`1px solid ${C.edge}`, position:'sticky', top:14,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', color: C.accent, textTransform:'uppercase' }}>Invitations</span>
              <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color: C.accent, background: C.accentDim, padding:'2px 6px', borderRadius:999 }}>2</span>
            </div>
            <InviteCardSidebar name="Sara Rose" what="meal plans" />
            <div style={{ borderTop:`1px solid ${C.edge}`, margin:'10px 0' }} />
            <InviteCardSidebar name="Casey Lin" what="Corner market shopping list" />
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
function InviteCardSidebar({ name, what }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12 }}>{name[0]}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, color: C.ink, fontWeight:600 }}>{name}</div>
          <div style={{ fontSize:11, color: C.dim }}>{what}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button style={{ ...btnGhost, height:30, padding:'0 12px', fontSize:12, flex:1, color: C.success, borderColor: C.successDim }}>Accept</button>
        <button style={{ ...btnGhost, height:30, padding:'0 12px', fontSize:12, color: C.dim }}>Decline</button>
      </div>
    </div>
  );
}

// ============================================================================
// INDEX (chosen option will be merged in — banner shown as default for now)
// ============================================================================
function IndexPage() {
  return (
    <PageShell>
      <div style={{ padding:'24px 0 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <div style={{ fontFamily: display, fontSize:30, fontWeight:700, letterSpacing:'-0.02em' }}>Your plans</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button style={btnGhostIcon} title="Template settings">⚙</button>
          <button style={{ ...btnGhostIcon, position:'relative' }} title="Sharing">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign:'middle' }}>
              <circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 12 C2 9, 4 8, 6 8 C8 8, 10 9, 10 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M11 12 C11 10, 12.5 9, 14 9 C15.5 9, 16.5 10, 16.5 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
            <DotBadge />
          </button>
          <button style={btnPrimary}>+ New plan</button>
        </div>
      </div>
      <PlansBlock />
    </PageShell>
  );
}

function DotBadge() {
  return (
    <span style={{
      position:'absolute', top:8, right:8,
      width:8, height:8, borderRadius:'50%',
      background: C.accent, border:`2px solid ${C.bg}`,
    }} />
  );
}

// ============================================================================
// CREATE PLAN DIALOG
// ============================================================================
function CreateDialog() {
  return (
    <PageShell>
      <div style={{ padding:'24px 0 18px' }}>
        <div style={{ fontFamily: display, fontSize:30, fontWeight:700, letterSpacing:'-0.02em' }}>Your plans</div>
      </div>
      {/* dim background */}
      <div style={{ opacity:0.4 }}>
        <PlansBlock />
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', zIndex:5 }} />
      <div style={{
        position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)',
        width:560, background: C.paper, borderRadius:16, zIndex:6,
        border:`1px solid ${C.edge}`, boxShadow:'0 24px 60px rgba(0,0,0,0.5)',
        overflow:'hidden', fontFamily: sans,
      }}>
        <div style={{ padding:'18px 22px 14px', borderBottom:`1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize:18, fontWeight:700 }}>New meal plan</div>
        </div>
        <div style={{ padding:'18px 22px' }}>
          <FieldLabel>Start date</FieldLabel>
          <div style={{ display:'flex', gap:8, marginBottom:6 }}>
            <DateChip label="May 18, 2026" selected />
            <DateChip label="May 25" />
            <DateChip label="Pick…" />
          </div>
          <div style={{ fontSize:11, color: C.dim, marginTop:6 }}>Next Monday — your template's start day.</div>

          <div style={{ marginTop:14, padding:'10px 12px', background: C.successDim, color: C.success, borderRadius:8, fontSize:12 }}>
            ✓ No overlap. Plan covers May 18 – 24.
          </div>
        </div>
        <div style={{ padding:'12px 22px', borderTop:`1px solid ${C.edge}`, display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button style={btnGhost}>Cancel</button>
          <button style={btnPrimary}>Create plan</button>
        </div>
      </div>
    </PageShell>
  );
}
function FieldLabel({ children, mt }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', marginBottom:8, marginTop: mt ? 16 : 0 }}>{children}</div>;
}
function DateChip({ label, selected }) {
  return (
    <button style={{
      height:36, padding:'0 14px',
      background: selected ? C.accentDim : 'transparent',
      border:`1px solid ${selected ? C.accent : C.edge}`,
      color: selected ? C.accent : C.ink,
      borderRadius:8, fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
    }}>{label}</button>
  );
}
function OwnerOption({ label, sub, selected, tag }) {
  return (
    <label style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 12px',
      background: selected ? C.accentDim : 'transparent',
      border:`1px solid ${selected ? C.accent+'55' : C.edge}`, borderRadius:10,
      cursor:'pointer',
    }}>
      <div style={{ width:16, height:16, borderRadius:'50%', border:`1.5px solid ${selected ? C.accent : C.edgeHi}`, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
        {selected && <div style={{ width:9, height:9, borderRadius:'50%', background: C.accent }} />}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, color: C.ink, fontWeight: selected ? 600 : 500 }}>{label}</div>
        <div style={{ fontSize:11, color: C.dim, marginTop:1 }}>{sub}</div>
      </div>
      {tag && <span style={{ fontSize:10, color: C.dim, padding:'2px 6px', border:`1px solid ${C.edge}`, borderRadius:4 }}>{tag}</span>}
    </label>
  );
}

// ============================================================================
// TEMPLATE SETTINGS
// ============================================================================
function TemplatePage() {
  return (
    <PageShell>
      <div style={{ padding:'24px 0 18px', display:'flex', alignItems:'baseline', gap:14 }}>
        <button style={{ ...btnGhost, height:30, padding:'0 12px', fontSize:13, color: C.accent, borderColor:'transparent' }}>‹ Plans</button>
        <div>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color: C.accent }}>Template</div>
          <div style={{ fontFamily: display, fontSize:30, fontWeight:700, marginTop:6, letterSpacing:'-0.02em' }}>Your default plan shape</div>
          <div style={{ fontSize:13, color: C.dim, marginTop:6 }}>Applied when you create a new meal plan.</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'flex-start' }}>
        <div style={{ background: C.paper, borderRadius:14, padding:'18px 20px' }}>
          <FieldLabel>Week starts on</FieldLabel>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <DateChip key={d} label={d} selected={d==='Mon'} />
            ))}
          </div>
          <FieldLabel mt>Meals to plan</FieldLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <ToggleRow label="Breakfast" color={SECTION.B} on />
            <ToggleRow label="Lunch"     color={SECTION.L} on />
            <ToggleRow label="Dinner"    color={SECTION.D} on />
          </div>
        </div>
        <div style={{ background: C.paper, borderRadius:14, padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <FieldLabel>Default staples</FieldLabel>
            <button style={{ ...btnGhost, height:30, padding:'0 10px', fontSize:12 }}>✎ Edit</button>
          </div>
          <div style={{ fontSize:12, color: C.dim, marginBottom:12 }}>Auto-added to every new plan. Organize into groups for shopping.</div>
          <StaplesGroup title="Breakfasts" items={['fruit (1 pkg)','2% milk (0.25 gal)','Oikos yogurt (1 pkg)','granola (1 bag)',"kid's yogurt (1 pkg)"]} />
          <StaplesGroup title="Kid's lunches" items={['sandwich bread','deli ham (0.75 lb)','deli cheese (0.75 lb)','baby carrots','mini cucumbers','cheese snacks']} />
          <StaplesGroup title="Other" items={['eggs (12 each)','olive oil (1 bottle)']} />
        </div>
      </div>
    </PageShell>
  );
}
function ToggleRow({ label, color, on }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'10px 12px',
      background: C.paperHi, borderRadius:10, border:`1px solid ${C.edge}`,
    }}>
      <span style={{ width:8, height:8, borderRadius:'50%', background: color }} />
      <div style={{ flex:1, fontSize:14, color: C.ink }}>{label}</div>
      <div style={{
        width:36, height:22, borderRadius:999,
        background: on ? C.accent : C.edge, position:'relative',
      }}>
        <div style={{
          position:'absolute', top:2, left: on ? 16 : 2,
          width:18, height:18, borderRadius:'50%', background:'#fff',
        }} />
      </div>
    </div>
  );
}
function StaplesGroup({ title, items }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, fontWeight:600, color: C.ink, marginBottom:6 }}>{title}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        {items.map((it, i) => <div key={i} style={{ fontSize:13, color: C.ink }}>{it}</div>)}
      </div>
    </div>
  );
}

// ============================================================================
// SHARING DIALOG
// ============================================================================
function SharingDialog() {
  return (
    <PageShell>
      <div style={{ padding:'24px 0 18px' }}>
        <div style={{ fontFamily: display, fontSize:30, fontWeight:700, letterSpacing:'-0.02em' }}>Your plans</div>
      </div>
      <div style={{ opacity:0.4 }}>
        <PlansBlock />
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', zIndex:5 }} />
      <div style={{
        position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)',
        width:560, background: C.paper, borderRadius:16, zIndex:6,
        border:`1px solid ${C.edge}`, boxShadow:'0 24px 60px rgba(0,0,0,0.5)',
        overflow:'hidden', fontFamily: sans,
      }}>
        <div style={{ padding:'18px 22px 14px', borderBottom:`1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize:18, fontWeight:700 }}>Share your meal plans</div>
          <div style={{ fontSize:12, color: C.dim, marginTop:4 }}>Invited people can view and edit all your plans.</div>
        </div>
        <div style={{ padding:'18px 22px' }}>
          <FieldLabel>Pending invitations · 2</FieldLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            <InviteCardLarge name="Sara Rose" email="sara@example.com" what="Meal plans" />
            <InviteCardLarge name="Casey Lin" email="casey@example.com" what="Corner market shopping list" />
          </div>
          <FieldLabel>Invite by email</FieldLabel>
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, height:38, padding:'0 12px', display:'flex', alignItems:'center', background: C.paperHi, border:`1px solid ${C.edgeHi}`, borderRadius:10, fontSize:13, color: C.mute }}>
              someone@example.com
            </div>
            <button style={btnPrimary}>Invite</button>
          </div>
          <FieldLabel mt>Shared with</FieldLabel>
          <SharedPerson name="Sara Rose" email="sara@example.com" status="accepted" />
          <SharedPerson name="Casey Lin" email="casey@example.com" status="pending" />
        </div>
        <div style={{ padding:'12px 22px', borderTop:`1px solid ${C.edge}`, display:'flex', justifyContent:'flex-end' }}>
          <button style={btnPrimary}>Done</button>
        </div>
      </div>
    </PageShell>
  );
}
function SharedPerson({ name, email, status }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'10px 12px', border:`1px solid ${C.edge}`, borderRadius:10, marginBottom:8,
    }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13 }}>{name[0]}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color: C.ink, fontWeight:500 }}>{name}</div>
        <div style={{ fontSize:11, color: C.dim }}>{email}</div>
      </div>
      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase',
        color: status === 'accepted' ? C.success : C.dim,
        background: status === 'accepted' ? C.successDim : 'transparent',
        padding:'3px 8px', borderRadius:999, border: status === 'pending' ? `1px solid ${C.edge}` : 'none',
      }}>
        {status}
      </span>
      <button style={{ background:'transparent', border:'none', color: C.danger, cursor:'pointer', padding:'0 6px', display:'inline-flex', alignItems:'center' }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
    </div>
  );
}

// ============================================================================
// HISTORY PAGE
// ============================================================================
function HistoryPage() {
  return (
    <PageShell>
      <div style={{ padding:'24px 0 18px', display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>‹ Plans</button>
          <div>
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color: C.accent }}>History</div>
            <div style={{ fontSize: 30, fontFamily: display, fontWeight:700, marginTop:6, letterSpacing:'-0.02em' }}>All your meal plans</div>
            <div style={{ fontSize:13, color: C.dim, marginTop:6 }}><span style={{ color: C.accent, fontWeight:600 }}>43</span> plans · since Jul 2024</div>
          </div>
        </div>
        <div style={{ width:280 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'8px 12px', height:38,
            background: C.paperHi, border:`1px solid ${C.edgeHi}`, borderRadius:10,
          }}>
            <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
            <div style={{ flex:1, fontSize:13, color: C.mute }}>Search plans, recipes…</div>
          </div>
        </div>
      </div>
      <MonthSection title="April 2026" plans={[
        ['Week of Apr 27','Apr 27 – May 3, 2026'],
        ['Week of Apr 20','Apr 20 – 26, 2026'],
        ['Week of Apr 13','Apr 13 – 19, 2026'],
        ['Week of Apr 6','Apr 6 – 12, 2026'],
      ]} />
      <MonthSection title="March 2026" plans={[
        ['Week of Mar 30','Mar 30 – Apr 5, 2026'],
        ['Week of Mar 23','Mar 23 – 29, 2026'],
        ['Week of Mar 16','Mar 16 – 22, 2026'],
        ['Week of Mar 9','Mar 9 – 15, 2026'],
        ['Week of Mar 2','Mar 2 – 8, 2026'],
      ]} />
      <MonthSection title="February 2026" plans={[
        ['Week of Feb 23','Feb 23 – Mar 1, 2026'],
        ['Week of Feb 16','Feb 16 – 22, 2026'],
      ]} />
      <div style={{ padding:'18px 0', textAlign:'center' }}>
        <button style={{ ...btnGhost, height:36, padding:'0 18px' }}>Load 12 more</button>
      </div>
    </PageShell>
  );
}
function MonthSection({ title, plans }) {
  return (
    <div style={{ marginBottom:18 }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:8 }}>
        {plans.map(([n, d], i) => <PlanRow key={i} name={n} dateRange={d} />)}
      </div>
    </div>
  );
}

Object.assign(window, {
  DesktopIndex: IndexPage, DesktopCreate: CreateDialog, DesktopTemplate: TemplatePage,
  DesktopSharing: SharingDialog, DesktopHistory: HistoryPage,
});
})();
