import { WahChatPanel } from "@/components/comunicaciones/WahChatPanel";

export default function ComunicacionesPage() {
  return (
    <div className="panel-page flex h-full flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="panel-title">Comunicaciones</h1>
        <p className="panel-subtitle">
          WhatsApp del taller — conversaciones con clientes y respuestas del equipo.
        </p>
      </div>
      <WahChatPanel />
    </div>
  );
}
