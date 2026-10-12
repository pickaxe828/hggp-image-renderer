import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { validateMapping } from "@/lib/mapping/validate";
import { loadMapping, saveMapping } from "@/lib/mapping/storage";
import type { Mapping } from "@/lib/mapping/types";

export interface ImportMappingProps {
  onImport: (mapping: Mapping) => void;
}

function loadedMappingText(): string {
  const mapping = loadMapping();
  return mapping ? JSON.stringify(mapping, null, 2) : "";
}

/**
 * "Import mapping" UI action. Shows whatever mapping is already loaded
 * (from localStorage, on mount) as editable JSON text, and imports it --
 * validating against the hggp block-mapping schema and persisting to
 * localStorage on success -- only when the user explicitly clicks Import.
 *
 * Choosing a file only replaces the textarea's text; it never imports on
 * its own -- a picked file could be the wrong one, so the user gets to see
 * (and edit) its content before it overwrites the saved mapping. The
 * Import button stays disabled while the text matches the last
 * successfully imported baseline, so there's never a no-op import.
 */
export function ImportMapping({ onImport }: ImportMappingProps) {
  const [text, setText] = useState(loadedMappingText);
  const [importedText, setImportedText] = useState(text);
  const [error, setError] = useState<string | null>(null);

  function importRawText(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("Could not parse input as JSON.");
      return;
    }

    const result = validateMapping(parsed);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    saveMapping(result.mapping);
    setError(null);
    setImportedText(raw);
    onImport(result.mapping);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    // Only load the file's text into the textarea -- importing it is a
    // separate, explicit step (the Import button below).
    setText(await file.text());
  }

  const canImport = text !== importedText;

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Mapping JSON"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-32 rounded-lg border border-input bg-background p-2 font-mono text-sm"
      />
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Mapping JSON file"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        disabled={!canImport}
        onClick={() => importRawText(text)}
        // The base Button's disabled state only fades opacity to 50%,
        // which on this solid-black variant over a near-white page still
        // reads, but faded further by hover/theme differences it can blend
        // into the light-gray helper text next to it (e.g. "No file
        // chosen"). Keep the button's box fully opaque while disabled so
        // it's unmistakably still a button, just an inactive one.
        className="disabled:opacity-80"
      >
        Import mapping
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
