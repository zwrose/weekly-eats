/* eslint-disable */
// B3 canonical edit-shell spec. Eight frames, every locked decision baked in.
// __IIFE_WRAPPED__
(function () {

const C = {
  bg:'#0f1115', paper:'#181b21', paperHi:'#1e222a', sheet:'#1a1e26',
  ink:'#e7e9ee', dim:'#9097a6', mute:'#5b6170',
  edge:'rgba(255,255,255,0.07)', edgeHi:'rgba(255,255,255,0.13)',
  accent:'#7aa7ff', accentDim:'rgba(122,167,255,0.16)',
  warn:'#f0c674', warnDim:'rgba(240,198,116,0.12)',
  danger:'#e87a8a', dangerDim:'rgba(232,122,138,0.14)',
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans    = `'Outfit', system-ui, sans-serif`;

// ---- chips --------------------------------------------------------------
function QtyChip({ value, active, warn }) {
  const border = warn ? C.warn : active ? C.accent : C.edgeHi;
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
function UnitChip({ value, active, warn }) {
  const border = warn ? C.warn : active ? C.accent : C.edge;
  const bg = active ? C.accentDim : 'transparent';
  return (
    <button style={{
      height:30, padding:'0 10px',
      border:`1px solid ${border}`, borderRadius:8,
      background: bg, color: C.ink, fontSize:13, fontFamily:'inherit',
      display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer',
    }}>{value} <span style={{ fontSize:9, color: C.mute }}>▾</span></button>
  );
}

// ---- rows ---------------------------------------------------------------
// Chips are content-sized inside fixed-width cells so they share a left edge
// across rows (qty column, unit column) without ever being padded wider
// than the widest chip in the meal.
const QTY_COL = 44;   // fits widest qty in this mock: "× 1" on recipe rows
const UNIT_COL = 78;  // fits widest unit chip: "head ▾"

function FoodRow({ name, qty, unit, qtyActive, unitActive, warn, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'10px 4px',
      borderBottom: last ? 'none' : `1px solid ${C.edge}`,
      background: (qtyActive || unitActive) ? 'rgba(122,167,255,0.05)' : 'transparent',
    }}>
      <div style={{ flex:1, minWidth:0, fontSize:14, color: warn ? C.warn : C.ink }}>
        {name || <span style={{ fontStyle:'italic', color: C.warn }}>Pick a food or recipe</span>}
      </div>
      <div style={{ width: QTY_COL, display:'flex', justifyContent:'flex-start' }}>
        <QtyChip value={qty} active={qtyActive} warn={warn && !name} />
      </div>
      <div style={{ width: UNIT_COL, display:'flex', justifyContent:'flex-start' }}>
        <UnitChip value={unit} active={unitActive} warn={warn && !name} />
      </div>
    </div>
  );
}
function RecipeRow({ name, emoji='🍝', qty, last }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
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

// ---- group section (flat — no nesting box) ------------------------------
function GroupSection({ title, items, last, titleWarn }) {
  return (
    <div style={{ marginTop:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'2px 4px', marginBottom:4 }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: C.dim }}>GROUP</span>
        <div style={{
          flex:1, height:30, display:'flex', alignItems:'center',
          padding:'0 10px',
          border:`1px solid ${titleWarn ? C.warn : C.edge}`, borderRadius:8,
          fontSize:13, color: title ? C.ink : C.mute,
          fontWeight:600,
        }}>
          {title || 'Group title (required)'}
        </div>
        <button style={{
          background:'transparent', border:'none', color: C.mute,
          cursor:'pointer', padding:'4px 6px', lineHeight:1,
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }}><span className="ms" style={{ fontSize: 17, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
      </div>
      {titleWarn && (
        <div style={{ fontSize:11, color: C.warn, padding:'0 4px 4px' }}>Group title is required</div>
      )}
      <div style={{ borderTop:`1px solid ${C.edge}` }}>
        {items.length === 0 ? (
          <EmptyState text="No items in this group" />
        ) : (
          items.map((it, i) => (
            it.type === 'recipe'
              ? <RecipeRow key={i} {...it} last={i === items.length - 1} />
              : <FoodRow key={i} {...it} last={i === items.length - 1} />
          ))
        )}
      </div>
    </div>
  );
}

// ---- empty-state cell ---------------------------------------------------
function EmptyState({ text, hint='+ Add item' }) {
  return (
    <div style={{ padding:'14px 6px', textAlign:'center' }}>
      <div style={{ fontSize:13, color: C.mute, marginBottom:6 }}>{text}</div>
      <button style={{
        background:'transparent', border:`1px dashed ${C.edge}`,
        color: C.dim, fontSize:12, padding:'6px 14px', borderRadius:999,
        fontFamily:'inherit', cursor:'pointer',
      }}>{hint}</button>
    </div>
  );
}

// ---- shell --------------------------------------------------------------
function shellStyle() {
  return { background: C.bg, color: C.ink, fontFamily: sans,
    width:'100%', height:'100%', position:'relative', overflow:'hidden' };
}
function StatusBar() {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'14px 22px 4px', fontSize:13, fontWeight:600,
    }}>
      <span>9:41</span>
      <span style={{ display:'flex', gap:6, opacity:.85, fontSize:11 }}>
        <span>●●●</span><span>📶</span><span>100%</span>
      </span>
    </div>
  );
}
function NavBar({ rightDisabled, leftLabel='‹ Plan' }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'12px 16px', borderBottom:`1px solid ${C.edge}`,
    }}>
      <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:14, fontFamily:'inherit', padding:0, minWidth:60, textAlign:'left' }}>{leftLabel}</button>
      <div style={{ textAlign:'center', flex:1, minWidth:0, padding:'0 8px' }}>
        <div style={{ fontFamily: display, fontSize:15, fontWeight:700, letterSpacing:'-0.01em' }}>Monday dinner</div>
        <div style={{ fontSize:11, color: C.dim, marginTop:1 }}>May 11</div>
      </div>
      <button style={{
        background:'transparent', border:'none',
        color: rightDisabled ? C.mute : C.accent,
        fontSize:14, fontWeight:600, fontFamily:'inherit', padding:0, minWidth:60, textAlign:'right',
      }}>Done</button>
    </div>
  );
}
function SkipBar({ skipped, reason, reasonOpen }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', gap:10,
      padding:'12px 16px', borderBottom:`1px solid ${C.edge}`,
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
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase', marginBottom:6 }}>Reason <span style={{ fontWeight:500, letterSpacing:'normal', textTransform:'none', color: C.mute }}>(optional)</span></div>
          <div style={{
            display:'flex', alignItems:'center', minHeight:44, padding:'10px 12px',
            background:'transparent',
            border:`1px solid ${reasonOpen ? C.accent : C.edge}`,
            boxShadow: reasonOpen ? `0 0 0 3px ${C.accentDim}` : 'none',
            borderRadius:10, fontSize:14, color: reason ? C.ink : C.mute,
            lineHeight: 1.35,
          }}>
            {reason || 'e.g. out for work lunch, leftovers tonight, big breakfast at brunch…'}{reasonOpen && <span style={{ display:'inline-block', width:1.5, height:16, background:C.accent, marginLeft:2 }} />}
          </div>
        </div>
      )}
    </div>
  );
}
function StickySearch({ value='', focus, results }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0,
      padding:'10px 12px 16px',
      background:`linear-gradient(180deg, rgba(15,17,21,0) 0%, ${C.bg} 30%)`,
    }}>
      {results}
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'10px 12px',
        background: C.paperHi,
        border: focus ? `1px solid ${C.accent}55` : `1px solid ${C.edgeHi}`,
        boxShadow: focus ? `0 0 0 3px ${C.accentDim}` : 'none',
        borderRadius:12,
      }}>
        <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
        <div style={{ flex:1, fontSize:13, color: value ? C.ink : C.mute }}>
          {value || 'Add item, recipe, or new group'}{focus && <span style={{ display:'inline-block', width:1.5, height:14, background:C.accent, marginLeft:1, verticalAlign:'-2px' }} />}
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
      marginBottom:8, background: C.paper, border:`1px solid ${C.edge}`, borderRadius:12,
      overflow:'hidden',
    }}>
      <SectionLabel>Recipes</SectionLabel>
      <ResultRow emoji="🍝" name="Parmesan butter pasta" sub="Recipe · 4 servings" />
      <SectionLabel mt>Food items</SectionLabel>
      <ResultRow name="parmesan, grated" sub="cup" />
      <ResultRow name="parmesan rind" sub="each" />
      <SectionLabel mt>Create</SectionLabel>
      <ResultRow icon="+" name={'Add "parm" as new food item'} accent />
      <ResultRow icon="⊞" name='New group with "parm"' accent />
    </div>
  );
}
function SectionLabel({ children, mt }) {
  return (
    <div style={{
      fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim,
      textTransform:'uppercase', padding: mt ? '10px 12px 4px' : '10px 12px 4px',
      borderTop: mt ? `1px solid ${C.edge}` : 'none',
    }}>{children}</div>
  );
}
function ResultRow({ emoji, icon, name, sub, accent }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px' }}>
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

// ---- the body (shared across most frames) -------------------------------
function MealBody({ qtyActive, unitActive, skip, reason, reasonOpen, body }) {
  return (
    <div style={{ position:'absolute', inset:0, top:32, background: C.bg, display:'flex', flexDirection:'column' }}>
      <NavBar />
      <SkipBar skipped={skip} reason={reason} reasonOpen={reasonOpen} />
      <div style={{ padding:'12px 16px 100px', flex:1, overflowY:'auto' }}>
        {body}
      </div>
    </div>
  );
}

// Standard items: pasta recipe + side-salad group
function DefaultItems({ qtyActive, unitActive }) {
  return (
    <>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase', marginBottom:4 }}>Items</div>
      <div style={{ borderTop:`1px solid ${C.edge}` }}>
        <RecipeRow name="Lemon ricotta pasta" qty={1} last />
      </div>
      <GroupSection
        title="Side salad"
        items={[
          { type:'food', name:'romaine',          qty:1, unit:'head' },
          { type:'food', name:'cherry tomatoes', qty:1, unit:'pint',
            qtyActive: qtyActive, unitActive: unitActive,
          },
          { type:'food', name:'cucumber',         qty:1, unit:'each' },
        ]}
      />
    </>
  );
}

// ============================================================================
// Numpad bottom sheet
// ============================================================================
function NumpadKey({ children, kind='digit', wide }) {
  const styles = {
    digit:  { background: C.paper, color: C.ink, border:`1px solid ${C.edge}` },
    action: { background: 'transparent', color: C.dim, border:`1px solid ${C.edge}` },
  }[kind];
  return (
    <button style={{
      ...styles, height:50, gridColumn: wide ? 'span 2' : 'auto',
      borderRadius:12, fontSize:20, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>{children}</button>
  );
}
function PresetPill({ children, active }) {
  return (
    <button style={{
      height:28, padding:'0 12px',
      background: active ? C.accentDim : 'transparent',
      color: active ? C.accent : C.dim,
      border:`1px solid ${active ? C.accent+'55' : C.edge}`,
      borderRadius:999, fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
      fontVariantNumeric:'tabular-nums',
    }}>{children}</button>
  );
}
function NumpadSheet({ value='1' }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0,
      background: C.sheet,
      borderTopLeftRadius:18, borderTopRightRadius:18,
      boxShadow:'0 -10px 30px rgba(0,0,0,0.4)',
      display:'flex', flexDirection:'column', zIndex:5,
    }}>
      <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 16px 10px', borderBottom:`1px solid ${C.edge}` }}>
        <button style={{ background:'transparent', border:'none', color: C.dim, fontSize:14, fontFamily:'inherit', minWidth:60, textAlign:'left' }}>Cancel</button>
        <div style={{ textAlign:'center', flex:1 }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase' }}>Quantity</div>
          <div style={{ fontFamily: display, fontSize:30, fontWeight:700, marginTop:2, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>{value}</div>
        </div>
        <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:14, fontWeight:600, fontFamily:'inherit', minWidth:60, textAlign:'right' }}>Done</button>
      </div>
      <div style={{ display:'flex', gap:6, padding:'10px 16px', overflowX:'auto', borderBottom:`1px solid ${C.edge}` }}>
        <PresetPill>¼</PresetPill>
        <PresetPill>½</PresetPill>
        <PresetPill>¾</PresetPill>
        <PresetPill active>1</PresetPill>
        <PresetPill>1½</PresetPill>
        <PresetPill>2</PresetPill>
        <PresetPill>3</PresetPill>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, padding:'12px 16px 22px' }}>
        <NumpadKey>1</NumpadKey><NumpadKey>2</NumpadKey><NumpadKey>3</NumpadKey>
        <NumpadKey>4</NumpadKey><NumpadKey>5</NumpadKey><NumpadKey>6</NumpadKey>
        <NumpadKey>7</NumpadKey><NumpadKey>8</NumpadKey><NumpadKey>9</NumpadKey>
        <NumpadKey kind="action">.</NumpadKey>
        <NumpadKey>0</NumpadKey>
        <NumpadKey kind="action">⌫</NumpadKey>
      </div>
    </div>
  );
}

