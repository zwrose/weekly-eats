/* eslint-disable */
// Recipes surfaces — re-themed with our design tokens. No new features.
// Mobile: list, view, edit. Desktop: same three. Mirrors RecipeViewDialog +
// RecipeEditorDialog + RecipeFilterBar + recipes/page.tsx structure from main.
// __IIFE_WRAPPED__
(function () {


const { TopNav, BottomNav } = window.NavChrome;
const C = {
  bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a', sheet: '#1a1e26', paperPast: '#141619',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)', edgeHi: 'rgba(255,255,255,0.13)',
  accent: '#e8a86b', accentDim: 'rgba(232,168,107,0.16)',
  staples: '#c4a7e7', success: '#8edcb4', successDim: 'rgba(142,220,180,0.14)',
  danger: '#e87a8a', warn: '#f0c674'
};
const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

// ---- recipes data ------------------------------------------------------
const RECIPES = [
{ emoji: '🍝', title: 'Lemon ricotta pasta', tags: ['italian', '30 min', 'vegetarian'], rating: 5, updated: 'May 4', access: 'private' },
{ emoji: '🍲', title: 'Thai coconut curry', tags: ['thai', 'curry', 'weeknight'], rating: 5, updated: 'May 1', access: 'private' },
{ emoji: '🌮', title: 'Sheet-pan chicken tacos', tags: ['weeknight', 'sheet pan'], rating: 4, updated: 'Apr 26', access: 'private' },
{ emoji: '🥣', title: 'Overnight oats', tags: ['breakfast', 'prep-ahead'], rating: 4, updated: 'Apr 22', access: 'shared-by-others' },
{ emoji: '🥗', title: 'Mediterranean grain bowl', tags: ['lunch', 'vegetarian', 'meal prep'], rating: 5, updated: 'Apr 18', access: 'shared-by-you' },
{ emoji: '🍕', title: 'Homemade pizza', tags: ['weekend', 'kid favorite'], rating: 5, updated: 'Apr 14', access: 'private' },
{ emoji: '🍗', title: 'Roast chicken', tags: ['sunday', 'classic'], rating: 5, updated: 'Apr 11', access: 'private' },
{ emoji: '🥞', title: 'Buttermilk pancakes', tags: ['breakfast', 'weekend'], rating: 4, updated: 'Apr 7', access: 'private' }];


const SAMPLE = {
  emoji: '🍝', title: 'Lemon ricotta pasta', tags: ['italian', '30 min', 'vegetarian'], rating: 5, access: 'private',
  // Recipes: groups are all-or-nothing. If any list has a title, every list must.
  ingredients: [
  { title: 'Pasta', items: [
    { qty: 1,    unit: 'lb',    name: 'spaghetti or linguine' },
    { qty: 1,    unit: 'cup',   name: 'ricotta cheese' },
    { qty: 0.5,  unit: 'cup',   name: 'parmesan' },
    { qty: 2,    unit: 'each',  name: 'lemons',  prep: 'zest + juice' },
    { qty: 3,    unit: 'tbsp',  name: 'olive oil' },
    { qty: 2,    unit: 'clove', name: 'garlic',  prep: 'minced' },
    { qty: 0.25, unit: 'cup',   name: 'basil',   prep: 'torn' }]
  },
  { title: 'For finishing', items: [
    { qty: 1,    unit: 'pinch', name: 'flaky salt' },
    { qty: 1,    unit: 'pinch', name: 'black pepper' },
    { qty: 0.25, unit: 'cup',   name: 'parmesan', prep: 'grated' }]
  }],

  instructions: [
  'Bring a large pot of salted water to a boil. Cook pasta according to package directions until al dente.',
  'While pasta cooks, whisk ricotta, parmesan, lemon zest, lemon juice, olive oil, and garlic in a large bowl until smooth.',
  'Reserve ½ cup pasta water before draining. Add hot pasta to the ricotta mixture and toss, adding pasta water a few tablespoons at a time until creamy.',
  'Fold in torn basil. Taste and adjust seasoning with salt and pepper.',
  'Serve in bowls topped with extra parmesan and a drizzle of olive oil.']

};

// ---- shared chrome ----------------------------------------------------
function StatusBar() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px 4px', fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: sans }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 6, opacity: .85, fontSize: 11 }}>
        <span>●●●</span><span>📶</span><span>100%</span>
      </span>
    </div>);

}
function PeopleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 18 14" fill="none" style={{ verticalAlign: 'middle' }}>
      <circle cx="6" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 12 C2 9, 4 8, 6 8 C8 8, 10 9, 10 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M11 12 C11 10, 12.5 9, 14 9 C15.5 9, 16.5 10, 16.5 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>);

}
function DotBadge({ bg = C.bg }) {
  return <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: C.accent, border: `2px solid ${bg}` }} />;
}
const btnGhostIcon = { width: 36, height: 36, borderRadius: 10, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 16, fontFamily: 'inherit' };
const btnPrimary = { height: 38, padding: '0 16px', borderRadius: 10, background: C.accent, color: '#0c1118', border: 'none', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' };
const btnGhost = { height: 38, padding: '0 16px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.edge}`, color: C.ink, fontSize: 14, fontFamily: 'inherit' };

function Stars({ rating, size = 12 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: C.warn, fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ opacity: n <= rating ? 1 : 0.22 }}>★</span>)}
    </span>);

}
function TagChip({ children, small }) {
  return (
    <span style={{
      fontSize: small ? 10 : 11, color: C.dim, padding: small ? '1px 6px' : '2px 8px',
      border: `1px solid ${C.edge}`, borderRadius: 999, fontFamily: sans, whiteSpace: 'nowrap'
    }}>{children}</span>);

}
function AccessChip({ access }) {
  const map = {
    'private': { label: 'Private', color: C.dim },
    'shared-by-you': { label: 'Shared by you', color: C.success },
    'shared-by-others': { label: 'Shared by others', color: C.accent }
  }[access];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: map.color, padding: '3px 8px', border: `1px solid ${C.edge}`, borderRadius: 999, fontFamily: sans }}>{map.label}</span>);

}

