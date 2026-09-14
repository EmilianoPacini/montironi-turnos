import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";

export const TIPO_VEHICULO_LABELS: Record<TipoVehiculo, string> = {
  auto: "Auto",
  camioneta: "Camioneta",
};

export const CONDICION_VEHICULO_LABELS: Record<CondicionVehiculo, string> = {
  nuevo: "Nuevo",
  normal: "Normal",
  viejo: "Viejo",
};
