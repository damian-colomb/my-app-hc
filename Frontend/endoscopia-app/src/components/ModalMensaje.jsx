import React, { useEffect } from "react";

function useLockBodyScroll() {
  useEffect(() => {
    const body = document.body;
    const prevCount = Number(body.dataset.lockCount || "0");
    if (prevCount === 0) {
      body.dataset.prevOverflow = body.style.overflow;
      body.dataset.prevPaddingRight = body.style.paddingRight;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollBarWidth > 0) {
        body.style.paddingRight = `${scrollBarWidth}px`;
      }
    }
    body.dataset.lockCount = String(prevCount + 1);

    return () => {
      const currentCount = Number(body.dataset.lockCount || "1") - 1;
      if (currentCount <= 0) {
        delete body.dataset.lockCount;
        body.style.overflow = body.dataset.prevOverflow || "";
        body.style.paddingRight = body.dataset.prevPaddingRight || "";
        delete body.dataset.prevOverflow;
        delete body.dataset.prevPaddingRight;
      } else {
        body.dataset.lockCount = String(currentCount);
      }
    };
  }, []);
}

/**
 * ModalMensaje — Modal genérico para mensajes y confirmaciones.
 * Uso típico (siempre condicional):
 *  {open && (
 *    <ModalMensaje
 *      tipo="confirmar_borrado" // o "confirmar" | "info"
 *      titulo="Confirmar eliminación"
 *      mensaje="¿Seguro?"
 *      onConfirm={() => ...}   // solo si es confirmar
 *      onClose={() => setOpen(false)}
 *    />
 *  )}
 */
export default function ModalMensaje({
  tipo = "info",
  titulo = "Mensaje",
  mensaje = "",
  nombre,
  telefono,
  email,
  confirmText,
  cancelText,
  onConfirm,   // opcional (solo confirmar)
  onClose,     // requerido
}) {
  useLockBodyScroll();
  const isConfirm = tipo === "confirmar" || tipo === "confirmar_borrado";
  const danger = tipo === "confirmar_borrado";
  const isContacto = tipo === "contacto";

  const confirmLabel = confirmText ?? (danger ? "Eliminar" : "Aceptar");
  const cancelLabel = cancelText ?? (isConfirm ? "Cancelar" : "Salir");

  // Blindaje: si alguien lo monta sin handlers ni mensaje, no muestres nada
  if (!onClose && !onConfirm && !mensaje && !isContacto) return null;

  const copyToClipboard = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("No se pudo copiar al portapapeles", error);
    }
  };

  const renderContenido = () => {
    if (isContacto) {
      const telefonoMostrar = telefono?.trim() ? telefono : "Sin teléfono";
      const emailMostrar = email?.trim() ? email : "Sin email";
      const Item = ({ label, value }) => (
        <div className="flex items-center gap-2 text-sm text-gray-200">
          <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
          <span className="font-semibold text-blue-300 break-all">{value}</span>
          <button
            type="button"
            className="ml-1 p-0 text-gray-400 bg-transparent border-0 hover:text-blue-300 transition"
            onClick={() => copyToClipboard(value)}
            title="Copiar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-4 h-4"
            >
              <path d="M9 4h9a2 2 0 0 1 2 2v11" />
              <path d="M7 7h9a2 2 0 0 1 2 2v11H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
            </svg>
          </button>
        </div>
      );

      return (
        <div className="mt-3 space-y-3">
          <Item label="Tel" value={telefonoMostrar} />
          <Item label="Email" value={emailMostrar} />
        </div>
      );
    }

    return mensaje ? (
      <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap text-center">{mensaje}</p>
    ) : null;
  };

  const computedTitle = isContacto && nombre
    ? (
        <span>
          {titulo} <span className="text-blue-300">{nombre}</span>
        </span>
      )
    : titulo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-xl bg-gray-900 text-gray-100 p-4 shadow-xl border border-gray-700">
        <h3 className="text-base font-semibold text-center">{computedTitle}</h3>
        {renderContenido()}

        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-gray-600 text-gray-300 text-xs tracking-wide uppercase hover:bg-gray-800 transition"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          {isConfirm && (
            <button
              type="button"
              className={`px-3 py-2 rounded-lg text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
