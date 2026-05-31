/* eslint-disable */
// N1 final — D's sliver-cell structure with B's simplicity (just "TODAY").
// __IIFE_WRAPPED__
(function () {


const { TopNav, BottomNav } = window.NavChrome;
const C = {
  bg:'#0f1115', paper:'#181b21', paperPast:'#141619',
  ink:'#e7e9ee', inkPast:'#7b818f', dim:'#9097a6', mute:'#5b6170',
  edge:'rgba(255,255,255,0.07)', edgeHi:'rgba(255,255,255,0.13)',
  accent:'#7aa7ff', accentDim:'rgba(122,167,255,0.16)',
  staples:'#c4a7e7', recipe:'#7aa7ff',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans    = `'Outfit', system-ui, sans-serif`;
const SECTION = { B: '#e8c97a', L: '#8edcb4', D: '#f0a08a' };
const MEAL_LABEL = { B:'Breakfast', L:'Lunch', D:'Dinner' };

const DAYS = [
  { day:'Mon', date:11, when:'past', meals:[
    { mt:'B', items:[{ type:'recipe', name:'Overnight oats', emoji:'🥣' }] },
    { mt:'L', items:[{ type:'recipe', name:'Med. grain bowl', emoji:'🥗' }] },
    { mt:'D', items:[{ type:'recipe', name:'Lemon ricotta pasta', emoji:'🍝' }, { type:'group', title:'Side salad', count:3 }] },
  ]},
  { day:'Tue', date:12, when:'past', meals:[
    { mt:'B', skip:true, reason:'coffee only' },
    { mt:'L', items:[{ type:'recipe', name:'Lemon ricotta pasta', emoji:'🍝', note:'leftovers' }] },
    { mt:'D', items:[{ type:'recipe', name:'Sheet-pan chicken tacos', emoji:'🌮' }] },
  ]},
  { day:'Thu', date:14, when:'future', meals:[
    { mt:'L', items:[{ type:'recipe', name:'Thai coconut curry', emoji:'🍲', note:'leftovers' }] },
    { mt:'D', items:[{ type:'food', name:'chicken thighs', qty:1.5, unit:'lb' }, { type:'food', name:'stir fry kit', qty:1, unit:'bag' }] },
  ]},
  { day:'Fri', date:15, when:'future', meals:[
    { mt:'B', items:[{ type:'food', name:'bagels', qty:2, unit:'each' }, { type:'food', name:'cream cheese', qty:2, unit:'tbsp' }] },
    { mt:'L', skip:true, reason:'out — work lunch' },
    { mt:'D', items:[{ type:'food', name:'pizza dough', qty:1, unit:'package' }, { type:'food', name:'mozzarella', qty:8, unit:'oz' }, { type:'food', name:'tomato sauce', qty:1, unit:'jar' }] },
  ]},
  { day:'Sat', date:16, when:'future', meals:[
    { mt:'B', items:[{ type:'recipe', name:'Buttermilk pancakes', emoji:'🥞' }] },
    { mt:'D', skip:true, reason:'DKE celebration' },
  ]},
  { day:'Sun', date:17, when:'future', meals:[
    { mt:'D', items:[{ type:'group', title:'Cheese board', count:5 }, { type:'group', title:'Veggie board', count:8 }] },
  ]},
];
const TODAY = { day:'Wed', date:13, meals:[
  { mt:'B', items:[{ type:'food', name:'eggs', qty:2, unit:'each' }, { type:'food', name:'toast', qty:2, unit:'slice' }] },
  { mt:'D', items:[{ type:'recipe', name:'Thai coconut curry', emoji:'🍲', qty:2 }, { type:'food', name:'jasmine rice', qty:2, unit:'cup' }] },
]};

function PageHeader() {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'18px 22px 14px' }}>
      <div>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color: C.accent }}>Meal Plan</div>
        <div style={{ fontFamily: display, fontSize:30, fontWeight:700, marginTop:6, letterSpacing:'-0.02em', lineHeight:1 }}>Week of May 11</div>
        <div style={{ fontSize:13, color: C.dim, marginTop:6 }}>May 11 – 17 · Shared with Sara</div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button style={btnGhost}>‹</button><button style={btnGhost}>›</button><button style={btnGhost}>⋯</button>
      </div>
    </div>
  );
}
const btnGhost = { height:38, width:38, borderRadius:10, background:'transparent', border:`1px solid ${C.edge}`, color: C.ink, fontSize:16 };

