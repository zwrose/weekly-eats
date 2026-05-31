/* eslint-disable */
// Mobile surfaces for meal plans — index, create, template, sharing, history.
// Mirrors the desktop spec but reflows for 390px and uses bottom sheets / pushed screens.
// __IIFE_WRAPPED__
(function () {


const { TopNav, BottomNav } = window.NavChrome;
const C = {
  bg:'#0f1115', paper:'#181b21', paperHi:'#1e222a', paperPast:'#141619', sheet:'#1a1e26',
  ink:'#e7e9ee', dim:'#9097a6', mute:'#5b6170', inkPast:'#7b818f',
  edge:'rgba(255,255,255,0.07)', edgeHi:'rgba(255,255,255,0.13)',
  accent:'#7aa7ff', accentDim:'rgba(122,167,255,0.16)',
  staples:'#c4a7e7', success:'#8edcb4', successDim:'rgba(142,220,180,0.14)',
  danger:'#e87a8a',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans    = `'Outfit', system-ui, sans-serif`;
const SECTION = { B:'#e8c97a', L:'#8edcb4', D:'#f0a08a' };

// ---- shared chrome ------------------------------------------------------
function StatusBar() {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'14px 22px 4px', fontSize:13, fontWeight:600, fontFamily: sans, color: C.ink,
    }}>
      <span>9:41</span>
      <span style={{ display:'flex', gap:6, opacity:.85, fontSize:11 }}>
        <span>●●●</span><span>📶</span><span>100%</span>
      </span>
    </div>
  );
}function PeopleIcon({ size=18 }) {
  return (
    <svg width={size} height={size*0.78} viewBox="0 0 18 14" fill="none" style={{ verticalAlign:'middle' }}>
      <circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 12 C2 9, 4 8, 6 8 C8 8, 10 9, 10 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M11 12 C11 10, 12.5 9, 14 9 C15.5 9, 16.5 10, 16.5 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function DotBadge() {
  return <span style={{ position:'absolute', top:6, right:6, width:8, height:8, borderRadius:'50%', background: C.accent, border:`2px solid ${C.bg}` }} />;
}
const btnGhostIcon = { width:36, height:36, borderRadius:10, background:'transparent', border:`1px solid ${C.edge}`, color: C.ink, fontSize:16, fontFamily:'inherit' };
const btnPrimary = { height:40, padding:'0 16px', borderRadius:10, background: C.accent, color:'#0c1118', border:'none', fontSize:14, fontWeight:600, fontFamily:'inherit' };
const btnGhost = { height:40, padding:'0 16px', borderRadius:10, background:'transparent', border:`1px solid ${C.edge}`, color: C.ink, fontSize:14, fontFamily:'inherit' };

function Frame({ children }) {
  return (
    <div style={{ width:'100%', height:'100%', background: C.bg, color: C.ink, fontFamily: sans, overflow:'hidden', position:'relative' }}>
      <StatusBar />
      {children}
    </div>
  );
}
function NavBar({ leftLabel='‹', right, title, subtitle }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:`1px solid ${C.edge}` }}>
      <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:18, fontFamily:'inherit', minWidth:40, textAlign:'left', padding:0 }}>{leftLabel}</button>
      <div style={{ textAlign:'center', flex:1, minWidth:0, padding:'0 8px' }}>
        <div style={{ fontFamily: display, fontSize:15, fontWeight:700, letterSpacing:'-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize:11, color: C.dim, marginTop:1 }}>{subtitle}</div>}
      </div>
      <div style={{ minWidth:40, textAlign:'right' }}>{right || null}</div>
    </div>
  );
}
function MobilePlanHeader({ kicker, title, sub, right }) {
  return (
    <div style={{ padding:'12px 18px 14px', display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
      <div style={{ flex:1, minWidth:0 }}>
        {kicker && <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color: C.accent, marginBottom:4 }}>{kicker}</div>}
        <div style={{ fontFamily: display, fontSize: kicker ? 24 : 28, fontWeight:700, letterSpacing:'-0.02em', lineHeight:1.05 }}>{title}</div>
        {sub && <div style={{ fontSize:12, color: C.dim, marginTop:4 }}>{sub}</div>}
      </div>
      {right && <div style={{ display:'flex', gap:8 }}>{right}</div>}
    </div>
  );
}
function SectionLabel({ children, right }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', gap:10, padding:'0 18px 6px' }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase' }}>{children}</div>
      <div style={{ flex:1, height:1, background: C.edge }} />
      {right && <div style={{ fontSize:11, color: C.accent, fontWeight:600 }}>{right}</div>}
    </div>
  );
}
function PlanRow({ name, dateRange, sharedBy, current }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'12px 14px', margin:'0 18px',
      background: C.paper, borderRadius:12,
      border: current ? `1px solid ${C.accent}55` : `1px solid transparent`,
      boxShadow: current ? `0 0 0 3px rgba(122,167,255,0.06)` : 'none',
    }}>
      <div style={{ width:32, height:32, borderRadius:8, background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>📅</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontFamily: display, fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
          {current && <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: C.accent, background:'rgba(122,167,255,0.10)', padding:'2px 5px', borderRadius:999 }}>NOW</span>}
        </div>
        <div style={{ fontSize:11, color: C.dim, marginTop:2 }}>{dateRange}{sharedBy ? ` · Shared by ${sharedBy}` : ''}</div>
      </div>
      <span style={{ color: C.dim, fontSize:14 }}>›</span>
    </div>
  );
}