// ============================================================================
// MOBILE · LIST
// ============================================================================
function MobileList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <StatusBar />
      <div style={{ padding: '12px 18px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Your recipes</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}><span style={{ color: C.accent, fontWeight: 600 }}>34</span> recipes</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...btnGhostIcon, position: 'relative' }} title="Sharing"><PeopleIcon /><DotBadge /></button>
          <button style={{ ...btnPrimary, height: 36, padding: '0 12px' }}>+ New</button>
        </div>
      </div>
      {/* Filter bar */}
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 38, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search recipes, tags…</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <FilterChip>All tags</FilterChip>
          <FilterChip selected>★ 4+</FilterChip>
          <FilterChip>Sort: Updated</FilterChip>
        </div>
      </div>
      <div style={{ overflowY: 'auto', height: 'calc(100% - 280px)', padding: '0 14px 110px' }}>
        {RECIPES.map((r, i) => <RecipeRowMobile key={i} recipe={r} />)}
      </div>
      <BottomNav active="recipes" />
    </div>);

}
function FilterChip({ children, selected }) {
  return (
    <button style={{
      height: 30, padding: '0 12px',
      background: selected ? C.accentDim : 'transparent',
      border: `1px solid ${selected ? C.accent : C.edge}`,
      color: selected ? C.accent : C.dim,
      borderRadius: 999, fontSize: 12, fontWeight: 500, fontFamily: sans
    }}>{children}</button>);

}
function RecipeRowMobile({ recipe }) {
  return (
    <div style={{ background: C.paper, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: C.paperHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{recipe.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Stars rating={recipe.rating} />
          <span style={{ fontSize: 11, color: C.mute }}>· updated {recipe.updated}</span>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
          {recipe.tags.slice(0, 3).map((t, i) => <TagChip key={i} small>{t}</TagChip>)}
        </div>
      </div>
      <span style={{ color: C.dim, fontSize: 14, paddingTop: 6 }}>›</span>
    </div>);

}

function MobileListTagsOpen() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <StatusBar />
      <div style={{ opacity: 0.55 }}><MobileListHeader /></div>
      <div style={{ position:'absolute', inset:0, top:60, background:'rgba(0,0,0,0.55)', zIndex:4 }} />
      {/* Sheet: Tag filter */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, zIndex:5,
        background: C.sheet, borderTopLeftRadius:18, borderTopRightRadius:18,
        boxShadow:'0 -10px 30px rgba(0,0,0,0.4)', maxHeight:'78%',
        display:'flex', flexDirection:'column',
      }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 16px 12px', borderBottom:`1px solid ${C.edge}` }}>
          <button style={{ background:'transparent', border:'none', color: C.dim, fontSize:14, fontFamily:'inherit', minWidth:60, textAlign:'left' }}>Reset</button>
          <div style={{ fontFamily: display, fontSize:15, fontWeight:700 }}>Filter by tags</div>
          <button style={{ background:'transparent', border:'none', color: C.accent, fontSize:14, fontWeight:600, fontFamily:'inherit', minWidth:60, textAlign:'right' }}>Done</button>
        </div>
        <div style={{ padding:'14px 18px', overflowY:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', height:38, background: C.paperHi, border:`1px solid ${C.edgeHi}`, borderRadius:10, marginBottom:14 }}>
            <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
            <div style={{ flex:1, fontSize:13, color: C.mute }}>Search tags…</div>
          </div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', marginBottom:8 }}>Selected · 2</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
            <SelectableTag selected>weeknight</SelectableTag>
            <SelectableTag selected>vegetarian</SelectableTag>
          </div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', marginBottom:8 }}>All tags</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['breakfast','lunch','dinner','italian','thai','curry','sheet pan','meal prep','weekend','kid favorite','sunday','classic','prep-ahead','30 min','60 min'].map(t => <SelectableTag key={t}>{t}</SelectableTag>)}
          </div>
        </div>
      </div>
    </div>
  );
}
function SelectableTag({ children, selected }) {
  return (
    <button style={{
      fontSize: 12, padding: '6px 12px',
      background: selected ? C.accentDim : 'transparent',
      color: selected ? C.accent : C.dim,
      border: `1px solid ${selected ? C.accent : C.edge}`,
      borderRadius: 999, fontFamily: sans, cursor:'pointer',
      display:'inline-flex', alignItems:'center', gap:5,
    }}>
      {selected && <span style={{ fontSize:10, fontWeight:700 }}>✓</span>}
      {children}
    </button>
  );
}
function MobileListHeader() {
  return (
    <>
      <div style={{ padding: '12px 18px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Your recipes</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}><span style={{ color: C.accent, fontWeight: 600 }}>34</span> recipes</div>
        </div>
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 38, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search recipes, tags…</div>
        </div>
      </div>
    </>
  );
}

function MobileListFiltered() {
  const filtered = RECIPES.filter(r => r.rating >= 4 && (r.tags.includes('weeknight') || r.tags.includes('vegetarian'))).slice(0, 4);
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <StatusBar />
      <div style={{ padding: '12px 18px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Your recipes</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}><span style={{ color: C.accent, fontWeight: 600 }}>{filtered.length}</span> matches · <span style={{ color: C.accent }}>Clear filters</span></div>
        </div>
      </div>
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 38, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
          <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
          <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search recipes, tags…</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <FilterChip selected>Tags · 2</FilterChip>
          <FilterChip selected>★ 4+</FilterChip>
          <FilterChip>Sort: Updated</FilterChip>
        </div>
      </div>
      <div style={{ overflowY: 'auto', height: 'calc(100% - 280px)', padding: '0 14px 110px' }}>
        {filtered.map((r, i) => <RecipeRowMobile key={i} recipe={r} />)}
      </div>
      <BottomNav active="recipes" />
    </div>
  );
}

// ============================================================================
// MOBILE · VIEW
// ============================================================================
function MobileView() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>‹ Recipes</button>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>Edit</button>
      </div>
      <div style={{ overflowY: 'auto', height: 'calc(100% - 130px)', padding: '18px 18px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: C.paperHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{SAMPLE.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{SAMPLE.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Stars rating={SAMPLE.rating} size={13} />
              <AccessChip access={SAMPLE.access} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {SAMPLE.tags.map((t, i) => <TagChip key={i}>{t}</TagChip>)}
        </div>

        <SectionLabel>Ingredients</SectionLabel>
        <div style={{ background: C.paper, borderRadius: 12, padding: '12px 14px', marginBottom: 18 }} data-comment-anchor="4a7c556051-div-237-9">
          {SAMPLE.ingredients.map((group, gi) =>
          <div key={gi} style={{ marginBottom: gi < SAMPLE.ingredients.length - 1 ? 14 : 0 }}>
              {group.title && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, marginBottom: 8 }}>{group.title}</div>}
              {group.items.map((it, ii) =>
            <div key={ii} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', fontSize: 14 }}>
                  <span style={{ width: 72, color: C.dim, fontFamily: sans, fontVariantNumeric: 'tabular-nums' }}>{it.qty}{it.unit !== 'each' ? ` ${it.unit}` : ''}</span>
                  <span style={{ flex: 1, color: C.ink }}>{it.name}{it.prep && <span style={{ color: C.dim, fontStyle:'italic' }}>, {it.prep}</span>}</span>
                </div>
            )}
            </div>
          )}
        </div>

        <SectionLabel>Instructions</SectionLabel>
        <div style={{ background: C.paper, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, fontFamily: sans, whiteSpace: 'pre-wrap' }}>
            {SAMPLE.instructions.join('\n\n')}
          </div>
        </div>
      </div>
      <BottomNav active="recipes" />
    </div>);

}
function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 4px 8px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase', fontFamily: sans }}>{children}</div>
      <div style={{ flex: 1, height: 1, background: C.edge }} />
      {right && <div style={{ fontSize: 12, color: C.accent, fontFamily: sans }}>{right}</div>}
    </div>);

}

// ============================================================================
// MOBILE · EDIT
// ============================================================================
function MobileEdit() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C.edge}` }}>
        <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', padding: 0 }}>Cancel</button>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Edit recipe</div>
        <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>Save</button>
      </div>
      <div style={{ overflowY: 'auto', height: 'calc(100% - 130px)', padding: '18px 18px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <button style={{ width: 56, height: 56, borderRadius: 14, background: C.paperHi, border: `1px dashed ${C.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, cursor: 'pointer' }}>🍝</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldLabel>Title</FieldLabel>
            <TextInput value="Lemon ricotta pasta" />
          </div>
        </div>

        <FieldLabel>Access</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <RadioRow label="Personal" selected />
          <RadioRow label="Global" />
        </div>

        <FieldLabel>Tags</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {SAMPLE.tags.map((t, i) =>
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.ink, padding: '4px 8px 4px 10px', background: C.paperHi, borderRadius: 999 }}>
              {t} <span style={{ color: C.dim, fontSize: 11, cursor: 'pointer' }}>✕</span>
            </span>
          )}
          <span style={{ fontSize: 11, color: C.dim, padding: '4px 10px', border: `1px dashed ${C.edge}`, borderRadius: 999, cursor: 'pointer' }}>+ Add tag</span>
        </div>

        <FieldLabel>Your rating</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <Stars rating={5} size={20} />
          <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 12 }}>Clear</button>
        </div>

        <SectionLabel right={<span style={{ color: C.accent }}>+ Group</span>}>Ingredients</SectionLabel>
        <div style={{ marginBottom: 18 }} data-comment-anchor="20694937e6-div-316-9">
          {SAMPLE.ingredients.map((group, gi) => (
            <div key={gi} style={{ background: C.paper, borderRadius: 12, padding: '12px 12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: C.dim }}>GROUP</span>
                <div style={{ flex: 1, height: 30, display: 'flex', alignItems: 'center', padding: '0 10px', border: `1px solid ${C.edge}`, borderRadius: 8, fontSize: 13, color: C.ink, fontWeight: 600 }}>{group.title}</div>
                <button style={{ background: 'transparent', border: 'none', color: C.mute, padding: '0 4px', display:'inline-flex', alignItems:'center' }}><span className="ms" style={{ fontSize: 17, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
              </div>
              {group.items.map((it, i) => (
                <MobileIngredientRow key={i} item={it} last={i === group.items.length - 1} />
              ))}
              <button style={{ width: '100%', marginTop: 8, padding: '8px 10px', background: 'transparent', border: `1px dashed ${C.edge}`, borderRadius: 8, color: C.dim, fontSize: 12, fontFamily: sans, textAlign: 'left' }}>+ Add ingredient</button>
            </div>
          ))}
        </div>

        <SectionLabel>Instructions</SectionLabel>
        <div style={{ background: C.paper, borderRadius: 12, padding: '12px 14px', marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, fontFamily: sans, whiteSpace: 'pre-wrap' }}>
            {SAMPLE.instructions.slice(0, 3).join('\n\n')}
            <span style={{ display: 'inline-block', width: 1.5, height: 15, background: C.accent, marginLeft: 1, verticalAlign: '-3px' }} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.dim, padding: '0 4px 12px' }}>Markdown supported.</div>

        <button style={{ width: '100%', height: 40, padding: '0 16px', background: 'transparent', border: `1px solid ${C.danger}55`, borderRadius: 10, color: C.danger, fontSize: 14, fontWeight: 600, fontFamily: sans }}>🗑 Delete recipe</button>
      </div>
    </div>);

}
function MobileIngredientRow({ item, last }) {
  return (
    <div style={{ borderTop: last && false ? 'none' : `1px solid ${C.edge}`, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
        <button style={{ height: 30, padding: '0 10px', border: `1px solid ${C.edgeHi}`, borderRadius: 8, background: 'transparent', color: C.ink, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: sans }}>{item.qty}</button>
        <button style={{ height: 30, padding: '0 10px', border: `1px solid ${C.edge}`, borderRadius: 8, background: 'transparent', color: C.ink, fontSize: 13, fontFamily: sans, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{item.unit} <span style={{ fontSize: 9, color: C.mute }}>▾</span></button>
        <button style={{ background: 'transparent', border: 'none', color: C.mute, display:'inline-flex', alignItems:'center', padding:'0 4px' }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
      </div>
      {item.prep ? (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, paddingLeft:2 }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase' }}>Prep</span>
          <div style={{ flex:1, height:28, padding:'0 10px', display:'flex', alignItems:'center', border:`1px solid ${C.edge}`, borderRadius:8, fontSize:12, color: C.ink, fontStyle:'italic' }}>{item.prep}</div>
          <button style={{ background:'transparent', border:'none', color: C.mute, display:'inline-flex', alignItems:'center', padding:'0 4px' }}><span className="ms" style={{ fontSize: 15, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
        </div>
      ) : (
        <button style={{ marginTop:4, background:'transparent', border:'none', color: C.dim, fontSize:11, fontFamily: sans, padding:'2px 0', cursor:'pointer' }}>+ prep instructions</button>
      )}
    </div>
  );
}
function FieldLabel({ children, mt }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginTop: mt ? 16 : 0, marginBottom: 8, fontFamily: sans }}>{children}</div>;
}
function TextInput({ value }) {
  return (
    <div style={{ height: 38, padding: '0 12px', display: 'flex', alignItems: 'center', border: `1px solid ${C.edge}`, borderRadius: 10, fontSize: 14, color: C.ink, fontFamily: sans }}>{value}</div>);

}
function RadioRow({ label, selected }) {
  return (
    <label style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
      background: selected ? C.accentDim : 'transparent',
      border: `1px solid ${selected ? `${C.accent}55` : C.edge}`,
      borderRadius: 10, cursor: 'pointer'
    }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${selected ? C.accent : C.edgeHi}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />}
      </div>
      <div style={{ fontSize: 14, color: C.ink, fontWeight: selected ? 600 : 500, fontFamily: sans }}>{label}</div>
    </label>);

}

function DesktopIngredientRow({ item, last }) {
  return (
    <div style={{ borderTop: last ? 'none' : `1px solid ${C.edge}`, padding: '8px 0' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
        <button style={{ height: 30, padding: '0 10px', border: `1px solid ${C.edgeHi}`, borderRadius: 8, background: 'transparent', color: C.ink, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: sans }}>{item.qty}</button>
        <button style={{ height: 30, padding: '0 10px', border: `1px solid ${C.edge}`, borderRadius: 8, background: 'transparent', color: C.ink, fontSize: 13, fontFamily: sans, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{item.unit} <span style={{ fontSize: 9, color: C.mute }}>▾</span></button>
        <button style={{ background: 'transparent', border: 'none', color: C.mute, display:'inline-flex', alignItems:'center', padding:'0 4px' }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
      </div>
      {item.prep ? (
        <div style={{ display:'flex', alignItems:'center', gap: 6, marginTop: 6, paddingLeft: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing:'0.14em', color: C.dim, textTransform:'uppercase' }}>Prep</span>
          <div style={{ flex: 1, height: 28, padding: '0 10px', display:'flex', alignItems:'center', border: `1px solid ${C.edge}`, borderRadius: 8, fontSize: 12, color: C.ink, fontStyle:'italic' }}>{item.prep}</div>
          <button style={{ background:'transparent', border:'none', color: C.mute, display:'inline-flex', alignItems:'center', padding:'0 4px' }}><span className="ms" style={{ fontSize: 15, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
        </div>
      ) : (
        <button style={{ marginTop: 4, background:'transparent', border:'none', color: C.dim, fontSize: 11, fontFamily: sans, padding: '2px 0', cursor:'pointer' }}>+ prep instructions</button>
      )}
    </div>
  );
}

// ============================================================================
// DESKTOP · LIST
// ============================================================================
function DesktopList() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="recipes" />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 32px' }}>
        <div style={{ padding: '24px 0 18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: display, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Your recipes</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}><span style={{ color: C.accent, fontWeight: 600 }}>34</span> recipes</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnGhostIcon, position: 'relative' }} title="Sharing"><PeopleIcon /><DotBadge /></button>
            <button style={btnPrimary}>+ New recipe</button>
          </div>
        </div>
        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 38, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
            <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
            <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search recipes, tags…</div>
          </div>
          <FilterChip>Tags</FilterChip>
          <FilterChip selected>★ 4+</FilterChip>
          <FilterChip>Sort: Updated ▾</FilterChip>
        </div>

        {/* Table */}
        <div style={{ background: C.paper, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.edge}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px 100px 110px', padding: '12px 18px', borderBottom: `1px solid ${C.edge}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: C.dim, textTransform: 'uppercase' }}>
            <div>Recipe</div>
            <div>Tags</div>
            <div>Rating</div>
            <div>Updated</div>
          </div>
          {RECIPES.map((r, i) =>
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 240px 100px 110px', padding: '12px 18px', borderTop: i === 0 ? 'none' : `1px solid ${C.edge}`, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.paperHi, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{r.emoji}</div>
                <div style={{ fontFamily: display, fontSize: 15, fontWeight: 600, color: C.ink }}>{r.title}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {r.tags.slice(0, 2).map((t, j) => <TagChip key={j} small>{t}</TagChip>)}
                {r.tags.length > 2 && <TagChip small>+{r.tags.length - 2}</TagChip>}
              </div>
              <Stars rating={r.rating} size={13} />
              <div style={{ fontSize: 12, color: C.dim }}>{r.updated}</div>
            </div>
          )}
        </div>
      </div>
    </div>);

}

function DesktopListTagsOpen() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="recipes" />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 32px', opacity: 0.55 }}>
        <div style={{ padding: '24px 0 18px' }}>
          <div style={{ fontFamily: display, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Your recipes</div>
        </div>
        <div style={{ display:'flex', gap: 10, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 38, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }} />
          <button style={{ ...btnGhost, padding: '0 14px' }}>Tags · 2 ▾</button>
          <FilterChip selected>★ 4+</FilterChip>
        </div>
      </div>
      {/* Dropdown */}
      <div style={{
        position:'absolute', top: 140, left: '50%', transform:'translateX(calc(-50% + 320px))',
        width: 360, background: C.sheet, border: `1px solid ${C.edge}`, borderRadius: 12,
        boxShadow:'0 16px 40px rgba(0,0,0,0.5)', padding: 14, zIndex: 6,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', height: 36, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 8, marginBottom: 12 }}>
          <span style={{ color: C.dim, fontSize:14 }}>⌕</span>
          <div style={{ flex:1, fontSize:13, color: C.mute }}>Search tags…</div>
        </div>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', marginBottom:8 }}>Selected · 2</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
          <SelectableTag selected>weeknight</SelectableTag>
          <SelectableTag selected>vegetarian</SelectableTag>
        </div>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.16em', color: C.dim, textTransform:'uppercase', marginBottom:8 }}>All tags</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {['breakfast','italian','thai','curry','sheet pan','meal prep','weekend','sunday','classic','prep-ahead','30 min'].map(t => <SelectableTag key={t}>{t}</SelectableTag>)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DESKTOP · VIEW (full page — no longer a contained modal)
// ============================================================================
function DesktopView() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }} data-comment-anchor="6fffb3a7d4-div-431-7">
      <TopNav active="recipes" />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 24px', overflowY: 'auto', height: 'calc(100% - 60px)' }}>
        {/* Back link */}
        <div style={{ padding: '20px 0 8px' }}>
          <button style={{ background:'transparent', border:'none', color: C.accent, fontSize: 14, fontFamily:'inherit', padding: 0, cursor:'pointer' }}>‹ Recipes</button>
        </div>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap: 18, padding: '8px 0 22px', borderBottom: `1px solid ${C.edge}`, marginBottom: 22 }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, background: C.paperHi, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 42 }}>{SAMPLE.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accent }}>Recipe</div>
            <div style={{ fontFamily: display, fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2, lineHeight: 1.05 }}>{SAMPLE.title}</div>
            <div style={{ display:'flex', alignItems:'center', gap: 12, marginTop: 8 }}>
              <Stars rating={SAMPLE.rating} size={16} />
              <AccessChip access={SAMPLE.access} />
              <div style={{ display:'flex', gap: 5, flexWrap:'wrap' }}>
                {SAMPLE.tags.map((t, i) => <TagChip key={i} small>{t}</TagChip>)}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap: 8 }}>
            <button style={btnGhost}>✎ Edit</button>
            <button style={btnGhostIcon}>⋯</button>
          </div>
        </div>

        {/* Two-column body */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 32, alignItems:'flex-start' }}>
          <div>
            <SectionLabel>Ingredients</SectionLabel>
            <div style={{ marginTop: 8 }}>
              {SAMPLE.ingredients.map((group, gi) =>
              <div key={gi} style={{ marginBottom: 22 }}>
                  {group.title && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, marginBottom: 10 }}>{group.title}</div>}
                  {group.items.map((it, ii) =>
                <div key={ii} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', fontSize: 15 }}>
                      <span style={{ width: 80, color: C.dim, fontVariantNumeric: 'tabular-nums' }}>{it.qty}{it.unit !== 'each' ? ` ${it.unit}` : ''}</span>
                      <span style={{ flex: 1, color: C.ink }}>{it.name}{it.prep && <span style={{ color: C.dim, fontStyle:'italic' }}>, {it.prep}</span>}</span>
                    </div>
                )}
                </div>
              )}
            </div>
          </div>
          <div>
            <SectionLabel>Instructions</SectionLabel>
            <div style={{ marginTop: 10, fontSize: 15, color: C.ink, lineHeight: 1.65, fontFamily: sans, whiteSpace: 'pre-wrap', maxWidth: 720 }}>
              {SAMPLE.instructions.join('\n\n')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DESKTOP · EDIT (full-page takeover, parity with view)
// ============================================================================
function DesktopEdit() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }} data-comment-anchor="42fcf82b8f-div-574-11">
      <TopNav active="recipes" />
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: C.bg, borderBottom: `1px solid ${C.edge}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
            <button style={{ background:'transparent', border:'none', color: C.accent, fontSize: 14, fontFamily:'inherit', padding: 0 }}>‹ Recipes</button>
            <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Editing recipe</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost}>Cancel</button>
            <button style={btnPrimary}>Save</button>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 32px', overflowY: 'auto', height: 'calc(100% - 124px)' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }}>
            <button style={{ width: 64, height: 64, borderRadius: 14, background: C.paperHi, border: `1px dashed ${C.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🍝</button>
            <div style={{ flex: 1 }}>
              <FieldLabel>Title</FieldLabel>
              <TextInput value="Lemon ricotta pasta" />
              <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Access</FieldLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <RadioRow label="Personal" selected />
                    <RadioRow label="Global" />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Your rating</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
                    <Stars rating={5} size={18} />
                    <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 12 }}>Clear</button>
                  </div>
                </div>
              </div>
              <FieldLabel mt>Tags</FieldLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SAMPLE.tags.map((t, i) =>
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.ink, padding: '4px 8px 4px 10px', background: C.paperHi, borderRadius: 999 }}>{t} <span style={{ color: C.dim, cursor: 'pointer' }}>✕</span></span>
                )}
                <span style={{ fontSize: 11, color: C.dim, padding: '4px 10px', border: `1px dashed ${C.edge}`, borderRadius: 999, cursor: 'pointer' }}>+ Add tag</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <SectionLabel right={<span style={{ color: C.accent }}>+ Group</span>}>Ingredients</SectionLabel>
              {SAMPLE.ingredients.map((group, gi) => (
                <div key={gi} style={{ background: C.paper, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: C.dim }}>GROUP</span>
                    <div style={{ flex:1, height: 30, display:'flex', alignItems:'center', padding:'0 10px', border:`1px solid ${C.edge}`, borderRadius:8, fontSize: 13, color: C.ink, fontWeight: 600 }}>{group.title}</div>
                    <button style={{ background:'transparent', border:'none', color: C.mute, padding:'0 4px', display:'inline-flex', alignItems:'center' }}><span className="ms" style={{ fontSize: 17, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
                  </div>
                  {group.items.map((it, i) => (
                    <DesktopIngredientRow key={i} item={it} last={i === group.items.length - 1} />
                  ))}
                  <button style={{ width:'100%', marginTop: 8, padding:'8px 10px', background:'transparent', border:`1px dashed ${C.edge}`, borderRadius: 8, color: C.dim, fontSize: 12, fontFamily: sans, textAlign:'left' }}>+ Add ingredient</button>
                </div>
              ))}
            </div>
            <div>
              <SectionLabel>Instructions</SectionLabel>
              <div style={{ background: C.paper, borderRadius: 12, padding: '12px 14px', minHeight: 240 }}>
                <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, fontFamily: sans, whiteSpace: 'pre-wrap' }}>
                  {SAMPLE.instructions.join('\n\n')}
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.dim, padding: '8px 4px 0' }}>Markdown supported.</div>
            </div>
          </div>

        <div style={{ marginTop: 22 }}>
          <button style={{ height: 38, padding: '0 16px', background: 'transparent', border: `1px solid ${C.danger}55`, borderRadius: 10, color: C.danger, fontSize: 14, fontWeight: 600, fontFamily: sans }}>🗑 Delete recipe</button>
        </div>
      </div>
    </div>);

}

