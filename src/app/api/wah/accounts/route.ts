import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { listWhatsappAccounts } from "@/lib/modules/wah/conversation.service";
import { jsonOk } from "@/lib/modules/wah/http";

export async function GET() {
  try {
    const session = await requireWahSession();
    const accounts = await listWhatsappAccounts(session.empresaId);
    return jsonOk({
      accounts: accounts.map((a) => ({
        id: a.id,
        label: a.label ?? a.displayPhoneNumber ?? a.phoneNumberId,
        phoneNumberId: a.phoneNumberId,
        displayPhoneNumber: a.displayPhoneNumber,
        active: a.active,
      })),
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
