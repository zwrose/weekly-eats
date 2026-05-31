/* eslint-disable */
// Design system specimen artboards. Renders each token + primitive against
// both light and dark surfaces. Loaded from Design System.html.

function Swatch({ name, value, theme }) {
  // try to render contrasting label
  const isToken = value.startsWith('rgba') || value.startsWith('#');
  const dark = theme === 'dark';
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'10px 12px',
      background: dark ? TOKENS.dark.surface.raised : TOKENS.light.surface.raised,
      border:`1px solid ${dark ? TOKENS.dark.border.subtle : TOKENS.light.border.subtle}`,
      borderRadius:10, marginBottom:6,
    }}>
      <div style={{
        width:48, height:32, borderRadius:6, background: value,
        border:`1px solid ${dark ? TOKENS.dark.border.subtle : TOKENS.light.border.subtle}`,
        flexShrink:0,
      }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontFamily: TYPE.body, fontWeight:600,
          color: dark ? TOKENS.dark.text.primary : TOKENS.light.text.primary }}>{name}</div>
        <div style={{ fontSize:11, fontFamily:'ui-monospace, monospace',
          color: dark ? TOKENS.dark.text.secondary : TOKENS.light.text.secondary }}>{value}</div>
      </div>
    </div>
  );
}

function GroupHeading({ children, theme }) {
  const dark = theme === 'dark';
  return (
    <div style={{
      fontSize:10, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase',
      color: dark ? TOKENS.dark.text.secondary : TOKENS.light.text.secondary,
      padding:'14px 12px 6px',
      fontFamily: TYPE.body,
    }}>{children}</div>
  );
}

// ─── Colors ────────────────────────────────────────────────────────────────
function ColorsBoard({ theme='dark' }) {
  const T = TOKENS[theme];
  return (
    <div style={{
      width:'100%', height:'100%', overflow:'auto',
      background: theme === 'dark' ? T.surface.base : T.surface.base,
      padding:'18px 16px',
    }}>
      <div style={{
        fontFamily: TYPE.display, fontSize:22, fontWeight:700,
        color: T.text.primary, marginBottom:4, letterSpacing:'-0.02em',
      }}>{theme === 'dark' ? 'Dark' : 'Light'} · colors</div>
      <div style={{ fontSize:12, color: T.text.secondary, marginBottom:14, fontFamily: TYPE.body }}>
        Semantic tokens, role-named.
      </div>

      <GroupHeading theme={theme}>Surface</GroupHeading>
      {Object.entries(T.surface).map(([k,v]) => <Swatch key={k} name={`surface.${k}`} value={v} theme={theme} />)}

      <GroupHeading theme={theme}>Text</GroupHeading>
      {Object.entries(T.text).map(([k,v]) => <Swatch key={k} name={`text.${k}`} value={v} theme={theme} />)}

      <GroupHeading theme={theme}>Border</GroupHeading>
      {Object.entries(T.border).map(([k,v]) => <Swatch key={k} name={`border.${k}`} value={v} theme={theme} />)}

      <GroupHeading theme={theme}>Accent</GroupHeading>
      {Object.entries(T.accent).map(([k,v]) => <Swatch key={k} name={`accent.${k}`} value={v} theme={theme} />)}

      <GroupHeading theme={theme}>Semantic states</GroupHeading>
      <Swatch name="success.base"  value={T.success.base}  theme={theme} />
      <Swatch name="success.muted" value={T.success.muted} theme={theme} />
      <Swatch name="danger.base"   value={T.danger.base}   theme={theme} />
      <Swatch name="warn.base"     value={T.warn.base}     theme={theme} />
      <Swatch name="warn.muted"    value={T.warn.muted}    theme={theme} />

      <GroupHeading theme={theme}>Section accents</GroupHeading>
      {Object.entries(T.section).map(([k,v]) => <Swatch key={k} name={`section.${k}`} value={v} theme={theme} />)}

      <GroupHeading theme={theme}>Meal (domain)</GroupHeading>
      {Object.entries(T.meal).map(([k,v]) => <Swatch key={k} name={`meal.${k}`} value={v} theme={theme} />)}
    </div>
  );
}

