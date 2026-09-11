export type WahContact = {
  id: string;
  telefono: string;
  nombre: string;
  clienteId: string | null;
  ultimoMensaje: string | null;
  ultimoMensajeAt: string | null;
  noLeidos: number;
};

export type WahKpis = {
  conversacionesActivas: number;
  sinResponder: number;
  mensajesHoy: number;
  tiempoMedioRespuestaMin: number | null;
};

export type WahMessage = {
  id: string;
  direccion: "entrante" | "saliente";
  cuerpo: string;
  enviadoAt: string;
  leido: boolean;
};
