/* eslint-disable */
// Desktop equivalent of the B3 edit shell. Modal Dialog (not full-screen),
// inline qty/unit popovers (not bottom sheets), plan view dimmed behind.
// __IIFE_WRAPPED__
(function () {

const C = {
  bg:'#0f1115', paper:'#181b21', paperHi:'#1e222a', sheet:'#1a1e26',
  ink:'#e7e9ee', dim:'#9097a6', mute:'#5b6170',
  edge:'rgba(255,255,255,0.07)', edgeHi:'rgba(255,255,255,0.13)',
  accent:'#7aa7ff', accentDim:'rgba(122,167,255,0.16)',
  warn:'#f0c674', danger:'#e87a8a', dangerDim:'rgba(232,122,138,0.14)',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans    = `'Outfit', system-ui, sans-serif`;

const QTY_COL = 44;
const UNIT_COL = 86;

// ---- chips --------------------------------------------------------------
function QtyChip({ value, active }) {
  const border = active ? C.accent : C.edgeHi;
  const bg = active ? C.accentDim : 'transparent';
  return (
    <button style={{
      height:30, padding:'0 10px',
      border:`1px solid ${border}`, borderRadius:8,
      background: bg, color: C.ink, fontSize:13, fontWeight:600,
      fontVariantNumeric:'tabular-nums', cursor:'pointer', fontFamily:'inherit',
    }}>{value}</button>
  );
}
function UnitChip({ value, active }) {
  const border = active ? C.accent : C.edge;
  const bg = active ? C.accentDim : 'transparent';
  return (
    <button style={{
      height:30, padding:'0 10px',
      border:`1px solid ${border}`, borderRadius:8,
      background: bg, color: C.ink, fontSize:13, fontFamily:'inherit',
      display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer',
    }}>{value} <span style={{ fontSize:9, color: C.mute }}>▾</span></button>
  );
}

// ---- rows ---------------------------------------------------------------
function FoodRow({ name, qty, unit, qtyActive, unitActive, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'10px 4px',
      borderBottom: last ? 'none' : `1px solid ${C.edge}`,
      background: (qtyActive || unitActive) ? 'rgba(122,167,255,0.05)' : 'transparent',
    }}>
      <div style={{ flex:1, minWidth:0, fontSize:14, color: C.ink }}>{name}</div>
      <div style={{ width: QTY_COL, display:'flex', justifyContent:'flex-start' }}>
        <QtyChip value={qty} active={qtyActive} />
      </div>
      <div style={{ width: UNIT_COL, display:'flex', justifyContent:'flex-start' }}>
        <UnitChip value={unit} active={unitActive} />
      </div>
    </div>
  );
}
function RecipeRow({ name, emoji='🍝', qty, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'10px 4px', borderBottom: last ? 'none' : `1px solid ${C.edge}`,
    }}>
      <span style={{ fontSize:16 }}>{emoji}</span>
      <div style={{ flex:1, minWidth:0, fontSize:14, fontWeight:600, color: C.accent }}>{name}</div>
      <span style={{ fontSize:10, color: C.dim, padding:'1px 6px', border:`1px solid ${C.edge}`, borderRadius:4 }}>Recipe</span>
      <div style={{ width: QTY_COL, display:'flex', justifyContent:'flex-start' }}>
        <button style={{
          height:30, padding:'0 10px',
          border:`1px solid ${C.edgeHi}`, borderRadius:8,
          background:'transparent', color: C.ink, fontSize:13, fontWeight:600,
          fontVariantNumeric:'tabular-nums', display:'inline-flex', alignItems:'center', gap:4,
        }}>× {qty}</button>
      </div>
      <div style={{ width: UNIT_COL }} />
    </div>
  );
}

