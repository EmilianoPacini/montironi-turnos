export function AdminOnlyBanner() {
  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
    >
      <span className="font-semibold">Solo administradores</span>
      <span className="text-indigo-800"> — esta sección no está disponible para empleados.</span>
    </div>
  );
}
