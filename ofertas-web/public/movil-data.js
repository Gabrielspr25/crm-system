// ============================================================
// CLARO BUSINESS — PLANES MÓVILES PYMES
// Datos del boletín y tabla de ofertas/financiamiento
// ============================================================

const CATEGORIES = [
  {
    id: 'individual-basico',
    name: 'Planes Nacionales Individuales — Básicos',
    icon: '📱',
    cssClass: 'cat-movil-basico',
    description: 'Planes económicos con minutos y data limitados',
  },
  {
    id: 'individual-red',
    name: 'Business RED — Individual',
    icon: '🔴',
    cssClass: 'cat-movil-red',
    description: 'Data ilimitada sin reducción, Hotspot incluido',
  },
  {
    id: 'sin-fronteras',
    name: 'Claro Sin Fronteras',
    icon: '🌎',
    cssClass: 'cat-movil-sf',
    description: 'Roaming y LD ilimitado en 18+ países de LATAM',
  },
  {
    id: 'multilinea',
    name: 'Planes Multilíneas Familiares / Negocios',
    icon: '👥',
    cssClass: 'cat-movil-multi',
    description: 'Hasta 10 líneas con ahorro, permite Móvil + Banda Ancha',
  },
  {
    id: 'ofertas-equipos',
    name: 'Ofertas de Equipos y Financiamiento',
    icon: '📦',
    cssClass: 'cat-movil-ofertas',
    description: 'Equipos GRATIS y financiamiento según plan',
  },
];

