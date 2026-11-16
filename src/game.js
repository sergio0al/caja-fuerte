// Lógica del juego de memoria (sin dependencias de interfaz de usuario salvo el tablero)

const EMOJIS = ['🔑', '💎', '🔒', '💰', '🧭', '🗝️', '⚙️', '🎲'];
export const PAREJAS = EMOJIS.length;
export const TIEMPO_LIMITE = 90; // segundos

function barajar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function calcularPuntuacion({ victoria, parejas, fallos, tiempoRestante }) {
  const base = parejas * 100;
  const bonus = victoria ? tiempoRestante * 10 : 0;
  const penal = fallos * 5;
  return Math.max(0, base + bonus - penal);
}

export class Memoria {
  /**
   * @param {HTMLElement} tablero contenedor de las cartas
   * @param {{onTick:Function,onStats:Function,onFin:Function}} cb
   */
  constructor(tablero, cb) {
    this.tablero = tablero;
    this.cb = cb;
    this.timer = null;
    this.bloqueado = false;
    this.terminada = false;
  }

  iniciar() {
    this.detener();
    this.terminada = false;
    this.bloqueado = false;
    this.volteadas = [];
    this.encontradas = 0;
    this.movimientos = 0;
    this.fallos = 0;
    this.tiempoRestante = TIEMPO_LIMITE;
    this.inicio = Date.now();

    const cartas = barajar([...EMOJIS, ...EMOJIS]);
    this.tablero.innerHTML = '';
    cartas.forEach((emoji, i) => {
      const b = document.createElement('button');
      b.className = 'carta';
      b.type = 'button';
      b.dataset.emoji = emoji;
      b.dataset.i = i;
      b.setAttribute('aria-label', 'Carta boca abajo');
      b.innerHTML = `<span class="cara dorso">?</span><span class="cara frente">${emoji}</span>`;
      b.addEventListener('click', () => this.voltear(b));
      this.tablero.appendChild(b);
    });

    this.cb.onTick(this.tiempoRestante);
    this.cb.onStats(this.movimientos, this.encontradas);
    this.timer = setInterval(() => this.tick(), 250);
  }

  tick() {
    const transcurrido = Math.floor((Date.now() - this.inicio) / 1000);
    const restante = Math.max(0, TIEMPO_LIMITE - transcurrido);
    if (restante !== this.tiempoRestante) {
      this.tiempoRestante = restante;
      this.cb.onTick(restante);
    }
    if (restante <= 0) this.terminar(false);
  }

  voltear(carta) {
    if (this.bloqueado || this.terminada) return;
    if (carta.classList.contains('volteada') || carta.classList.contains('hecha')) return;

    carta.classList.add('volteada');
    this.volteadas.push(carta);

    if (this.volteadas.length === 2) {
      this.movimientos++;
      this.bloqueado = true;
      const [a, b] = this.volteadas;
      if (a.dataset.emoji === b.dataset.emoji) {
        a.classList.add('hecha');
        b.classList.add('hecha');
        this.encontradas++;
        this.volteadas = [];
        this.bloqueado = false;
        this.cb.onStats(this.movimientos, this.encontradas);
        if (this.encontradas === PAREJAS) this.terminar(true);
      } else {
        this.fallos++;
        this.cb.onStats(this.movimientos, this.encontradas);
        setTimeout(() => {
          a.classList.remove('volteada');
          b.classList.remove('volteada');
          this.volteadas = [];
          this.bloqueado = false;
        }, 800);
      }
    }
  }

  terminar(victoria) {
    if (this.terminada) return;
    this.terminada = true;
    this.detener();
    const duracion = Math.min(TIEMPO_LIMITE, Math.round((Date.now() - this.inicio) / 1000));
    const tiempoRestante = Math.max(0, TIEMPO_LIMITE - duracion);
    const puntuacion = calcularPuntuacion({
      victoria,
      parejas: this.encontradas,
      fallos: this.fallos,
      tiempoRestante,
    });
    this.cb.onFin({
      resultado: victoria ? 'victoria' : 'derrota',
      puntuacion,
      duracion: victoria ? duracion : TIEMPO_LIMITE,
      intentos: this.movimientos,
    });
  }

  detener() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
