import './style.css';
import {
  supabase,
  configOk,
  loginConGoogle,
  cerrarSesion,
  guardarPartida,
  obtenerHistorial,
} from './supabase.js';
import { Memoria, PAREJAS, TIEMPO_LIMITE } from './game.js';

const app = document.getElementById('app');
let usuario = null;
let juego = null;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ---------- Estructura base ---------- */
function layout(contenido) {
  const nombre = usuario?.user_metadata?.full_name || usuario?.email || '';
  app.innerHTML = `
    <header class="top">
      <h1>🔐 Memoria</h1>
      ${
        usuario
          ? `<div class="user">
              <span class="user-name" title="${esc(usuario.email || '')}">👤 ${esc(nombre)}</span>
              <button id="btn-logout" class="btn small ghost">Cerrar sesión</button>
            </div>`
          : ''
      }
    </header>
    <main>${contenido}</main>`;
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    juego?.detener();
    try {
      await cerrarSesion();
    } catch (e) {
      alert('Error al cerrar sesión: ' + e.message);
    }
  });
}

/* ---------- Pantallas ---------- */
function vistaConfigFalta() {
  layout(`<section class="card">
    <h2>Falta la configuración</h2>
    <p>Crea un archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y
    <code>VITE_SUPABASE_ANON_KEY</code> (mira el README).</p>
  </section>`);
}

function vistaLogin(error = '') {
  layout(`<section class="card center">
    <h2>La caja fuerte digital</h2>
    <p>Inicia sesión para jugar y guardar tus partidas.</p>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <button id="btn-google" class="btn primary big">
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
      Entrar con Google
    </button>
  </section>`);
  document.getElementById('btn-google').addEventListener('click', async () => {
    try {
      await loginConGoogle();
    } catch (e) {
      vistaLogin(e.message);
    }
  });
}

function vistaInicio() {
  layout(`<section class="card center">
    <h2>Encuentra las parejas</h2>
    <p>Pon a prueba tu memoria y consigue la mejor puntuación.</p>
    <div class="botones">
      <button id="btn-jugar" class="btn primary big">▶ Nueva partida</button>
      <button id="btn-instr" class="btn">📖 Instrucciones</button>
      <button id="btn-hist" class="btn">📊 Mi historial</button>
    </div>
  </section>`);
  document.getElementById('btn-jugar').onclick = vistaJuego;
  document.getElementById('btn-instr').onclick = vistaInstrucciones;
  document.getElementById('btn-hist').onclick = vistaHistorial;
}

function vistaInstrucciones() {
  layout(`<section class="card">
    <h2>Instrucciones</h2>
    <ol class="reglas">
      <li>Hay <strong>${PAREJAS * 2} cartas</strong> boca abajo con <strong>${PAREJAS} parejas</strong> de símbolos.</li>
      <li>Toca (o haz clic en) dos cartas para darles la vuelta.</li>
      <li>Si coinciden, se quedan descubiertas. Si no, se vuelven a ocultar.</li>
      <li>Tienes <strong>${TIEMPO_LIMITE} segundos</strong> para encontrar todas las parejas.</li>
      <li><strong>Puntuación:</strong> 100 puntos por pareja + 10 por cada segundo que te sobre si ganas − 5 por cada fallo.</li>
      <li>Si se acaba el tiempo, la partida cuenta como <strong>derrota</strong>.</li>
    </ol>
    <div class="botones">
      <button id="btn-jugar" class="btn primary">▶ Jugar</button>
      <button id="btn-volver" class="btn">← Volver</button>
    </div>
  </section>`);
  document.getElementById('btn-jugar').onclick = vistaJuego;
  document.getElementById('btn-volver').onclick = vistaInicio;
}