const PLANS = [
  // ========== INDIVIDUALES BÁSICOS ==========
  {
    cat: 'individual-basico',
    code: 'VOLT412',
    name: 'Plan Nacional $12',
    price: '$12.00',
    voz: '1,000 min PR y US',
    ld: '100 min LD a US',
    sms: '900 SMS / 100 MMS',
    data: '4.5 GB (PUJ)',
    hotspot: '—',
    roaming: '—',
    nota: 'Plan básico para uso moderado',
  },
  {
    cat: 'individual-basico',
    code: 'VOLT820',
    name: 'Plan Nacional $20',
    price: '$20.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US + 100 min LD INT',
    sms: 'Ilimitado PR, US, destinos INT',
    data: 'Ilimitada PR & US (PUJ 8GB)',
    hotspot: '—',
    roaming: 'Ilimitado en US',
    nota: 'Buen balance precio/beneficio',
  },
  {
    cat: 'individual-basico',
    code: 'RED3535',
    name: 'Plan Nacional $35',
    price: '$35.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado PR, US, MX, CA + destinos INT',
    data: 'Ilimitada PR, US, MX, CA (PUJ 35GB)',
    hotspot: '—',
    roaming: 'Ilimitado US, MX, CA',
    nota: 'Incluye México y Canadá',
  },
  {
    cat: 'individual-basico',
    code: 'RED4050',
    name: 'Plan Nacional $40',
    price: '$40.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado PR, US, MX, CA + destinos INT',
    data: 'Ilimitada PR, US, MX, CA (PUJ 50GB)',
    hotspot: '—',
    roaming: 'Ilimitado US, MX, CA',
    nota: '50GB antes de reducción de velocidad',
  },
  {
    cat: 'individual-basico',
    code: 'RED4560',
    name: 'Plan Nacional $45',
    price: '$45.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado PR, US, MX, CA + destinos INT',
    data: 'Ilimitada PR, US, MX, CA (PUJ 60GB)',
    hotspot: '—',
    roaming: 'Ilimitado US, MX, CA',
    nota: '⭐ Umbral mínimo para Bono Portabilidad',
  },

  // ========== BUSINESS RED INDIVIDUAL ==========
  {
    cat: 'individual-red',
    code: 'REDBAS',
    name: 'Business RED Basic',
    price: '$50.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado PR, US, MX, CA + destinos INT',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '10 GB',
    roaming: 'Ilimitado US, MX, CA',
    nota: '🔥 Primer plan sin reducción de velocidad',
  },
  {
    cat: 'individual-red',
    code: 'BREDPLUS',
    name: 'Business RED Plus',
    price: '$65.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado PR, US, MX, CA + destinos INT',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '15 GB',
    roaming: 'Ilimitado US, MX, CA',
    nota: '🔥 Permite Móvil + Banda Ancha',
    destacado: true,
  },
  {
    cat: 'individual-red',
    code: 'BREDEXT',
    name: 'Business RED Extreme',
    price: '$75.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado PR, US, MX, CA + destinos INT',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '50 GB',
    roaming: 'Ilimitado US, MX, CA',
    nota: '🔥 Permite Móvil + Banda Ancha · Hotspot generoso',
    destacado: true,
  },
  {
    cat: 'individual-red',
    code: 'BREDSUP',
    name: 'Business RED Supreme',
    price: '$95.00',
    voz: 'Ilimitada local',
    ld: 'Ilimitado a US, MX, CA + 100 min INT',
    sms: 'Ilimitado PR, US, MX, CA + destinos INT',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '100 GB',
    roaming: 'Ilimitado US, MX, CA',
    nota: '🔥 Permite Móvil + Banda Ancha · 100 min LD Internacional',
    destacado: true,
  },
  {
    cat: 'individual-red',
    code: 'BREDSF',
    name: 'Business RED Sin Fronteras',
    price: '$100.00',
    voz: 'Ilimitada TODO',
    ld: 'Ilimitado a 18+ países',
    sms: 'Ilimitado TODO',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '100 GB',
    roaming: 'Ilimitado en 18+ países',
    nota: '⭐ PLAN PREMIUM · Permite Móvil + Banda Ancha · Todo ilimitado',
    destacado: true,
    premium: true,
  },

  // ========== CLARO SIN FRONTERAS ==========
  {
    cat: 'sin-fronteras',
    code: 'VOLCSF50',
    name: 'Sin Fronteras $50',
    price: '$50.00',
    voz: 'Ilimitada local + LD + RM',
    ld: 'Ilimitado 18+ países LATAM',
    sms: 'Ilimitado TODO',
    data: 'Ilimitada con PUJ 5GB',
    hotspot: '5 GB (solo PR y US)',
    roaming: '18+ países (NO roaming INT de data)',
    nota: 'Sin roaming internacional de data',
  },
  {
    cat: 'sin-fronteras',
    code: 'VOLCSF60',
    name: 'Sin Fronteras $60',
    price: '$60.00',
    voz: 'Ilimitada local + LD + RM',
    ld: 'Ilimitado 18+ países LATAM',
    sms: 'Ilimitado TODO',
    data: 'Ilimitada con PUJ 10GB',
    hotspot: '10 GB (solo PR y US)',
    roaming: '18+ países (NO roaming INT de data)',
    nota: 'Doble data vs plan de $50',
  },
  {
    cat: 'sin-fronteras',
    code: 'VOLCSF70',
    name: 'Sin Fronteras $70',
    price: '$70.00',
    voz: 'Ilimitada local + LD + RM',
    ld: 'Ilimitado 18+ países LATAM',
    sms: 'Ilimitado TODO',
    data: 'Ilimitada con PUJ 15GB',
    hotspot: '15 GB (solo PR y US)',
    roaming: '18+ países (NO roaming INT de data)',
    nota: '15GB de hotspot',
  },
  {
    cat: 'sin-fronteras',
    code: 'BREDSF',
    name: 'Sin Fronteras $100 (RED)',
    price: '$100.00',
    voz: 'Ilimitada TODO',
    ld: 'Ilimitado 18+ países LATAM',
    sms: 'Ilimitado TODO',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '100 GB',
    roaming: '18+ países CON roaming de data',
    nota: '⭐ Plan completo · Data sin reducción · Roaming data incluido',
    premium: true,
  },

  // ========== MULTILÍNEAS ==========
  {
    cat: 'multilinea',
    code: 'BREDP1',
    name: 'RED Plus Multilínea — 10 líneas',
    price: '$350.00',
    pricePerLine: '$35/línea',
    voz: 'Ilimitada local + LD',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '15 GB',
    roaming: 'Ilimitado US, MX, CA',
    nota: 'Hasta 10 líneas · Permite Móvil + Banda Ancha',
    destacado: true,
  },
  {
    cat: 'multilinea',
    code: 'BREDE1',
    name: 'RED Extreme Multilínea — 10 líneas',
    price: '$400.00',
    pricePerLine: '$40/línea',
    voz: 'Ilimitada local + LD',
    ld: 'Ilimitado a US, MX, CA',
    sms: 'Ilimitado',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '50 GB',
    roaming: 'Ilimitado US, MX, CA',
    nota: 'Hasta 10 líneas · Permite Móvil + Banda Ancha',
    destacado: true,
  },
  {
    cat: 'multilinea',
    code: 'BREDS1',
    name: 'RED Supreme Multilínea — 10 líneas',
    price: '$500.00',
    pricePerLine: '$50/línea',
    voz: 'Ilimitada local + LD',
    ld: 'Ilimitado a US, MX, CA + 100 min INT',
    sms: 'Ilimitado',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '100 GB',
    roaming: 'Ilimitado US, MX, CA',
    nota: 'Hasta 10 líneas · Permite Móvil + Banda Ancha · 100 min LD INT',
    destacado: true,
  },
  {
    cat: 'multilinea',
    code: 'BREDSF1',
    name: 'RED Sin Fronteras Multilínea — 10 líneas',
    price: '$550.00',
    pricePerLine: '$55/línea',
    voz: 'Ilimitada TODO',
    ld: 'Ilimitado 18+ países',
    sms: 'Ilimitado TODO',
    data: 'Ilimitada SIN REDUCCIÓN',
    hotspot: '100 GB',
    roaming: 'Ilimitado 18+ países',
    nota: '⭐ PREMIUM · Hasta 10 líneas · Todo ilimitado en 18+ países',
    premium: true,
  },

  // ========== OFERTAS DE EQUIPOS ==========
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: 'Equipo GRATIS — Plan $20',
    price: '$20+',
    requisito: 'Cliente nuevo, portabilidad o renovación',
    tradeIn: 'No requerido',
    plazos: '30 plazos',
    nota: 'Equipo básico gratis en financiamiento',
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: 'Equipo GRATIS — Plan $35',
    price: '$35+',
    requisito: 'Cliente nuevo, portabilidad o renovación',
    tradeIn: 'NO requerido',
    plazos: '30 plazos',
    nota: 'Sin trade-in necesario',
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: 'Equipo GRATIS — Plan $40-$45',
    price: '$40-$45',
    requisito: 'Cliente nuevo, portabilidad o renovación',
    tradeIn: 'NO requerido',
    plazos: '30 plazos',
    nota: 'Solo 30 plazos disponible',
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: 'Equipo GRATIS — Planes desde $50',
    price: '$50+',
    requisito: 'Cliente nuevo, portabilidad o renovación',
    tradeIn: 'NO requerido',
    plazos: '30 plazos',
    nota: 'Amplia selección de equipos',
    destacado: true,
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: 'Equipo GRATIS — Planes desde $60',
    price: '$60+',
    requisito: 'Cliente nuevo, portabilidad o renovación',
    tradeIn: 'NO requerido',
    plazos: '30 plazos',
    nota: 'Equipos de gama media-alta disponibles',
    destacado: true,
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: '2 Equipos GRATIS — Multilíneas $60+',
    price: '$60+ multi',
    requisito: 'Cliente nuevo, portabilidad o renovación',
    tradeIn: 'NO requerido',
    plazos: '30 plazos',
    nota: '🔥 NUEVO · Dos equipos gratis con planes multilíneas',
    premium: true,
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: '50% Descuento Equipo — Planes $50+',
    price: '$50+',
    requisito: 'Líneas nuevas, portabilidades, renovaciones',
    tradeIn: 'NO requerido / Sin valorización',
    plazos: '30 plazos',
    nota: 'NUEVO · Mitad de precio sin trade-in',
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: 'Crédito hasta $1,000 — Planes $75+',
    price: '$75+',
    requisito: 'Cliente nuevo, portabilidad o renovación',
    tradeIn: 'NO requerido',
    plazos: '30 plazos',
    nota: '🔥 Para equipos premium (iPhone, Galaxy S, etc.)',
    destacado: true,
  },
  {
    cat: 'ofertas-equipos',
    code: '—',
    name: 'Crédito hasta $1,100 — Planes $75+ con Trade-In',
    price: '$75+',
    requisito: 'Líneas nuevas, portabilidades, renovaciones',
    tradeIn: 'REQUIERE Trade-In (sin valorización)',
    plazos: '30 plazos',
    nota: '⭐ Máximo crédito disponible',
    premium: true,
  },
];