// ---- group section ------------------------------------------------------
function GroupSection({ title, items }) {
  return (
    <div style={{ marginTop:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'2px 4px', marginBottom:6 }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: C.dim }}>GROUP</span>
        <div style={{
          flex:1, height:30, display:'flex', alignItems:'center', padding:'0 10px',
          border:`1px solid ${C.edge}`, borderRadius:8,
          fontSize:13, color: C.ink, fontWeight:600,
        }}>{title}</div>
        <button style={{
          background:'transparent', border:'none', color: C.mute,
          cursor:'pointer', padding:'4px 6px', lineHeight:1,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><span className="ms" style={{ fontSize: 17, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
      </div>
      <div style={{ borderTop:`1px solid ${C.edge}` }}>
        {items.map((it, i) => (
          <FoodRow key={i} {...it} last={i === items.length - 1} />
        ))}
      </div>
    </div>
  );
}

// ---- plan view behind dialog -------------------------------------------
function PlanViewBehind() {
  return (
    <div style={{ position:'absolute', inset:0, background: C.bg, color: C.ink, fontFamily: sans }}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 32px', borderBottom:`1px solid ${C.edge}`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background: C.accentDim, color: C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontFamily: display }}>WE</div>
          <div style={{ fontFamily: display, fontSize:18, fontWeight:700 }}>Weekly Eats</div>
          <div style={{ display:'flex', gap:18, marginLeft:24 }}>
            <span style={{ fontSize:14, color: C.accent, fontWeight:600, borderBottom:`2px solid ${C.accent}`, paddingBottom:4 }}>Plans</span>
            <span style={{ fontSize:14, color: C.dim }}>Shop</span>
            <span style={{ fontSize:14, color: C.dim }}>Recipes</span>
            <span style={{ fontSize:14, color: C.dim }}>You</span>
          </div>
        </div>
        <div style={{ width:32, height:32, borderRadius:'50%', background: C.edge }} />
      </div>
      <div style={{ padding:'32px 32px 0', maxWidth:920, margin:'0 auto' }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', textTransform:'uppercase', color: C.accent }}>Meal Plan</div>
        <div style={{ fontFamily: display, fontSize:30, fontWeight:700, marginTop:4 }}>Week of May 11</div>
        {/* mini day cards in a row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:12, marginTop:24 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
            <div key={d} style={{
              background: C.paper, borderRadius:12, padding:'12px 10px',
              border: d === 'Mon' ? `1px solid ${C.accent}55` : `1px solid transparent`,
              boxShadow: d === 'Mon' ? `0 0 0 3px rgba(122,167,255,0.08)` : 'none',
              minHeight: 220,
            }}>
              <div style={{ fontFamily: display, fontSize:14, fontWeight:700, color: d === 'Mon' ? C.accent : C.ink }}>
                {d} {11 + i}
              </div>
              <div style={{ marginTop:10, fontSize:11, color: C.dim }}>
                {i === 0 && <>🍝 Lemon ricotta pasta<br/>Side salad</>}
                {i === 1 && <>🌮 Sheet-pan tacos</>}
                {i === 2 && <>🍲 Coconut curry ×2</>}
                {i === 3 && <>Stir fry kit + chicken</>}
                {i === 4 && <>Pizza dough · sauce · mozz</>}
                {i === 5 && <em style={{ opacity:0.5 }}>skipped</em>}
                {i === 6 && <>Cheese board · Veggie board</>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- dialog body (shared) ----------------------------------------------
function DialogShell({ width=900, height=720, children }) {
  return (
    <div style={{
      position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)',
      width, height, maxHeight:'88vh',
      background: C.sheet, borderRadius:16, zIndex:6,
      border:`1px solid ${C.edge}`,
      boxShadow:'0 24px 60px rgba(0,0,0,0.5)',
      display:'flex', flexDirection:'column',
      overflow:'hidden',
      fontFamily: sans, color: C.ink,
    }}>{children}</div>
  );
}
function DialogHeader({ rightDisabled }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'16px 22px', borderBottom:`1px solid ${C.edge}`,
    }}>
      <div>
        <div style={{ fontFamily: display, fontSize:18, fontWeight:700, letterSpacing:'-0.01em' }}>Monday dinner</div>
        <div style={{ fontSize:12, color: C.dim, marginTop:2 }}>May 11 · 2 items</div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button style={{
          height:36, padding:'0 16px',
          background:'transparent', border:`1px solid ${C.edge}`, borderRadius:8,
          color: C.ink, fontSize:14, fontFamily:'inherit', cursor:'pointer',
        }}>Cancel</button>
        <button disabled={rightDisabled} style={{
          height:36, padding:'0 18px',
          background: rightDisabled ? 'transparent' : C.accent,
          border: rightDisabled ? `1px solid ${C.edge}` : 'none',
          borderRadius:8,
          color: rightDisabled ? C.mute : '#0c1118',
          fontSize:14, fontWeight:600, fontFamily:'inherit',
          cursor: rightDisabled ? 'default' : 'pointer',
        }}>Save</button>
      </div>
    </div>
  );
}
function SkipBar({ skipped, reason }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      padding:'12px 22px', borderBottom:`1px solid ${C.edge}`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{
          width:36, height:22, borderRadius:999,
          background: skipped ? C.accent : C.edge, position:'relative',
        }}>
          <div style={{
            position:'absolute', top:2, left: skipped ? 16 : 2,
            width:18, height:18, borderRadius:'50%', background:'#fff',
          }} />
        </div>
        <div style={{ fontSize:13, fontWeight:500 }}>Skip this meal</div>
      </div>
      {skipped && (
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color: C.dim, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600 }}>Reason</span>
          <div style={{
            flex:1, height:34, padding:'0 12px', display:'flex', alignItems:'center',
            border:`1px solid ${C.edge}`, borderRadius:8,
            fontSize:13, color: reason ? C.ink : C.mute,
          }}>{reason || 'optional · e.g. out for work lunch'}</div>
        </div>
      )}
    </div>
  );
}
function StickySearch({ value, focus, results }) {
  return (
    <div style={{ padding:'12px 22px 18px', borderTop:`1px solid ${C.edge}` }}>
      {results}
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'10px 14px',
        background: C.paperHi,
        border: focus ? `1px solid ${C.accent}55` : `1px solid ${C.edgeHi}`,
        boxShadow: focus ? `0 0 0 3px ${C.accentDim}` : 'none',
        borderRadius:10,
      }}>
        <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
        <div style={{ flex:1, fontSize:14, color: value ? C.ink : C.mute }}>
          {value || 'Add item, recipe, or new group'}{focus && <span style={{ display:'inline-block', width:1.5, height:14, background:C.accent, marginLeft:2, verticalAlign:'-2px' }} />}
        </div>
        <span style={{
          fontSize:10, color: C.dim, padding:'2px 6px',
          background:'rgba(255,255,255,0.05)', borderRadius:4,
        }}>↵</span>
      </div>
    </div>
  );
}
function SearchResults() {
  return (
    <div style={{
      marginBottom:8, background: C.paper, border:`1px solid ${C.edge}`, borderRadius:10,
      overflow:'hidden',
    }}>
      <SectionLabel>Recipes</SectionLabel>
      <ResultRow emoji="🍝" name="Parmesan butter pasta" sub="Recipe · 4 servings" />
      <SectionLabel mt>Food items</SectionLabel>
      <ResultRow name="parmesan, grated" sub="cup" />
      <ResultRow name="parmesan rind" sub="each" />
      <SectionLabel mt>Create</SectionLabel>
      <ResultRow icon="+" name={'Add "parm" as new food item'} accent />
      <ResultRow icon="▦" name='New group with "parm"' accent />
    </div>
  );
}
function SectionLabel({ children, mt }) {
  return (
    <div style={{
      fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim,
      textTransform:'uppercase', padding:'10px 14px 4px',
      borderTop: mt ? `1px solid ${C.edge}` : 'none',
    }}>{children}</div>
  );
}
function ResultRow({ emoji, icon, name, sub, accent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px' }}>
      {emoji && <span style={{ fontSize:16 }}>{emoji}</span>}
      {icon && <span style={{
        width:22, height:22, borderRadius:6, background: C.accentDim,
        color: C.accent, display:'inline-flex', alignItems:'center', justifyContent:'center',
        fontWeight:700, fontSize:13,
      }}>{icon}</span>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, color: accent ? C.accent : C.ink, fontWeight: accent ? 600 : 500 }}>{name}</div>
        {sub && <div style={{ fontSize:11, color: C.dim, marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MealBody({ skip, reason, qtyActive, unitActive, searchFocus, searchValue, searchResults }) {
  return (
    <>
      <DialogHeader />
      <SkipBar skipped={skip} reason={reason} />
      <div style={{ flex:1, overflowY:'auto', padding:'14px 22px 12px' }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase', marginBottom:6 }}>Items</div>
        <div style={{ borderTop:`1px solid ${C.edge}` }}>
          <RecipeRow name="Lemon ricotta pasta" qty={1} last />
        </div>
        <GroupSection title="Side salad" items={[
          { name:'romaine',          qty:1, unit:'head' },
          { name:'cherry tomatoes', qty:1, unit:'pint', qtyActive, unitActive },
          { name:'cucumber',         qty:1, unit:'each' },
        ]} />
      </div>
      <StickySearch focus={searchFocus} value={searchValue} results={searchResults} />
    </>
  );
}

// ---- popover (anchored to a chip) --------------------------------------
function Popover({ x, y, width=280, children }) {
  return (
    <div style={{
      position:'absolute', left:x, top:y, width,
      background: C.sheet, border:`1px solid ${C.edge}`,
      borderRadius:12, boxShadow:'0 16px 40px rgba(0,0,0,0.5)',
      zIndex:7, fontFamily: sans, color: C.ink,
    }}>{children}</div>
  );
}
function PresetPill({ children, active }) {
  return (
    <button style={{
      height:30, padding:'0 12px',
      background: active ? C.accentDim : 'transparent',
      color: active ? C.accent : C.dim,
      border:`1px solid ${active ? C.accent+'55' : C.edge}`,
      borderRadius:999, fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      fontVariantNumeric:'tabular-nums',
    }}>{children}</button>
  );
}
function QtyPopover({ x, y }) {
  return (
    <Popover x={x} y={y} width={300}>
      <div style={{ padding:'14px 16px 8px' }}>
        <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase', marginBottom:8 }}>Quantity</div>
        <input readOnly value="1" style={{
          width:'100%', height:44, padding:'0 14px',
          background: C.paperHi, border:`1px solid ${C.accent}55`,
          boxShadow:`0 0 0 3px ${C.accentDim}`,
          borderRadius:10, fontSize:20, fontFamily: display, fontWeight:700, color: C.ink,
          fontVariantNumeric:'tabular-nums', outline:'none',
        }} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
          <PresetPill>¼</PresetPill>
          <PresetPill>½</PresetPill>
          <PresetPill>¾</PresetPill>
          <PresetPill active>1</PresetPill>
          <PresetPill>1½</PresetPill>
          <PresetPill>2</PresetPill>
          <PresetPill>3</PresetPill>
        </div>
      </div>
    </Popover>
  );
}
function UnitPopover({ x, y }) {
  return (
    <Popover x={x} y={y} width={320}>
      <div style={{ padding:'10px 12px 6px' }}>
        <div style={{
          display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
          background: C.paperHi, border:`1px solid ${C.edgeHi}`, borderRadius:10,
        }}>
          <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
          <div style={{ flex:1, fontSize:13, color: C.mute }}>Search units</div>
        </div>
      </div>
      <div style={{ maxHeight:300, overflowY:'auto', padding:'4px 6px 10px' }}>
        <UnitGroup title="Volume">
          <UnitRow name="cup" abbr="c" />
          <UnitRow name="pint" abbr="pt" selected />
          <UnitRow name="quart" abbr="qt" />
          <UnitRow name="gallon" abbr="gal" />
        </UnitGroup>
        <UnitGroup title="Weight">
          <UnitRow name="ounce" abbr="oz" />
          <UnitRow name="pound" abbr="lb" />
        </UnitGroup>
        <UnitGroup title="Countable">
          <UnitRow name="each" />
          <UnitRow name="bunch" />
          <UnitRow name="head" />
        </UnitGroup>
      </div>
    </Popover>
  );
}
function UnitRow({ name, abbr, selected }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'8px 10px',
      background: selected ? C.accentDim : 'transparent', borderRadius:6,
    }}>
      <div style={{
        width:14, height:14, borderRadius:'50%',
        border:`1.5px solid ${selected ? C.accent : C.edgeHi}`,
        display:'inline-flex', alignItems:'center', justifyContent:'center',
      }}>
        {selected && <div style={{ width:7, height:7, borderRadius:'50%', background: C.accent }} />}
      </div>
      <div style={{ flex:1, fontSize:13, color: C.ink, fontWeight: selected ? 600 : 500 }}>{name}</div>
      {abbr && <div style={{ fontSize:11, color: C.dim }}>{abbr}</div>}
    </div>
  );
}
function UnitGroup({ title, children }) {
  return (
    <div style={{ marginTop:6 }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', padding:'4px 10px 4px' }}>{title}</div>
      {children}
    </div>
  );
}

// ---- frames -------------------------------------------------------------
function FullStage({ children, backdropOnly }) {
  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden', background: C.bg }}>
      {!backdropOnly && <PlanViewBehind />}
      <div style={{ position:'absolute', inset:0, background: backdropOnly ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', zIndex:5 }} />
      {children}
    </div>
  );
}

function D1Default() {
  return (
    <FullStage>
      <DialogShell>
        <MealBody />
      </DialogShell>
    </FullStage>
  );
}
function D2QtyPopover() {
  // chip is around y=380, x=590 (approx) within dialog at center
  return (
    <FullStage>
      <DialogShell>
        <MealBody qtyActive />
      </DialogShell>
      <QtyPopover x={780} y={460} />
    </FullStage>
  );
}
function D3UnitPopover() {
  return (
    <FullStage>
      <DialogShell>
        <MealBody unitActive />
      </DialogShell>
      <UnitPopover x={830} y={460} />
    </FullStage>
  );
}
function D4Search() {
  return (
    <FullStage>
      <DialogShell height={780}>
        <MealBody searchFocus searchValue="parm" searchResults={<SearchResults />} />
      </DialogShell>
    </FullStage>
  );
}

function D5FullBackdrop() {
  return (
    <FullStage backdropOnly>
      <DialogShell>
        <MealBody />
      </DialogShell>
    </FullStage>
  );
}

function D6Empty() {
  return (
    <FullStage>
      <DialogShell>
        <MealBody body={
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px', textAlign:'center', color: C.dim }}>
            <div style={{ width:56, height:56, borderRadius:14, background: C.paperHi, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:14, fontSize:24 }}>🍽</div>
            <div style={{ fontFamily: display, fontSize:18, fontWeight:700, color: C.ink, letterSpacing:'-0.01em' }}>No items yet</div>
            <div style={{ fontSize:13, color: C.dim, marginTop:6, maxWidth:320, lineHeight:1.5 }}>Search a recipe or food item below to add it. Or add a group to organize items.</div>
            <div style={{ display:'flex', gap:8, marginTop:18 }}>
              <button style={{ height:36, padding:'0 14px', borderRadius:8, background:'transparent', border:`1px solid ${C.edgeHi}`, color: C.ink, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>+ Group</button>
            </div>
          </div>
        } />
      </DialogShell>
    </FullStage>
  );
}

function D7Skipped() {
  return (
    <FullStage>
      <DialogShell>
        <MealBody skip reason="leftovers from last night" />
      </DialogShell>
    </FullStage>
  );
}

function D8Invalid() {
  return (
    <FullStage>
      <DialogShell rightDisabled>
        <MealBody body={
          <div style={{ flex:1, padding:'0 24px', overflow:'auto' }}>
            <div style={{ margin:'18px 0 14px', padding:'12px 14px', background: 'rgba(232,122,138,0.10)', border:`1px solid ${C.danger}55`, borderRadius: 10, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:8, height:8, borderRadius:999, background: C.danger }} />
              <div style={{ fontSize:13, color: C.ink }}>One group has no title. Groups are all-or-nothing — name it or remove it to save.</div>
            </div>
            <div style={{ padding:'12px 14px', background: C.paper, border:`1px solid ${C.danger}55`, borderRadius:10, marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: C.danger }}>GROUP</span>
                <div style={{ flex:1, height:32, padding:'0 12px', background: C.paperHi, border:`1px solid ${C.danger}`, borderRadius:8, fontSize:13, color: C.mute, display:'flex', alignItems:'center' }}>Title required</div>
              </div>
            </div>
            <div style={{ padding:'10px 14px', background: C.paper, border:`1px solid ${C.edge}`, borderRadius:10 }}>
              <div style={{ fontSize:13, color: C.ink }}>1 lb spaghetti</div>
            </div>
          </div>
        } />
      </DialogShell>
    </FullStage>
  );
}

function D9CancelConfirm() {
  return (
    <FullStage>
      <DialogShell>
        <MealBody />
      </DialogShell>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', zIndex:7 }} />
      <div style={{
        position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)', zIndex:8,
        width:420, background: C.paper, border:`1px solid ${C.edgeHi}`, borderRadius:16,
        boxShadow:'0 24px 60px rgba(0,0,0,0.5)', padding:'22px 24px 20px',
        color: C.ink, fontFamily: sans,
      }}>
        <div style={{ fontFamily: display, fontSize:18, fontWeight:700, color: C.ink }}>Discard changes?</div>
        <div style={{ fontSize:13, color: C.dim, marginTop:8, lineHeight:1.55 }}>You have unsaved changes to Monday dinner. They'll be lost if you leave now.</div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
          <button style={{ height:36, padding:'0 14px', borderRadius:8, background:'transparent', border:`1px solid ${C.edge}`, color: C.ink, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>Keep editing</button>
          <button style={{ height:36, padding:'0 14px', borderRadius:8, background: C.danger, color:'#1a0f0f', border:'none', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>Discard</button>
        </div>
      </div>
    </FullStage>
  );
}

function D10RemoveGroup() {
  return (
    <FullStage>
      <DialogShell>
        <MealBody />
      </DialogShell>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', zIndex:7 }} />
      <div style={{
        position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)', zIndex:8,
        width:420, background: C.paper, border:`1px solid ${C.edgeHi}`, borderRadius:16,
        boxShadow:'0 24px 60px rgba(0,0,0,0.5)', padding:'22px 24px 20px',
        color: C.ink, fontFamily: sans,
      }}>
        <div style={{ fontFamily: display, fontSize:18, fontWeight:700, color: C.ink }}>Remove this group?</div>
        <div style={{ fontSize:13, color: C.dim, marginTop:8, lineHeight:1.55 }}>The group <b style={{ color: C.ink }}>Sides</b> and its 3 items will be removed from Monday dinner.</div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
          <button style={{ height:36, padding:'0 14px', borderRadius:8, background:'transparent', border:`1px solid ${C.edge}`, color: C.ink, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>Cancel</button>
          <button style={{ height:36, padding:'0 14px', borderRadius:8, background: C.danger, color:'#1a0f0f', border:'none', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>Remove group</button>
        </div>
      </div>
    </FullStage>
  );
}

Object.assign(window, { D1Default, D2QtyPopover, D3UnitPopover, D4Search, D5FullBackdrop, D6Empty, D7Skipped, D8Invalid, D9CancelConfirm, D10RemoveGroup });
})();
