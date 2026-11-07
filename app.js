// Mi Recetario para Romper el Ayuno (OTO2 · Ayuno 2.0 AR).
// Cuestionario de 8 preguntas -> Edge Function "recetario-ayuno" (Supabase, proyecto meta-surfeo) -> recetario imprimible.
// Link propio: ?r=<id>. El PDF sale con window.print() y el CSS @media print de estilos.css.

const API = 'https://mrspggszwtvndlatsmxv.supabase.co/functions/v1/recetario-ayuno';

// Links de los regalos (PDF fijos que arma otro equipo). Vacíos = se indica que llegan por mail.
const REGALOS = {
  rompi: '',  // «Rompí mal el ayuno, ¿y ahora?»
  mate: '',   // «Mate en la Ventana» (regalo sorpresa)
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

function mostrar(id) {
  document.querySelectorAll('.vista').forEach((v) => { v.hidden = v.id !== id; });
  window.scrollTo(0, 0);
}

// ── Preguntas ───────────────────────────────────────────────────────────────
const PREGUNTAS = [
  { k: 'nombre', tipo: 'texto', titulo: '¿Cómo te llamás?', ayuda: 'Va en la tapa de tu recetario.', ph: 'Tu nombre', max: 30 },
  { k: 'edad', tipo: 'numero', titulo: '¿Cuántos años tenés?', ayuda: 'Con la edad ajusto la proteína de cada comida.', ph: 'Ej.: 58' },
  {
    k: 'protocolo', tipo: 'uno', titulo: '¿Qué protocolo te salió en el test?', ayuda: 'Es el test de 3 preguntas del programa Ayuno 2.0.',
    op: [
      ['despertar', 'El Despertar', 'Para empezar'],
      ['flexible', 'El Flexible', 'Para quien tiene vida social'],
      ['reset', 'El Reset', 'El que rompe la meseta'],
      ['rey', 'El Rey', 'Para quien ama el plato lleno'],
      ['alternado', 'El Alternado', 'El más avanzado'],
      ['nose', 'Todavía no hice el test', ''],
    ],
  },
  {
    k: 'hora', tipo: 'uno', titulo: '¿A qué hora abrís tu ventana?', ayuda: 'Es la hora de tu primera comida del día, la que rompe el ayuno.', chips: true,
    op: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((h) => [h, `${h}:00`, '']),
  },
  {
    k: 'condiciones', tipo: 'varios', titulo: '¿Tomás algún remedio o tenés alguna de estas condiciones?', ayuda: 'Marcá todas las que correspondan.', ninguna: 'ninguna',
    op: [
      ['metformina', 'Diabetes o azúcar alta, con metformina', ''],
      ['insulina', 'Insulina u otro remedio para el azúcar', ''],
      ['azucar', 'Azúcar alta o prediabetes, sin remedio', ''],
      ['presion', 'Presión alta', ''],
      ['tiroides', 'Tiroides', ''],
      ['menopausia', 'Menopausia', ''],
      ['ninguna', 'Ninguna', ''],
    ],
  },
  {
    k: 'no_come', tipo: 'varios', titulo: '¿Qué no comés o no te gusta?', ayuda: 'Marcá lo que quieras dejar afuera. Si comés de todo, seguí.', chips: true, libre: 'otro',
    op: [
      ['vegetariana', 'Soy vegetariana', ''], ['pescado', 'Pescado', ''], ['vacuna', 'Carne de vaca', ''], ['cerdo', 'Cerdo', ''], ['pollo', 'Pollo', ''],
      ['huevo', 'Huevo', ''], ['lacteos', 'Lácteos', ''], ['gluten', 'Gluten (celíaca)', ''], ['legumbres', 'Legumbres', ''],
      ['frutos_secos', 'Frutos secos', ''], ['palta', 'Palta', ''],
    ],
  },
  {
    k: 'presupuesto', tipo: 'uno', titulo: '¿Cuánto querés gastar?', ayuda: '',
    op: [['ajustado', 'Lo justo', 'Que sea bien económico'], ['normal', 'Normal', 'Ni mucho ni poco'], ['holgado', 'No me fijo tanto', 'Que sea rico y punto']],
  },
  {
    k: 'porciones', tipo: 'uno', titulo: '¿Cocinás para la familia?', ayuda: 'Ajusto las cantidades y la lista de compras.',
    op: [[1, 'No, solo para mí', ''], [2, 'Para 2', ''], [4, 'Para 3 o 4', ''], [6, 'Para 5 o más', '']],
  },
  { k: 'email', tipo: 'email', titulo: 'Último paso: tu mail', ayuda: 'El mismo con el que compraste. Ahí queda guardado tu recetario.', ph: 'tu@mail.com' },
];

let paso = 0;
const resp = Object.assign({ condiciones: [], no_come: [], otro: '' }, leer('recetario-borrador') || {});

function pintarPregunta() {
  const p = PREGUNTAS[paso];
  const total = PREGUNTAS.length - 1;
  $('#progreso-barra').style.width = `${Math.round((paso / total) * 100)}%`;
  $('#paso-num').textContent = paso < total ? `Pregunta ${paso + 1} de ${total}` : '¡Listo! Último paso';
  $('#atras').style.visibility = paso === 0 ? 'hidden' : 'visible';
  $('#siguiente').textContent = paso === total ? 'Armar mi recetario' : 'Siguiente';
  $('#error').hidden = true;
  let h = `<h1 class="titulo">${p.titulo}</h1>${p.ayuda ? `<p class="ayuda">${p.ayuda}</p>` : ''}`;
  if (p.tipo === 'texto' || p.tipo === 'numero' || p.tipo === 'email') {
    const t = p.tipo === 'numero' ? 'number' : p.tipo === 'email' ? 'email' : 'text';
    const extra = p.tipo === 'numero' ? 'inputmode="numeric" min="18" max="99"' : p.tipo === 'email' ? 'inputmode="email" autocomplete="email"' : 'autocomplete="given-name" autocapitalize="words"';
    h += `<input class="campo" id="campo" type="${t}" ${extra} maxlength="${p.max || 120}" placeholder="${p.ph}" value="${esc(resp[p.k] ?? '')}">`;
  } else {
    const multi = p.tipo === 'varios';
    h += `<div class="${p.chips ? 'chips' : 'opciones'}" role="${multi ? 'group' : 'radiogroup'}">`;
    for (const [v, t, s] of p.op) {
      const sel = multi ? (resp[p.k] || []).includes(v) : resp[p.k] === v;
      h += `<button type="button" class="op${sel ? ' sel' : ''}" data-v="${esc(v)}" aria-pressed="${sel}">
        <span class="op-check" aria-hidden="true"></span><span class="op-t">${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</span></button>`;
    }
    h += '</div>';
    if (p.libre) h += `<label class="libre">¿Algo más que no comés? <input class="campo campo-chico" id="libre" maxlength="120" placeholder="Ej.: berenjena, morrón" value="${esc(resp.otro || '')}"></label>`;
  }
  $('#pregunta').innerHTML = h;
  const campo = $('#campo');
  if (campo && !('ontouchstart' in window)) campo.focus();
  document.querySelectorAll('.op').forEach((b) => b.addEventListener('click', () => elegir(p, b)));
}

function elegir(p, b) {
  const raw = b.dataset.v;
  const v = p.op.find((o) => String(o[0]) === raw)[0];
  if (p.tipo === 'uno') {
    resp[p.k] = v;
    guardar('recetario-borrador', resp);
    document.querySelectorAll('.op').forEach((x) => { x.classList.toggle('sel', x === b); x.setAttribute('aria-pressed', x === b); });
    setTimeout(avanzar, 220);
    return;
  }
  let lista = new Set(resp[p.k] || []);
  if (lista.has(v)) lista.delete(v); else lista.add(v);
  if (p.ninguna) {
    if (v === p.ninguna && lista.has(v)) lista = new Set([v]);
    else lista.delete(p.ninguna);
  }
  resp[p.k] = [...lista];
  guardar('recetario-borrador', resp);
  document.querySelectorAll('.op').forEach((x) => {
    const on = resp[p.k].includes(p.op.find((o) => String(o[0]) === x.dataset.v)[0]);
    x.classList.toggle('sel', on); x.setAttribute('aria-pressed', on);
  });
}

function validar() {
  const p = PREGUNTAS[paso];
  const campo = $('#campo');
  if (campo) resp[p.k] = p.tipo === 'numero' ? campo.value.trim() : campo.value.trim();
  if (p.libre) resp.otro = $('#libre').value.trim();
  guardar('recetario-borrador', resp);
  const v = resp[p.k];
  if (p.k === 'nombre' && (!v || v.length < 2)) return 'Escribí tu nombre.';
  if (p.k === 'edad' && !(Number(v) >= 18 && Number(v) <= 99)) return 'Escribí tu edad en números.';
  if (p.k === 'email' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v || '')) return 'Revisá tu mail.';
  if (p.tipo === 'uno' && (v === undefined || v === null || v === '')) return 'Elegí una opción.';
  if (p.k === 'condiciones' && !(v || []).length) return 'Marcá una opción (o «Ninguna»).';
  return '';
}

