import { WahInbox } from "@/components/wah/WahInbox";

export default function ComunicacionesPage() {
  return (
    <div className="panel-page flex h-full flex-col">
      <div className="mb-2">
        <h1 className="panel-title">Comunicaciones</h1>
        <p className="panel-subtitle">Bandeja WhatsApp · respuestas humanas e integración bot</p>
      </div>
      <WahInbox />
    </div>
  );
}
