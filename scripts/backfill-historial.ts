#!/usr/bin/env tsx
/**
 * Backfill historial_servicio from existing turnos in estado finalizado.
 * Idempotent: skips turnos that already have historial rows.
 */
import { backfillHistorialFromFinalizados } from "@/lib/modules/historial/service";

async function main() {
  const empresaId = process.env.EMPRESA_ID;
  const result = await backfillHistorialFromFinalizados(
    empresaId ? { empresaId } : undefined
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