function avanzar() {
  const e = validar();
  if (e) { $('#error').textContent = e; $('#error').hidden = false; return; }
  if (paso < PREGUNTAS.length - 1) { paso++; pintarPregunta(); window.scrollTo(0, 0); return; }
  enviar();
}

$('#form').addEventListener('submit', (ev) => { ev.preventDefault(); avanzar(); });
$('#atras').addEventListener('click', () => { validar(); if (paso > 0) { paso--; pintarPregunta(); } });

// ── Enviar ──────────────────────────────────────────────────────────────────
let timerPasos;
function animarPasos() {
  const items = [...document.querySelectorAll('#pasos-armado li')];
  items.forEach((li) => li.classList.remove('hecho', 'activo'));
  let i = 0;
  items[0].classList.add('activo');
  timerPasos = setInterval(() => {
    if (i < items.length - 1) { items[i].classList.replace('activo', 'hecho'); i++; items[i].classList.add('activo'); }
  }, 2200);
}

async function enviar() {
  mostrar('vista-armando');
  animarPasos();
  const { email, ...respuestas } = resp;
  try {
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, respuestas: { ...respuestas, edad: Number(respuestas.edad) } }),
    });
    const j = await r.json().catch(() => ({}));
    clearInterval(timerPasos);
    if (!r.ok || !j.recetario) throw new Error(j.error || 'Algo salió mal. Probá de nuevo en un minuto.');
    guardar('recetario-ultimo', j.id);
    history.replaceState(null, '', `?r=${j.id}`);
    pintarRecetario(j.recetario);
  } catch (e) {
    clearInterval(timerPasos);
    mostrar('vista-cuestionario');
    pintarPregunta();
    $('#error').textContent = e.message || 'No hay conexión. Probá de nuevo.';
    $('#error').hidden = false;
  }
}