// ============================================================================
// Unit picker sheet (compressed)
// ============================================================================
function UnitRow({ name, abbr, selected }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10,
      padding:'9px 12px',
      background: selected ? C.accentDim : 'transparent', borderRadius:8,
    }}>
      <div style={{
        width:16, height:16, borderRadius:'50%',
        border:`1.5px solid ${selected ? C.accent : C.edgeHi}`,
        display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      }}>
        {selected && <div style={{ width:8, height:8, borderRadius:'50%', background: C.accent }} />}
      </div>
      <div style={{ flex:1, fontSize:14, color: C.ink, fontWeight: selected ? 600 : 500 }}>{name}</div>
      {abbr && <div style={{ fontSize:11, color: C.dim }}>{abbr}</div>}
    </div>
  );
}
function UnitGroup({ title, children }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', padding:'0 12px 4px' }}>{title}</div>
      {children}
    </div>
  );
}
function UnitPickerSheet() {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, height:'72%',
      background: C.sheet, borderTopLeftRadius:18, borderTopRightRadius:18,
      boxShadow:'0 -10px 30px rgba(0,0,0,0.4)',
      display:'flex', flexDirection:'column', zIndex:5,
    }}>
      <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }} />
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 16px 10px', borderBottom:`1px solid ${C.edge}` }}>
        <button style={{ background:'transparent', border:'none', color: C.dim, fontSize:14, fontFamily:'inherit', minWidth:60, textAlign:'left' }}>Cancel</button>
        <div style={{ textAlign:'center', flex:1 }}>
          <div style={{ fontFamily: display, fontSize:15, fontWeight:700 }}>Unit</div>
          <div style={{ fontSize:11, color: C.dim, marginTop:1 }}>for qty 1</div>
        </div>
        <div style={{ minWidth:60 }} />
      </div>
      <div style={{ padding:'10px 12px 6px' }}>
        <div style={{
          display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
          background: C.paperHi, border:`1px solid ${C.edgeHi}`, borderRadius:10,
        }}>
          <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
          <div style={{ flex:1, fontSize:13, color: C.mute }}>Search units</div>
        </div>
      </div>
      <div style={{ overflowY:'auto', padding:'4px 6px 22px' }}>
        <UnitGroup title="Volume">
          <UnitRow name="cup" abbr="c" />
          <UnitRow name="pint" abbr="pt" selected />
          <UnitRow name="quart" abbr="qt" />
          <UnitRow name="gallon" abbr="gal" />
          <UnitRow name="fluid ounce" abbr="fl oz" />
          <UnitRow name="tablespoon" abbr="tbsp" />
          <UnitRow name="teaspoon" abbr="tsp" />
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
    </div>
  );
}

