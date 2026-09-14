import prisma from "@/lib/db";
import { horarioResumenForTaller, getCompatibleBahias } from "@/lib/modules/availability/service";
import { displayDireccion } from "@/lib/modules/catalog/direccion";

export async function listTalleresForAgents(params: {
  empresaId: string;
  servicioId?: string;
}) {
  const talleres = await prisma.taller.findMany({
    where: {
      empresaId: params.empresaId,
      activo: true,
      configuracion: { is: {} },
      bahias: { some: { activa: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const result = [];
  for (const taller of talleres) {
    if (params.servicioId) {
      const compatible = await getCompatibleBahias(taller.id, [params.servicioId]);
      if (compatible.length === 0) continue;
    }
    result.push({
      id: taller.id,
      nombre: taller.nombre,
      localidad: taller.localidad,
      direccion: displayDireccion(taller),
      calle: taller.calle,
      numero: taller.numero,
      provincia: taller.provincia,
      codigo_postal: taller.codigoPostal,
      horario_resumen: await horarioResumenForTaller(taller.id),
    });
  }
  return result;
}