// ── Recetario ───────────────────────────────────────────────────────────────
const SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function tarjeta(d) {
  const r = d.receta;
  const ing = r.ingredientes.map((i) => `<li><span>${esc(i.item)}</span><b>${esc(i.cant)}</b></li>`).join('');
  const pasos = r.pasos.map((p) => `<li>${esc(p)}</li>`).join('');
  return `<section class="receta">
    <header class="receta-cab">
      <span class="dia">Día ${d.n} · ${SEMANA[(d.n - 1) % 7]}</span>
      <span class="hora">${esc(d.hora)} h</span>
      ${d.etiqueta ? `<span class="etiqueta">${esc(d.etiqueta)}</span>` : ''}${d.repetida ? '<span class="etiqueta etiqueta-rep">Se repite</span>' : ''}
    </header>
    <h3>${esc(r.nombre)}</h3>
    <p class="meta">${r.minutos} min · ${r.proteina_g} g de proteína · ${r.kcal} kcal por porción</p>
    <p class="porque"><strong>Por qué esta es para vos:</strong> ${esc(d.porque)}</p>
    <div class="receta-cuerpo">
      <div class="ingredientes"><h4>Ingredientes</h4><ul>${ing}</ul></div>
      <div class="preparacion"><h4>Preparación</h4><ol>${pasos}</ol></div>
    </div>
  </section>`;
}

