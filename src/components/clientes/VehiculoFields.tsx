import { CondicionVehiculo, TipoVehiculo } from "@prisma/client";
import { invalidFieldClass } from "@/lib/form-field-errors";

type VehiculoFieldValues = {
  patente?: string;
  marca?: string;
  modelo?: string;
  tipoVehiculo?: TipoVehiculo;
  condicion?: CondicionVehiculo;
  kilometrajeActual?: number | null | string;
};

type VehiculoFieldName =
  | "patente"
  | "marca"
  | "modelo"
  | "tipoVehiculo"
  | "condicion"
  | "kilometrajeActual";

export function VehiculoFields({
  prefix = "",
  defaultValues,
  values,
  onChange,
  fieldErrors,
}: {
  prefix?: string;
  defaultValues?: VehiculoFieldValues;
  values?: VehiculoFieldValues;
  onChange?: (field: VehiculoFieldName, value: string) => void;
  fieldErrors?: Partial<Record<string, string>>;
}) {
  const p = prefix ? `${prefix}_` : "";
  const source = values ?? defaultValues;
  const resolved = {
    patente: source?.patente ?? "",
    marca: source?.marca ?? "",
    modelo: source?.modelo ?? "",
    tipoVehiculo: source?.tipoVehiculo ?? "auto",
    condicion: source?.condicion ?? "normal",
    kilometrajeActual:
      source?.kilometrajeActual != null && source.kilometrajeActual !== ""
        ? String(source.kilometrajeActual)
        : "",
  };

  function inputClass(field: string) {
    return invalidFieldClass(field, "input-field", fieldErrors);
  }

  function fieldMessage(field: string) {
    const message = fieldErrors?.[field];
    if (!message) return null;
    return (
      <p id={`${field}-error`} className="mt-1 text-xs text-red-700" role="alert">
        {message}
      </p>
    );
  }

  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Patente *</span>
        <input
          name={`${p}patente`}
          required
          data-field="patente"
          aria-invalid={fieldErrors?.patente ? true : undefined}
          aria-describedby={fieldErrors?.patente ? "patente-error" : undefined}
          className={`${inputClass("patente")} uppercase`}
          value={onChange ? resolved.patente : undefined}
          defaultValue={onChange ? undefined : resolved.patente}
          onChange={onChange ? (e) => onChange("patente", e.target.value) : undefined}
        />
        {fieldMessage("patente")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Marca</span>
          <input
            name={`${p}marca`}
            data-field="marca"
            className={inputClass("marca")}
            value={onChange ? resolved.marca : undefined}
            defaultValue={onChange ? undefined : resolved.marca}
            onChange={onChange ? (e) => onChange("marca", e.target.value) : undefined}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Modelo</span>
          <input
            name={`${p}modelo`}
            data-field="modelo"
            className={inputClass("modelo")}
            value={onChange ? resolved.modelo : undefined}
            defaultValue={onChange ? undefined : resolved.modelo}
            onChange={onChange ? (e) => onChange("modelo", e.target.value) : undefined}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tipo</span>
          <select
            name={`${p}tipoVehiculo`}
            data-field="tipoVehiculo"
            className={inputClass("tipoVehiculo")}
            value={onChange ? resolved.tipoVehiculo : undefined}
            defaultValue={onChange ? undefined : resolved.tipoVehiculo}
            onChange={onChange ? (e) => onChange("tipoVehiculo", e.target.value) : undefined}
          >
            <option value="auto">Auto</option>
            <option value="camioneta">Camioneta</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Condición</span>
          <select
            name={`${p}condicion`}
            data-field="condicion"
            className={inputClass("condicion")}
            value={onChange ? resolved.condicion : undefined}
            defaultValue={onChange ? undefined : resolved.condicion}
            onChange={onChange ? (e) => onChange("condicion", e.target.value) : undefined}
          >
            <option value="nuevo">Nuevo</option>
            <option value="normal">Normal</option>
            <option value="viejo">Viejo</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Km actual</span>
          <input
            name={`${p}kilometrajeActual`}
            type="number"
            min={0}
            data-field="kilometrajeActual"
            aria-invalid={fieldErrors?.kilometrajeActual ? true : undefined}
            aria-describedby={fieldErrors?.kilometrajeActual ? "kilometrajeActual-error" : undefined}
            className={inputClass("kilometrajeActual")}
            value={onChange ? resolved.kilometrajeActual : undefined}
            defaultValue={onChange ? undefined : resolved.kilometrajeActual || undefined}
            onChange={onChange ? (e) => onChange("kilometrajeActual", e.target.value) : undefined}
          />
          {fieldMessage("kilometrajeActual")}
        </label>
      </div>
    </>
  );
}
