/* eslint-disable */
// v4 — grounded in the actual data model from main + frontend-redesign.
//
// Schema reality (src/types/meal-plan.ts):
//   MealPlan { name, startDate, endDate, template, items: MealPlanItem[] }
//   MealPlanItem { dayOfWeek, mealType, items: MealItem[], skipped?, skipReason?, notes? }
//   MealItem  = foodItem(qty+unit) | recipe(qty multiplier, no unit) | ingredientGroup(title + nested list)
//   MealType  = breakfast | lunch | dinner | staples   (template toggles B/L/D individually)
//
// So: a "dinner" is a LIST of items. A side salad is an ingredientGroup. A doubled batch
// is recipe.quantity=2. Some days have no breakfast at all (template-driven). Staples are
// a sibling concept, not a hidden subsection. v1-v3 abstracted all of this away.
// __IIFE_WRAPPED__
(function () {

// ---- realistic shape data ------------------------------------------------
const PLAN = {
  name: 'Week of May 11',
  startDate: '2025-05-11',
  template: { startDay: 'monday', meals: { breakfast: true, lunch: true, dinner: true, staples: true } },
  staples: [
  { type: 'ingredientGroup', title: 'Breakfasts', ingredients: [
    { type: 'foodItem', name: 'fruit for snacking', qty: 1, unit: 'package' },
    { type: 'foodItem', name: '2% milk', qty: 0.25, unit: 'gallon' },
    { type: 'foodItem', name: 'Oikos vanilla yogurt', qty: 1, unit: 'package' },
    { type: 'foodItem', name: 'granola', qty: 1, unit: 'bag' },
    { type: 'foodItem', name: "kid's yogurt", qty: 1, unit: 'package' }]
  },
  { type: 'ingredientGroup', title: "Kid's lunches", ingredients: [
    { type: 'foodItem', name: 'sandwich bread', qty: 1, unit: 'package' },
    { type: 'foodItem', name: 'deli ham', qty: 0.75, unit: 'lb' },
    { type: 'foodItem', name: 'deli cheese', qty: 0.75, unit: 'lb' },
    { type: 'foodItem', name: 'baby carrots', qty: 1, unit: 'bag' },
    { type: 'foodItem', name: 'mini cucumbers', qty: 1, unit: 'package' },
    { type: 'foodItem', name: 'cheese snacks', qty: 1, unit: 'package' }]
  },
  { type: 'foodItem', name: 'eggs', qty: 12, unit: 'each' },
  { type: 'foodItem', name: 'olive oil', qty: 1, unit: 'bottle' }],

  days: [
  { dow: 'monday', date: 'Mon, May 11', today: true, meals: {
      breakfast: { items: [
        { type: 'recipe', name: 'Overnight oats', emoji: '🥣', qty: 1 }]
      },
      lunch: { items: [
        { type: 'recipe', name: 'Mediterranean grain bowl', emoji: '🥗', qty: 1 }]
      },
      dinner: { items: [
        { type: 'recipe', name: 'Lemon ricotta pasta', emoji: '🍝', qty: 1 },
        { type: 'ingredientGroup', title: 'Side salad', ingredients: [
          { type: 'foodItem', name: 'romaine', qty: 1, unit: 'head' },
          { type: 'foodItem', name: 'cherry tomatoes', qty: 1, unit: 'pint' },
          { type: 'foodItem', name: 'cucumber', qty: 1, unit: 'each' }]
        }]
      }
    } },
  { dow: 'tuesday', date: 'Tue, May 12', meals: {
      breakfast: { skipped: true, reason: 'coffee only' },
      lunch: { items: [{ type: 'recipe', name: 'Lemon ricotta pasta', emoji: '🍝', qty: 1, note: 'leftovers' }] },
      dinner: { items: [{ type: 'recipe', name: 'Sheet-pan chicken tacos', emoji: '🌮', qty: 1 }] }
    } },
  { dow: 'wednesday', date: 'Wed, May 13', meals: {
      breakfast: { items: [{ type: 'foodItem', name: 'eggs', qty: 2, unit: 'each' }, { type: 'foodItem', name: 'toast', qty: 2, unit: 'slice' }] },
      lunch: { items: [] },
      dinner: { items: [{ type: 'recipe', name: 'Thai coconut curry', emoji: '🍲', qty: 2 }, { type: 'foodItem', name: 'jasmine rice', qty: 2, unit: 'cup' }] }
    } },
  { dow: 'thursday', date: 'Thu, May 14', meals: {
      breakfast: { items: [] },
      lunch: { items: [{ type: 'recipe', name: 'Thai coconut curry', emoji: '🍲', qty: 1, note: 'leftovers' }] },
      dinner: { items: [
        { type: 'foodItem', name: 'chicken thighs', qty: 1.5, unit: 'lb' },
        { type: 'foodItem', name: 'stir fry kit', qty: 1, unit: 'bag' }]
      }
    } },
  { dow: 'friday', date: 'Fri, May 15', meals: {
      breakfast: { items: [{ type: 'foodItem', name: 'bagels', qty: 2, unit: 'each' }, { type: 'foodItem', name: 'cream cheese', qty: 2, unit: 'tbsp' }] },
      lunch: { skipped: true, reason: 'out — work lunch' },
      dinner: { items: [{ type: 'foodItem', name: 'pizza dough', qty: 1, unit: 'package' }, { type: 'foodItem', name: 'mozzarella', qty: 8, unit: 'oz' }, { type: 'foodItem', name: 'tomato sauce', qty: 1, unit: 'jar' }] }
    } },
  { dow: 'saturday', date: 'Sat, May 16', meals: {
      breakfast: { items: [{ type: 'recipe', name: 'Buttermilk pancakes', emoji: '🥞', qty: 1 }] },
      lunch: { items: [] },
      dinner: { skipped: true, reason: 'DKE celebration' }
    } },
  { dow: 'sunday', date: 'Sun, May 17', meals: {
      breakfast: { items: [] },
      lunch: { items: [] },
      dinner: { items: [
        { type: 'ingredientGroup', title: 'Cheese board', ingredients: [
          { type: 'foodItem', name: 'green grapes', qty: 1, unit: 'bunch' },
          { type: 'foodItem', name: 'crackers', qty: 4, unit: 'boxes' },
          { type: 'foodItem', name: 'brie', qty: 8, unit: 'oz' },
          { type: 'foodItem', name: 'manchego', qty: 6, unit: 'oz' },
          { type: 'foodItem', name: 'fig jam', qty: 1, unit: 'jar' }]
        },
        { type: 'ingredientGroup', title: 'Veggie board', ingredients: [
          { type: 'foodItem', name: 'rainbow carrots', qty: 2, unit: 'lb' },
          { type: 'foodItem', name: 'mini cucumbers', qty: 1, unit: 'bag' },
          { type: 'foodItem', name: 'sugar snap peas', qty: 1, unit: 'lb' },
          { type: 'foodItem', name: 'cherry tomatoes', qty: 1, unit: 'lb' },
          { type: 'foodItem', name: 'radishes', qty: 1, unit: 'bunch' },
          { type: 'foodItem', name: 'asparagus', qty: 1, unit: 'bunch' },
          { type: 'foodItem', name: 'hummus', qty: 1, unit: 'container' },
          { type: 'foodItem', name: 'whipped feta dip', qty: 1, unit: 'each' }]
        }]
      }
    } }]

};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_LETTER = { breakfast: 'B', lunch: 'L', dinner: 'D' };

const COLOR = {
  bg: '#0f1115', paper: '#181b21', paperHi: '#1e222a',
  ink: '#e7e9ee', dim: '#9097a6', mute: '#5b6170',
  edge: 'rgba(255,255,255,0.07)',
  accent: '#7aa7ff',
  // section colors per current product (kept subtle as label-only)
  breakfast: '#e8c97a',
  lunch: '#8edcb4',
  dinner: '#f0a08a',
  staples: '#c4a7e7',
  recipe: '#7aa7ff',
  food: '#9097a6'
};
const SECTION = { breakfast: COLOR.breakfast, lunch: COLOR.lunch, dinner: COLOR.dinner };

const display = `'Bricolage Grotesque', system-ui, sans-serif`;
const sans = `'Outfit', system-ui, sans-serif`;

// ---- helpers -------------------------------------------------------------
function qtyStr(q, unit) {
  if (q == null) return '';
  // mimic getUnitForm: very simple plural toggle for "each"
  const u = unit && unit !== 'each' ? ` ${unit}` : '';
  return `${q}${u}`;
}

function MealItemRow({ item, color }) {
  if (item.type === 'recipe') {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, lineHeight: 1.4 }}>
        {item.emoji && <span style={{ fontSize: 14, lineHeight: 1, transform: 'translateY(1px)' }}>{item.emoji}</span>}
        <span style={{ color: COLOR.recipe, fontWeight: 600 }}>{item.name}</span>
        {item.qty && item.qty !== 1 &&
        <span style={{ color: COLOR.mute, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>×{item.qty}</span>
        }
        {item.note && <span style={{ color: COLOR.mute, fontSize: 12, fontStyle: 'italic' }}>· {item.note}</span>}
      </div>);

  }
  if (item.type === 'foodItem') {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, lineHeight: 1.4 }}>
        <span style={{ color: COLOR.ink }}>{item.name}</span>
        <span style={{ color: COLOR.mute, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{qtyStr(item.qty, item.unit)}</span>
      </div>);

  }
  // ingredient group
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: COLOR.dim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: color || COLOR.mute }} />
        {item.title}
      </div>
      <div style={{ paddingLeft: 10, borderLeft: `1px solid ${COLOR.edge}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {item.ingredients.map((ing, i) =>
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, lineHeight: 1.35 }}>
            <span style={{ color: COLOR.ink }}>{ing.name}</span>
            <span style={{ color: COLOR.mute, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{qtyStr(ing.qty, ing.unit)}</span>
          </div>
        )}
      </div>
    </div>);

}

function MealRow({ mealType, meal }) {
  const color = SECTION[mealType];
  const isSkipped = meal.skipped;
  const isEmpty = !isSkipped && (!meal.items || meal.items.length === 0);

  return (
    <div style={{ display: 'flex', gap: 12, padding: '11px 14px', borderTop: `1px solid ${COLOR.edge}`, cursor: 'pointer' }}>
      <div style={{ flex: '0 0 18px', display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13, lineHeight: 1.4, color: color, fontWeight: 700, fontFamily: display, letterSpacing: '0.02em' }}>
        {MEAL_LETTER[mealType]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isSkipped ?
        <div style={{ fontSize: 13, color: COLOR.mute, fontStyle: 'italic' }}>
            Skipped{meal.reason ? <span> · {meal.reason}</span> : null}
          </div> :
        isEmpty ?
        <button style={{
          background: 'transparent', border: `1px dashed ${COLOR.edge}`, color: COLOR.mute,
          borderRadius: 8, padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6
        }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add {MEAL_LABEL[mealType].toLowerCase()}
          </button> :

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meal.items.map((it, i) =>
          <MealItemRow key={i} item={it} color={color} />
          )}
          </div>
        }
      </div>
    </div>);

}

function DayCard({ day, enabledMeals }) {
  // Only render meals that have content or are explicitly skipped.
  // Empty meals (template-enabled but no items, not skipped) are hidden — the +Add
  // affordance lives in the day-card footer instead.
  const meals = enabledMeals.
  map((mt) => ({ mt, m: day.meals[mt] || { items: [] } })).
  filter(({ m }) => m.skipped || m.items && m.items.length > 0);
  const missing = enabledMeals.filter((mt) => {
    const m = day.meals[mt] || { items: [] };
    return !m.skipped && (!m.items || m.items.length === 0);
  });
  return (
    <div style={{
      background: COLOR.paper,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 12,
      border: day.today ? `1px solid ${COLOR.accent}55` : `1px solid transparent`,
      boxShadow: day.today ? `0 0 0 3px rgba(122,167,255,0.08)` : 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <div style={{ fontFamily: display, fontSize: 17, fontWeight: 700, color: day.today ? COLOR.accent : COLOR.ink, letterSpacing: '-0.015em' }}>
          {day.date}
        </div>
        {day.today &&
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: COLOR.accent, background: 'rgba(122,167,255,0.10)', padding: '3px 8px', borderRadius: 999 }}>
            TODAY
          </span>
        }
      </div>
      <div>
        {meals.map(({ mt, m }) => <MealRow key={mt} mealType={mt} meal={m} />)}
      </div>
      {missing.length > 0 &&
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 14px 12px', borderTop: meals.length > 0 ? `1px solid ${COLOR.edge}` : 'none' }}>
          {missing.map((mt) =>
        <button key={mt} style={{
          background: 'transparent', border: `1px dashed ${COLOR.edge}`, color: COLOR.mute,
          borderRadius: 8, padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6
        }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> {MEAL_LABEL[mt]}
            </button>
        )}
        </div>
      }
    </div>);

}

function StaplesCard({ items }) {
  const [open, setOpen] = React.useState(false);
  const groups = items.filter((it) => it.type === 'ingredientGroup');
  const loose = items.filter((it) => it.type !== 'ingredientGroup');
  const total = loose.length + groups.reduce((n, g) => n + (g.ingredients?.length || 0), 0);

  return (
    <div style={{
      background: 'transparent',
      borderRadius: 12,
      marginBottom: 14,
      border: `1px solid ${COLOR.edge}`,
      overflow: 'hidden'
    }}>
      <div style={{ display:'flex', alignItems:'stretch' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            flex:1, display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left', minWidth: 0,
          }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: COLOR.staples
          }}>
            Staples
          </span>
          <span style={{ fontSize: 12, color: COLOR.dim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} data-comment-anchor="e531e4a4e5-span-291-9">
            {groups.length > 0 ?
            groups.map((g) => `${g.title} (${g.ingredients.length})`).join('  ·  ') + (
            loose.length ? `  ·  Other (${loose.length})` : '') :
            `${total} items`}
          </span>
          <span style={{ fontSize: 11, color: COLOR.mute, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          <span style={{ fontSize: 11, color: COLOR.mute, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
        </button>
        <button
          aria-label="Edit staples"
          onClick={(e) => { e.stopPropagation(); }}
          style={{
            background:'transparent', border:'none', borderLeft:`1px solid ${COLOR.edge}`,
            color: COLOR.dim, padding:'0 12px', cursor:'pointer', fontSize: 13, fontFamily:'inherit',
          }}>
          ✎
        </button>
      </div>
      {open &&
      <div style={{ padding: '4px 14px 12px', borderTop: `1px solid ${COLOR.edge}` }}>
          {groups.map((g, gi) =>
        <div key={gi} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLOR.ink, marginBottom: 4 }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 10 }}>
                {g.ingredients.map((it, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13 }}>
                    <span style={{ color: COLOR.ink }}>{it.name}</span>
                    <span style={{ color: COLOR.mute, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{qtyStr(it.qty, it.unit)}</span>
                  </div>
            )}
              </div>
            </div>
        )}
          {loose.length > 0 &&
        <div style={{ marginTop: 10 }}>
              {groups.length > 0 && <div style={{ fontSize: 12, fontWeight: 600, color: COLOR.ink, marginBottom: 4 }}>Other</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: groups.length > 0 ? 10 : 0 }}>
                {loose.map((it, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13 }}>
                    <span style={{ color: COLOR.ink }}>{it.name}</span>
                    <span style={{ color: COLOR.mute, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{qtyStr(it.qty, it.unit)}</span>
                  </div>
            )}
              </div>
            </div>
        }
        </div>
      }
    </div>);

}

function V4() {
  const enabledMeals = MEAL_ORDER.filter((m) => PLAN.template.meals[m]);
  return (
    <div className="ab" style={{ background: COLOR.bg, color: COLOR.ink, fontFamily: sans }}>
      <div className="statusbar"><span>9:41</span><span className="icons"><span>●●●</span><span>📶</span><span>100%</span></span></div>

      <div style={{ padding: '10px 22px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: COLOR.accent }}>Meal Plan</div>
          <div style={{ fontFamily: display, fontSize: 26, fontWeight: 700, marginTop: 4, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {PLAN.name}
          </div>
          <div style={{ fontSize: 12, color: COLOR.dim, marginTop: 3 }}>May 11 – 17 · Shared with Sara</div>
        </div>
        <button style={{ background: 'transparent', border: `1px solid ${COLOR.edge}`, color: COLOR.ink, width: 36, height: 36, borderRadius: 10, fontSize: 16 }}>⋯</button>
      </div>
      <div style={{ padding: '4px 22px 0', fontSize: 12, color: COLOR.mute }}>Tap a meal to edit it.</div>

      <div className="scroll" style={{ padding: '8px 16px 120px' }}>
        <StaplesCard items={PLAN.staples} />
        {PLAN.days.map((d) => <DayCard key={d.dow} day={d} enabledMeals={enabledMeals} />)}
      </div>

      {window.NavChrome && React.createElement(window.NavChrome.BottomNav, { active: 'plans' })}
    </div>);

}

Object.assign(window, { V4 });
})();
