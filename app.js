/* Ritmo — Dieta & Treino
   App que roda 100% no celular: os dados ficam guardados no próprio aparelho.
   Backup: Perfil > Exportar / Importar. */
(() => {
'use strict';

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = (n) => String(n).padStart(2, '0');
const fmtDay = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => fmtDay(new Date());
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return fmtDay(d); };
const num = (v, dec = 0) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const r1 = (v) => Math.round(v * 10) / 10;
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dayLabel = (s) => {
  if (s === today()) return 'Hoje';
  if (s === addDays(today(), -1)) return 'Ontem';
  const d = parseDay(s); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
};
const MEALS = [
  ['cafe', 'Café da manhã'], ['almoco', 'Almoço'], ['lanche', 'Lanche'], ['jantar', 'Jantar'], ['ceia', 'Ceia']
];
const mealName = (k) => (MEALS.find(m => m[0] === k) || [, k])[1];
const ICON = {
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M16 9v6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>'
};

// ---------- dados (guardados no aparelho) ----------
const KEY = 'ritmo-dados-v1';
const blank = () => ({
  v: 1, profile: null, foods: [], logs: {}, water: {}, workouts: [], wlogs: [], weights: [], recent: [], nextId: 1
});
let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { db = blank(); }
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { toast('Não consegui salvar. Faça um backup em Perfil.'); }
};
const uid = () => 'u' + (db.nextId++);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const BASE = (window.BASE_FOODS || []).map((f, i) => ({
  id: 'b:' + norm(f[0]), name: f[0], portion_g: f[1], kcal: f[2], protein: f[3], carbs: f[4], fat: f[5], fiber: Number.isFinite(f[8]) ? f[8] : null, unit: f[6] || null, unit_g: f[7] || null, source: 'base'
}));
// unidade caseira do alimento (ex.: 1 ovo = 50 g); o usuário pode mudar em qualquer alimento
const foodUnit = (f) => {
  const o = db.units && db.units[f.id];
  if (o) return o.unit && o.unit_g ? o : null;
  return f.unit && f.unit_g ? { unit: f.unit, unit_g: f.unit_g } : null;
};
const plural = (u, n) => {
  if (n <= 1) return u;
  const w = u.split(' '), first = w[0];
  w[0] = /r$/.test(first) ? first + 'es' : /l$/.test(first) ? first.slice(0, -1) + 'is' : /ão$/.test(first) ? first.slice(0, -2) + 'ões' : /[aeiouáéíóú]$/.test(first) ? first + 's' : first + 's';
  if (w[1] && !['de', 'da', 'do'].includes(w[1])) w[1] = w[1] + 's';
  return w.join(' ');
};
const fmtUnits = (n, u) => num(n, n % 1 ? 1 : 0).replace(',5', ' ½').replace(/^0 ½$/, '½') + ' ' + plural(u, n);
const allFoods = () => db.foods.concat(BASE);
const foodById = (id) => allFoods().find(f => f.id === id);

// ---------- metas ----------
function latestWeight() {
  const w = [...db.weights].sort((a, b) => a.day < b.day ? 1 : -1)[0];
  return w ? w.kg : null;
}
function targets() {
  const p = db.profile || {};
  const w = latestWeight();
  let tdee = null;
  if (p.sex && p.birth_year && p.height_cm && w) {
    const age = new Date().getFullYear() - Number(p.birth_year);
    const bmr = 10 * w + 6.25 * Number(p.height_cm) - 5 * age + (p.sex === 'M' ? 5 : -161);
    tdee = bmr * Number(p.activity || 1.375);
  }
  let kcal = Number(p.kcal_target) || 0;
  let auto = false;
  if (!kcal) {
    auto = true;
    if (tdee) {
      const f = { perder: 0.85, manter: 1, ganhar: 1.1 }[p.goal] || 1;
      kcal = Math.max(Math.round(tdee * f / 10) * 10, p.sex === 'M' ? 1500 : 1200);
    } else kcal = 2000;
  }
  // Mantém as metas anteriores dos backups existentes.
  const pp = Number(p.protein_pct ?? 30), cp = Number(p.carb_pct ?? 45), fp = Number(p.fat_pct ?? 25);
  return {
    kcal, auto, tdee: tdee ? Math.round(tdee) : null,
    protein: Math.round(kcal * pp / 100 / 4), carbs: Math.round(kcal * cp / 100 / 4), fat: Math.round(kcal * fp / 100 / 9),
    water: Number(p.water_target) || (w ? Math.round(w * 35 / 250) * 250 : 2500)
  };
}
function dayTotals(day) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, fiberKnown: 0 };
  for (const l of db.logs[day] || []) { t.kcal += l.kcal; t.protein += l.protein; t.carbs += l.carbs; t.fat += l.fat; if (Number.isFinite(l.fiber)) { t.fiber += l.fiber; t.fiberKnown++; } }
  return t;
}
const trainedOn = (day) => db.wlogs.filter(w => w.day === day);

// ---------- interface geral ----------
const state = { tab: 'hoje', date: today(), session: null };
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
let sheetClose = null;
function openSheet(title, html, onMount, onClose) {
  closeSheet();
  const root = $('#sheetRoot');
  root.innerHTML = `<div class="overlay"><div class="sheet" role="dialog"><div class="grab"></div>
    <div class="sheet-h"><h3>${esc(title)}</h3><button class="iconbtn" data-close>${ICON.x}</button></div>
    <div class="sheet-b">${html}</div></div></div>`;
  const ov = $('.overlay', root);
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) closeSheet(); });
  sheetClose = onClose || null;
  if (onMount) onMount($('.sheet-b', root));
}
function closeSheet() {
  if (sheetClose) { const f = sheetClose; sheetClose = null; f(); }
  $('#sheetRoot').innerHTML = '';
}
function setSheetBody(title, html, onMount) {
  const s = $('#sheetRoot .sheet'); if (!s) return openSheet(title, html, onMount);
  $('.sheet-h h3', s).textContent = title; $('.sheet-b', s).innerHTML = html; s.scrollTop = 0;
  if (onMount) onMount($('.sheet-b', s));
}

function go(tab) { state.tab = tab; location.hash = tab; render(); window.scrollTo(0, 0); }
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) go(b.dataset.tab); });
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== state.tab && VIEWS[t]) { state.tab = t; render(); } });

function render() {
  // recria o container a cada tela para não acumular ouvintes de toque
  const oldView = $('#view'), view = oldView.cloneNode(false);
  oldView.replaceWith(view);
  if (!db.profile) { $('#tabs').classList.add('hide'); $('#topRight').textContent = ''; view.innerHTML = viewWelcome(); bindWelcome(view); return; }
  $('#tabs').classList.remove('hide');
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  $('#topRight').textContent = db.profile.name ? 'Olá, ' + db.profile.name.split(' ')[0] : '';
  view.innerHTML = VIEWS[state.tab].html();
  VIEWS[state.tab].bind?.(view);
}

