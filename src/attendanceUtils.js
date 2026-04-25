// Estados posibles
export const ESTADOS = {
  ASISTIO: "asistio",
  AVISO: "aviso",
  NO_AVISO: "no_aviso",
};

// Determina si pierde el turno
export function pierdeTurno(estado) {
  return estado === ESTADOS.NO_AVISO;
}

// Métricas
export function calcularMetricas(turnos) {
  const total = turnos.length;

  const asistieron = turnos.filter(t => t.estado === ESTADOS.ASISTIO).length;
  const avisaron = turnos.filter(t => t.estado === ESTADOS.AVISO).length;
  const noAvisaron = turnos.filter(t => t.estado === ESTADOS.NO_AVISO).length;

  return {
    total,
    asistieron,
    avisaron,
    noAvisaron,
    porcentajeAsistencia: total ? (asistieron / total) * 100 : 0,
    porcentajeAusentes: total ? (noAvisaron / total) * 100 : 0,
  };
}