function regalo(titulo, texto, link) {
  return `<div class="regalo"><h3>${titulo}</h3><p>${texto}</p>${link
    ? `<p class="no-print-link"><a class="btn btn-pri" href="${esc(link)}" target="_blank" rel="noopener">Abrir mi regalo</a></p><p class="solo-print">Lo abrís desde tu link del recetario.</p>`
    : '<p class="chico">Te llega en el mail de tu compra.</p>'}</div>`;
}

function pintarRecetario(R) {
  document.title = `El recetario de ${R.nombre} · Ayuno 2.0`;
  const avisos = (R.avisos || []).map((a) => `<div class="aviso aviso-${esc(a.tipo)}"><h3>${esc(a.titulo)}</h3><p>${esc(a.texto)}</p></div>`).join('');
  const dias = R.semanas.flatMap((s) => s.dias);
  const indice = R.semanas.map((s) => `<div class="indice-sem"><h3>Semana ${s.n}</h3><ol start="${(s.n - 1) * 7 + 1}">${s.dias
    .map((d) => `<li><span>${esc(d.receta.nombre)}</span>${d.etiqueta ? ` <em>${esc(d.etiqueta.split(':')[0])}</em>` : ''}</li>`).join('')}</ol></div>`).join('');
  const semanas = R.semanas.map((s) => `<section class="semana">
      <h2 class="titulo-sec"><span>Semana ${s.n}</span> Días ${(s.n - 1) * 7 + 1} al ${s.n * 7}</h2>
      ${s.dias.map(tarjeta).join('')}
    </section>`).join('');
  const compras = R.compras.map((c) => `<section class="compras">
      <h2 class="titulo-sec"><span>Lista de compras</span> Semana ${c.semana}</h2>
      <p class="chico">${esc(R.porciones_texto)} Tachá lo que ya tenés en casa.</p>
      <div class="rubros">${c.rubros.map((r) => `<div class="rubro"><h3>${esc(r.rubro)}</h3><ul>${r.items
        .map((i) => `<li><span class="caja" aria-hidden="true"></span><span>${esc(i.nombre)}</span><b>${esc(i.cant)}</b></li>`).join('')}</ul></div>`).join('')}</div>
      ${c.semana === 1 ? `<div class="siempre"><h3>Siempre tené en casa</h3><p>${R.siempre.map(esc).join(' · ')}</p></div>` : ''}
    </section>`).join('');
  const fecha = new Date(R.creado).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  $('#libro').innerHTML = `
    <section class="tapa">
      <div class="tapa-arriba"><img src="logo.png" alt=""><span>Ayuno 2.0 · Método P.I.G.</span></div>
      <div class="tapa-centro">
        <p class="tapa-pre">Mi Recetario para Romper el Ayuno</p>
        <h1>El recetario de <span>${esc(R.nombre)}</span></h1>
        <p class="tapa-sub">21 comidas para romper el ayuno, elegidas para vos. Tres semanas sin repetir.</p>
        <ul class="tapa-datos">
          <li>Protocolo <b>${esc(R.protocolo)}</b></li>
          <li>Ventana <b>${esc(R.hora)} h</b></li>
          <li><b>${R.edad}</b> años</li>
        </ul>
      </div>
      <div class="tapa-abajo"><strong>Lic. Lucas Martínez</strong><span>Nutricionista · Ayuno 2.0</span><span class="tapa-fecha">${fecha}</span></div>
    </section>

    <section class="carta">
      <h2 class="titulo-sec"><span>Hola, ${esc(R.nombre)}</span></h2>
      <p class="saludo">${esc(R.saludo)}</p>
      <p class="firma">Lic. Lucas Martínez</p>
      <div class="nota">${esc(R.nota_protocolo)} ${esc(R.porciones_texto)}</div>
      ${avisos}
      <div class="como">
        <h3>Cómo usar tu recetario</h3>
        <ul>
          <li>Seguí los días en orden: están pensados para que no repitas y para que la semana te salga equilibrada.</li>
          <li>Empezá siempre por la proteína y la verdura del plato; lo demás, después.</li>
          <li>Durante el ayuno, agua, café o mate sin azúcar.</li>
          <li>Si un día te tentaste, no pasa nada: mirá «Rompí mal el ayuno, ¿y ahora?» y al otro día seguís con el que toca.</li>
          ${R.no_come?.length ? `<li>Dejamos afuera lo que no comés: ${esc(R.no_come.join(', ').replaceAll('_', ' '))}.</li>` : ''}
        </ul>
      </div>
    </section>

    <section class="indice">
      <h2 class="titulo-sec"><span>Tus 21 comidas</span> de un vistazo</h2>
      <div class="indice-grilla">${indice}</div>
    </section>

    ${semanas}
    ${compras}

    <section class="regalos">
      <h2 class="titulo-sec"><span>Tus regalos</span></h2>
      ${regalo('Rompí mal el ayuno, ¿y ahora?', 'Qué hacer en las horas siguientes si un día comiste lo que no tenías que comer, para que no se pierda el día.', REGALOS.rompi)}
      ${regalo('Regalo sorpresa: Mate en la Ventana', 'Un regalo que tiene que ver con el mate, para que lo sigas disfrutando con tu ayuno.', REGALOS.mate)}
      <p class="legal">Este recetario es una guía de alimentación y no reemplaza la consulta médica. Si tomás remedios o tenés una enfermedad, consultalo con tu médico antes de cambiar tu alimentación o tus horarios. Nunca cambies ni dejes un remedio por tu cuenta.</p>
    </section>`;
  mostrar('vista-recetario');
}

