import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { parseDocument } from "@/lib/notation";
import type { Document } from "@/lib/notation";

export interface NotationInputProps {
  onParsed: (document: Document) => void;
}

/**
 * Notation paste/import UI: accepts pasted hggp build-notation text (or a
 * file containing it), parses it via `parseDocument`, and surfaces a
 * specific error message on failure without ever leaving a blank UI.
 */
export function NotationInput({ onParsed }: NotationInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function parseRawText(raw: string) {
    try {
      const document = parseDocument(raw);
      setError(null);
      onParsed(document);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const raw = await file.text();
    setText(raw);
    parseRawText(raw);
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Notation text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-32 rounded-lg border border-input bg-background p-2 font-mono text-sm"
      />
      <input
        type="file"
        accept="text/plain,.txt,.hggp"
        aria-label="Notation file"
        onChange={handleFileChange}
      />
      <Button type="button" onClick={() => parseRawText(text)}>
        Render
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