function vistaJuego() {
  layout(`<section class="juego">
    <div class="hud">
      <div class="stat"><span>⏱️</span><strong id="h-tiempo">${TIEMPO_LIMITE}</strong>s</div>
      <div class="stat"><span>👆</span><strong id="h-mov">0</strong> mov.</div>
      <div class="stat"><span>✅</span><strong id="h-par">0</strong>/${PAREJAS}</div>
    </div>
    <div id="tablero" class="tablero"></div>
    <div class="botones">
      <button id="btn-reiniciar" class="btn">🔄 Reiniciar</button>
      <button id="btn-salir" class="btn ghost">Salir</button>
    </div>
  </section>`);

  const tablero = document.getElementById('tablero');
  juego = new Memoria(tablero, {
    onTick: (t) => {
      const el = document.getElementById('h-tiempo');
      if (el) {
        el.textContent = t;
        el.parentElement.classList.toggle('alerta', t <= 10);
      }
    },
    onStats: (m, p) => {
      document.getElementById('h-mov').textContent = m;
      document.getElementById('h-par').textContent = p;
    },
    onFin: (datos) => vistaResultado(datos),
  });
  juego.iniciar();

  document.getElementById('btn-reiniciar').onclick = () => juego.iniciar();
  document.getElementById('btn-salir').onclick = () => {
    juego.detener();
    vistaInicio();
  };
}

async function vistaResultado(datos) {
  const victoria = datos.resultado === 'victoria';
  layout(`<section class="card center">
    <h2>${victoria ? '🎉 ¡Has ganado!' : '⌛ Se acabó el tiempo'}</h2>
    <p class="puntos">${datos.puntuacion} <small>puntos</small></p>
    <ul class="resumen">
      <li>Resultado: <strong>${victoria ? 'Victoria' : 'Derrota'}</strong></li>
      <li>Duración: <strong>${datos.duracion} s</strong></li>
      <li>Movimientos: <strong>${datos.intentos}</strong></li>
    </ul>
    <p id="estado-guardado" class="estado">Guardando partida…</p>
    <div class="botones">
      <button id="btn-otra" class="btn primary big">▶ Jugar otra vez</button>
      <button id="btn-hist" class="btn">📊 Historial</button>
      <button id="btn-inicio" class="btn ghost">Inicio</button>
    </div>
  </section>`);
  document.getElementById('btn-otra').onclick = vistaJuego;
  document.getElementById('btn-hist').onclick = vistaHistorial;
  document.getElementById('btn-inicio').onclick = vistaInicio;

  const estado = document.getElementById('estado-guardado');
  try {
    await guardarPartida(datos);
    estado.textContent = '✅ Partida guardada en la base de datos';
    estado.className = 'estado ok';
  } catch (e) {
    estado.textContent = '❌ No se pudo guardar: ' + e.message;
    estado.className = 'estado error';
  }
}

async function vistaHistorial() {
  layout(`<section class="card">
    <h2>Mi historial</h2>
    <div id="hist-body"><p>Cargando…</p></div>
    <div class="botones"><button id="btn-volver" class="btn">← Volver</button></div>
  </section>`);
  document.getElementById('btn-volver').onclick = vistaInicio;
  const body = document.getElementById('hist-body');
  try {
    const { partidas, total } = await obtenerHistorial();
    if (!partidas.length) {
      body.innerHTML = '<p>Todavía no has jugado ninguna partida.</p>';
      return;
    }
    const filas = partidas
      .map(
        (p) => `<tr>
          <td data-label="Fecha">${new Date(p.fecha).toLocaleString('es-ES')}</td>
          <td data-label="Resultado"><span class="badge ${p.resultado}">${p.resultado}</span></td>
          <td data-label="Puntuación">${p.puntuacion}</td>
          <td data-label="Duración">${p.duracion} s</td>
        </tr>`
      )
      .join('');
    body.innerHTML = `<p class="total">Total de partidas jugadas: <strong>${total}</strong></p>
      <table class="tabla">
        <thead><tr><th>Fecha</th><th>Resultado</th><th>Puntuación</th><th>Duración</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
  } catch (e) {
    body.innerHTML = `<p class="error">Error al cargar el historial: ${esc(e.message)}</p>`;
  }
}

/* ---------- Arranque ---------- */
function pintar() {
  if (!configOk) return vistaConfigFalta();
  usuario ? vistaInicio() : vistaLogin();
}

async function init() {
  if (!configOk) return vistaConfigFalta();

  const { data } = await supabase.auth.getSession();
  usuario = data.session?.user ?? null;
  pintar();

  supabase.auth.onAuthStateChange((evento, session) => {
    const nuevo = session?.user ?? null;
    const cambio = (nuevo?.id ?? null) !== (usuario?.id ?? null);
    usuario = nuevo;
    if (cambio) {
      juego?.detener();
      pintar();
    }
  });
}

init();