// ============================================================
// RENDERING — Using card layout for mobile plans
// ============================================================

let currentCategory = 'all';
let currentSearch = '';

function matchesSearch(plan, search) {
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    plan.code.toLowerCase().includes(s) ||
    plan.name.toLowerCase().includes(s) ||
    plan.price.toLowerCase().includes(s) ||
    (plan.nota && plan.nota.toLowerCase().includes(s)) ||
    (plan.data && plan.data.toLowerCase().includes(s)) ||
    (plan.hotspot && plan.hotspot.toLowerCase().includes(s)) ||
    (plan.roaming && plan.roaming.toLowerCase().includes(s)) ||
    (plan.requisito && plan.requisito.toLowerCase().includes(s))
  );
}

function highlightText(text, search) {
  if (!search || !text) return text || '';
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function renderPlans() {
  const container = document.getElementById('plansContainer');
  const noResults = document.getElementById('noResults');
  let html = '';
  let totalVisible = 0;

  CATEGORIES.forEach(cat => {
    if (currentCategory !== 'all' && currentCategory !== cat.id) return;

    const catPlans = PLANS.filter(p =>
      p.cat === cat.id && matchesSearch(p, currentSearch)
    );
    if (catPlans.length === 0) return;
    totalVisible += catPlans.length;

    html += `<div class="category-section ${cat.cssClass}">`;
    html += `<div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">`;
    html += `<h2><span class="category-icon">${cat.icon}</span> ${cat.name} <span class="category-count">${catPlans.length}</span></h2>`;
    html += `<span class="category-toggle">▼</span>`;
    html += `</div>`;
    html += `<div class="category-body">`;

    if (cat.description) {
      html += `<p class="cat-description">${cat.description}</p>`;
    }

    // Render as cards
    html += `<div class="plan-cards">`;
    catPlans.forEach(plan => {
      const isPremium = plan.premium;
      const isDestacado = plan.destacado;
      const cardClass = isPremium ? 'plan-card premium' : (isDestacado ? 'plan-card destacado' : 'plan-card');

      html += `<div class="${cardClass}">`;

      // Card Header
      html += `<div class="card-header">`;
      html += `<span class="card-code">${highlightText(plan.code, currentSearch)}</span>`;
      if (isPremium) html += `<span class="card-badge premium-badge">⭐ PREMIUM</span>`;
      else if (isDestacado) html += `<span class="card-badge dest-badge">🔥 TOP</span>`;
      html += `</div>`;

      // Card Name & Price
      html += `<div class="card-title">${highlightText(plan.name, currentSearch)}</div>`;
      html += `<div class="card-price-row">`;
      html += `<span class="card-price">${plan.price}</span>`;
      html += `<span class="card-period">/mes</span>`;
      if (plan.pricePerLine) html += `<span class="card-ppl">(${plan.pricePerLine})</span>`;
      html += `</div>`;

      // Card Features — Phone plans
      if (plan.voz) {
        html += `<div class="card-features">`;
        html += `<div class="feat"><span class="feat-icon">📞</span><span class="feat-label">Voz</span><span class="feat-val">${plan.voz}</span></div>`;
        html += `<div class="feat"><span class="feat-icon">🌐</span><span class="feat-label">LD</span><span class="feat-val">${plan.ld}</span></div>`;
        html += `<div class="feat"><span class="feat-icon">📶</span><span class="feat-label">Data</span><span class="feat-val">${highlightText(plan.data, currentSearch)}</span></div>`;
        if (plan.hotspot && plan.hotspot !== '—') {
          html += `<div class="feat"><span class="feat-icon">📡</span><span class="feat-label">Hotspot</span><span class="feat-val hotspot-val">${plan.hotspot}</span></div>`;
        }
        if (plan.roaming && plan.roaming !== '—') {
          html += `<div class="feat"><span class="feat-icon">✈️</span><span class="feat-label">Roaming</span><span class="feat-val">${plan.roaming}</span></div>`;
        }
        if (plan.sms) {
          html += `<div class="feat"><span class="feat-icon">💬</span><span class="feat-label">SMS/MMS</span><span class="feat-val">${plan.sms}</span></div>`;
        }
        html += `</div>`;
      }

      // Card Features — Equipment offers
      if (plan.requisito) {
        html += `<div class="card-features">`;
        html += `<div class="feat"><span class="feat-icon">✅</span><span class="feat-label">Requisito</span><span class="feat-val">${plan.requisito}</span></div>`;
        html += `<div class="feat"><span class="feat-icon">🔄</span><span class="feat-label">Trade-In</span><span class="feat-val">${plan.tradeIn}</span></div>`;
        html += `<div class="feat"><span class="feat-icon">📅</span><span class="feat-label">Plazos</span><span class="feat-val">${plan.plazos}</span></div>`;
        html += `</div>`;
      }

      // Note
      if (plan.nota) {
        html += `<div class="card-note">${highlightText(plan.nota, currentSearch)}</div>`;
      }

      html += `</div>`; // end card
    });
    html += `</div>`; // end plan-cards
    html += `</div></div>`; // end category-body, category-section
  });

  container.innerHTML = html;
  noResults.style.display = totalVisible === 0 ? 'block' : 'none';

  document.getElementById('stats').textContent =
    totalVisible === PLANS.length
      ? `Mostrando ${totalVisible} planes`
      : `Mostrando ${totalVisible} de ${PLANS.length} planes`;
}


// ============================================================
// INIT
// ============================================================
function init() {
  const catSelect = document.getElementById('categoryFilter');
  CATEGORIES.forEach(cat => {
    const count = PLANS.filter(p => p.cat === cat.id).length;
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name} (${count})`;
    catSelect.appendChild(opt);
  });

  catSelect.addEventListener('change', () => {
    currentCategory = catSelect.value;
    renderPlans();
  });

  let searchTimeout;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      renderPlans();
    }, 200);
  });

  renderPlans();
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================
// DARK MODE
// ============================================================
(function() {
  const btn = document.getElementById('darkToggle');
  const icon = document.getElementById('darkIcon');
  const saved = localStorage.getItem('darkMode');
  if (saved === 'true') {
    document.body.classList.add('dark');
    icon.textContent = '☀️';
  }
  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    icon.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('darkMode', isDark);
  });
})();