// ============================================================================
// Confirm dialog
// ============================================================================
function ConfirmDialog({ title, body, primary='Discard', primaryColor=C.danger }) {
  return (
    <>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', zIndex:6 }} />
      <div style={{
        position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)',
        width:'82%', maxWidth:320, background: C.sheet,
        borderRadius:14, zIndex:7,
        border:`1px solid ${C.edge}`,
      }}>
        <div style={{ padding:'18px 18px 8px', textAlign:'center' }}>
          <div style={{ fontFamily: display, fontSize:16, fontWeight:700 }}>{title}</div>
          <div style={{ fontSize:13, color: C.dim, marginTop:6, lineHeight:1.4 }}>{body}</div>
        </div>
        <div style={{ display:'flex', borderTop:`1px solid ${C.edge}` }}>
          <button style={{
            flex:1, height:44, background:'transparent', border:'none',
            color: C.ink, fontSize:15, fontFamily:'inherit', cursor:'pointer',
            borderRight:`1px solid ${C.edge}`,
          }}>Keep editing</button>
          <button style={{
            flex:1, height:44, background:'transparent', border:'none',
            color: primaryColor, fontSize:15, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
          }}>{primary}</button>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Frames
// ============================================================================
function F1Default() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <MealBody body={<DefaultItems />} />
      <StickySearch />
    </div>
  );
}
function F2QtyOpen() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <div style={{ opacity:0.6 }}>
        <MealBody body={<DefaultItems qtyActive />} />
      </div>
      <NumpadSheet value="1" />
    </div>
  );
}
function F3UnitOpen() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <div style={{ opacity:0.6 }}>
        <MealBody body={<DefaultItems unitActive />} />
      </div>
      <UnitPickerSheet />
    </div>
  );
}
function F4SearchActive() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <MealBody body={<DefaultItems />} />
      <StickySearch value="parm" focus results={<SearchResults />} />
    </div>
  );
}
function F5Empty() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <MealBody body={
        <>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase', marginBottom:4 }}>Items</div>
          <EmptyState text="No items planned yet" hint="↓ Add from the search below" />
          <GroupSection title="Side salad" items={[]} />
        </>
      } />
      <StickySearch />
    </div>
  );
}
function F6Skipped() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <MealBody skip reason="out — work lunch" reasonOpen={false} body={
        <div style={{ padding:'40px 16px', textAlign:'center', color: C.dim, fontSize:13, fontStyle:'italic' }}>
          This meal is skipped. Toggle off above to plan it.
        </div>
      } />
    </div>
  );
}
function F7Invalid() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <MealBody body={
        <>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase', marginBottom:4 }}>Items</div>
          <div style={{ borderTop:`1px solid ${C.edge}` }}>
            <RecipeRow name="Lemon ricotta pasta" qty={1} last />
          </div>
          <GroupSection
            title=""
            titleWarn
            items={[
              { type:'food', name:'romaine',          qty:1, unit:'head' },
              { type:'food', name:'',                  qty:1, unit:'cup', warn:true },
              { type:'food', name:'cucumber',         qty:1, unit:'each' },
            ]}
          />
        </>
      } />
      <StickySearch />
      {/* override NavBar disabled state via overlay — easier than threading prop */}
      <div style={{ position:'absolute', top:36, right:16, color: C.mute, fontSize:14, fontWeight:600, pointerEvents:'none' }}>Done</div>
      <div style={{ position:'absolute', top:36, right:16, width:36, height:18, background:C.bg }} />
      <div style={{ position:'absolute', top:36, right:16, color: C.mute, fontSize:14, fontWeight:600, pointerEvents:'none' }}>Done</div>
    </div>
  );
}
function F8CancelConfirm() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <div style={{ opacity:0.5 }}>
        <MealBody body={<DefaultItems />} />
        <StickySearch />
      </div>
      <ConfirmDialog
        title="Discard changes?"
        body="You've made changes to Monday dinner. They won't be saved."
      />
    </div>
  );
}

function F9RemoveGroup() {
  return (
    <div style={shellStyle()}>
      <StatusBar />
      <div style={{ opacity:0.5 }}>
        <MealBody body={<DefaultItems />} />
        <StickySearch />
      </div>
      <ConfirmDialog
        title="Remove group?"
        body='"Side salad" and its 3 items will be removed from this meal.'
        primary="Remove"
      />
    </div>
  );
}

Object.assign(window, {
  F1Default, F2QtyOpen, F3UnitOpen, F4SearchActive,
  F5Empty, F6Skipped, F7Invalid, F8CancelConfirm, F9RemoveGroup,
});
})();
