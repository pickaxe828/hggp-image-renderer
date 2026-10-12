import type {
  Cell,
  Document,
  Extent,
  GlyphDefinition,
  ModelContent,
  ModuleRhs,
  Row,
  Statement,
  WordRef,
} from "./ir.ts";

/**
 * Serializes the document IR back into hggp build notation.
 *
 * Output is not guaranteed byte-identical to whatever text was originally
 * parsed (indentation is regenerated, not preserved) but is guaranteed to
 * reparse to an IR that deep-equals the input document.
 */
export function serializeDocument(doc: Document): string {
  return doc.statements.map(serializeStatement).join("\n\n");
}

function serializeStatement(statement: Statement): string {
  switch (statement.kind) {
    case "module":
      return serializeModuleBlock(statement.definitions);
    case "identify":
      return statement.elementName === undefined
        ? `${serializeModel(statement.model, "")};`
        : `${serializeModel(statement.model, "")}:=/${statement.elementName}/;`;
    case "equivalence":
      return `${serializeWordRef(statement.word)} == ${serializeModel(statement.model, "")};`;
  }
}

function serializeModuleBlock(definitions: readonly GlyphDefinition[]): string {
  const lines = definitions.map(
    (def) => `${def.glyph} ::= ${serializeModuleRhs(def.rhs)};`
  );
  return ["---", ...lines, "---"].join("\n");
}

function serializeModuleRhs(rhs: ModuleRhs): string {
  return rhs.kind === "word" ? serializeWordRef(rhs) : `/${rhs.name}/`;
}

function serializeWordRef(word: WordRef): string {
  const extentSuffix = word.extent ? serializeExtent(word.extent) : "";
  return `[${word.word}]${extentSuffix}`;
}

function serializeExtent(extent: Extent): string {
  return `<${extent.join(",")}>`;
}

function serializeModel(content: ModelContent, indent: string): string {
  const innerIndent = `${indent}  `;
  if (content.kind === "slice2d") {
    const lines = content.rows.map(
      (row) => `${innerIndent}${serializeRow(row)}`
    );
    return `[[\n${lines.join("\n")}\n${indent}]]`;
  }
  const lines = content.slices.map(
    (slice) => `${innerIndent}${serializeModel(slice, innerIndent)}`
  );
  return `[[\n${lines.join("\n")}\n${indent}]]`;
}

function serializeRow(row: Row): string {
  return row.map(serializeCell).join("");
}

function serializeCell(cell: Cell): string {
  return cell.kind === "glyph" ? cell.text : serializeWordRef(cell);
}
