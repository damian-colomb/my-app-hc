// src/pages/Modulos/elementosPartes/ParteHeader.jsx
import React from "react";

export default function ParteHeader({
    centroResolved,
    pac,
    edadPaciente,
    coberturaDisplay,
}) {
    const infoRow = [
        { label: "DNI", valor: pac?.dni || "—", copy: pac?.dni || "", className: "w-24" },
        { label: "Edad", valor: edadPaciente ?? "—", copy: edadPaciente || "", className: "w-16" },
        { label: "Cobertura", valor: coberturaDisplay || "—", copy: coberturaDisplay || "", className: "min-w-[12rem]" },
        { label: "Beneficio", valor: pac?.beneficio || "—", copy: pac?.beneficio || "", className: "min-w-[16rem]" },
    ];

    return (
        <div className="mb-6">
            {/* Header estilo Historia Clínica */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-[0_25px_60px_-20px_rgba(15,20,40,0.85)]">
                <div className="pointer-events-none absolute inset-0 opacity-40" style={{
                    background: "radial-gradient( circle at 30% 20%, rgba(41,142,255,0.18), transparent 45% ), radial-gradient( circle at 80% 10%, rgba(16,196,164,0.12), transparent 40% )"
                }} />

                <div className="relative px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/20 to-sky-500/20">
                                <img
                                    src={centroResolved === "HZB" ? "/HZB.jpg" : "/Intecnus.png"}
                                    alt={centroResolved === "HZB" ? "Hospital Zonal Bariloche" : "Fundación Intecnus"}
                                    className="h-10 w-auto rounded"
                                />
                            </div>
                            <div>
                                <h2 className="text-2xl font-semibold text-white">
                                    Parte quirúrgico {centroResolved === "HZB" ? "HZB" : "INTECNUS"}
                                </h2>
                                {pac?.nombre && (
                                    <p className="mt-1 text-base font-semibold text-emerald-300/90">
                                        {pac.nombre}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm">
                            {infoRow.map(({ label, valor, copy, className }) => (
                                <div
                                    key={label}
                                    className={`flex flex-col items-center gap-1 border-l border-white/15 pl-3 transition hover:border-emerald-300/50 group ${copy ? "cursor-pointer" : ""}`}
                                    onClick={() => { if (copy) navigator.clipboard.writeText(copy); }}
                                    title={copy ? `Clic para copiar ${label.toLowerCase()}` : undefined}
                                >
                                    <span className="text-[0.55rem] uppercase tracking-[0.28em] text-white/35 group-hover:text-emerald-300 transition-colors">{label}</span>
                                    <span className={`font-semibold text-white/85 truncate text-center group-hover:text-emerald-300 transition-colors`}>
                                        {valor || "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