// ─── Typography ────────────────────────────────────────────────────────────
function TypeBoard({ theme='dark' }) {
  const T = TOKENS[theme];
  return (
    <div style={{
      width:'100%', height:'100%', overflow:'auto',
      background: T.surface.base, padding:'18px 16px',
    }}>
      <div style={{
        fontFamily: TYPE.display, fontSize:22, fontWeight:700,
        color: T.text.primary, marginBottom:4, letterSpacing:'-0.02em',
      }}>{theme === 'dark' ? 'Dark' : 'Light'} · type</div>
      <div style={{ fontSize:12, color: T.text.secondary, marginBottom:18, fontFamily: TYPE.body }}>
        Bricolage Grotesque for display. Outfit for body. Tabular numerals for qty.
      </div>
      {Object.entries(TYPE.scale).map(([k, v]) => (
        <div key={k} style={{
          display:'flex', alignItems:'baseline', gap:14,
          padding:'10px 0', borderBottom:`1px solid ${T.border.subtle}`,
        }}>
          <div style={{ width:90, flexShrink:0, fontSize:10, color: T.text.secondary, fontFamily:'ui-monospace, monospace' }}>{k}</div>
          <div style={{
            fontFamily: v.family === 'display' ? TYPE.display : TYPE.body,
            fontSize: v.size,
            fontWeight: v.weight,
            letterSpacing: v.track,
            textTransform: v.upper ? 'uppercase' : 'none',
            color: T.text.primary,
            lineHeight: 1.2,
            flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {v.upper ? 'WEEK OF MAY 11' : 'Week of May 11'}
          </div>
          <div style={{ fontSize:10, color: T.text.muted, fontFamily:'ui-monospace, monospace' }}>
            {v.size}/{v.weight}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Spacing + Radii ───────────────────────────────────────────────────────
function ScaleBoard({ theme='dark' }) {
  const T = TOKENS[theme];
  return (
    <div style={{
      width:'100%', height:'100%', overflow:'auto',
      background: T.surface.base, padding:'18px 16px',
    }}>
      <div style={{
        fontFamily: TYPE.display, fontSize:22, fontWeight:700,
        color: T.text.primary, marginBottom:14, letterSpacing:'-0.02em',
      }}>{theme === 'dark' ? 'Dark' : 'Light'} · spacing & radii</div>

      <GroupHeading theme={theme}>Spacing</GroupHeading>
      {Object.entries(SPACE).map(([k, v]) => (
        <div key={k} style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 0' }}>
          <div style={{ width:70, fontSize:11, color: T.text.secondary, fontFamily:'ui-monospace, monospace' }}>space.{k}</div>
          <div style={{ width: v, height: 12, background: T.accent.muted, borderRadius:2 }} />
          <div style={{ fontSize:11, color: T.text.muted, fontFamily:'ui-monospace, monospace' }}>{v}px</div>
        </div>
      ))}

      <GroupHeading theme={theme}>Radii</GroupHeading>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, padding:'4px 0' }}>
        {Object.entries(RADIUS).map(([k, v]) => (
          <div key={k} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <div style={{
              width:54, height:36, background: T.accent.muted, borderRadius: v === 999 ? 999 : v,
              border:`1px solid ${T.accent.base}55`,
            }} />
            <div style={{ fontSize:10, color: T.text.secondary, fontFamily:'ui-monospace, monospace' }}>radius.{k}</div>
            <div style={{ fontSize:10, color: T.text.muted, fontFamily:'ui-monospace, monospace' }}>{v === 999 ? '∞' : v + 'px'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Primitives ────────────────────────────────────────────────────────────
function PrimitivesBoard({ theme='dark' }) {
  const T = TOKENS[theme];
  const sans = TYPE.body, display = TYPE.display;

  const btn = (kind) => {
    if (kind === 'primary') return { height:40, padding:'0 16px', borderRadius:10, background: T.accent.base, color: theme==='dark' ? '#0c1118' : '#fff', border:'none', fontSize:14, fontWeight:600, fontFamily: sans };
    if (kind === 'ghost')   return { height:40, padding:'0 16px', borderRadius:10, background:'transparent', border:`1px solid ${T.border.subtle}`, color: T.text.primary, fontSize:14, fontFamily: sans };
    if (kind === 'danger')  return { height:40, padding:'0 16px', borderRadius:10, background:'transparent', border:`1px solid ${T.border.subtle}`, color: T.danger.base, fontSize:14, fontWeight:600, fontFamily: sans };
  };
  const chip = (selected) => ({
    height:36, padding:'0 14px',
    background: selected ? T.accent.muted : 'transparent',
    border:`1px solid ${selected ? T.accent.base : T.border.subtle}`,
    color: selected ? T.accent.base : T.text.primary,
    borderRadius:8, fontSize:13, fontWeight:600, fontFamily: sans,
  });

  return (
    <div style={{ width:'100%', height:'100%', overflow:'auto', background: T.surface.base, padding:'18px 16px' }}>
      <div style={{ fontFamily: display, fontSize:22, fontWeight:700, color: T.text.primary, marginBottom:14, letterSpacing:'-0.02em' }}>
        {theme === 'dark' ? 'Dark' : 'Light'} · primitives
      </div>

      <GroupHeading theme={theme}>Buttons</GroupHeading>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:'4px 0 14px' }}>
        <button style={btn('primary')}>Save</button>
        <button style={btn('ghost')}>Cancel</button>
        <button style={btn('danger')}>Delete</button>
        <button style={{ ...btn('ghost'), width:40, padding:0, borderRadius:10, fontSize:16 }}>⚙</button>
      </div>

      <GroupHeading theme={theme}>Chips</GroupHeading>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:'4px 0 14px' }}>
        <button style={chip(false)}>Mon</button>
        <button style={chip(true)}>Tue</button>
        <button style={chip(false)}>Wed</button>
        <button style={chip(false)}>Pick…</button>
      </div>

      <GroupHeading theme={theme}>Inputs</GroupHeading>
      <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'4px 0 14px' }}>
        <div style={{
          display:'flex', alignItems:'center', height:38, padding:'0 12px',
          border:`1px solid ${T.border.subtle}`, borderRadius:10, fontSize:13, color: T.text.muted, fontFamily: sans,
        }}>someone@example.com</div>
        <div style={{
          display:'flex', alignItems:'center', height:38, padding:'0 12px', gap:8,
          background: T.surface.elevated,
          border:`1px solid ${T.accent.base}55`,
          boxShadow:`0 0 0 3px ${T.accent.muted}`,
          borderRadius:10, fontSize:13, color: T.text.primary, fontFamily: sans,
        }}>
          <span style={{ color: T.text.secondary }}>⌕</span>
          <span style={{ flex:1 }}>parm</span>
          <span style={{ fontSize:10, color: T.text.muted, padding:'2px 6px', background: T.border.subtle, borderRadius:4 }}>↵</span>
        </div>
      </div>

      <GroupHeading theme={theme}>Toggle</GroupHeading>
      <div style={{ display:'flex', gap:24, padding:'4px 0 14px' }}>
        <Toggle on theme={theme} label="On" />
        <Toggle on={false} theme={theme} label="Off" />
      </div>

      <GroupHeading theme={theme}>Pills (status)</GroupHeading>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:'4px 0 14px' }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: T.accent.base, background: T.accent.muted, padding:'3px 8px', borderRadius:999, fontFamily: sans }}>TODAY</span>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color: T.success.base, background: T.success.muted, padding:'3px 8px', borderRadius:999, fontFamily: sans }}>ACCEPTED</span>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color: T.text.secondary, border:`1px solid ${T.border.subtle}`, padding:'3px 8px', borderRadius:999, fontFamily: sans }}>PENDING</span>
      </div>

      <GroupHeading theme={theme}>Shadow + Card</GroupHeading>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'4px 0 24px' }}>
        <div style={{
          background: T.surface.raised, borderRadius:14, padding:'14px 16px',
          border:`1px solid ${T.border.subtle}`,
        }}>
          <div style={{ fontSize:13, color: T.text.primary, fontFamily: sans }}>Card · raised</div>
          <div style={{ fontSize:11, color: T.text.secondary, fontFamily: sans, marginTop:2 }}>radius.2xl</div>
        </div>
        <div style={{
          background: T.surface.raised, borderRadius:14, padding:'14px 16px',
          border:`1px solid ${T.accent.base}55`,
          boxShadow:`0 0 0 3px ${T.accent.muted}`,
        }}>
          <div style={{ fontSize:13, color: T.text.primary, fontFamily: sans }}>Today halo</div>
          <div style={{ fontSize:11, color: T.text.secondary, fontFamily: sans, marginTop:2 }}>shadow.card + accent border</div>
        </div>
      </div>
    </div>
  );
}
function Toggle({ on, theme, label }) {
  const T = TOKENS[theme];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:36, height:22, borderRadius:999, background: on ? T.accent.base : T.border.strong, position:'relative' }}>
        <div style={{ position:'absolute', top:2, left: on ? 16 : 2, width:18, height:18, borderRadius:'50%', background:'#fff' }} />
      </div>
      <div style={{ fontSize:13, color: T.text.primary, fontFamily: TYPE.body }}>{label}</div>
    </div>
  );
}

