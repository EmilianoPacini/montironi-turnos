import { NextRequest, NextResponse } from "next/server";
import { requireWahIntegration, wahErrorResponse } from "@/lib/modules/wah/scope";
import { getWahMediaForEmpresa, readWahMediaFile } from "@/lib/modules/wah/media.service";

/** Integration: GET /api/wah/integration/media/:mediaId?empresa_id= */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    requireWahIntegration(request);
    const { mediaId } = await params;
    const empresaId = request.nextUrl.searchParams.get("empresa_id");
    if (!empresaId) {
      return wahErrorResponse(new Error("empresa_id requerido"));
    }

    const media = await getWahMediaForEmpresa(mediaId, empresaId);
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
