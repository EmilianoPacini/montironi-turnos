export function AdminOnlyBanner() {
  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm"
    >
      <span className="font-semibold">Solo administradores</span>
      <span className="text-sky-800"> — esta sección no está disponible para empleados.</span>
    </div>
  );
}
