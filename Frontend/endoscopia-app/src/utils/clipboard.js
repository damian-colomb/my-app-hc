export async function copyToClipboard(text) {
    const value = typeof text === "string" ? text : "";
    if (!value || !value.trim()) {
        throw new Error("Texto vacío");
    }

    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }
    } catch (error) {
        console.warn("navigator.clipboard.writeText falló, probando fallbacks", error);
    }

    if (copyUsingTextarea(value)) return;
    if (copyUsingContentEditable(value)) return;

    throw new Error("No se pudo copiar al portapapeles");
}

function saveSelection() {
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }
    const ranges = [];
    for (let i = 0; i < selection.rangeCount; i += 1) {
        ranges.push(selection.getRangeAt(i));
    }
    return { selection, ranges };
}

function restoreSelection(saved) {
    if (!saved) return;
    const { selection, ranges } = saved;
    selection.removeAllRanges();
    ranges.forEach((range) => selection.addRange(range));
}

function copyUsingTextarea(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.whiteSpace = "pre-wrap";
    document.body.appendChild(textarea);

    const savedSelection = saveSelection();

    textarea.focus({ preventScroll: true });
    textarea.select();
    if (typeof textarea.setSelectionRange === "function") {
        textarea.setSelectionRange(0, value.length);
    }

    let successful = false;
    try {
        successful = document.execCommand("copy");
    } catch (error) {
        console.warn("execCommand con textarea falló", error);
        successful = false;
    }

    document.body.removeChild(textarea);
    restoreSelection(savedSelection);

    return successful;
}

function copyUsingContentEditable(value) {
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.style.position = "fixed";
    editable.style.top = "0";
    editable.style.left = "0";
    editable.style.opacity = "0";
    editable.style.pointerEvents = "none";
    editable.style.whiteSpace = "pre-wrap";
    editable.textContent = value;
    document.body.appendChild(editable);

    const savedSelection = saveSelection();
    const selection = window.getSelection?.();
    selection?.removeAllRanges?.();
    const range = document.createRange();
    range.selectNodeContents(editable);
    selection?.addRange?.(range);

    let successful = false;
    try {
        successful = document.execCommand("copy");
    } catch (error) {
        console.warn("execCommand con contentEditable falló", error);
        successful = false;
    }

    selection?.removeAllRanges?.();
    restoreSelection(savedSelection);
    document.body.removeChild(editable);

    return successful;
}