// ---------- boas-vindas / cadastro ----------
function profileForm(p = {}, withWeight = true) {
  const y = new Date().getFullYear();
  return `
  <label class="f"><span>Seu nome</span><input name="name" value="${esc(p.name || '')}" placeholder="Como quer ser chamado" required></label>
  <label class="f"><span>Sexo (para o cálculo de calorias)</span>
    <div class="seg" data-seg="sex"><button type="button" data-v="M" class="${p.sex === 'M' ? 'on' : ''}">Masculino</button><button type="button" data-v="F" class="${p.sex === 'F' ? 'on' : ''}">Feminino</button></div></label>
  <div class="grid2">
    <label class="f"><span>Ano de nascimento</span><input name="birth_year" type="number" inputmode="numeric" min="1920" max="${y}" value="${esc(p.birth_year || '')}" placeholder="1990"></label>
    <label class="f"><span>Altura (cm)</span><input name="height_cm" type="number" inputmode="decimal" value="${esc(p.height_cm || '')}" placeholder="175"></label>
  </div>
  ${withWeight ? `<div class="grid2">
    <label class="f"><span>Peso atual (kg)</span><input name="weight" type="number" step="0.1" inputmode="decimal" placeholder="80"></label>
    <label class="f"><span>Peso meta (kg)</span><input name="target_weight" type="number" step="0.1" inputmode="decimal" value="${esc(p.target_weight || '')}" placeholder="75"></label>
  </div>` : `<label class="f"><span>Peso meta (kg)</span><input name="target_weight" type="number" step="0.1" inputmode="decimal" value="${esc(p.target_weight || '')}"></label>`}
  <label class="f"><span>Nível de atividade</span><select name="activity">
    ${[[1.2, 'Sedentário (pouco ou nenhum exercício)'], [1.375, 'Leve (1–3 treinos por semana)'], [1.55, 'Moderado (3–5 treinos por semana)'], [1.725, 'Alto (6–7 treinos por semana)'], [1.9, 'Muito alto (treino pesado + trabalho físico)']]
      .map(([v, t]) => `<option value="${v}" ${Number(p.activity || 1.375) === v ? 'selected' : ''}>${t}</option>`).join('')}
  </select></label>
  <label class="f"><span>Objetivo</span>
    <div class="seg" data-seg="goal">${[['perder', 'Perder peso'], ['manter', 'Manter'], ['ganhar', 'Ganhar massa']].map(([v, t]) => `<button type="button" data-v="${v}" class="${(p.goal || 'manter') === v ? 'on' : ''}">${t}</button>`).join('')}</div></label>`;
}
function bindSegs(root, obj) {
  $$('[data-seg]', root).forEach(seg => {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
      obj[seg.dataset.seg] = b.dataset.v;
    });
  });
}
function readProfileForm(form, segVals) {
  const fd = Object.fromEntries(new FormData(form));
  return {
    name: (fd.name || '').trim(), sex: segVals.sex || null,
    birth_year: fd.birth_year ? Number(fd.birth_year) : null, height_cm: fd.height_cm ? Number(fd.height_cm) : null,
    activity: Number(fd.activity || 1.375), goal: segVals.goal || 'manter',
    target_weight: fd.target_weight ? Number(fd.target_weight) : null, weight: fd.weight ? Number(String(fd.weight).replace(',', '.')) : null
  };
}
function viewWelcome() {
  return `<div class="hero"><h1>Construa sua rotina de <em>evolução</em>.</h1>
    <p class="muted">Dieta, treino e peso em um só lugar. Seus dados ficam guardados só neste celular.</p></div>
    <form class="card" id="welcomeForm">${profileForm({})}
    <button class="btn primary block" type="submit">Começar</button></form>
    <p class="small muted" style="text-align:center">Já usava em outro aparelho? <button class="link" id="importBtn" type="button">Importar backup</button></p>`;
}
function bindWelcome(view) {
  const seg = { goal: 'manter' };
  bindSegs(view, seg);
  $('#welcomeForm', view).addEventListener('submit', (e) => {
    e.preventDefault();
    const p = readProfileForm(e.target, seg);
    if (!p.name) return toast('Informe seu nome');
    const weight = p.weight; delete p.weight;
    db.profile = { ...p, protein_pct: 30, carb_pct: 45, fat_pct: 25 };
    if (weight) db.weights.push({ id: uid(), day: today(), kg: weight });
    if (!db.workouts.length) db.workouts = starterWorkouts();
    save(); go('hoje'); toast('Tudo pronto! Bom treino 💪');
  });
  $('#importBtn', view).addEventListener('click', importBackup);
}
function starterWorkouts() {
  const ex = (name, sets, reps, rest = 60) => ({ id: uid(), name, sets, reps, load_kg: null, rest_s: rest });
  return [
    { id: uid(), name: 'Treino A — Peito e tríceps', exercises: [ex('Supino reto', 4, '10'), ex('Supino inclinado halteres', 3, '12'), ex('Crucifixo', 3, '12'), ex('Tríceps corda', 3, '12'), ex('Tríceps francês', 3, '12')] },
    { id: uid(), name: 'Treino B — Costas e bíceps', exercises: [ex('Puxada frontal', 4, '10'), ex('Remada baixa', 3, '12'), ex('Remada curvada', 3, '10'), ex('Rosca direta', 3, '12'), ex('Rosca martelo', 3, '12')] },
    { id: uid(), name: 'Treino C — Pernas e ombros', exercises: [ex('Agachamento livre', 4, '10', 90), ex('Leg press', 3, '12', 90), ex('Cadeira extensora', 3, '12'), ex('Mesa flexora', 3, '12'), ex('Desenvolvimento halteres', 3, '10'), ex('Elevação lateral', 3, '15')] }
  ];
}

// ---------- HOJE ----------
function weekStrip() {
  const sel = state.date; const start = addDays(sel, -parseDay(sel).getDay());
  let h = '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const cls = ['day', d === sel ? 'sel' : '', d === today() ? 'today' : '', trainedOn(d).length ? 'done' : '', (db.logs[d] || []).length ? 'food' : ''].join(' ');
    h += `<button class="${cls}" data-day="${d}"><small>${DOW[i]}</small><b>${parseDay(d).getDate()}</b></button>`;
  }
  return h + '</div>';
}
function bindWeek(view) {
  $$('.week [data-day]', view).forEach(b => b.addEventListener('click', () => { state.date = b.dataset.day; render(); }));
}
function ring(value, max, color = 'var(--accent)') {
  const r = 56, c = 2 * Math.PI * r, pct = max ? Math.min(value / max, 1) : 0;
  const over = value > max;
  return `<svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--card2)" stroke-width="12"/>
    <circle cx="66" cy="66" r="${r}" fill="none" stroke="${over ? 'var(--danger)' : color}" stroke-width="12" stroke-linecap="round"
    stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>`;
}
function macroBlock(label, val, max, color) {
  const pct = max ? Math.min(val / max * 100, 100) : 0;
  return `<div class="macro"><span>${label}</span><div class="bar"><i style="width:${pct}%;background:${color}"></i></div><b>${num(val)}</b><span style="display:inline"> / ${num(max)} g</span></div>`;
}
const VIEWS = {};
VIEWS.hoje = {
  html() {
    const d = state.date, t = targets(), tot = dayTotals(d), remain = t.kcal - tot.kcal;
    const water = db.water[d] || 0, cups = Math.ceil(t.water / 250), cupsOn = Math.floor(water / 250);
    const done = trainedOn(d);
    const w = latestWeight(), tw = db.profile.target_weight;
    return `${weekStrip()}
    <div class="section-title"><h3>${dayLabel(d)}</h3><button class="link" data-act="dieta">Ver refeições</button></div>
    <div class="card">
      <div class="kcal">
        <div class="ring">${ring(tot.kcal, t.kcal)}<div class="c"><b>${num(Math.abs(remain))}</b><span>${remain >= 0 ? 'kcal restantes' : 'kcal acima'}</span></div></div>
        <div class="kstats">
          <div class="kstat"><span>Meta diária</span><b>${num(t.kcal)} kcal</b></div>
          <div class="kstat"><span>Consumido</span><b>${num(tot.kcal)} kcal</b></div>
        </div>
      </div>
      <div class="macros">${macroBlock('Carboidrato', tot.carbs, t.carbs, 'var(--carb)')}${macroBlock('Proteína', tot.protein, t.protein, 'var(--prot)')}${macroBlock('Gordura', tot.fat, t.fat, 'var(--fat)')}</div>
    </div>
    <div class="card"><div class="spread"><h3 style="margin:0">Fibras</h3><span class="muted small">${num(tot.fiber,1)} / ${num(db.profile.fiber_target ?? 30)} g</span></div>
      <div class="bar" style="margin-top:12px"><i style="width:${Math.min(100,tot.fiber/(db.profile.fiber_target ?? 30)*100)}%;background:var(--ok)"></i></div>
      <p class="small muted">Apenas alimentos com fibras informadas entram na soma. ${tot.fiberKnown ? tot.fiberKnown + ' registro(s) com dados.' : 'Nenhum registro com dados de fibras.'} Dados ausentes não significam zero.</p></div>
    <div class="card">
      <div class="spread"><h3 style="margin:0">Água</h3><span class="muted small"><b style="color:var(--text)">${num(water / 1000, 2)} L</b> de ${num(t.water / 1000, 1)} L</span></div>
      <div class="water-cups">${Array.from({ length: Math.min(cups, 16) }, (_, i) => `<div class="cup ${i < cupsOn ? 'on' : ''}"></div>`).join('')}</div>
      <div class="row"><button class="btn sm ghost" data-water="-250">− 250 ml</button><button class="btn sm" data-water="250">+ 250 ml</button><button class="btn sm" data-water="500">+ 500 ml</button></div>
    </div>
    <div class="card">
      <div class="spread"><h3 style="margin:0">Treino</h3>${done.length ? '<span class="pill" style="color:var(--ok)">✓ Feito</span>' : ''}</div>
      ${done.length ? done.map(x => `<p class="muted" style="margin:8px 0 0">${esc(x.name)}</p>`).join('') :
        db.workouts.length ? `<p class="muted small" style="margin:6px 0 10px">Qual treino hoje?</p><div class="row wrap">${db.workouts.map(x => `<button class="btn sm" data-start="${x.id}">${esc(shortName(x.name))}</button>`).join('')}</div>`
          : `<p class="muted small">Monte sua primeira ficha na aba Treino.</p>`}
    </div>
    <div class="card">
      <div class="spread"><h3 style="margin:0">Peso</h3><button class="btn sm" data-act="peso">Registrar</button></div>
      ${w ? `<div class="row" style="margin-top:8px;align-items:baseline"><span class="big">${num(w, 1)}</span><span class="muted">kg</span>
        ${tw ? `<span class="muted small" style="margin-left:auto">meta ${num(tw, 1)} kg · faltam ${num(Math.abs(w - tw), 1)} kg</span>` : ''}</div>` : '<p class="muted small">Registre seu peso para acompanhar a evolução.</p>'}
    </div>`;
  },
  bind(view) {
    bindWeek(view);
    view.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'dieta') go('dieta');
      if (b.dataset.act === 'peso') openWeightSheet();
      if (b.dataset.water) {
        const d = state.date; db.water[d] = Math.max(0, (db.water[d] || 0) + Number(b.dataset.water)); save(); render();
      }
      if (b.dataset.start) startWorkout(b.dataset.start);
    });
  }
};
const shortName = (n) => n.split('—')[0].trim();

