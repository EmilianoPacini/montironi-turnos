import { NextRequest, NextResponse } from "next/server";
import { requireWahSession, wahErrorResponse } from "@/lib/modules/wah/scope";
import { getWahMediaForEmpresa, readWahMediaFile } from "@/lib/modules/wah/media.service";

/** Panel: GET /api/wah/media/:mediaId */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const session = await requireWahSession();
    const { mediaId } = await params;

    const media = await getWahMediaForEmpresa(mediaId, session.empresaId);
    if (!media) {
      return NextResponse.json({ error: "Media no encontrado" }, { status: 404 });
    }

    const buffer = await readWahMediaFile(media);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Disposition": `inline; filename="${media.fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    return wahErrorResponse(e);
  }
}
