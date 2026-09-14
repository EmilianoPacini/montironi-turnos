import { CanalTurno } from "@prisma/client";

export function resolveCanal(body: { canal?: string; origen?: string }): CanalTurno {
  const raw = body.canal ?? body.origen;
  if (raw && Object.values(CanalTurno).includes(raw as CanalTurno)) {
    return raw as CanalTurno;
  }
  const legacyMap: Record<string, CanalTurno> = {
    panel: CanalTurno.interno,
    voz: CanalTurno.telefono,
    api: CanalTurno.agente_ia,
  };
  if (raw && legacyMap[raw]) {
    return legacyMap[raw];
  }
  return CanalTurno.agente_ia;
}