// ============================================================================
// MOBILE · SHARING SHEET
// ============================================================================
function MobileSharing() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <StatusBar />
      <div style={{ opacity: 0.4 }}>
        <div style={{ padding: '12px 18px 14px' }}>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700, }}>Your recipes</div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 4 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5,
        background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', maxHeight: '92%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ minWidth: 60 }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Share recipe data</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>Share your tags, ratings, or both</div>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Done</button>
        </div>
        <div style={{ padding: '14px 18px 18px', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Pending invitations · 1</div>
          <RecipeInviteCard name="Sara Rose" shares={['tags', 'ratings']} />

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>What to share</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <CheckboxRow checked label="Tags" sub="Categories you've added to recipes" />
            <CheckboxRow checked label="Ratings" sub="Your star ratings" />
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Invite by email</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10, fontSize: 13, color: C.mute }}>someone@example.com</div>
            <button style={btnPrimary}>Invite</button>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Shared with · 2</div>
          <SharedPersonRecipe name="Casey Lin"   email="casey@example.com"   sharing={['tags', 'ratings']} />
          <SharedPersonRecipe name="Alex Morgan" email="alex@example.com"    sharing={['tags']} />
        </div>
      </div>
    </div>
  );
}
function RecipeInviteCard({ name, shares }) {
  return (
    <div style={{ background: C.paperHi, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.accentDim, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{name[0]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 11, color: C.dim }}>wants to share their <span style={{ color: C.ink }}>{shares.join(' + ')}</span></div>
      </div>
      <button style={{ width: 32, height: 32, borderRadius: 8, background: C.successDim, color: C.success, border: 'none', fontWeight: 700 }}>✓</button>
      <button style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(232,122,138,0.12)', color: C.danger, border: 'none', fontWeight: 700 }}>✕</button>
    </div>
  );
}
function CheckboxRow({ checked, label, sub }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
      background: checked ? C.accentDim : 'transparent',
      border: `1px solid ${checked ? `${C.accent}55` : C.edge}`, borderRadius: 10
    }}>
      <div style={{ width: 18, height: 18, borderRadius: 5, background: checked ? C.accent : 'transparent', border: `1.5px solid ${checked ? C.accent : C.edgeHi}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0c1118', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {checked ? '✓' : ''}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: checked ? 600 : 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{sub}</div>
      </div>
    </label>
  );
}
function SharedPersonRecipe({ name, email, sharing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${C.edge}`, borderRadius: 10, marginBottom: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.accentDim, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{name[0]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 11, color: C.dim }}>sharing <span style={{ color: C.ink }}>{sharing.join(' + ')}</span></div>
      </div>
      <button style={{ background: 'transparent', border: 'none', color: C.danger, padding: '0 4px', display:'inline-flex', alignItems:'center' }}><span className="ms" style={{ fontSize: 16, lineHeight: 1, fontVariationSettings: "'FILL' 0, 'wght' 400, 'opsz' 20" }}>delete</span></button>
    </div>
  );
}

