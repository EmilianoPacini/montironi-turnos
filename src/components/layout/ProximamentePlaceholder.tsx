export function ProximamentePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-lg font-semibold text-slate-900">Próximamente</p>
      <p className="mt-2 text-sm text-slate-600">
        {description ?? `La gestión de ${title.toLowerCase()} estará disponible en una próxima versión.`}
      </p>
    </div>
  );
}