// ============================================================================
// INDEX
// ============================================================================
function IndexPage() {
  return (
    <Frame>
      <MobilePlanHeader
        title="Your plans"
        right={[
          <button key="g" style={btnGhostIcon} title="Template settings">⚙</button>,
          <button key="s" style={{ ...btnGhostIcon, position:'relative', color: C.ink }} title="Sharing"><PeopleIcon /><DotBadge /></button>,
          <button key="n" style={{ ...btnPrimary, height:36, padding:'0 12px' }}>+ New</button>,
        ]}
      />
      <div style={{ overflowY:'auto', height:'calc(100% - 220px)' }}>
        <SectionLabel>Current</SectionLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
          <PlanRow name="Week of May 11" dateRange="May 11 – 17, 2026" current />
          <PlanRow name="Week of May 18" dateRange="May 18 – 24, 2026" />
        </div>
        <SectionLabel>Shared with you</SectionLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
          <PlanRow name="Sara's week of May 11" dateRange="May 11 – 17, 2026" sharedBy="Sara Rose" />
        </div>
        <SectionLabel>Past · last 6 weeks</SectionLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <PlanRow name="Week of May 4" dateRange="May 4 – 10, 2026" />
          <PlanRow name="Week of Apr 27" dateRange="Apr 27 – May 3, 2026" />
          <PlanRow name="Week of Apr 20" dateRange="Apr 20 – 26, 2026" />
        </div>
        <div style={{ padding:'14px 14px 100px', textAlign:'center' }}>
          <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:13, fontWeight:600, fontFamily:'inherit' }}>View older →</button>
        </div>
      </div>
      <BottomNav active="plans" />
    </Frame>
  );
}

