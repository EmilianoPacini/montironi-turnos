import { CanalTurno } from "@prisma/client";

export interface CreateTurnoInput {
  empresaId: string;
  tallerId: string;
  bahiaId?: string;
  clienteId: string;
  vehiculoId: string;
  servicioIds: string[];
  inicio: Date;
  canal?: CanalTurno;
  notas?: string;
  creadorId?: string;
  confirmar?: boolean;
  kilometraje?: number;
}