// ---------- DIETA ----------
VIEWS.dieta = {
  html() {
    const d = state.date, t = targets(), tot = dayTotals(d), logs = db.logs[d] || [];
    return `<div class="datenav"><button class="iconbtn" data-nav="-1">${ICON.left}</button><b>${dayLabel(d)}</b><button class="iconbtn" data-nav="1">${ICON.right}</button></div>
    <div class="card tight"><div class="spread"><div><span class="muted small">Consumido</span><div><b style="font-size:20px">${num(tot.kcal)}</b> <span class="muted">/ ${num(t.kcal)} kcal</span></div></div>
      <div class="small" style="text-align:right"><span style="color:var(--carb)">C ${num(tot.carbs)}g</span> · <span style="color:var(--prot)">P ${num(tot.protein)}g</span> · <span style="color:var(--fat)">G ${num(tot.fat)}g</span></div></div>
      <div class="bar" style="margin-top:10px"><i style="width:${Math.min(tot.kcal / t.kcal * 100, 100)}%;${tot.kcal > t.kcal ? 'background:var(--danger)' : ''}"></i></div></div>
    ${MEALS.map(([k, name]) => {
      const items = logs.filter(l => l.meal === k), sum = items.reduce((a, l) => a + l.kcal, 0);
      return `<div class="card"><div class="meal-h"><h3>${name}</h3><span class="muted small">${num(sum)} kcal</span></div>
        ${items.length ? `<div style="margin-top:6px">${items.map(l => `<div class="item"><div class="t"><b>${esc(l.name)}</b><span>${l.units ? fmtUnits(l.units, l.unit) + ' (' + num(l.grams) + ' g)' : num(l.grams) + ' g'} · C ${num(l.carbs)} · P ${num(l.protein)} · G ${num(l.fat)}</span></div><span class="k">${num(l.kcal)}</span><button class="x" data-del="${l.id}" aria-label="Remover">×</button></div>`).join('')}</div>` : ''}
        <button class="add-row" data-add="${k}">+ Adicionar alimento</button></div>`;
    }).join('')}`;
  },
  bind(view) {
    view.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.nav) { state.date = addDays(state.date, Number(b.dataset.nav)); render(); }
      if (b.dataset.add) openAddFood(b.dataset.add);
      if (b.dataset.del) {
        const d = state.date; db.logs[d] = (db.logs[d] || []).filter(l => l.id !== b.dataset.del);
        if (!db.logs[d].length) delete db.logs[d];
        save(); render();
      }
    });
  }
};

