import React, { useEffect, useRef, useState } from "react";
import ModalMensaje from "../../../components/ModalMensaje.jsx";
import ModalVisor from "../../../components/modalVisor.jsx";

export default function FotosCirugia({
  readOnly,
  procPacId,
  fotos,                 // preferido: lista normalizada desde el padre
  fotosSubidas,          // compat: por si el padre envía esta prop
  setFotosSubidas,       // compat opcional (solo si no se pasa onDelete)
  loadFotosBackend,      // compat opcional (solo si no se pasa onDelete)
  canPick,
  onPick,                // NUEVO: explicitamente aceptado como prop
  onQueueChange,         // NUEVO: notifica al padre la cola local (File[])
  onDelete,              // preferido: (fileKey) => Promise<void>
  deleteFotoProcedimiento, // compat: fallback para borrar
}) {
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [visorAbierto, setVisorAbierto] = useState(false);
  const [visorLista, setVisorLista] = useState([]);
  const fileRef = useRef(null);

  const [queued, setQueued] = useState([]); // [{ file, preview }]

  useEffect(() => {
    return () => {
      // cleanup previews on unmount
      queued.forEach((q) => q?.preview && URL.revokeObjectURL(q.preview));
    };
  }, []);

  // Unificamos la fuente de datos (preferimos `fotos`)
  const items = Array.isArray(fotos)
    ? fotos
    : (Array.isArray(fotosSubidas) ? fotosSubidas : []);

  async function handleDelete(fileKey, filename) {
    if (!procPacId || !fileKey) return;
    setBusy(true);
    try {
      if (typeof onDelete === "function") {
        await onDelete(fileKey);
      } else if (typeof deleteFotoProcedimiento === "function") {
        await deleteFotoProcedimiento(procPacId, fileKey);
        if (typeof loadFotosBackend === "function") {
          await loadFotosBackend(procPacId);
        } else if (typeof setFotosSubidas === "function") {
          setFotosSubidas((prev) => Array.isArray(prev) ? prev.filter((f) => (f.file_key ?? f.key ?? f.filename) !== fileKey) : prev);
        }
      }
    } catch (err) {
      console.error("[FotosCirugia] No se pudo eliminar la foto", err);
      alert(`No se pudo eliminar la foto. ${err?.message || "Intentá de nuevo."}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {(canPick ?? true) && (
        <div className="mb-2 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              setBusy(true);
              try {
                if (procPacId && typeof onPick === "function") {
                  await onPick(files); // sube al toque si hay ID
                } else {
                  // parte nuevo o sin onPick: mantenemos cola local y avisamos al padre
                  const adds = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
                  setQueued((prev) => {
                    const next = [...prev, ...adds];
                    if (typeof onQueueChange === "function") {
                      try { onQueueChange(next.map((q) => q.file)); } catch {}
                    }
                    return next;
                  });
                }
              } catch (err) {
                console.error("[FotosCirugia] onPick error", err);
                alert(`No se pudieron procesar las fotos. ${err?.message || "Intentá de nuevo."}`);
              } finally {
                setBusy(false);
                e.target.value = ""; // reset para permitir re-seleccionar iguales
              }
            }}
          />
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 h-9 border border-gray-600 rounded text-gray-200 hover:bg-gray-800 disabled:opacity-60"
            onClick={() => fileRef.current && fileRef.current.click()}
            disabled={busy}
            title="Agregar fotos"
          >
            Agregar fotos
          </button>
        </div>
      )}

      {/* Cola local (parte nuevo) */}
      {queued.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-gray-300 mb-1">A adjuntar al guardar:</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {queued.map((q, idx) => (
              <div key={`q_${idx}`} className="relative border rounded p-1">
                <img
                  src={q.preview}
                  alt="preview"
                  className="object-cover w-full h-32 cursor-zoom-in"
                  onClick={() => {
                    if (!q.preview) return;
                    const colaResto = queued
                      .filter((_, i) => i !== idx)
                      .map((qq) => qq?.preview)
                      .filter(Boolean);
                    const back = (Array.isArray(items) ? items : [])
                      .map((g) => g?.url || g?.file_url || g?.public_url || "")
                      .filter(Boolean);
                    const lista = [q.preview, ...colaResto, ...back];
                    setVisorLista(lista);
                    setVisorAbierto(true);
                  }}
                />
                <button
                  type="button"
                  className="absolute top-1 right-1 px-2 h-7 text-xs border border-rose-600 rounded text-rose-200 bg-gray-900/70 hover:bg-gray-800"
                  onClick={() => {
                    setQueued((prev) => {
                      const next = prev.filter((_, i) => i !== idx);
                      // revoke removed preview
                      try { URL.revokeObjectURL(q.preview); } catch {}
                      if (typeof onQueueChange === "function") {
                        try { onQueueChange(next.map((x) => x.file)); } catch {}
                      }
                      return next;
                    });
                  }}
                  disabled={busy}
                  title="Quitar de la cola"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Galería de fotos del backend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map((f, idx) => (
          <div
            key={f.id_foto ?? f.file_key ?? f.key ?? f.filename ?? f.url ?? f.file_url ?? idx}
            className="relative border rounded p-1"
          >
            <img
              src={f.url || f.file_url || f.public_url || ""}
              alt={f.filename || "foto"}
              className="object-cover w-full h-32 cursor-zoom-in"
              onClick={() => {
                const clicked = f?.url || f?.file_url || f?.public_url || "";
                if (!clicked) return;
                const backResto = (Array.isArray(items) ? items : [])
                  .filter((_, j) => j !== idx)
                  .map((g) => g?.url || g?.file_url || g?.public_url || "")
                  .filter(Boolean);
                const cola = (Array.isArray(queued) ? queued : [])
                  .map((qq) => qq?.preview)
                  .filter(Boolean);
                const lista = [clicked, ...backResto, ...cola];
                setVisorLista(lista);
                setVisorAbierto(true);
              }}
            />
            {!readOnly && (
              <button
                type="button"
                className="absolute top-1 right-1 px-2 h-7 text-xs border border-rose-600 rounded text-rose-200 bg-gray-900/70 hover:bg-gray-800"
                onClick={() => setDeleteTarget({ fileKey: (f.file_key ?? f.key ?? f.filename), filename: f.filename || "" })}
                disabled={busy || !procPacId}
                title={procPacId ? "Borrar del servidor" : "Guardá el parte para habilitar borrado"}
              >
                Borrar
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Empty state claro */}
      {(!Array.isArray(items) || items.length === 0) && (
        <div className="text-xs text-gray-400 mt-2">No hay fotos para mostrar.</div>
      )}

      {/* Confirmación de borrado */}
      {deleteTarget && (
        <ModalMensaje
          tipo="confirmar_borrado"
          titulo="Confirmar eliminación"
          mensaje={`¿Eliminar la foto "${deleteTarget.filename}"?`}
          onConfirm={async () => { await handleDelete(deleteTarget.fileKey, deleteTarget.filename); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <ModalVisor
        abierto={visorAbierto}
        onClose={() => setVisorAbierto(false)}
        fotos={visorLista}
      />
    </div>
  );
}