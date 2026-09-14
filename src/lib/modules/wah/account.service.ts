import prisma from "@/lib/db";

export type UpsertWhatsappAccountInput = {
  empresaId: string;
  phoneNumberId: string;
  wabaId?: string | null;
  label?: string | null;
  displayPhoneNumber?: string | null;
  active?: boolean;
};

export function normalizeMetaId(raw: string, field: string): string {
  const value = raw.trim();
  if (!/^\d{5,30}$/.test(value)) {
    throw new Error(`${field} inválido: usá solo dígitos (id de Meta)`);
  }
  return value;
}

export function serializeWhatsappAccount(a: {
  id: string;
  label: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  wabaId: string | null;
  active: boolean;
}) {
  return {
    id: a.id,
    label: a.label ?? a.displayPhoneNumber ?? a.phoneNumberId,
    phoneNumberId: a.phoneNumberId,
    displayPhoneNumber: a.displayPhoneNumber,
    wabaId: a.wabaId,
    active: a.active,
  };
}

/** Alta o edición por (empresa, phone_number_id). El webhook y el envío usan este id. */
export async function upsertWhatsappAccount(params: UpsertWhatsappAccountInput) {
  const phoneNumberId = normalizeMetaId(params.phoneNumberId, "Phone number id");
  const wabaId =
    params.wabaId && params.wabaId.trim()
      ? normalizeMetaId(params.wabaId, "WABA id")
      : null;
  const label = params.label?.trim() || null;
  const displayPhoneNumber = params.displayPhoneNumber?.trim() || null;
  const active = params.active ?? true;

  return prisma.whatsappAccount.upsert({
    where: {
      empresaId_phoneNumberId: {
        empresaId: params.empresaId,
        phoneNumberId,
      },
    },
    create: {
      empresaId: params.empresaId,
      phoneNumberId,
      wabaId,
      label,
      displayPhoneNumber,
      active,
    },
    update: {
      wabaId,
      label,
      displayPhoneNumber,
      active,
    },
  });
}