function defaultMeal() {
  const h = new Date().getHours();
  return h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 18 ? 'lanche' : h < 22 ? 'jantar' : 'ceia';
}
function foodRow(f) {
  return `<button class="res" data-food="${f.id}"><div class="t"><b>${esc(f.name)}${f.brand ? ` <span class="tag">${esc(f.brand)}</span>` : ''}</b>
    <span>${num(f.kcal)} kcal · P ${num(f.protein, 1)} · C ${num(f.carbs, 1)} · G ${num(f.fat, 1)} <span class="muted">(100 g)</span></span></div><span class="plus">+</span></button>`;
}
function searchFoods(q) {
  const n = norm(q).trim();
  if (!n) {
    const rec = db.recent.map(foodById).filter(Boolean);
    return { title: rec.length ? 'Usados recentemente' : 'Sugestões', list: rec.length ? rec : BASE.slice(0, 15) };
  }
  const words = n.split(/\s+/);
  const list = allFoods().filter(f => { const s = norm(f.name + ' ' + (f.brand || '')); return words.every(w => s.includes(w)); })
    .sort((a, b) => (norm(a.name).startsWith(n) ? 0 : 1) - (norm(b.name).startsWith(n) ? 0 : 1) || a.name.length - b.name.length).slice(0, 40);
  return { title: list.length ? 'Resultados' : '', list };
}
function openAddFood(meal) {
  meal = meal || defaultMeal();
  openSheet('Adicionar em ' + mealName(meal), `
    <div class="row"><input id="foodQ" placeholder="Buscar alimento (ex: arroz, frango)" autocomplete="off" class="grow">
      <button class="iconbtn" id="scanBtn" style="width:46px;height:46px" aria-label="Ler código de barras">${ICON.scan}</button></div>
    <div class="row" style="margin-top:10px"><button class="btn sm ghost" id="newFoodBtn">+ Cadastrar alimento</button></div>
    <div id="foodRes" class="results"></div>`, (b) => {
    const draw = () => {
      const { title, list } = searchFoods($('#foodQ', b).value);
      $('#foodRes', b).innerHTML = (title ? `<p class="muted small" style="margin:14px 2px 2px">${title}</p>` : '') +
        (list.length ? list.map(foodRow).join('') : `<div class="empty">Nada na lista do app.<br><button class="link" id="newFromQ">Cadastrar “${esc($('#foodQ', b).value)}”</button></div>`) +
        ($('#foodQ', b).value.trim().length >= 3 ? `<button class="add-row" id="webQ" style="margin-top:10px">🔎 Buscar “${esc($('#foodQ', b).value.trim())}” em produtos de mercado</button><div id="webRes"></div>` : '');
      $('#newFromQ', b)?.addEventListener('click', () => openNewFood(meal, { name: $('#foodQ', b).value }));
      $('#webQ', b)?.addEventListener('click', () => searchOnline($('#foodQ', b).value.trim(), b));
    };
    $('#foodQ', b).addEventListener('input', draw);
    $('#foodRes', b).addEventListener('click', (e) => {
      const w = e.target.closest('[data-web]');
      if (w) { const f = webCache[w.dataset.web]; if (!f) return; db.foods = db.foods.filter(x => x.barcode !== f.barcode); db.foods.unshift({ ...f, id: uid() }); save(); return openQty(db.foods[0], meal); }
      const r = e.target.closest('[data-food]'); if (r) openQty(foodById(r.dataset.food), meal);
    });
    $('#scanBtn', b).addEventListener('click', () => openScanner(meal));
    $('#newFoodBtn', b).addEventListener('click', () => openNewFood(meal, {}));
    draw();
  });
}
// busca de produtos industrializados na base aberta Open Food Facts (precisa de internet)
const webCache = {};
async function searchOnline(q, b) {
  const box = $('#webRes', b), btn = $('#webQ', b);
  if (btn) btn.remove();
  box.innerHTML = '<div class="empty small">Buscando produtos…</div>';
  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=30'
      + '&tagtype_0=countries&tag_contains_0=contains&tag_0=brazil'
      + '&fields=code,product_name,product_name_pt,brands,nutriments,serving_quantity&search_terms=' + encodeURIComponent(q);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const j = await (await fetch(url, { signal: ctl.signal })).json(); clearTimeout(t);
    const list = (j.products || []).map(p => {
      const n = p.nutriments || {};
      const kcal = n['energy-kcal_100g'] != null ? n['energy-kcal_100g'] : (n.energy_100g != null ? n.energy_100g / 4.184 : null);
      const name = (p.product_name_pt || p.product_name || '').trim();
      if (kcal == null || !name) return null;
      return { name, brand: (p.brands || '').split(',')[0].trim() || null, barcode: p.code || null, portion_g: Number(p.serving_quantity) || 100,
        kcal: r1(kcal), protein: r1(n.proteins_100g || 0), carbs: r1(n.carbohydrates_100g || 0), fat: r1(n.fat_100g || 0), fiber: n.fiber_100g == null ? null : r1(n.fiber_100g), source: 'openfoodfacts' };
    }).filter(Boolean).slice(0, 20);
    if (!list.length) { box.innerHTML = '<div class="empty small">Nenhum produto encontrado. Tente outro nome ou cadastre pelo rótulo.</div>'; return; }
    box.innerHTML = '<p class="muted small" style="margin:14px 2px 2px">Produtos de mercado <span class="tag">confira com o rótulo</span></p>' + list.map((f, i) => {
      const k = 'w' + i; webCache[k] = f;
      return `<button class="res" data-web="${k}"><div class="t"><b>${esc(f.name)}${f.brand ? ` <span class="tag">${esc(f.brand)}</span>` : ''}</b>
        <span>${num(f.kcal)} kcal · P ${num(f.protein, 1)} · C ${num(f.carbs, 1)} · G ${num(f.fat, 1)} <span class="muted">(100 g)</span></span></div><span class="plus">+</span></button>`;
    }).join('');
  } catch {
    box.innerHTML = '<div class="empty small">Não consegui buscar agora (sem internet?). Tente de novo ou cadastre pelo rótulo.</div>';
  }
}
function openQty(food, meal, back) {
  if (!food) return;
  const calc = (g) => ({ kcal: food.kcal * g / 100, protein: food.protein * g / 100, carbs: food.carbs * g / 100, fat: food.fat * g / 100, fiber: Number.isFinite(food.fiber) ? food.fiber * g / 100 : null });
  const U = foodUnit(food);
  let mode = U ? 'un' : 'g';
  const g0 = food.portion_g || 100;
  setSheetBody(food.name, `
    ${food.brand ? `<p class="muted" style="margin-top:-6px">${esc(food.brand)}</p>` : ''}
    ${U ? `<div class="seg" id="qMode" style="margin-bottom:12px"><button type="button" data-m="un" class="on">${esc(plural(U.unit, 2)).replace(/^./, c => c.toUpperCase())}</button><button type="button" data-m="g">Gramas</button></div>` : ''}
    <label class="f"><span id="qLbl"></span><input id="qtyG" type="number" step="any" inputmode="decimal"></label>
    <div class="row wrap" id="qChips" style="margin:-4px 0 14px"></div>
    <div class="card" id="qtyPrev"></div>
    <label class="f"><span>Refeição</span><select id="qtyMeal">${MEALS.map(([k, n]) => `<option value="${k}" ${k === meal ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <button class="btn primary block" id="qtyAdd">Adicionar</button>
    <button class="btn ghost block" style="margin-top:10px" id="qtyUnit">${U ? `Mudar unidade (1 ${esc(U.unit)} = ${num(U.unit_g)} g)` : 'Definir unidade (ex.: 1 unidade = 50 g)'}</button>
    ${food.source !== 'base' ? `<button class="btn ghost block" style="margin-top:10px" id="qtyEdit">Editar dados do alimento</button>` : ''}`, (b) => {
    const val = () => Number(String($('#qtyG', b).value).replace(',', '.')) || 0;
    const grams = () => mode === 'un' ? val() * U.unit_g : val();
    const setMode = (m) => {
      mode = m;
      $$('#qMode button', b).forEach(x => x.classList.toggle('on', x.dataset.m === m));
      if (m === 'un') {
        $('#qLbl', b).textContent = `Quantidade (${plural(U.unit, 2)})`;
        $('#qtyG', b).value = 1; $('#qtyG', b).step = '0.5';
        $('#qChips', b).innerHTML = [0.5, 1, 2, 3, 4].map(n => `<button class="btn sm ghost" data-g="${n}">${n === 0.5 ? '½' : n}</button>`).join('');
      } else {
        $('#qLbl', b).textContent = 'Quantidade (g ou ml)';
        $('#qtyG', b).value = g0; $('#qtyG', b).step = 'any';
        $('#qChips', b).innerHTML = [...new Set([g0, 50, 100, 150, 200].filter(Boolean))].map(g => `<button class="btn sm ghost" data-g="${g}">${g} g</button>`).join('');
      }
      prev();
    };
    const prev = () => {
      const g = grams(), m = calc(g);
      $('#qtyPrev', b).innerHTML = `<div class="spread"><b style="font-size:22px">${num(m.kcal)} kcal</b><span class="small"><span style="color:var(--carb)">C ${num(m.carbs, 1)}</span> · <span style="color:var(--prot)">P ${num(m.protein, 1)}</span> · <span style="color:var(--fat)">G ${num(m.fat, 1)}</span></span></div>
        ${mode === 'un' ? `<div class="small muted" style="margin-top:6px">${fmtUnits(val(), U.unit)} = ${num(g)} g</div>` : ''}`;
    };
    $('#qtyG', b).addEventListener('input', prev);
    $('#qMode', b)?.addEventListener('click', (e) => { const x = e.target.closest('[data-m]'); if (x) setMode(x.dataset.m); });
    b.addEventListener('click', (e) => { const x = e.target.closest('[data-g]'); if (x) { $('#qtyG', b).value = x.dataset.g; prev(); } });
    $('#qtyEdit', b)?.addEventListener('click', () => openNewFood(meal, food));
    $('#qtyUnit', b).addEventListener('click', () => openUnitEdit(food, meal));
    $('#qtyAdd', b).addEventListener('click', () => {
      const g = grams();
      if (g <= 0) return toast('Informe a quantidade');
      const m = calc(g), d = state.date;
      const entry = { id: uid(), meal: $('#qtyMeal', b).value, food_id: food.id, name: food.name, grams: r1(g), kcal: r1(m.kcal), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat), fiber: m.fiber == null ? null : r1(m.fiber) };
      if (mode === 'un') { entry.units = val(); entry.unit = U.unit; }
      (db.logs[d] = db.logs[d] || []).push(entry);
      db.recent = [food.id, ...db.recent.filter(i => i !== food.id)].slice(0, 20);
      save(); closeSheet(); render(); toast('Adicionado ✓');
    });
    setMode(mode);
  });
}
function openUnitEdit(food, meal) {
  const U = foodUnit(food) || {};
  setSheetBody('Unidade de ' + food.name, `
    <p class="small muted" style="margin-top:-4px">Assim você lança por unidade em vez de pesar. Ex.: 1 <b>unidade</b> de ovo = <b>50</b> g · 1 <b>fatia</b> de pão = <b>25</b> g.</p>
    <form id="uf"><div class="grid2">
      <label class="f"><span>Nome da unidade</span><input name="unit" value="${esc(U.unit || 'unidade')}" placeholder="unidade, fatia, colher…" required></label>
      <label class="f"><span>Quantos gramas tem 1?</span><input name="unit_g" type="number" step="any" inputmode="decimal" value="${esc(U.unit_g || '')}" required></label>
    </div>
    <div class="row wrap" style="margin:-4px 0 14px">${['unidade', 'fatia', 'colher de sopa', 'copo', 'concha'].map(u => `<button type="button" class="btn sm ghost" data-u="${u}">${u}</button>`).join('')}</div>
    <button class="btn primary block" type="submit">Salvar unidade</button>
    ${foodUnit(food) ? '<button class="btn danger block" type="button" id="uOff" style="margin-top:10px">Usar só gramas</button>' : ''}
    <button class="btn ghost block" type="button" id="uBack" style="margin-top:10px">Voltar</button></form>`, (b) => {
    b.addEventListener('click', (e) => { const x = e.target.closest('[data-u]'); if (x) $('[name=unit]', b).value = x.dataset.u; });
    $('#uf', b).addEventListener('submit', (e) => {
      e.preventDefault();
      const unit = $('[name=unit]', b).value.trim().toLowerCase(), unit_g = Number(String($('[name=unit_g]', b).value).replace(',', '.'));
      if (!unit || !(unit_g > 0)) return toast('Preencha o nome e os gramas');
      db.units = db.units || {}; db.units[food.id] = { unit, unit_g }; save();
      toast('Unidade salva ✓'); openQty(food, meal);
    });
    $('#uOff', b)?.addEventListener('click', () => { db.units = db.units || {}; db.units[food.id] = { unit: null, unit_g: null }; save(); openQty(food, meal); });
    $('#uBack', b).addEventListener('click', () => openQty(food, meal));
  });
}
function openNewFood(meal, pre = {}) {
  const editing = !!(pre.id && pre.source !== 'base');
  setSheetBody(editing ? 'Editar alimento' : 'Cadastrar alimento', `
    ${pre.notFound ? `<p class="small" style="background:var(--card);padding:10px 12px;border-radius:12px;margin-top:0">Código <b>${esc(pre.barcode)}</b> não encontrado. Preencha pelos dados do rótulo — da próxima vez ele aparece direto.</p>` : ''}
    <form id="nf">
    <label class="f"><span>Nome</span><input name="name" value="${esc(pre.name || '')}" required></label>
    <div class="grid2"><label class="f"><span>Marca (opcional)</span><input name="brand" value="${esc(pre.brand || '')}"></label>
    <label class="f"><span>Código de barras</span><input name="barcode" inputmode="numeric" value="${esc(pre.barcode || '')}"></label></div>
    <label class="f"><span>Os valores do rótulo são por</span><div class="seg" data-seg="base"><button type="button" data-v="100" class="on">100 g / 100 ml</button><button type="button" data-v="porcao">Porção</button></div></label>
    <label class="f" id="porcaoF"><span>Porção (g ou ml)</span><input name="portion_g" type="number" inputmode="decimal" value="${esc(pre.portion_g || 100)}"></label>
    <div class="grid2"><label class="f"><span>Unidade (opcional)</span><input name="unit" value="${esc(pre.unit || '')}" placeholder="ex.: unidade, fatia"></label>
    <label class="f"><span>Gramas por unidade</span><input name="unit_g" type="number" step="any" inputmode="decimal" value="${esc(pre.unit_g || '')}" placeholder="ex.: 50"></label></div>
    <div class="grid4">
      <label class="f"><span>Kcal</span><input name="kcal" type="number" step="any" inputmode="decimal" value="${pre.kcal ?? ''}" required></label>
      <label class="f"><span>Carb</span><input name="carbs" type="number" step="any" inputmode="decimal" value="${pre.carbs ?? ''}"></label>
      <label class="f"><span>Prot</span><input name="protein" type="number" step="any" inputmode="decimal" value="${pre.protein ?? ''}"></label>
      <label class="f"><span>Gord</span><input name="fat" type="number" step="any" inputmode="decimal" value="${pre.fat ?? ''}"></label>
      <label class="f"><span>Fibras (opcional)</span><input name="fiber" type="number" min="0" step="any" inputmode="decimal" value="${pre.fiber ?? ''}"></label>
    </div>
    <button class="btn primary block" type="submit">${editing ? 'Salvar' : 'Salvar e adicionar'}</button>
    ${editing ? '<button class="btn danger block" type="button" id="nfDel" style="margin-top:10px">Excluir alimento</button>' : ''}
    </form>`, (b) => {
    const seg = { base: '100' }; bindSegs(b, seg);
    $('#nf', b).addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const n = (k) => Number(String(fd[k] || 0).replace(',', '.')) || 0;
      const portion = n('portion_g') || 100, f = seg.base === 'porcao' ? 100 / portion : 1;
      const food = {
        id: editing ? pre.id : uid(), name: fd.name.trim(), brand: fd.brand.trim() || null, barcode: fd.barcode.trim() || null,
        portion_g: portion, unit: (fd.unit || '').trim().toLowerCase() || null, unit_g: n('unit_g') || null, kcal: r1(n('kcal') * f), protein: r1(n('protein') * f), carbs: r1(n('carbs') * f), fat: r1(n('fat') * f), fiber: fd.fiber === '' ? null : r1(n('fiber') * f), source: 'usuario'
      };
      if (!food.name) return toast('Informe o nome');
      if (db.units) delete db.units[food.id];
      db.foods = db.foods.filter(x => x.id !== food.id); db.foods.unshift(food); save();
      openQty(food, meal);
    });
    $('#nfDel', b)?.addEventListener('click', () => {
      if (!confirm('Excluir este alimento? (os registros já lançados continuam)')) return;
      db.foods = db.foods.filter(x => x.id !== pre.id); db.recent = db.recent.filter(i => i !== pre.id); save(); openAddFood(meal);
    });
  });
}

// ---------- leitor de código de barras ----------
let scanStop = null;
function loadScript(src) {
  return new Promise((ok, fail) => { if ($(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
}
function stopScan() { if (scanStop) { try { scanStop(); } catch { } scanStop = null; } }
async function openScanner(meal) {
  stopScan();
  setSheetBody('Ler código de barras', `
    <div class="scan"><video id="sv" playsinline muted autoplay></video><div class="frame"></div><div class="laser"></div></div>
    <p class="muted small" id="smsg" style="text-align:center">Aponte a câmera para o código de barras do produto</p>
    <div class="row"><input id="scode" inputmode="numeric" placeholder="Ou digite o código" class="grow"><button class="btn" id="sgo">Buscar</button></div>`, (b) => {
    $('#sgo', b).addEventListener('click', () => { const c = $('#scode', b).value.replace(/\D/g, ''); if (c) { stopScan(); lookupBarcode(c, meal); } });
  });
  sheetClose = stopScan;
  const video = $('#sv'), msg = $('#smsg');
  const found = (code) => { stopScan(); if (navigator.vibrate) navigator.vibrate(80); lookupBarcode(code, meal); };
  try {
    if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('ean_13')) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream; await video.play();
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      let alive = true;
      scanStop = () => { alive = false; stream.getTracks().forEach(t => t.stop()); };
      const loop = async () => {
        if (!alive) return;
        try { const r = await det.detect(video); if (r.length) return found(r[0].rawValue); } catch { }
        setTimeout(loop, 250);
      };
      loop();
    } else {
      msg.textContent = 'Abrindo a câmera…';
      await loadScript('https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js');
      const hints = new Map(); hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128]);
      const reader = new ZXing.BrowserMultiFormatReader(hints);
      scanStop = () => reader.reset();
      msg.textContent = 'Aponte a câmera para o código de barras do produto';
      await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (res) => { if (res && scanStop) found(res.getText()); });
    }
  } catch (e) {
    msg.innerHTML = 'Não consegui abrir a câmera. Libere o acesso à câmera para este site (no iPhone: Ajustes › Safari › Câmera) ou digite o código abaixo.';
  }
}
async function lookupBarcode(code, meal) {
  const local = db.foods.find(f => f.barcode === code);
  if (local) return openQty(local, meal);
  setSheetBody('Buscando produto…', `<div class="empty">Procurando o código <b>${esc(code)}</b>…</div>`);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_pt,brands,nutriments,serving_quantity`);
    const j = await r.json();
    const p = j.product, n = p && p.nutriments;
    if (j.status === 1 && n && (n['energy-kcal_100g'] != null || n.energy_100g != null)) {
      const kcal = n['energy-kcal_100g'] != null ? n['energy-kcal_100g'] : n.energy_100g / 4.184;
      const food = {
        id: uid(), name: (p.product_name_pt || p.product_name || 'Produto ' + code).trim(), brand: (p.brands || '').split(',')[0].trim() || null, barcode: code,
        portion_g: Number(p.serving_quantity) || 100, kcal: r1(kcal), protein: r1(n.proteins_100g || 0), carbs: r1(n.carbohydrates_100g || 0), fat: r1(n.fat_100g || 0), source: 'openfoodfacts'
      };
      db.foods.unshift(food); save();
      toast('Produto encontrado — confira os valores');
      return openQty(food, meal);
    }
  } catch { }
  openNewFood(meal, { barcode: code, notFound: true });
}

