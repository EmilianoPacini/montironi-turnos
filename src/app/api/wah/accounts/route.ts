import { NextRequest } from "next/server";
import { requireWahAdmin, requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { listWhatsappAccounts } from "@/lib/modules/wah/conversation.service";
import {
  serializeWhatsappAccount,
  upsertWhatsappAccount,
} from "@/lib/modules/wah/account.service";
import { jsonOk, parseIntegrationBody, parseJsonBody } from "@/lib/modules/wah/http";
import { upsertWahAccountSchema } from "@/lib/modules/wah/schemas";
import { revalidatePath } from "next/cache";

export async function GET() {
  try {
    const session = await requireWahSession();
    const accounts = await listWhatsappAccounts(session.empresaId);
    return jsonOk({
      accounts: accounts.map(serializeWhatsappAccount),
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireWahAdmin();
    const raw = await parseJsonBody(request);
    const body = parseIntegrationBody(upsertWahAccountSchema, raw);
    const account = await upsertWhatsappAccount({
      empresaId: session.empresaId,
      phoneNumberId: body.phoneNumberId,
      wabaId: body.wabaId,
      label: body.label,
      displayPhoneNumber: body.displayPhoneNumber,
      active: body.active,
    });
    revalidatePath("/comunicaciones");
    return jsonOk({ account: serializeWhatsappAccount(account) });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
