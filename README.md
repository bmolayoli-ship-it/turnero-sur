# Turnero SUR ONLINE

## Ejecutar en modo prueba local

```bash
npm install
npm run dev
```

## Para hacerlo ONLINE con Supabase

1. Crear cuenta en Supabase.
2. Crear un proyecto.
3. Ir a SQL Editor.
4. Copiar y ejecutar el contenido de `supabase.sql`.
5. En la carpeta del proyecto, copiar `.env.example` y renombrarlo a `.env`.
6. Completar:

```env
VITE_SUPABASE_URL=TU_URL
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

7. Ejecutar:

```bash
npm install
npm run dev
```

## Para publicar online

Podés subirlo a Vercel o Netlify.

```bash
npm run build
```

Luego subir la carpeta `dist`.

## Funciones nuevas

- Base online preparada con Supabase.
- Horarios de mañana editables.
- Horarios de tarde editables.
- Duración del turno editable.
- Máximo de pacientes por hora editable.
- Profesionales.
- Pacientes.
- Turnos.
- Estadísticas por lesión y profesional.
