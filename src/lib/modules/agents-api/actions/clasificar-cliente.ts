import {
  clasificarCliente,
  serializePerfilBuyer,
  type ClasificacionFuente,
} from "@/lib/modules/buyer/service";

export async function handleClasificarCliente(empresaId: string, body: Record<string, unknown>) {
  if (!body.clienteId || !body.clasificacion) {
    throw new Error("clienteId y clasificacion requeridos");
  }
  const { perfil, evento } = await clasificarCliente({
    empresaId,
    clienteId: String(body.clienteId),
    clasificacion: String(body.clasificacion),
    intencion: body.intencion ? String(body.intencion) : undefined,
    tagsDelta: body.tagsDelta as string[] | undefined,
    scoreReclamosDelta: body.scoreReclamosDelta ? Number(body.scoreReclamosDelta) : undefined,
    wahConversationId: body.wahConversationId ? String(body.wahConversationId) : undefined,
    wahMessageId: body.wahMessageId ? String(body.wahMessageId) : undefined,
    fuente: (body.fuente ? String(body.fuente) : "integracion") as ClasificacionFuente,
    payload: body.payload as Record<string, unknown> | undefined,
  });
  return {
    perfil: serializePerfilBuyer(perfil),
    evento: {
      id: evento.id,
      clasificacion: evento.clasificacion,
      intencion: evento.intencion,
      createdAt: evento.createdAt.toISOString(),
    },
  };
}
