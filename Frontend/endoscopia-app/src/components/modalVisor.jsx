import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

function ModalVisor({ fotos = [], abierto, onClose }) {
    // Normalizá las fotos para tolerar distintos shapes (url, file_url, preview, filename, name, nombre)
    const items = useMemo(() => {
        const arr = Array.isArray(fotos) ? fotos : [];
        return arr.map((it, idx) => {
            // Soportar string directo (URL)
            if (typeof it === "string") {
                const url = it.trim();
                const title = url.split("/").pop() || `Foto ${idx + 1}`;
                return { primary: url, fallback: url, title };
            }
            // Soportar objetos con distintas claves conocidas
            const primary = it?.url || it?.file_url || it?.preview || it?.src || "";
            const fallback = (it?.file_url && it?.file_url !== primary)
                ? it.file_url
                : (it?.url || it?.src || "");
            const title = it?.filename || it?.name || it?.nombre || it?.file_key || it?.fileKey || `Foto ${idx + 1}`;
            return { primary, fallback, title };
        }).filter(it => !!it.primary || !!it.fallback);
    }, [fotos]);

    const [fotoIndex, setFotoIndex] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [useFallback, setUseFallback] = useState(false);

    const anterior = useCallback(() => {
        setFotoIndex((prev) => (prev === 0 ? Math.max(items.length - 1, 0) : prev - 1));
        setLoaded(false);
        setUseFallback(false);
    }, [items.length]);

    const siguiente = useCallback(() => {
        setFotoIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
        setLoaded(false);
        setUseFallback(false);
    }, [items.length]);

    const onKeyDown = useCallback((e) => {
        if (!abierto) return;
        if (e.key === "Escape") onClose && onClose();
        if (e.key === "ArrowLeft") anterior();
        if (e.key === "ArrowRight") siguiente();
    }, [abierto, onClose, anterior, siguiente]);

    useEffect(() => {
        if (abierto) {
            setFotoIndex(0); // Reinicia al abrir
            setUseFallback(false);
        }
        setLoaded(false);
    }, [abierto, items]);

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onKeyDown]);

    if (!abierto || items.length === 0) return null;

    const current = items[fotoIndex] || {};
    const src = useFallback ? (current.fallback || current.primary) : (current.primary || current.fallback);
    const alt = current.title || `Foto ${fotoIndex + 1}`;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
            onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-gray-900 rounded-lg p-4 max-w-5xl w-[90vw] relative flex flex-col items-center">
                <button
                    onClick={onClose}
                    aria-label="Cerrar visor"
                    className="absolute top-4 right-4 z-10 bg-gray-800 bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-full"
                >
                    <FiX size={20} />
                </button>
                <div className="relative max-h-[80vh] w-full flex items-center justify-center">
                    {/* Botón anterior */}
                    {items.length > 1 && (
                        <button
                            onClick={anterior}
                            aria-label="Anterior"
                            className="absolute left-2 md:left-4 p-3 bg-gray-800/60 hover:bg-gray-700 text-white rounded-full border border-white/20"
                        >
                            <FiChevronLeft size={24} />
                        </button>
                    )}
                    {/* Imagen */}
                    <img
                        src={src}
                        alt={alt}
                        onLoad={() => setLoaded(true)}
                        onError={() => {
                            // si falla la primaría, probá la de fallback una vez
                            if (!useFallback && current.fallback && current.fallback !== src) {
                                setUseFallback(true);
                                setLoaded(false);
                            }
                        }}
                        className={`max-h-[80vh] max-w-full object-contain rounded shadow transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
                    />
                    {/* Botón siguiente */}
                    {items.length > 1 && (
                        <button
                            onClick={siguiente}
                            aria-label="Siguiente"
                            className="absolute right-2 md:right-4 p-3 bg-gray-800/60 hover:bg-gray-700 text-white rounded-full border border-white/20"
                        >
                            <FiChevronRight size={24} />
                        </button>
                    )}
                </div>
                <div className="flex justify-center items-center w-full mt-3">
                    <span className="text-white/90 text-sm">
                        {fotoIndex + 1} / {items.length}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default ModalVisor;