// ── Botones del recetario ───────────────────────────────────────────────────
const enApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|TikTok/i.test(navigator.userAgent);
$('#aviso-app').hidden = !enApp;
$('#descargar').addEventListener('click', () => {
  if (enApp) { $('#aviso-app').scrollIntoView({ behavior: 'smooth' }); return; }
  window.print();
});
$('#copiar').addEventListener('click', async () => {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); $('#copiar').textContent = '¡Link copiado!'; }
  catch { prompt('Copiá tu link:', url); }
  setTimeout(() => { $('#copiar').textContent = 'Copiar mi link'; }, 2500);
});
$('#otro').addEventListener('click', (ev) => {
  ev.preventDefault();
  history.replaceState(null, '', './');
  paso = 0; mostrar('vista-cuestionario'); pintarPregunta();
});

// ── Inicio ──────────────────────────────────────────────────────────────────
(async function inicio() {
  const id = new URLSearchParams(location.search).get('r');
  if (!id) { mostrar('vista-cuestionario'); pintarPregunta(); return; }
  mostrar('vista-armando');
  $('#vista-armando h1').textContent = 'Abriendo tu recetario';
  $('#pasos-armado').hidden = true;
  try {
    const r = await fetch(`${API}?id=${encodeURIComponent(id)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.recetario) throw new Error(j.error || 'No encontramos este recetario.');
    pintarRecetario(j.recetario);
  } catch (e) {
    $('#error-texto').textContent = e.message;
    mostrar('vista-error');
  }
})();