// ---------- TREINO ----------
VIEWS.treino = {
  html() {
    const hist = [...db.wlogs].sort((a, b) => (a.day + a.id) < (b.day + b.id) ? 1 : -1).slice(0, 12);
    const last = (id) => { const l = db.wlogs.filter(w => w.workout_id === id).sort((a, b) => a.day < b.day ? 1 : -1)[0]; return l ? dayLabel(l.day) : 'nunca'; };
    const wk = (() => { const s = addDays(today(), -parseDay(today()).getDay()); return new Set(db.wlogs.filter(w => w.day >= s).map(w => w.day)).size; })();
    return `<div class="spread"><h2>Treinos</h2><button class="btn sm primary" id="newWk">+ Nova ficha</button></div>
    <div class="stats3" style="margin-bottom:12px">
      <div class="stat"><span>Nesta semana</span><b>${wk} ${wk === 1 ? 'dia' : 'dias'}</b></div>
      <div class="stat"><span>Últimos 30 dias</span><b>${new Set(db.wlogs.filter(w => w.day > addDays(today(), -30)).map(w => w.day)).size}</b></div>
      <div class="stat"><span>Total</span><b>${db.wlogs.length}</b></div>
    </div>
    ${db.workouts.length ? db.workouts.map((w, i) => `<div class="card">
      <div class="wk-head"><div class="wk-badge">${esc((shortName(w.name).match(/\b([A-Z])\b/) || [, String.fromCharCode(65 + i)])[1])}</div>
        <div class="grow"><b>${esc(w.name)}</b><div class="muted small">${w.exercises.length} exercícios · último: ${last(w.id)}</div></div>
        <button class="iconbtn" data-edit="${w.id}" aria-label="Editar">${ICON.edit}</button></div>
      <div style="margin-top:10px">${w.exercises.slice(0, 6).map(e => `<div class="small muted" style="padding:2px 0">• ${esc(e.name)} — ${e.sets}×${esc(e.reps)}${e.load_kg ? ' · ' + num(e.load_kg, 1) + ' kg' : ''}</div>`).join('')}</div>
      <button class="btn primary block" style="margin-top:12px" data-start="${w.id}">Começar treino</button></div>`).join('')
      : '<div class="card empty">Nenhuma ficha ainda. Toque em “Nova ficha”.</div>'}
    <div class="section-title"><h3>Histórico</h3></div>
    <div class="card">${hist.length ? hist.map(h => `<div class="item"><div class="t"><b>${esc(h.name)}</b><span>${dayLabel(h.day)}</span></div><button class="x" data-undo="${h.id}" aria-label="Remover">×</button></div>`).join('') : '<div class="empty">Seus treinos concluídos aparecem aqui.</div>'}</div>`;
  },
  bind(view) {
    $('#newWk', view).addEventListener('click', () => openWorkoutEditor(null));
    view.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.start) startWorkout(b.dataset.start);
      if (b.dataset.edit) openWorkoutEditor(b.dataset.edit);
      if (b.dataset.undo && confirm('Remover este treino do histórico?')) { db.wlogs = db.wlogs.filter(w => w.id !== b.dataset.undo); save(); render(); }
    });
  }
};

