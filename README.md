# 🔐 Memoria – La Caja Fuerte Digital

Videojuego web de memoria hecho con **JavaScript Vanilla + Vite**, con login de **Google (Supabase Auth)** y partidas guardadas en **PostgreSQL (Supabase)**.

## Reglas del juego

- Hay 16 cartas boca abajo con 8 parejas de símbolos.
- Toca dos cartas por turno: si coinciden se quedan descubiertas; si no, se ocultan de nuevo.
- Tienes **90 segundos** para encontrar las 8 parejas.
- **Puntuación:** 100 puntos por pareja + 10 por cada segundo sobrante (solo si ganas) − 5 por cada fallo.
- Si se acaba el tiempo, la partida es una **derrota**.
- Al terminar, la partida se guarda automáticamente y aparece en tu historial.

## Tecnologías

HTML5, CSS3, JavaScript Vanilla, Vite, PostgreSQL (Supabase), Supabase Auth con Google OAuth, GitHub.

## Ejecutarlo en local

```bash
npm install
cp .env.example .env     # y rellena tus claves de Supabase
npm run dev
```

## Configuración de Supabase

1. Crea un proyecto en https://supabase.com.
2. **SQL Editor** → pega y ejecuta `supabase/schema.sql` (crea la tabla `partidas` y las políticas RLS).
3. **Authentication → Providers → Google** → actívalo con tu Client ID y Client Secret de Google Cloud.
4. **Authentication → URL Configuration**: pon la URL pública como *Site URL* y añade también `http://localhost:5173` en *Redirect URLs*.
5. **Project Settings → API**: copia *Project URL* y la clave *anon public* en tu `.env`.

## Despliegue

Desplegado en Vercel/Netlify con las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Comando de build: `npm run build`; carpeta de salida: `dist`.

## Estructura de la tabla `partidas`

`id`, `user_id`, `fecha`, `resultado`, `puntuacion`, `duracion` (segundos), `intentos`.
Row Level Security: cada usuario solo puede leer e insertar sus propias partidas.
