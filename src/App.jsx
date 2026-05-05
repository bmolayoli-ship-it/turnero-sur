import React, { useEffect, useMemo, useState } from "react";
import { supabase, modoOnline } from "./supabaseClient";
import { ESTADOS, calcularMetricas, pierdeTurno } from "./attendanceUtils";
import {
  CalendarDays, Users, UserRound, Clock3, BarChart3, Settings, Bell, Plus,
  ChevronLeft, ChevronRight, Calendar, Search, Trash2, HeartPulse, ShieldCheck,
  Star, Wifi, WifiOff, Save
} from "lucide-react";

const lesionesBase = [
  "Contractura lumbar", "Cervicalgia", "Lumbalgia crónica", "Rehabilitación de hombro",
  "Rehabilitación de rodilla", "Esguince de tobillo", "Post operatorio", "Reeducación postural",
  "Dolor ciático", "Tendinitis", "Traumatología", "Neurológica", "Respiratoria"
];

const colores = ["green", "blue", "purple", "red", "orange", "teal"];

const etiquetaEstado = (estado) => {
  switch (estado) {
    case ESTADOS.ASISTIO:
      return "Asistió";
    case ESTADOS.AVISO:
      return "Avisó · conserva orden";
    case ESTADOS.NO_AVISO:
      return "No avisó · pierde orden";
    default:
      return "Pendiente";
  }
};

const claseEstado = (estado) => {
  switch (estado) {
    case ESTADOS.ASISTIO:
      return "estado-asistio";
    case ESTADOS.AVISO:
      return "estado-aviso";
    case ESTADOS.NO_AVISO:
      return "estado-no-aviso";
    default:
      return "estado-pendiente";
  }
};

const textoOrden = (estado) => {
  if (estado === ESTADOS.ASISTIO) return "Orden usada";
  if (estado === ESTADOS.AVISO) return "Conserva orden";
  if (pierdeTurno(estado)) return "Pierde orden";
  return "Orden pendiente";
};


const configInicial = {
  horariosManana: ["08:00", "09:00", "10:00", "11:00", "12:00"],
  horariosTarde: ["14:00", "15:00", "16:00", "17:00", "18:00"],
  duracionTurno: 60,
  maxPorHora: 3,
  lesiones: lesionesBase
};

const leer = (clave, defecto) => {
  try {
    const valor = localStorage.getItem(clave);
    return valor ? JSON.parse(valor) : defecto;
  } catch {
    return defecto;
  }
};
const guardarLocal = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor));
const hoyISO = () => new Date().toISOString().slice(0, 10);
const sumarDias = (iso, dias) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const fechaLarga = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

const horaFin = (hora, minutos) => {
  const [h, m] = hora.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + Number(minutos), 0, 0);
  return d.toTimeString().slice(0, 5);
};

const diasDelMes = (iso) => {
  const base = new Date(iso + "T12:00:00");
  const y = base.getFullYear();
  const m = base.getMonth();
  const primero = new Date(y, m, 1);
  const ultimo = new Date(y, m + 1, 0);
  const inicioSemana = (primero.getDay() + 6) % 7;
  const dias = [];
  for (let i = 0; i < inicioSemana; i++) {
    const d = new Date(y, m, 1 - inicioSemana + i);
    dias.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), fuera: true });
  }
  for (let n = 1; n <= ultimo.getDate(); n++) {
    const d = new Date(y, m, n);
    dias.push({ iso: d.toISOString().slice(0, 10), num: n, fuera: false });
  }
  while (dias.length % 7 !== 0) {
    const d = new Date(y, m, ultimo.getDate() + (dias.length % 7));
    dias.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), fuera: true });
  }
  return dias;
};