// ============================================================================
// CREATE — bottom sheet from index
// ============================================================================
function CreatePage() {
  return (
    <Frame>
      <div style={{ opacity:0.4 }}>
        <MobilePlanHeader title="Your plans" />
        <div style={{ padding:'0 14px' }}>
          <div style={{ background: C.paper, borderRadius:12, height:60, marginBottom:8 }} />
          <div style={{ background: C.paper, borderRadius:12, height:60 }} />
        </div>
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', zIndex:4 }} />
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:5,
        background: C.sheet, borderTopLeftRadius:18, borderTopRightRadius:18,
        boxShadow:'0 -10px 30px rgba(0,0,0,0.4)',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 16px 12px', borderBottom:`1px solid ${C.edge}` }}>
          <button style={{ background:'transparent', border:'none', color: C.dim, fontSize:14, fontFamily:'inherit', minWidth:60, textAlign:'left' }}>Cancel</button>
          <div style={{ fontFamily: display, fontSize:15, fontWeight:700 }}>New meal plan</div>
          <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:14, fontWeight:600, fontFamily:'inherit', minWidth:60, textAlign:'right' }}>Create</button>
        </div>
        <div style={{ padding:'16px 18px 22px' }}>
          <FieldLabel>Start date</FieldLabel>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
            <DateChip label="May 18" selected />
            <DateChip label="May 25" />
            <DateChip label="Pick…" />
          </div>
          <div style={{ fontSize:11, color: C.dim, marginTop:6 }}>Next Monday — your template's start day.</div>
          <div style={{ marginTop:18, padding:'10px 12px', background: C.successDim, color: C.success, borderRadius:8, fontSize:12 }}>
            ✓ No overlap. Plan covers May 18 – 24.
          </div>
        </div>
      </div>
    </Frame>
  );
}
function FieldLabel({ children, mt }) {
  return <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase', marginTop: mt ? 16 : 0, marginBottom:8 }}>{children}</div>;
}
function DateChip({ label, selected }) {
  return (
    <button style={{
      height:36, padding:'0 14px',
      background: selected ? C.accentDim : 'transparent',
      border:`1px solid ${selected ? C.accent : C.edge}`,
      color: selected ? C.accent : C.ink,
      borderRadius:8, fontSize:13, fontWeight:600, fontFamily:'inherit',
    }}>{label}</button>
  );
}

// ============================================================================
// TEMPLATE — pushed screen
// ============================================================================
function TemplatePage() {
  return (
    <Frame>
      <NavBar leftLabel="‹ Plans" title="Template" subtitle="Your default plan shape" />
      <div style={{ overflowY:'auto', height:'calc(100% - 180px)', padding:'14px 18px 100px' }}>
        <FieldLabel>Week starts on</FieldLabel>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
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
        <FieldLabel mt>Default staples · 13</FieldLabel>
        <div style={{ background: C.paper, borderRadius:12, overflow:'hidden' }}>
          <StaplesRow title="Breakfasts" count={5} />
          <StaplesRow title="Kid's lunches" count={6} />
          <StaplesRow title="Other" count={2} />
        </div>
        <button style={{ ...btnGhost, marginTop:10, width:'100%' }}>✎ Edit staples</button>
      </div>
      <BottomNav active="plans" />
    </Frame>
  );
}
function ToggleRow({ label, color, on }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'10px 12px', background: C.paper, borderRadius:10, border:`1px solid ${C.edge}`,
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
function StaplesRow({ title, count }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderTop:`1px solid ${C.edge}`, borderTopColor:'transparent' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: C.staples }} />
      <div style={{ flex:1, fontSize:13, color: C.ink, fontWeight:500 }}>{title}</div>
      <span style={{ fontSize:11, color: C.dim }}>{count} items</span>
      <span style={{ color: C.dim, fontSize:14 }}>›</span>
    </div>
  );
}