// ============================================================================
// MOBILE · EMOJI PICKER (flat grid, search + all emojis)
// ============================================================================
const EMOJI_FLAT = [
  '🍝','🍲','🌮','🥣','🥗','🍕','🍗','🥞','🍔','🌭','🥪','🍱','🍣','🍤','🍛','🥘','🍜','🍩','🥙','🍢','🍖','🍳','🥚','🥯',
  '🥕','🥦','🌽','🥒','🍅','🧄','🧅','🥔','☕','🍵','🥛','🧋','🍷','🍰','🍪','🥧','🍮','🍦',
  '🍎','🍊','🍌','🍇','🍓','🥭','🍉','🍒','🍈','🍑','🥝','🥥','🌶','🍫','🍬','🍭','🍧',
  '🍞','🥨','🌯','🥖','🍯','🧁','🎂','🧊','🍶','🥂',
];
function MobileEmojiPicker() {
  const selected = '🍝';
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <StatusBar />
      <div style={{ opacity: 0.4 }}>
        <div style={{ padding: '12px 18px' }}>
          <div style={{ fontFamily: display, fontSize: 24, fontWeight: 700 }}>Edit recipe</div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 4 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5,
        background: C.sheet, borderTopLeftRadius: 18, borderTopRightRadius: 18,
        boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', maxHeight: '78%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 12px', borderBottom: `1px solid ${C.edge}` }}>
          <button style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 14, fontFamily: 'inherit', minWidth: 60, textAlign: 'left' }}>Clear</button>
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700 }}>Pick an emoji</div>
          <button style={{ background: 'transparent', border: 'none', color: C.accent, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 60, textAlign: 'right' }}>Done</button>
        </div>
        <div style={{ padding: '10px 14px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 38, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
            <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
            <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search emoji</div>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 14px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
            {EMOJI_FLAT.map((e, i) => (
              <button key={`${i}-${e}`} style={{
                height: 38, fontSize: 22,
                background: e === selected ? C.accentDim : 'transparent',
                border: e === selected ? `1px solid ${C.accent}` : '1px solid transparent',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              }}>{e}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DESKTOP · SHARING DIALOG
// ============================================================================
function DesktopSharing() {
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="recipes" />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px 32px', opacity: 0.4 }}>
        <div style={{ padding: '24px 0' }}>
          <div style={{ fontFamily: display, fontSize: 30, fontWeight: 700, }}>Your recipes</div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, top: 60, background: 'rgba(0,0,0,0.55)', zIndex: 5 }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 560, background: C.paper, borderRadius: 16, zIndex: 6,
        border: `1px solid ${C.edge}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${C.edge}` }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Share recipe data</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Invite users to see your tags, ratings, or both.</div>
        </div>
        <div style={{ padding: '18px 22px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Pending invitations · 1</div>
          <RecipeInviteCard name="Sara Rose" shares={['tags', 'ratings']} />

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>What to share</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <CheckboxRow checked label="Tags" sub="Categories you've added to recipes" />
            <CheckboxRow checked label="Ratings" sub="Your star ratings" />
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Invite by email</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 38, padding: '0 12px', background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10, fontSize: 13, color: C.mute }}>someone@example.com</div>
            <button style={btnPrimary}>Invite</button>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: C.dim, textTransform: 'uppercase', marginBottom: 8 }}>Shared with · 2</div>
          <SharedPersonRecipe name="Casey Lin"   email="casey@example.com" sharing={['tags', 'ratings']} />
          <SharedPersonRecipe name="Alex Morgan" email="alex@example.com"  sharing={['tags']} />
        </div>
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${C.edge}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button style={btnPrimary}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DESKTOP · EMOJI PICKER (flat grid)
// ============================================================================
function DesktopEmojiPicker() {
  const selected = '🍝';
  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, color: C.ink, fontFamily: sans, overflow: 'hidden', position: 'relative' }}>
      <TopNav active="recipes" />
      <div style={{ position: 'absolute', inset: 0, top: 60, background: 'rgba(0,0,0,0.55)', zIndex: 5 }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 520, background: C.paper, borderRadius: 16, zIndex: 6,
        border: `1px solid ${C.edge}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${C.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: display, fontSize: 18, fontWeight: 700 }}>Pick an emoji</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost}>Clear</button>
            <button style={btnPrimary}>Done</button>
          </div>
        </div>
        <div style={{ padding: '14px 22px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', height: 38, background: C.paperHi, border: `1px solid ${C.edgeHi}`, borderRadius: 10 }}>
            <span style={{ color: C.dim, fontSize: 14 }}>⌕</span>
            <div style={{ flex: 1, fontSize: 13, color: C.mute }}>Search emoji</div>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 22px 22px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
            {EMOJI_FLAT.map((e, i) => (
              <button key={`${i}-${e}`} style={{
                height: 40, fontSize: 22,
                background: e === selected ? C.accentDim : 'transparent',
                border: e === selected ? `1px solid ${C.accent}` : '1px solid transparent',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              }}>{e}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MobileList, MobileListTagsOpen, MobileListFiltered, MobileView, MobileEdit, MobileSharing, MobileEmojiPicker, DesktopList, DesktopListTagsOpen, DesktopView, DesktopEdit, DesktopSharing, DesktopEmojiPicker });
})();
