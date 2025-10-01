const DEFAULT_SECTION_FALLBACK = "Sin datos";

function normalizeSingleValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
            .join("; ");
    }
    return typeof value === "string" ? value.trim() : "";
}

function linesFromValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        return trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }
    return [];
}

export function buildPrimeraVezText({ motivo, evolucionMasVieja, antecedentes = {} }) {
    const motivoText = normalizeSingleValue(motivo);
    const evolucionTexto = normalizeSingleValue(evolucionMasVieja?.texto);

    if (!motivoText || !evolucionTexto) {
        return "";
    }

    const encabezado = `Paciente consulta por "${motivoText}"`;
    const secciones = [
        ["Médicos", linesFromValue(antecedentes.medicos)],
        ["Quirúrgicos", linesFromValue(antecedentes.quirurgicos)],
        ["Alérgicos", linesFromValue(antecedentes.alergicos)],
        ["Tóxicos", linesFromValue(antecedentes.toxicos)],
        ["Gineco - Obstétricos", linesFromValue(antecedentes.ginecoobstetricos)],
        ["Familiares", linesFromValue(antecedentes.familiares)],
    ];

    const antecedentesBloque = ["Antecedentes:"];
    secciones.forEach(([label, valores], index) => {
        if (index > 0) {
            antecedentesBloque.push("");
        }
        antecedentesBloque.push(`${label}:`);
        if (valores.length === 0) {
            antecedentesBloque.push(DEFAULT_SECTION_FALLBACK);
        } else {
            antecedentesBloque.push(...valores);
        }
    });

    while (antecedentesBloque.length > 0 && antecedentesBloque[antecedentesBloque.length - 1] === "") {
        antecedentesBloque.pop();
    }

    return [encabezado, "", evolucionTexto, "", antecedentesBloque.join("\n")].join("\n");
}

export function buildEvolucionText({ fecha, texto }) {
    const parts = [];
    const contenido = typeof texto === "string" ? texto.trim() : "";

    if (contenido) {
        if (parts.length > 0) {
            parts.push("");
        }
        parts.push(contenido);
    }

    return parts.join("\n");
}

export function buildEpicrisisText() {
    return "";
}
