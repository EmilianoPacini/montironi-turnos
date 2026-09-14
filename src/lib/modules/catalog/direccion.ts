export type DireccionEstructurada = {
  calle?: string | null;
  numero?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  codigoPostal?: string | null;
};

export function concatenateDireccion(parts: DireccionEstructurada): string | null {
  const calleNumero = [parts.calle?.trim(), parts.numero?.trim()]
    .filter(Boolean)
    .join(" ");
  const rest = [calleNumero, parts.localidad?.trim(), parts.provincia?.trim(), parts.codigoPostal?.trim()]
    .filter(Boolean);
  return rest.length > 0 ? rest.join(", ") : null;
}

export function displayDireccion(taller: DireccionEstructurada & { direccion?: string | null }): string | null {
  const structured = concatenateDireccion(taller);
  if (structured) return structured;
  return taller.direccion?.trim() || null;
}