let restT = null;
function stopRest() { clearInterval(restT); restT = null; $('#restTimer')?.remove(); }
function startRest(sec) {
  stopRest(); let left = sec;
  const el = document.createElement('div'); el.className = 'timer'; el.id = 'restTimer';
  const draw = () => el.innerHTML = `⏱ Descanso <span>${Math.floor(left / 60)}:${pad(left % 60)}</span><button>+15s</button><button>Pular</button>`;
  draw(); document.body.appendChild(el);
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.textContent === 'Pular') stopRest(); else { left += 15; draw(); } });
  restT = setInterval(() => { left--; if (left <= 0) { stopRest(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); toast('Descanso acabou — próxima série!'); } else draw(); }, 1000);
}
function startWorkout(id) {
  const w = db.workouts.find(x => x.id === id); if (!w) return;
  const sess = { id, done: {}, loads: Object.fromEntries(w.exercises.map(e => [e.id, e.load_kg ?? ''])) };
  openSheet(w.name, `
    <p class="muted small" style="margin-top:-4px">Marque cada exercício ao terminar. Ajuste a carga se mudou.</p>
    <div class="card" id="exList">${w.exercises.map(e => `<div class="ex" data-ex="${e.id}">
      <button class="check" data-chk="${e.id}">${ICON.check}</button>
      <div class="t"><b>${esc(e.name)}</b><span>${e.sets} × ${esc(e.reps)} · descanso ${e.rest_s || 60}s</span></div>
      <input class="load" data-load="${e.id}" type="number" step="0.5" inputmode="decimal" placeholder="kg" value="${e.load_kg ?? ''}">
      <button class="iconbtn" data-rest="${e.rest_s || 60}" aria-label="Descanso">${ICON.timer}</button></div>`).join('')}</div>
    <label class="f"><span>Data</span><input type="date" id="wkDay" value="${state.date > today() ? today() : state.date}" max="${today()}"></label>
    <button class="btn ok block" id="finish">Concluir treino</button>`, (b) => {
    b.addEventListener('click', (e) => {
      const c = e.target.closest('[data-chk]'); if (c) { const on = !c.classList.contains('on'); c.classList.toggle('on', on); sess.done[c.dataset.chk] = on; }
      const r = e.target.closest('[data-rest]'); if (r) startRest(Number(r.dataset.rest));
    });
    b.addEventListener('input', (e) => { const i = e.target.closest('[data-load]'); if (i) sess.loads[i.dataset.load] = i.value; });
    $('#finish', b).addEventListener('click', () => {
      const n = Object.values(sess.done).filter(Boolean).length;
      if (!n && !confirm('Nenhum exercício marcado. Concluir mesmo assim?')) return;
      const loads = {};
      for (const e of w.exercises) { const v = Number(String(sess.loads[e.id]).replace(',', '.')); if (v > 0) { e.load_kg = v; loads[e.id] = v; } }
      db.wlogs.push({ id: uid(), workout_id: w.id, name: w.name, day: $('#wkDay', b).value || today(), loads, done: n, total: w.exercises.length });
      save(); stopRest(); closeSheet(); render(); toast('Treino concluído! 🔥');
    });
  }, stopRest);
}
function openWorkoutEditor(id) {
  const orig = db.workouts.find(x => x.id === id);
  const w = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid(), name: '', exercises: [] };
  if (!w.exercises.length) w.exercises.push({ id: uid(), name: '', sets: 3, reps: '12', load_kg: null, rest_s: 60 });
  const exHtml = (e) => `<div class="ex-edit" data-e="${e.id}">
    <div class="row"><input data-f="name" value="${esc(e.name)}" placeholder="Nome do exercício" class="grow"><button class="x" data-rm="${e.id}" aria-label="Remover">×</button></div>
    <div class="grid4" style="margin-top:8px">
      <label class="f" style="margin:0"><span>Séries</span><input data-f="sets" type="number" inputmode="numeric" value="${e.sets}"></label>
      <label class="f" style="margin:0"><span>Reps</span><input data-f="reps" value="${esc(e.reps)}"></label>
      <label class="f" style="margin:0"><span>Carga kg</span><input data-f="load_kg" type="number" step="0.5" inputmode="decimal" value="${e.load_kg ?? ''}"></label>
      <label class="f" style="margin:0"><span>Desc. s</span><input data-f="rest_s" type="number" inputmode="numeric" value="${e.rest_s}"></label>
    </div></div>`;
  openSheet(orig ? 'Editar ficha' : 'Nova ficha', `
    <label class="f"><span>Nome da ficha</span><input id="wn" value="${esc(w.name)}" placeholder="Ex: Treino A — Peito e tríceps"></label>
    <div id="exs">${w.exercises.map(exHtml).join('')}</div>
    <button class="add-row" id="addEx">+ Adicionar exercício</button>
    <button class="btn primary block" id="wsave" style="margin-top:14px">Salvar ficha</button>
    ${orig ? '<button class="btn danger block" id="wdel" style="margin-top:10px">Excluir ficha</button>' : ''}`, (b) => {
    const collect = () => {
      w.name = $('#wn', b).value.trim();
      w.exercises = $$('[data-e]', b).map(div => {
        const g = (f) => $(`[data-f="${f}"]`, div).value;
        return { id: div.dataset.e, name: g('name').trim(), sets: Number(g('sets')) || 3, reps: g('reps').trim() || '12', load_kg: Number(String(g('load_kg')).replace(',', '.')) || null, rest_s: Number(g('rest_s')) || 60 };
      });
    };
    $('#addEx', b).addEventListener('click', () => { const e = { id: uid(), name: '', sets: 3, reps: '12', load_kg: null, rest_s: 60 }; $('#exs', b).insertAdjacentHTML('beforeend', exHtml(e)); $(`[data-e="${e.id}"] input`, b).focus(); });
    $('#exs', b).addEventListener('click', (e) => { const r = e.target.closest('[data-rm]'); if (r) r.closest('[data-e]').remove(); });
    $('#wsave', b).addEventListener('click', () => {
      collect(); w.exercises = w.exercises.filter(e => e.name);
      if (!w.name) return toast('Dê um nome para a ficha');
      if (!w.exercises.length) return toast('Adicione pelo menos um exercício');
      const i = db.workouts.findIndex(x => x.id === w.id);
      if (i >= 0) db.workouts[i] = w; else db.workouts.push(w);
      save(); closeSheet(); render(); toast('Ficha salva ✓');
    });
    $('#wdel', b)?.addEventListener('click', () => {
      if (!confirm('Excluir esta ficha? O histórico continua.')) return;
      db.workouts = db.workouts.filter(x => x.id !== w.id); save(); closeSheet(); render();
    });
  });
}

