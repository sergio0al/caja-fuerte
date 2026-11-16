import './style.css';
import {
  supabase,
  configOk,
  loginConGoogle,
  loginConEmail,
  registrarConEmail,
  cerrarSesion,
  guardarPartida,
  obtenerHistorial,
} from './supabase.js';
import { Memoria, PAREJAS, TIEMPO_LIMITE } from './game.js';

const app = document.getElementById('app');
let usuario = null;
let juego = null;

// Cambia a true para mostrar el botón de Google (obligatorio en la entrega final)
const USAR_GOOGLE = true;

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

function vistaLogin(error = '', info = '') {
  const google = USAR_GOOGLE
    ? `<button id="btn-google" class="btn primary big">Entrar con Google</button>`
    : '';
  const form = USAR_GOOGLE
    ? ''
    : `<form id="form-login" class="form">
        <input id="email" type="email" placeholder="Correo" autocomplete="email" required />
        <input id="password" type="password" placeholder="Contraseña (mín. 6)" autocomplete="current-password" minlength="6" required />
        <div class="botones">
          <button type="submit" class="btn primary">Entrar</button>
          <button type="button" id="btn-registro" class="btn">Crear cuenta</button>
        </div>
      </form>`;
  layout(`<section class="card center">
    <h2>La caja fuerte digital</h2>
    <p>Inicia sesión para jugar y guardar tus partidas.</p>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    ${info ? `<p class="estado ok">${esc(info)}</p>` : ''}
    ${google}
    ${form}
  </section>`);

  document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
      await loginConGoogle();
    } catch (e) {
      vistaLogin(e.message);
    }
  });

  const f = document.getElementById('form-login');
  if (f) {
    const datos = () => [
      document.getElementById('email').value.trim(),
      document.getElementById('password').value,
    ];
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await loginConEmail(...datos());
      } catch (e) {
        vistaLogin(e.message);
      }
    });
    document.getElementById('btn-registro').addEventListener('click', async () => {
      if (!f.reportValidity()) return;
      try {
        const r = await registrarConEmail(...datos());
        if (!r.session) vistaLogin('', 'Cuenta creada. Revisa tu correo para confirmarla y entra.');
      } catch (e) {
        vistaLogin(e.message);
      }
    });
  }
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