// ============================================================================
// SHARING — bottom sheet from index
// ============================================================================
function SharingPage() {
  return (
    <Frame>
      <div style={{ opacity:0.4 }}>
        <MobilePlanHeader title="Your plans" />
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', zIndex:4 }} />
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:5,
        background: C.sheet, borderTopLeftRadius:18, borderTopRightRadius:18,
        boxShadow:'0 -10px 30px rgba(0,0,0,0.4)',
        display:'flex', flexDirection:'column', maxHeight:'92%',
      }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 16px 12px', borderBottom:`1px solid ${C.edge}` }}>
          <div style={{ minWidth:60 }} />
          <div style={{ textAlign:'center', flex:1 }}>
            <div style={{ fontFamily: display, fontSize:15, fontWeight:700 }}>Share meal plans</div>
            <div style={{ fontSize:11, color: C.dim, marginTop:1 }}>Invited people can view + edit</div>
          </div>
          <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:14, fontWeight:600, fontFamily:'inherit', minWidth:60, textAlign:'right' }}>Done</button>
        </div>
        <div style={{ padding:'14px 18px 18px', overflowY:'auto' }}>
          <FieldLabel>Pending invitations · 2</FieldLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
            <InviteCard name="Sara Rose" what="Meal plans" />
            <InviteCard name="Casey Lin" what="Corner market shopping list" />
          </div>
          <FieldLabel>Invite by email</FieldLabel>
          <div style={{ display:'flex', gap:8, marginBottom:6 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', height:40, padding:'0 12px', background: C.paperHi, border:`1px solid ${C.edgeHi}`, borderRadius:10, fontSize:13, color: C.mute }}>someone@example.com</div>
            <button style={btnPrimary}>Invite</button>
          </div>
          <FieldLabel mt>Shared with</FieldLabel>
          <SharedPerson name="Sara Rose" email="sara@example.com" status="accepted" />
          <SharedPerson name="Casey Lin" email="casey@example.com" status="pending" />
        </div>
      </div>
    </Frame>
  );
}
function InviteCard({ name, what }) {
  return (
    <div style={{ background: C.paperHi, borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{name[0]}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color: C.ink, fontWeight:600 }}>{name}</div>
        <div style={{ fontSize:11, color: C.dim }}>invited you to <span style={{ color: C.ink }}>{what}</span></div>
      </div>
      <button style={{ width:32, height:32, borderRadius:8, background: C.successDim, color: C.success, border:'none', fontWeight:700 }}>✓</button>
      <button style={{ width:32, height:32, borderRadius:8, background:'rgba(232,122,138,0.12)', color: C.danger, border:'none', fontWeight:700 }}>✕</button>
    </div>
  );
}
function SharedPerson({ name, email, status }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:`1px solid ${C.edge}`, borderRadius:10, marginBottom:8 }}>
      <div style={{ width:28, height:28, borderRadius:'50%', background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12 }}>{name[0]}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color: C.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
        <div style={{ fontSize:11, color: C.dim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{email}</div>
      </div>
      <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase',
        color: status === 'accepted' ? C.success : C.dim,
        background: status === 'accepted' ? C.successDim : 'transparent',
        padding:'3px 6px', borderRadius:999, border: status === 'pending' ? `1px solid ${C.edge}` : 'none',
      }}>{status}</span>
      <button style={{ background:'transparent', border:'none', color: C.danger, padding:'0 4px', display:'inline-flex', alignItems:'center' }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
    </div>
  );
}

// ============================================================================
// HISTORY — pushed screen
// ============================================================================
function HistoryPage() {
  return (
    <Frame>
      <NavBar leftLabel="‹ Plans" title="History" subtitle="43 plans · since Jul 2024" />
      <div style={{ padding:'10px 14px 6px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', height:40, background: C.paperHi, border:`1px solid ${C.edgeHi}`, borderRadius:10 }}>
          <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
          <div style={{ flex:1, fontSize:13, color: C.mute }}>Search plans, recipes…</div>
        </div>
      </div>
      <div style={{ overflowY:'auto', height:'calc(100% - 230px)', padding:'8px 0 100px' }}>
        <MonthBlock title="April 2026" plans={[
          ['Week of Apr 27','Apr 27 – May 3'],
          ['Week of Apr 20','Apr 20 – 26'],
          ['Week of Apr 13','Apr 13 – 19'],
          ['Week of Apr 6','Apr 6 – 12'],
        ]} />
        <MonthBlock title="March 2026" plans={[
          ['Week of Mar 30','Mar 30 – Apr 5'],
          ['Week of Mar 23','Mar 23 – 29'],
          ['Week of Mar 16','Mar 16 – 22'],
        ]} />
        <MonthBlock title="February 2026" plans={[
          ['Week of Feb 23','Feb 23 – Mar 1'],
        ]} />
        <div style={{ padding:'10px 14px', textAlign:'center' }}>
          <button style={{ ...btnGhost, width:'100%' }}>Load 12 more</button>
        </div>
      </div>
      <BottomNav active="plans" />
    </Frame>
  );
}
function MonthBlock({ title, plans }) {
  return (
    <div style={{ marginBottom:14 }}>
      <SectionLabel>{title}</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {plans.map(([n, d], i) => <PlanRow key={i} name={n} dateRange={d} />)}
      </div>
    </div>
  );
}

Object.assign(window, { MobileIndex: IndexPage, MobileCreate: CreatePage, MobileTemplate: TemplatePage, MobileSharing: SharingPage, MobileHistory: HistoryPage });
})();