// ---------- EVOLUÇÃO ----------
function lineChart(points, goal) {
  if (points.length < 2) return '<div class="empty small">Registre pelo menos 2 pesos para ver o gráfico.</div>';
  const W = 340, H = 180, pl = 34, pr = 10, pt = 12, pb = 24;
  const vals = points.map(p => p.kg).concat(goal ? [goal] : []);
  let mn = Math.min(...vals), mx = Math.max(...vals); if (mx - mn < 2) { mn -= 1; mx += 1; }
  const pad2 = (mx - mn) * 0.1; mn -= pad2; mx += pad2;
  const t0 = parseDay(points[0].day).getTime(), t1 = parseDay(points[points.length - 1].day).getTime() || t0 + 1;
  const x = (d) => pl + (parseDay(d).getTime() - t0) / Math.max(t1 - t0, 1) * (W - pl - pr);
  const y = (v) => pt + (mx - v) / (mx - mn) * (H - pt - pb);
  const path = points.map((p, i) => (i ? 'L' : 'M') + x(p.day).toFixed(1) + ' ' + y(p.kg).toFixed(1)).join(' ');
  const area = path + ` L${x(points[points.length - 1].day).toFixed(1)} ${H - pb} L${pl} ${H - pb} Z`;
  const ticks = [mn + (mx - mn) * 0.15, (mn + mx) / 2, mx - (mx - mn) * 0.15];
  const lab = (d) => { const z = parseDay(d); return z.getDate() + '/' + pad(z.getMonth() + 1); };
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${num(v, 1)}</text>`).join('')}
    ${goal ? `<line x1="${pl}" x2="${W - pr}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${W - pr}" y="${y(goal) - 4}" text-anchor="end" style="fill:var(--ok)">meta</text>` : ''}
    <path d="${area}" fill="url(#ga)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map(p => `<circle cx="${x(p.day)}" cy="${y(p.kg)}" r="3" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>`).join('')}
    <text x="${pl}" y="${H - 6}">${lab(points[0].day)}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${lab(points[points.length - 1].day)}</text>
  </svg>`;
}
function kcalBars() {
  const t = targets(), days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const vals = days.map(d => dayTotals(d).kcal), mx = Math.max(t.kcal * 1.2, ...vals);
  const W = 340, H = 150, pb = 22, bw = 30, gap = (W - 7 * bw) / 8, y = (v) => (H - pb) - v / mx * (H - pb - 8);
  const logged = vals.filter(v => v > 0);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  return { avg, svg: `<svg class="chart" style="height:150px" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line x1="0" x2="${W}" y1="${y(t.kcal)}" y2="${y(t.kcal)}" stroke="var(--ok)" stroke-dasharray="6 4"/>
    ${days.map((d, i) => { const v = vals[i], x = gap + i * (bw + gap); return `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(H - pb - y(v), v ? 2 : 0)}" rx="7" fill="${v > t.kcal ? 'var(--danger)' : 'var(--accent)'}" opacity="${d === today() ? 1 : .75}"/><text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${DOW[parseDay(d).getDay()]}</text>`; }).join('')}
  </svg>` };
}
VIEWS.evolucao = {
  html() {
    const pts = [...db.weights].sort((a, b) => a.day < b.day ? -1 : 1);
    const first = pts[0], last = pts[pts.length - 1], goal = db.profile.target_weight;
    const diff = first && last ? last.kg - first.kg : 0;
    const kb = kcalBars();
    const t30 = new Set(db.wlogs.filter(w => w.day > addDays(today(), -30)).map(w => w.day)).size;
    let prog = '';
    if (goal && first && last && first.kg !== goal) {
      const p = Math.max(0, Math.min(1, (first.kg - last.kg) / (first.kg - goal)));
      prog = `<div class="spread small" style="margin-top:12px"><span class="muted">Início ${num(first.kg, 1)} kg</span><span class="muted">Meta ${num(goal, 1)} kg</span></div>
        <div class="bar" style="height:8px"><i style="width:${p * 100}%;background:var(--ok)"></i></div><div class="small muted">${num(p * 100)}% do caminho</div>`;
    }
    return `<div class="spread"><h2>Evolução</h2><button class="btn sm primary" id="addW">+ Peso</button></div>
    <div class="card">
      <div class="spread"><div><span class="muted small">Peso atual</span><div><span class="big">${last ? num(last.kg, 1) : '—'}</span> <span class="muted">kg</span></div></div>
      ${pts.length > 1 ? `<span class="pill ${diff <= 0 ? 'down' : 'up'}">${diff > 0 ? '+' : ''}${num(diff, 1)} kg desde ${dayLabel(first.day).toLowerCase()}</span>` : ''}</div>
      ${lineChart(pts.slice(-60), goal)}${prog}
    </div>
    <div class="stats3" style="margin-bottom:12px">
      <div class="stat"><span>Média kcal (7d)</span><b>${kb.avg ? num(kb.avg) : '—'}</b></div>
      <div class="stat"><span>Treinos (30d)</span><b>${t30}</b></div>
      <div class="stat"><span>Cintura</span><b>${(() => { const c = [...pts].reverse().find(p => p.waist_cm); return c ? num(c.waist_cm, 1) + ' cm' : '—'; })()}</b></div>
    </div>
    <div class="card"><div class="spread"><h3 style="margin:0">Calorias — últimos 7 dias</h3><span class="small" style="color:var(--ok)">— meta</span></div>${kb.svg}</div>
    <div class="section-title"><h3>Registros de peso</h3></div>
    <div class="card">${pts.length ? [...pts].reverse().slice(0, 30).map(p => `<div class="item"><div class="t"><b>${num(p.kg, 1)} kg${p.waist_cm ? ` <span class="tag">cintura ${num(p.waist_cm, 1)} cm</span>` : ''}</b><span>${dayLabel(p.day)}</span></div><button class="x" data-delw="${p.id}" aria-label="Remover">×</button></div>`).join('') : '<div class="empty">Nenhum registro ainda.</div>'}</div>`;
  },
  bind(view) {
    $('#addW', view).addEventListener('click', openWeightSheet);
    view.addEventListener('click', (e) => { const b = e.target.closest('[data-delw]'); if (b && confirm('Remover este registro?')) { db.weights = db.weights.filter(w => w.id !== b.dataset.delw); save(); render(); } });
  }
};
function openWeightSheet() {
  openSheet('Registrar peso', `<form id="wf">
    <div class="grid2"><label class="f"><span>Peso (kg)</span><input name="kg" type="number" step="0.1" inputmode="decimal" value="${latestWeight() ?? ''}" required></label>
    <label class="f"><span>Data</span><input name="day" type="date" value="${today()}" max="${today()}"></label></div>
    <label class="f"><span>Cintura (cm) — opcional</span><input name="waist" type="number" step="0.1" inputmode="decimal"></label>
    <button class="btn primary block" type="submit">Salvar</button></form>`, (b) => {
    const i = $('[name=kg]', b); i.focus(); i.select();
    $('#wf', b).addEventListener('submit', (e) => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
      const kg = Number(String(fd.kg).replace(',', '.')); if (!(kg > 20 && kg < 400)) return toast('Peso inválido');
      const day = fd.day || today();
      db.weights = db.weights.filter(w => w.day !== day);
      db.weights.push({ id: uid(), day, kg, waist_cm: fd.waist ? Number(String(fd.waist).replace(',', '.')) : null });
      save(); closeSheet(); render(); toast('Peso registrado ✓');
    });
  });
}

// ---------- PERFIL ----------
VIEWS.perfil = {
  html() {
    const p = db.profile, t = targets();
    return `<h2>Perfil</h2>
    <div class="card"><h3>Suas metas diárias</h3>
      <div class="stats3"><div class="stat"><span>Calorias</span><b>${num(t.kcal)}</b></div><div class="stat"><span>Proteína</span><b>${t.protein} g</b></div><div class="stat"><span>Água</span><b>${num(t.water / 1000, 1)} L</b></div></div>
      <p class="small muted" style="margin:10px 0 0">${t.auto ? (t.tdee ? `Calculado pelo seu gasto estimado de ${num(t.tdee)} kcal/dia${p.goal === 'perder' ? ' (−15%)' : p.goal === 'ganhar' ? ' (+10%)' : ''}. ` : 'Preencha sexo, ano, altura e peso para calcular. ') : 'Meta definida manualmente. '}É uma estimativa — ajuste conforme seus resultados ou a orientação do seu nutricionista.</p>
    </div>
    <form class="card" id="pf"><h3>Seus dados</h3>${profileForm(p, false)}
      <h3 style="margin-top:6px">Metas personalizadas</h3>
      <label class="f"><span>Meta de calorias (deixe vazio para calcular automático)</span><input name="kcal_target" type="number" inputmode="numeric" value="${esc(p.kcal_target || '')}" placeholder="${t.auto ? num(t.kcal) + ' (automático)' : ''}"></label>
      <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
        <label class="f"><span>Carb %</span><input name="carb_pct" type="number" inputmode="numeric" value="${p.carb_pct ?? 45}"></label>
        <label class="f"><span>Prot %</span><input name="protein_pct" type="number" inputmode="numeric" value="${p.protein_pct ?? 30}"></label>
        <label class="f"><span>Gord %</span><input name="fat_pct" type="number" inputmode="numeric" value="${p.fat_pct ?? 25}"></label>
      </div>
      <p class="small muted">Os três percentuais devem somar 100%. Metas são referências ajustáveis, não limites clínicos.</p>
      <label class="f"><span>Meta de fibras (g/dia)</span><input name="fiber_target" type="number" min="10" max="70" step="1" inputmode="numeric" value="${esc(p.fiber_target ?? 30)}"></label>
      <p class="small muted">O acompanhamento de fibras estará disponível para alimentos com dados de fibras cadastrados.</p>
      <label class="f"><span>Meta de água (ml) — vazio = automático</span><input name="water_target" type="number" inputmode="numeric" value="${esc(p.water_target || '')}"></label>
      <button class="btn primary block" type="submit">Salvar</button>
    </form>
    <div class="card"><h3>Backup dos seus dados</h3>
      <p class="small muted" style="margin-top:-4px">Seus dados ficam só neste celular. Faça backup de vez em quando — e antes de trocar de aparelho ou limpar o navegador.</p>
      <div class="row"><button class="btn grow" id="exp">Exportar backup</button><button class="btn ghost grow" id="imp">Importar</button></div>
    </div>
    <div class="card"><h3>Instalar na tela inicial</h3>
      <p class="small muted" style="margin:0">iPhone: no Safari, toque em <b>Compartilhar</b> › <b>Adicionar à Tela de Início</b>.<br>Android: no Chrome, menu <b>⋮</b> › <b>Instalar app</b>.<br>Instalado, o app abre em tela cheia e seus dados ficam mais protegidos.</p>
    </div>
    <button class="btn danger block" id="wipe" style="margin-bottom:12px">Apagar todos os dados deste celular</button>
    <p class="small muted" style="text-align:center">Ritmo · versão 1.3</p>`;
  },
  bind(view) {
    const seg = { sex: db.profile.sex, goal: db.profile.goal || 'manter' };
    bindSegs(view, seg);
    $('#pf', view).addEventListener('submit', (e) => {
      e.preventDefault();
      const p = readProfileForm(e.target, seg); delete p.weight;
      const fd = Object.fromEntries(new FormData(e.target));
      const c = Number(fd.carb_pct) || 0, pr = Number(fd.protein_pct) || 0, f = Number(fd.fat_pct) || 0;
      if (![c, pr, f].every(Number.isFinite) || [c, pr, f].some(x => x < 0 || x > 100) || Math.abs(c + pr + f - 100) > 0.01) return toast('Macros inválidos: devem somar 100%');
      const fiberTarget = Number(fd.fiber_target);
      if (!Number.isFinite(fiberTarget) || fiberTarget < 10 || fiberTarget > 70) return toast('Meta de fibras deve ficar entre 10 e 70 g');
      if (!p.name) return toast('Informe seu nome');
      db.profile = { ...db.profile, ...p, kcal_target: Number(fd.kcal_target) || null, carb_pct: c, protein_pct: pr, fat_pct: f, fiber_target: fiberTarget, water_target: Number(fd.water_target) || null };
      save(); render(); toast('Perfil salvo ✓');
    });
    $('#exp', view).addEventListener('click', exportBackup);
    $('#imp', view).addEventListener('click', importBackup);
    $('#wipe', view).addEventListener('click', () => {
      if (!confirm('Apagar TODOS os dados deste celular? Faça um backup antes. Essa ação não pode ser desfeita.')) return;
      if (!confirm('Tem certeza mesmo?')) return;
      localStorage.removeItem(KEY); db = blank(); state.date = today(); render();
    });
  }
};
async function exportBackup() {
  const name = `ritmo-backup-${today()}.json`;
  const blob = new Blob([JSON.stringify(db)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Ritmo' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Backup exportado');
}
function importBackup() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.v !== 1 || !('logs' in data)) throw new Error();
      if (db.profile && !confirm('Isso vai substituir os dados atuais deste celular pelos do backup. Continuar?')) return;
      db = { ...blank(), ...data }; save(); state.date = today(); go('hoje'); toast('Backup importado ✓');
    } catch { toast('Arquivo de backup inválido'); }
  };
  inp.click();
}

// ---------- início ----------
const t0 = location.hash.slice(1); if (VIEWS[t0]) state.tab = t0;
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