// ─── Domain components ────────────────────────────────────────────────────
function DomainBoard({ theme='dark' }) {
  const T = TOKENS[theme];
  const sans = TYPE.body, display = TYPE.display;

  return (
    <div style={{ width:'100%', height:'100%', overflow:'auto', background: T.surface.base, padding:'18px 16px' }}>
      <div style={{ maxWidth: 360 }}>
      <div style={{ fontFamily: display, fontSize:22, fontWeight:700, color: T.text.primary, marginBottom:14, letterSpacing:'-0.02em' }}>
        {theme === 'dark' ? 'Dark' : 'Light'} · domain
      </div>

      <GroupHeading theme={theme}>Meal row</GroupHeading>
      <div style={{ background: T.surface.raised, borderRadius:12, padding:'4px 12px', marginBottom:14, border:`1px solid ${T.border.subtle}` }}>
        <MealRow theme={theme} mt="B" name="Overnight oats" emoji="🥣" isRecipe />
        <MealRow theme={theme} mt="L" name="Med. grain bowl" emoji="🥗" isRecipe />
        <MealRow theme={theme} mt="D" name="romaine" qty="1 head" last />
      </div>

      <GroupHeading theme={theme}>Staples bar (collapsed)</GroupHeading>
      <div style={{ marginBottom:14, border:`1px solid ${T.border.subtle}`, borderRadius:12, padding:'10px 12px',
        display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color: T.meal.staples, fontFamily: sans }}>Staples</span>
        <span style={{ fontSize:12, color: T.text.secondary, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily: sans }}>Breakfasts (5) · Kid's lunches (6) · Other (2)</span>
        <span style={{ fontSize:11, color: T.text.muted, fontFamily: sans }}>13</span>
        <span style={{ fontSize:11, color: T.text.muted }}>▾</span>
      </div>

      <GroupHeading theme={theme}>Plan row</GroupHeading>
      <div style={{
        display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
        background: T.surface.raised, borderRadius:12,
        border:`1px solid ${T.accent.base}55`, boxShadow:`0 0 0 3px ${T.accent.muted}`,
      }}>
        <div style={{ width:32, height:32, borderRadius:8, background: T.accent.muted, color: T.accent.base, display:'flex', alignItems:'center', justifyContent:'center' }}>📅</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontFamily: display, fontSize:14, fontWeight:700, color: T.text.primary }}>Week of May 11</div>
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.16em', color: T.accent.base, background: T.accent.muted, padding:'2px 5px', borderRadius:999, fontFamily: sans }}>NOW</span>
          </div>
          <div style={{ fontSize:11, color: T.text.secondary, marginTop:2, fontFamily: sans }}>May 11 – 17, 2026</div>
        </div>
        <span style={{ color: T.text.muted, fontSize:14 }}>›</span>
      </div>
      </div>
    </div>
  );
}
function MealRow({ theme, mt, name, emoji, isRecipe, qty, last }) {
  const T = TOKENS[theme];
  const sans = TYPE.body, display = TYPE.display;
  const mealColor = T.meal[mt === 'B' ? 'breakfast' : mt === 'L' ? 'lunch' : 'dinner'];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: last ? 'none' : `1px solid ${T.border.subtle}` }}>
      <div style={{ width:14, fontFamily: display, fontSize:13, fontWeight:700, color: mealColor }}>{mt}</div>
      {emoji && <span style={{ fontSize:14 }}>{emoji}</span>}
      <div style={{ flex:1, minWidth:0, fontSize:14, fontWeight: isRecipe ? 600 : 500, color: isRecipe ? T.accent.base : T.text.primary, fontFamily: sans, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
      {isRecipe && <span style={{ fontSize:10, color: T.text.secondary, padding:'1px 6px', border:`1px solid ${T.border.subtle}`, borderRadius:4, fontFamily: sans }}>Recipe</span>}
      {qty && <span style={{ fontSize:12, color: T.text.secondary, fontFamily: sans, fontVariantNumeric:'tabular-nums' }}>{qty}</span>}
    </div>
  );
}

Object.assign(window, { ColorsBoard, TypeBoard, ScaleBoard, PrimitivesBoard, DomainBoard });