export default function App() {
  const [vista, setVista] = useState("Agenda");
  const [fecha, setFecha] = useState(() => leer("sur_fecha", hoyISO()));
  const [config, setConfig] = useState(() => leer("sur_config", configInicial));
  const [profesionales, setProfesionales] = useState(() => leer("sur_profesionales", [
    { id: "local-cecilia", nombre: "Lic. Cecilia", especialidad: "Kinesiología", activo: true }
  ]));
  const [profId, setProfId] = useState(() => leer("sur_prof_id", "local-cecilia"));
  const [turnos, setTurnos] = useState(() => leer("sur_turnos", []));
  const [pacientes, setPacientes] = useState(() => leer("sur_pacientes", []));
  const [modalTurno, setModalTurno] = useState(null);
  const [modalPaciente, setModalPaciente] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [nuevoProf, setNuevoProf] = useState({ nombre: "", especialidad: "" });
  const [nuevoHorario, setNuevoHorario] = useState({ bloque: "mañana", hora: "" });
  const [nuevaLesion, setNuevaLesion] = useState("");
  const [estado, setEstado] = useState(modoOnline ? "Conectando..." : "Modo local");

  const profActual = profesionales.find(p => p.id === profId) || profesionales[0];

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => guardarLocal("sur_fecha", fecha), [fecha]);
  useEffect(() => guardarLocal("sur_config", config), [config]);
  useEffect(() => guardarLocal("sur_profesionales", profesionales), [profesionales]);
  useEffect(() => guardarLocal("sur_prof_id", profId), [profId]);
  useEffect(() => guardarLocal("sur_turnos", turnos), [turnos]);
  useEffect(() => guardarLocal("sur_pacientes", pacientes), [pacientes]);

  const cargarDatos = async () => {
    if (!supabase) return;
    try {
      setEstado("Online");
      const [profs, pacs, turns, conf] = await Promise.all([
        supabase.from("profesionales").select("*").order("created_at", { ascending: true }),
        supabase.from("pacientes").select("*").order("created_at", { ascending: false }),
        supabase.from("turnos").select("*").order("fecha", { ascending: true }),
        supabase.from("configuracion").select("*").eq("id", "principal").maybeSingle()
      ]);

      if (profs.data?.length) {
        const map = profs.data.map(p => ({ id: p.id, nombre: p.nombre, especialidad: p.especialidad, activo: p.activo }));
        setProfesionales(map);
        setProfId(map[0].id);
      }

      if (pacs.data) {
        setPacientes(pacs.data.map(p => ({
          id: p.id, nombre: p.nombre, dni: p.dni || "", telefono: p.telefono || "",
          obraSocial: p.obra_social || "", lesion: p.lesion || "", notas: p.notas || ""
        })));
      }

      if (turns.data) {
        setTurnos(turns.data.map(t => ({
          id: t.id, fecha: t.fecha, hora: t.hora, bloque: t.bloque,
          profesionalId: t.profesional_id, profesional: t.profesional,
          pacienteId: t.paciente_id, paciente: t.paciente, dni: t.dni || "",
          telefono: t.telefono || "", obraSocial: t.obra_social || "",
          lesion: t.lesion || "", notas: t.notas || "", estado: t.estado || "pendiente",
          color: t.color || "teal"
        })));
      }

      if (conf.data?.data) setConfig({ ...configInicial, ...conf.data.data });
    } catch (e) {
      console.error(e);
      setEstado("Error online - usando local");
    }
  };

  const guardarConfigOnline = async (nuevaConfig) => {
    setConfig(nuevaConfig);
    if (!supabase) return;
    await supabase.from("configuracion").upsert({
      id: "principal",
      data: nuevaConfig,
      updated_at: new Date().toISOString()
    });
  };

  const turnosDia = useMemo(
    () => turnos.filter(t => t.fecha === fecha && t.profesionalId === profActual?.id),
    [turnos, fecha, profActual]
  );

  const estadisticas = useMemo(() => {
    const porLesion = {};
    const porProfesional = {};
    turnos.forEach(t => {
      porLesion[t.lesion || "Sin lesión"] = (porLesion[t.lesion || "Sin lesión"] || 0) + 1;
      porProfesional[t.profesional || "Sin profesional"] = (porProfesional[t.profesional || "Sin profesional"] || 0) + 1;
    });

    const asistencia = calcularMetricas(turnos);

    return {
      porLesion,
      porProfesional,
      total: turnos.length,
      pacientes: pacientes.length,
      asistencia
    };
  }, [turnos, pacientes]);

  const turnosEnHora = (hora) => turnosDia.filter(t => t.hora === hora);

  const agregarProfesional = async () => {
    const nombre = nuevoProf.nombre.trim();
    if (!nombre) return;
    const especialidad = nuevoProf.especialidad.trim() || "Kinesiología";

    if (supabase) {
      const { data, error } = await supabase.from("profesionales").insert({ nombre, especialidad }).select().single();
      if (!error && data) {
        const prof = { id: data.id, nombre: data.nombre, especialidad: data.especialidad, activo: data.activo };
        setProfesionales([...profesionales, prof]);
        setProfId(prof.id);
      }
    } else {
      const prof = { id: crypto.randomUUID(), nombre, especialidad, activo: true };
      setProfesionales([...profesionales, prof]);
      setProfId(prof.id);
    }
    setNuevoProf({ nombre: "", especialidad: "" });
  };

  const eliminarProfesional = async (id) => {
    if (profesionales.length <= 1) return alert("Debe quedar al menos un profesional.");
    if (!confirm("¿Eliminar profesional?")) return;

    if (supabase) await supabase.from("profesionales").delete().eq("id", id);
    const nuevos = profesionales.filter(p => p.id !== id);
    setProfesionales(nuevos);
    if (profId === id) setProfId(nuevos[0].id);
  };

  const guardarPaciente = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const paciente = {
      nombre: data.get("nombre").trim(),
      dni: data.get("dni").trim(),
      telefono: data.get("telefono").trim(),
      obraSocial: data.get("obraSocial").trim(),
      lesion: data.get("lesion"),
      notas: data.get("notas").trim()
    };
    if (!paciente.nombre) return;

    if (supabase) {
      const { data: saved, error } = await supabase.from("pacientes").insert({
        nombre: paciente.nombre, dni: paciente.dni, telefono: paciente.telefono,
        obra_social: paciente.obraSocial, lesion: paciente.lesion, notas: paciente.notas
      }).select().single();
      if (!error && saved) setPacientes([{ ...paciente, id: saved.id }, ...pacientes]);
    } else {
      setPacientes([{ ...paciente, id: crypto.randomUUID() }, ...pacientes]);
    }
    setModalPaciente(false);
  };

  const guardarTurno = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const pacienteId = data.get("pacienteId");
    const pacienteExistente = pacientes.find(p => p.id === pacienteId);
    const manual = data.get("pacienteManual").trim();
    const nombre = pacienteExistente?.nombre || manual;
    if (!nombre) return;

    let pacienteFinal = pacienteExistente;
    if (!pacienteFinal && manual) {
      pacienteFinal = {
        id: crypto.randomUUID(),
        nombre,
        dni: data.get("dni").trim(),
        telefono: data.get("telefono").trim(),
        obraSocial: data.get("obraSocial").trim(),
        lesion: data.get("lesion"),
        notas: ""
      };
      if (supabase) {
        const { data: saved } = await supabase.from("pacientes").insert({
          nombre: pacienteFinal.nombre, dni: pacienteFinal.dni, telefono: pacienteFinal.telefono,
          obra_social: pacienteFinal.obraSocial, lesion: pacienteFinal.lesion
        }).select().single();
        if (saved) pacienteFinal.id = saved.id;
      }
      setPacientes([pacienteFinal, ...pacientes]);
    }

    const turno = {
      id: crypto.randomUUID(),
      fecha,
      hora: modalTurno.hora,
      bloque: modalTurno.bloque,
      profesionalId: profActual.id,
      profesional: profActual.nombre,
      pacienteId: pacienteFinal?.id || "",
      paciente: nombre,
      dni: pacienteFinal?.dni || data.get("dni").trim(),
      telefono: pacienteFinal?.telefono || data.get("telefono").trim(),
      obraSocial: pacienteFinal?.obraSocial || data.get("obraSocial").trim(),
      lesion: data.get("lesion") || pacienteFinal?.lesion || "Sesión kinesiológica",
      notas: data.get("notas").trim(),
      estado: "pendiente",
      color: colores[turnos.length % colores.length]
    };

    if (supabase) {
  const { data: saved, error } = await supabase.from("turnos").insert({
    fecha: turno.fecha,
    hora: turno.hora,
    bloque: turno.bloque,
    profesional_id: turno.profesionalId,
    profesional: turno.profesional,
    paciente_id: turno.pacienteId || null,
    paciente: turno.paciente,
    dni: turno.dni,
    telefono: turno.telefono,
    obra_social: turno.obraSocial,
    lesion: turno.lesion,
    notas: turno.notas,
    estado: turno.estado,
    color: turno.color
  }).select().single();

  if (error) {
    alert("Error Supabase: " + error.message);
    console.error(error);
    return;
  }

  if (saved) turno.id = saved.id;
}

    setTurnos([...turnos, turno]);
    setModalTurno(null);
  };

  const cancelarTurno = async (id) => {
    if (!confirm("¿Cancelar este turno?")) return;
    if (supabase) await supabase.from("turnos").delete().eq("id", id);
    setTurnos(turnos.filter(t => t.id !== id));
  };

  const actualizarEstadoTurno = async (id, nuevoEstado) => {
    const turnoActual = turnos.find(t => t.id === id);
    if (!turnoActual) return;

    const actualizados = turnos.map(t =>
      t.id === id ? { ...t, estado: nuevoEstado } : t
    );
    setTurnos(actualizados);

    if (supabase) {
      const { error } = await supabase
        .from("turnos")
        .update({ estado: nuevoEstado })
        .eq("id", id);

      if (error) {
        alert("No se pudo actualizar el estado. Revisá permisos de Supabase.");
        setTurnos(turnos);
      }
    }
  };

  const BotonesAsistencia = ({ turno }) => (
    <div className="attendance-actions">
      <button
        className={turno.estado === ESTADOS.ASISTIO ? "activo ok" : "ok"}
        onClick={() => actualizarEstadoTurno(turno.id, ESTADOS.ASISTIO)}
        type="button"
      >
        ✓ Asistió
      </button>
      <button
        className={turno.estado === ESTADOS.AVISO ? "activo warn" : "warn"}
        onClick={() => actualizarEstadoTurno(turno.id, ESTADOS.AVISO)}
        type="button"
      >
        Avisó
      </button>
      <button
        className={turno.estado === ESTADOS.NO_AVISO ? "activo bad" : "bad"}
        onClick={() => actualizarEstadoTurno(turno.id, ESTADOS.NO_AVISO)}
        type="button"
      >
        No avisó
      </button>
    </div>
  );

  const agregarHorario = () => {
    if (!nuevoHorario.hora) return;
    const key = nuevoHorario.bloque === "mañana" ? "horariosManana" : "horariosTarde";
    const horarios = [...new Set([...config[key], nuevoHorario.hora])].sort();
    guardarConfigOnline({ ...config, [key]: horarios });
    setNuevoHorario({ ...nuevoHorario, hora: "" });
  };

  const eliminarHorario = (bloque, hora) => {
    const key = bloque === "mañana" ? "horariosManana" : "horariosTarde";
    guardarConfigOnline({ ...config, [key]: config[key].filter(h => h !== hora) });
  };

  const agregarLesion = () => {
    const v = nuevaLesion.trim();
    if (!v || config.lesiones.includes(v)) return;
    guardarConfigOnline({ ...config, lesiones: [...config.lesiones, v] });
    setNuevaLesion("");
  };

  const NavItem = ({ name, icon: Icon }) => (
    <button className={vista === name ? "active" : ""} onClick={() => setVista(name)}>
      <Icon /> {name}
    </button>
  );

  const Slot = ({ hora, bloque }) => {
    const lista = turnosEnHora(hora);
    const completo = lista.length >= Number(config.maxPorHora);
    return (
      <div className="time-row">
        <div className="time">{hora}</div>
        <div className="slot-stack">
          {lista.map(t => (
            <div className={`appointment ${t.color || "teal"}`} key={t.id}>
              <div>
                <strong>{t.paciente}</strong>
                <small>{t.lesion}</small>
                <em>{hora} - {horaFin(hora, config.duracionTurno)} · {t.telefono || "Sin teléfono"}</em>
                <span className={`estado-chip ${claseEstado(t.estado)}`}>{etiquetaEstado(t.estado)}</span>
                <span className="orden-chip">{textoOrden(t.estado)}</span>
                <BotonesAsistencia turno={t} />
              </div>
              <button className="delete" onClick={() => cancelarTurno(t.id)}><Trash2 size={15}/></button>
            </div>
          ))}
          {!completo ? (
            <button className="empty-slot" onClick={() => setModalTurno({ hora, bloque })}>
              <span><strong>Turno disponible</strong><small>{lista.length}/{config.maxPorHora} pacientes</small></span>
              <Plus size={18}/>
            </button>
          ) : <div className="full-slot">Horario completo · {lista.length}/{config.maxPorHora}</div>}
        </div>
      </div>
    );
  };

  const Agenda = () => (
    <>
      <div className="agenda-head">
        <div className="title"><CalendarDays/><div><h2>Agenda Online</h2><p>Administrá tus turnos</p></div></div>
        <div className="controls">
          <button onClick={() => setFecha(sumarDias(fecha, -1))}><ChevronLeft size={18}/></button>
          <button onClick={() => setFecha(sumarDias(fecha, 1))}><ChevronRight size={18}/></button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
          <button onClick={() => setFecha(hoyISO())}>Hoy</button>

          <select value={profActual?.id || ""} onChange={e => setProfId(e.target.value)}>
            {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="main-grid">
        <div className="agenda-card">
          <div className="agenda-date">{fechaLarga(fecha)} · {profActual?.nombre}</div>
          <div className="columns">
            <section className="agenda-block"><h3>☀️ MAÑANA</h3>{config.horariosManana.map(h => <Slot key={h} hora={h} bloque="Mañana"/>)}</section>
            <section className="agenda-block"><h3>🌤️ TARDE</h3>{config.horariosTarde.map(h => <Slot key={h} hora={h} bloque="Tarde"/>)}</section>
          </div>
        </div>
        <RightBar/>
      </div>
    </>
  );

  const RightBar = () => {
    const mesNombre = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    const totalHorarios = (config.horariosManana.length + config.horariosTarde.length) * Number(config.maxPorHora);
    return (
      <aside className="rightbar">
        <section className="mini-card">
          <h3><Calendar size={18}/> Calendario</h3>
          <div className="month"><button onClick={() => setFecha(sumarDias(fecha,-30))}><ChevronLeft size={16}/></button><strong>{mesNombre}</strong><button onClick={() => setFecha(sumarDias(fecha,30))}><ChevronRight size={16}/></button></div>
          <div className="weekdays"><span>LUN</span><span>MAR</span><span>MIÉ</span><span>JUE</span><span>VIE</span><span>SÁB</span><span>DOM</span></div>
          <div className="calendar-grid">{diasDelMes(fecha).map((d,i) => <button key={i} className={`${d.iso===fecha?"today":""} ${d.fuera?"muted":""}`} onClick={() => setFecha(d.iso)}>{d.num}</button>)}</div>
        </section>
        <section className="mini-card">
          <div className="mini-head"><h3>Profesionales</h3><button onClick={agregarProfesional}>+ Agregar</button></div>
          {profesionales.map(p => (
            <div className="kine-line" key={p.id}>
              <div>{p.nombre.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div>
              <button className="kine-name" onClick={() => setProfId(p.id)}>{p.nombre}<small>{p.especialidad}</small></button>
              <button className="tiny-danger" onClick={() => eliminarProfesional(p.id)}>×</button>
            </div>
          ))}
          <div className="add-line">
            <input value={nuevoProf.nombre} onChange={e => setNuevoProf({...nuevoProf, nombre:e.target.value})} placeholder="Nombre profesional"/>
            <input value={nuevoProf.especialidad} onChange={e => setNuevoProf({...nuevoProf, especialidad:e.target.value})} placeholder="Especialidad"/>
            <button onClick={agregarProfesional}><Plus size={16}/></button>
          </div>
        </section>
        <section className="mini-card">
          <h3>Resumen del día</h3>
          <div className="summary"><span>Turnos confirmados</span><b className="ok">{turnosDia.length}</b></div>
          <div className="summary"><span>Capacidad diaria</span><b>{totalHorarios}</b></div>
          <div className="summary"><span>Disponibles</span><b className="warn">{Math.max(totalHorarios - turnosDia.length, 0)}</b></div>
        </section>
      </aside>
    );
  };

  const Pacientes = () => (
    <section className="module">
      <div className="module-head"><h2>Pacientes</h2><button className="new small" onClick={() => setModalPaciente(true)}><Plus/> Nuevo paciente</button></div>
      <SearchBox/>
      <div className="table">{pacientes.filter(p => `${p.nombre} ${p.dni} ${p.telefono} ${p.lesion}`.toLowerCase().includes(busqueda.toLowerCase())).map(p => <div className="table-row" key={p.id}><strong>{p.nombre}</strong><span>DNI: {p.dni || "-"}</span><span>{p.telefono || "-"}</span><span>{p.obraSocial || "-"}</span><b>{p.lesion}</b></div>)}</div>
    </section>
  );

  const Profesionales = () => (
    <section className="module">
      <h2>Profesionales</h2>
      <div className="prof-form"><input placeholder="Nombre profesional" value={nuevoProf.nombre} onChange={e=>setNuevoProf({...nuevoProf,nombre:e.target.value})}/><input placeholder="Especialidad" value={nuevoProf.especialidad} onChange={e=>setNuevoProf({...nuevoProf,especialidad:e.target.value})}/><button className="new small" onClick={agregarProfesional}><Plus/> Agregar</button></div>
      <div className="cards-grid">{profesionales.map(p => <div className="pro-card" key={p.id}><div>{p.nombre.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div><h3>{p.nombre}</h3><p>{p.especialidad}</p><button onClick={()=>setProfId(p.id)}>Seleccionar</button></div>)}</div>
    </section>
  );

  const Turnos = () => (
    <section className="module">
      <h2>Turnos</h2><SearchBox/>
      <div className="table">
        {turnos
          .filter(t => `${t.paciente} ${t.profesional} ${t.lesion} ${t.fecha} ${t.estado}`.toLowerCase().includes(busqueda.toLowerCase()))
          .map(t => (
            <div className="table-row asistencia-row" key={t.id}>
              <strong>{t.fecha} · {t.hora}</strong>
              <span>{t.paciente}</span>
              <span>{t.profesional}</span>
              <b>{t.lesion}</b>
              <div>
                <span className={`estado-chip ${claseEstado(t.estado)}`}>{etiquetaEstado(t.estado)}</span>
                <small className="orden-mini">{textoOrden(t.estado)}</small>
              </div>
              <BotonesAsistencia turno={t} />
              <button onClick={()=>cancelarTurno(t.id)}>Cancelar</button>
            </div>
          ))}
      </div>
    </section>
  );

  const Estadisticas = () => (
    <section className="module">
      <h2>Estadísticas</h2>

      <div className="stats-grid">
        <div className="stat-card"><span>Total turnos</span><b>{estadisticas.total}</b></div>
        <div className="stat-card"><span>Pacientes</span><b>{estadisticas.pacientes}</b></div>
        <div className="stat-card"><span>Profesionales</span><b>{profesionales.length}</b></div>
        <div className="stat-card"><span>Máx. pacientes/horario</span><b>{config.maxPorHora}</b></div>
      </div>

      <h3>Asistencia y órdenes</h3>
      <div className="stats-grid">
        <div className="stat-card asist-ok"><span>Asistieron</span><b>{estadisticas.asistencia.asistieron}</b></div>
        <div className="stat-card asist-warn"><span>No asistió con aviso</span><b>{estadisticas.asistencia.avisaron}</b><small>Conserva orden</small></div>
        <div className="stat-card asist-bad"><span>No asistió sin aviso</span><b>{estadisticas.asistencia.noAvisaron}</b><small>Pierde orden</small></div>
        <div className="stat-card"><span>% asistencia</span><b>{Number(estadisticas.asistencia.porcentajeAsistencia).toFixed(1)}%</b></div>
      </div>

      <h3>Por lesión / rehabilitación</h3>
      <Bars data={estadisticas.porLesion}/>

      <h3>Por profesional</h3>
      <Bars data={estadisticas.porProfesional}/>
    </section>
  );

  const Bars = ({data}) => {
    const entries = Object.entries(data).sort((a,b)=>b[1]-a[1]);
    const max = Math.max(...entries.map(e=>e[1]), 1);
    return <div className="bars">{entries.length === 0 ? <p>Sin datos todavía.</p> : entries.map(([k,v]) => <div className="bar" key={k}><span>{k}</span><div><i style={{width:`${(v/max)*100}%`}}></i></div><b>{v}</b></div>)}</div>
  };

  const Configuracion = () => (
    <section className="module">
      <h2>Configuración de horarios</h2>
      <div className="config-grid">
        <label>Duración del turno en minutos<input type="number" min="15" step="15" value={config.duracionTurno} onChange={e=>guardarConfigOnline({...config,duracionTurno:e.target.value})}/></label>
        <label>Máximo de pacientes por hora<input type="number" min="1" max="20" value={config.maxPorHora} onChange={e=>guardarConfigOnline({...config,maxPorHora:e.target.value})}/></label>
      </div>

      <h3>Horarios de mañana</h3>
      <div className="chips">{config.horariosManana.map(h => <span key={h}>{h}<button onClick={()=>eliminarHorario("mañana",h)}>×</button></span>)}</div>
      <h3>Horarios de tarde</h3>
      <div className="chips">{config.horariosTarde.map(h => <span key={h}>{h}<button onClick={()=>eliminarHorario("tarde",h)}>×</button></span>)}</div>

      <div className="inline-add wide">
        <select value={nuevoHorario.bloque} onChange={e=>setNuevoHorario({...nuevoHorario,bloque:e.target.value})}><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select>
        <input type="time" value={nuevoHorario.hora} onChange={e=>setNuevoHorario({...nuevoHorario,hora:e.target.value})}/>
        <button onClick={agregarHorario}>Agregar horario</button>
      </div>

      <h3>Tipos de lesión / rehabilitación</h3>
      <div className="chips">{config.lesiones.map(l => <span key={l}>{l}</span>)}</div>
      <div className="inline-add"><input value={nuevaLesion} onChange={e=>setNuevaLesion(e.target.value)} placeholder="Nueva lesión o rehabilitación"/><button onClick={agregarLesion}>Agregar</button></div>
    </section>
  );

  const SearchBox = () => <div className="search"><Search size={17}/><input placeholder="Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></div>;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><div className="sur-logo">SUR</div><h2>CENTRO KINESIOLÓGICO</h2><p>Cuidamos tu movimiento</p></div>
        <nav>
          <NavItem name="Agenda" icon={CalendarDays}/><NavItem name="Pacientes" icon={Users}/><NavItem name="Profesionales" icon={UserRound}/><NavItem name="Turnos" icon={Clock3}/><NavItem name="Estadísticas" icon={BarChart3}/><NavItem name="Configuración" icon={Settings}/>
        </nav>
        <div className="sidebar-card"><CalendarDays size={34}/><div><strong>Turnero</strong><span>{modoOnline ? "Online" : "Local"}</span></div><button onClick={()=>{setVista("Agenda");setFecha(hoyISO())}}>Ir a hoy</button></div>
const inicioSemana = (iso) => {
  const d = new Date(iso + "T12:00:00");
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const diasSemana = (iso) => {
  const inicio = inicioSemana(iso);
  return Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
};

const nombreDiaCorto = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  });
```

---

## 2) Agregar estado

Junto a tus useState principales:

```js
const [modoAgenda, setModoAgenda] = useState("dia");
```

---

## 3) Agregar componente Semana dentro de App()

Pegarlo antes del componente `Agenda`.

```jsx
const Semana = () => {
  const dias = diasSemana(fecha);
  const horarios = [...horariosManana, ...horariosTarde];

  const turnosPorDiaHora = (dia, hora) =>
    turnos.filter(
      t =>
        t.fecha === dia &&
        t.hora === hora &&
        t.profesionalId === profActual?.id
    );

  return (
    <section className="semana-card">
      <div className="semana-header">
        <button onClick={() => setFecha(sumarDias(fecha, -7))}>← Semana anterior</button>
        <strong>
          Semana del {fechaLarga(dias[0])} al {fechaLarga(dias[6])}
        </strong>
        <button onClick={() => setFecha(sumarDias(fecha, 7))}>Semana siguiente →</button>
      </div>

      <div className="semana-grid">
        <div className="semana-hora titulo">Hora</div>

        {dias.map(dia => (
          <div
            key={dia}
            className={`semana-dia titulo ${dia === fecha ? "seleccionado" : ""}`}
            onClick={() => setFecha(dia)}
          >
            {nombreDiaCorto(dia)}
          </div>
        ))}

        {horarios.map(hora => (
          <React.Fragment key={hora}>
            <div className="semana-hora">{hora}</div>

            {dias.map(dia => {
              const lista = turnosPorDiaHora(dia, hora);

              return (
                <div
                  key={`${dia}-${hora}`}
                  className="semana-slot"
                  onDoubleClick={() => {
                    setFecha(dia);
                    setModalTurno({
                      hora,
                      bloque: horariosManana.includes(hora) ? "Mañana" : "Tarde"
                    });
                  }}
                >
                  {lista.length === 0 ? (
                    <span className="semana-vacio">Disponible</span>
                  ) : (
                    lista.map(t => (
                      <div className={`semana-turno ${t.color || "teal"}`} key={t.id}>
                        <strong>{t.paciente}</strong>
                        <small>{t.lesion}</small>
                        <em>{t.estado || "pendiente"}</em>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};
```

---

## 4) Agregar botones Día / Semana

Dentro del header de `Agenda`, en los controles, agregá:

```jsx
<div className="vista-switch">
  <button
    className={modoAgenda === "dia" ? "activo" : ""}
    onClick={() => setModoAgenda("dia")}
  >
    Día
  </button>
  <button
    className={modoAgenda === "semana" ? "activo" : ""}
    onClick={() => setModoAgenda("semana")}
  >
    Semana
  </button>
</div>
```

---

## 5) Cambiar render de Agenda

Dentro de `Agenda`, después del encabezado, usá:

```jsx
{modoAgenda === "semana" ? (
  <Semana />
) : (
  <div className="main-grid">
    {/* acá va lo que ya tenías: agenda diaria + RightBar */}
  </div>
)}
```

No borres tu agenda diaria. Solo ponela dentro del bloque `else`.

---

## 6) Agregar estilos al final de src/styles.css

```css
/* === Vista semanal === */

.vista-switch {
  display: flex;
  gap: 6px;
  background: #eef6f8;
  padding: 5px;
  border-radius: 999px;
}

.vista-switch button {
  border: 0;
  padding: 9px 16px;
  border-radius: 999px;
  font-weight: 900;
  background: transparent;
  cursor: pointer;
  color: #345;
}

.vista-switch button.activo {
  background: #08b8c5;
  color: white;
}

.semana-card {
  background: white;
  border-radius: 18px;
  padding: 18px;
  border: 1px solid #e4edf3;
  box-shadow: 0 12px 35px rgba(5,28,55,.08);
  overflow-x: auto;
}

.semana-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.semana-header button {
  border: 0;
  background: #e7fbfc;
  color: #078fa0;
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 900;
  cursor: pointer;
}

.semana-grid {
  display: grid;
  grid-template-columns: 80px repeat(7, minmax(170px, 1fr));
  gap: 8px;
  min-width: 1250px;
}

.semana-hora,
.semana-dia {
  background: #f1f7fa;
  border-radius: 12px;
  padding: 10px;
  font-weight: 900;
  text-align: center;
}

.semana-dia {
  cursor: pointer;
}

.semana-dia.seleccionado {
  background: #08b8c5;
  color: white;
}

.semana-slot {
  min-height: 105px;
  background: #fbfdff;
  border: 1px dashed #c7d7e2;
  border-radius: 14px;
  padding: 8px;
}

.semana-vacio {
  color: #8a9aaa;
  font-size: 13px;
}

.semana-turno {
  border-radius: 12px;
  padding: 9px;
  margin-bottom: 6px;
  border: 1px solid #dbe6ef;
}

.semana-turno strong,
.semana-turno small,
.semana-turno em {
  display: block;
}

.semana-turno small {
  color: #40556b;
}

.semana-turno em {
  margin-top: 5px;
  font-style: normal;
  font-size: 11px;
  color: #66758a;
}
```

---

      </aside>

      <main className="content">
        <header className="topbar">
          <div><h1>Turnero SUR Online</h1><p>{modoOnline ? <><Wifi size={15}/> Base online Supabase activa</> : <><WifiOff size={15}/> Modo local: falta configurar Supabase</>}</p></div>
          <button className="new" onClick={()=>{setVista("Agenda");setModalTurno({hora:config.horariosManana[0] || "08:00", bloque:"Mañana"})}}><Plus/> Nuevo turno</button>
          <div className="profile"><div>{(profActual?.nombre || "LC").split(" ").map(x=>x[0]).slice(0,2).join("")}</div><span><strong>{profActual?.nombre}</strong><small>{profActual?.especialidad}</small></span></div>
        </header>

        <section className="panel">
          {vista === "Agenda" && <Agenda/>}
          {vista === "Pacientes" && <Pacientes/>}
          {vista === "Profesionales" && <Profesionales/>}
          {vista === "Turnos" && <Turnos/>}
          {vista === "Estadísticas" && <Estadisticas/>}
          {vista === "Configuración" && <Configuracion/>}
        </section>

        <section className="bottom">
          <div><HeartPulse/><strong>Atención personalizada</strong><span>Cuidamos cada detalle</span></div>
          <div><Users/><strong>Multi profesional</strong><span>Base online compartida</span></div>
          <div><Star/><strong>Horarios editables</strong><span>Mañana y tarde configurables</span></div>
          <div><ShieldCheck/><strong>Datos guardados</strong><span>Preparado para Supabase</span></div>
        </section>
      </main>

      {modalTurno && (
        <div className="modal-bg">
          <form className="modal" onSubmit={guardarTurno}>
            <h2>Nuevo turno</h2><p>{fechaLarga(fecha)} · {modalTurno.hora} a {horaFin(modalTurno.hora, config.duracionTurno)} · {profActual?.nombre}</p>
            <select name="pacienteId"><option value="">Paciente nuevo/manual</option>{pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.lesion}</option>)}</select>
            <input name="pacienteManual" placeholder="Nombre paciente nuevo"/>
            <input name="dni" placeholder="DNI"/><input name="telefono" placeholder="Teléfono"/><input name="obraSocial" placeholder="Obra social"/>
            <select name="lesion">{config.lesiones.map(l => <option key={l}>{l}</option>)}</select>
            <textarea name="notas" placeholder="Notas del turno"></textarea>
            <div className="modal-actions"><button type="button" onClick={()=>setModalTurno(null)}>Cerrar</button><button className="save">Guardar turno</button></div>
          </form>
        </div>
      )}

      {modalPaciente && (
        <div className="modal-bg">
          <form className="modal" onSubmit={guardarPaciente}>
            <h2>Nuevo paciente</h2>
            <input name="nombre" placeholder="Nombre y apellido *" autoFocus/><input name="dni" placeholder="DNI"/><input name="telefono" placeholder="Teléfono"/><input name="obraSocial" placeholder="Obra social"/>
            <select name="lesion">{config.lesiones.map(l => <option key={l}>{l}</option>)}</select>
            <textarea name="notas" placeholder="Notas / antecedentes"></textarea>
            <div className="modal-actions"><button type="button" onClick={()=>setModalPaciente(false)}>Cerrar</button><button className="save">Guardar paciente</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