function StaplesBar() {
  return (
    <div style={{ background:'transparent', border:`1px solid ${C.edge}`, borderRadius:12, marginBottom: 18, overflow:'hidden', display:'flex', alignItems:'stretch' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:12, padding:'10px 16px' }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color: C.staples }}>Staples</span>
        <span style={{ fontSize:13, color: C.dim, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Breakfasts (5) · Kid's lunches (6) · Other (2)</span>
        <span style={{ fontSize:12, color: C.mute, fontVariantNumeric:'tabular-nums' }}>13</span>
        <span style={{ fontSize:11, color: C.mute }}>▾</span>
      </div>
      <button style={{ background:'transparent', border:'none', borderLeft:`1px solid ${C.edge}`, color: C.dim, padding:'0 14px', fontSize:13 }}>✎</button>
    </div>
  );
}
function MealItemLine({ item, ink, mute }) {
  if (item.type === 'recipe') {
    return (
      <div style={{ fontSize:13, lineHeight:1.4, display:'flex', alignItems:'baseline', gap:6 }}>
        {item.emoji && <span style={{ fontSize:13 }}>{item.emoji}</span>}
        <span style={{ color: C.recipe, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{item.name}</span>
        {item.qty && item.qty !== 1 && <span style={{ fontSize:11, color: mute, fontVariantNumeric:'tabular-nums' }}>× {item.qty}</span>}
        {item.note && <span style={{ fontSize:11, color: mute, fontStyle:'italic' }}>· {item.note}</span>}
      </div>
    );
  }
  if (item.type === 'food') {
    return (
      <div style={{ fontSize:13, lineHeight:1.4, display:'flex', alignItems:'baseline', gap:6 }}>
        <span style={{ color: ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 }}>{item.name}</span>
        <span style={{ fontSize:11, color: mute, fontVariantNumeric:'tabular-nums' }}>{item.qty}{item.unit !== 'each' ? ` ${item.unit}` : ''}</span>
      </div>
    );
  }
  return <div style={{ fontSize:13, lineHeight:1.4 }}><span style={{ color: ink, fontWeight:500 }}>{item.title}</span><span style={{ fontSize:11, color: mute, marginLeft:4 }}>({item.count})</span></div>;
}
function Hero() {
  return (
    <div style={{
      background: C.paper, borderRadius:16, padding:'22px 26px',
      border:`1px solid ${C.accent}55`, boxShadow:`0 0 0 3px rgba(122,167,255,0.08)`,
    }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
        <div style={{ fontFamily: display, fontSize:32, fontWeight:700, color: C.accent, letterSpacing:'-0.02em' }}>{TODAY.day}, May {TODAY.date}</div>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.18em', color: C.accent, background:'rgba(122,167,255,0.10)', padding:'3px 8px', borderRadius:999 }}>TODAY</span>
      </div>
      <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24 }}>
        {['B','L','D'].map(mt => {
          const meal = TODAY.meals.find(m => m.mt === mt);
          return (
            <div key={mt}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.18em', color: SECTION[mt], textTransform:'uppercase', marginBottom:8 }}>{MEAL_LABEL[mt]}</div>
              {meal ? (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {meal.skip ? <div style={{ fontSize:13, color: C.mute, fontStyle:'italic' }}>Skipped</div>
                    : meal.items.map((it, i) => <MealItemLine key={i} item={it} ink={C.ink} mute={C.dim} />)}
                </div>
              ) : (
                <button style={{ background:'transparent', border:`1px dashed ${C.edge}`, color: C.mute, borderRadius:8, padding:'4px 10px', fontSize:12 }}>+ Add</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function StripCell({ day }) {
  const past = day.when === 'past';
  const ink = past ? C.inkPast : C.ink;
  const mute = past ? C.mute : C.dim;
  return (
    <div style={{
      background: past ? C.paperPast : C.paper,
      borderRadius:10, padding:'10px 12px',
      opacity: past ? 0.72 : 1, minHeight:130,
    }}>
      <div style={{ fontFamily: display, fontSize:14, fontWeight:700, color: ink, marginBottom:6 }}>{day.day} {day.date}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        {day.meals.map((m, i) => (
          <div key={i} style={{ fontSize:11, color: ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            <span style={{ color: SECTION[m.mt], fontWeight:700, fontFamily: display, marginRight:4 }}>{m.mt}</span>
            {m.skip ? <span style={{ color: mute, fontStyle:'italic' }}>Skipped</span> : (m.items[0]?.name || m.items[0]?.title)}
            {!m.skip && m.items.length > 1 && <span style={{ color: mute }}> +{m.items.length - 1}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
function PageShell({ children }) {
  return (
    <div style={{ width:'100%', height:'100%', background: C.bg, color: C.ink, fontFamily: sans, overflow:'hidden' }}>
      <TopNav active="plans" />
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 32px 32px' }}>
        <PageHeader />
        <StaplesBar />
        {children}
      </div>
    </div>
  );
}
function RailLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', padding:'0 4px 8px' }}>{children}</div>;
}

// Sliver-pill cell with vertical "TODAY" — that's it.
function TodayPill() {
  return (
    <div style={{
      background: C.accentDim, border:`1px solid ${C.accent}55`, borderRadius:10,
      padding:'10px 0 12px', minHeight:130,
      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
    }}>
      <div style={{ color: C.accent, fontSize:14, lineHeight:1, fontWeight:700 }}>↑</div>
      <div style={{
        fontFamily: display, fontSize:11, fontWeight:700, color: C.accent,
        writingMode:'vertical-rl', transform:'rotate(180deg)',
        letterSpacing:'0.18em',
      }}>TODAY</div>
    </div>
  );
}

function Final() {
  return (
    <PageShell>
      <Hero />
      <div style={{ marginTop:22 }}>
        <RailLabel>This week</RailLabel>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 28px 1fr 1fr 1fr 1fr', gap:10, alignItems:'stretch' }}>
          <StripCell day={DAYS[0]} />
          <StripCell day={DAYS[1]} />
          <TodayPill />
          <StripCell day={DAYS[2]} />
          <StripCell day={DAYS[3]} />
          <StripCell day={DAYS[4]} />
          <StripCell day={DAYS[5]} />
        </div>
      </div>
    </PageShell>
  );
}

Object.assign(window, { DesktopPlanFinal: Final });
})();
