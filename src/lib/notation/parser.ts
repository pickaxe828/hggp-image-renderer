import { tokenizeGlyphRow } from "./tokenizer.ts";
import type {
  Cell,
  Document,
  ElementRef,
  Extent,
  GlyphDefinition,
  IdentifyStatement,
  ModelContent,
  ModuleBlock,
  ModuleRhs,
  Row,
  Slice2D,
  Stack3D,
  Statement,
  WordRef,
} from "./ir.ts";

/**
 * Parses hggp build notation into the document IR.
 *
 * This is purely syntactic: glyph cells are kept as written (not resolved
 * against the module table) and extents are kept as metadata (not
 * expanded into cell grids) -- resolution and expansion are the job of
 * `modules.ts` / `extents.ts` for whoever consumes the IR.
 */
export function parseDocument(text: string): Document {
  return new Parser(text).parseDocument();
}

const WHITESPACE = /\s/;

class Parser {
  private pos = 0;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  parseDocument(): Document {
    const statements: Statement[] = [];
    this.skipWs();
    while (!this.atEnd()) {
      if (this.peek("---")) {
        statements.push(this.parseModuleBlock());
      } else if (this.peek("[[")) {
        statements.push(this.parseIdentifyStatement());
      } else if (this.peek("[")) {
        statements.push(this.parseEquivalenceStatement());
      } else {
        throw new Error(
          `Unexpected content at position ${this.pos}: ${JSON.stringify(this.text.slice(this.pos, this.pos + 20))}`,
        );
      }
      this.skipWs();
    }
    return { statements };
  }

  // ---- module blocks ----

  private parseModuleBlock(): ModuleBlock {
    this.consumeLiteral("---");
    const definitions: GlyphDefinition[] = [];
    while (true) {
      this.skipWs();
      if (this.peek("---")) {
        this.pos += 3;
        break;
      }
      if (this.atEnd()) {
        throw new Error("Unterminated module block (missing closing ---)");
      }
      definitions.push(this.parseGlyphDefinition());
    }
    return { kind: "module", definitions };
  }

  private parseGlyphDefinition(): GlyphDefinition {
    this.skipWs();
    const glyph = this.readCodePoints(2, "glyph in module definition");
    this.skipWs();
    this.consumeLiteral("::=");
    this.skipWs();
    const rhs = this.parseModuleRhs();
    this.skipWs();
    this.consumeTerminator();
    return { kind: "definition", glyph, rhs };
  }

  private parseModuleRhs(): ModuleRhs {
    if (this.peek("/")) return this.parseElementRef();
    if (this.peek("[")) return this.parseWordRef();
    throw new Error(
      `Expected an element reference (/name/) or bracketed word ([word]) at position ${this.pos}: ${JSON.stringify(this.text.slice(this.pos, this.pos + 20))}`,
    );
  }

  // ---- shared primitives ----

  private parseElementRef(): ElementRef {
    const name = this.scanDelimited("/", "/", "element reference");
    return { kind: "element", name };
  }

  private parseWordRef(): WordRef {
    const word = this.scanDelimited("[", "]", "bracketed word");
    if (this.peek("<")) {
      const extent = this.parseExtent();
      return { kind: "word", word, extent };
    }
    return { kind: "word", word };
  }

  private parseExtent(): Extent {
    const body = this.scanDelimited("<", ">", "extent");
    return parseExtentBody(body);
  }

  /** Consumes `open`, scans up to (not including) the next `close`, consumes
   * that `close`, and returns the text in between. Shared by every
   * delimiter-bounded construct (`/name/`, `[word]`, `<extent>`) since they
   * all follow the same "open, scan, close" shape. */
  private scanDelimited(open: string, close: string, what: string): string {
    this.consumeLiteral(open);
    const end = this.text.indexOf(close, this.pos);
    if (end === -1) {
      throw new Error(`Unterminated ${what} (missing closing ${close})`);
    }
    const content = this.text.slice(this.pos, end);
    this.pos = end + 1;
    return content;
  }

  // ---- 2D block models ----

  private parseIdentifyStatement(): IdentifyStatement {
    this.consumeLiteral("[[");
    const model = this.parseModelContent();
    this.skipWs();
    this.consumeLiteral(":=");
    this.skipWs();
    const element = this.parseElementRef();
    this.skipWs();
    this.consumeTerminator();
    return { kind: "identify", model, elementName: element.name };
  }

  private parseEquivalenceStatement(): Statement {
    const word = this.parseWordRef();
    this.skipWs();
    this.consumeLiteral("==");
    this.skipWs();
    this.consumeLiteral("[[");
    const model = this.parseModelContent();
    this.skipWs();
    this.consumeTerminator();
    return { kind: "equivalence", word, model };
  }

  /** Called with `pos` positioned right after a consumed opening "[[". */
  private parseModelContent(): ModelContent {
    this.skipWs();
    if (this.peek("[[")) {
      return this.parseStack3D();
    }
    return this.parseSlice2D();
  }

  private parseStack3D(): Stack3D {
    const slices: ModelContent[] = [];
    while (true) {
      this.skipWs();
      if (this.peek("]]")) {
        this.pos += 2;
        break;
      }
      if (this.atEnd()) {
        throw new Error("Unterminated model (missing ]])");
      }
      this.consumeLiteral("[[");
      slices.push(this.parseModelContent());
    }
    return { kind: "stack3d", slices };
  }

  private parseSlice2D(): Slice2D {
    const rows: Row[] = [];
    while (true) {
      this.skipWs();
      if (this.peek("]]")) {
        this.pos += 2;
        break;
      }
      if (this.atEnd()) {
        throw new Error("Unterminated model (missing ]])");
      }
      rows.push(this.parseRow());
    }
    return { kind: "slice2d", rows };
  }

  private parseRow(): Row {
    const nlIdx = this.text.indexOf("\n", this.pos);
    const closeIdx = this.text.indexOf("]]", this.pos);
    let end = this.text.length;
    if (nlIdx !== -1) end = Math.min(end, nlIdx);
    if (closeIdx !== -1) end = Math.min(end, closeIdx);
    const rowText = this.text.slice(this.pos, end).trim();
    this.pos = end;
    return parseRowCells(rowText);
  }

  // ---- low-level helpers ----

  private peek(literal: string): boolean {
    return this.text.startsWith(literal, this.pos);
  }

  private consumeLiteral(literal: string): void {
    if (!this.peek(literal)) {
      throw new Error(
        `Expected "${literal}" at position ${this.pos}, found: ${JSON.stringify(this.text.slice(this.pos, this.pos + 20))}`,
      );
    }
    this.pos += literal.length;
  }

  /** Statement terminators vary (";", ";;", or nothing at end of input) --
   * accept any of them. */
  private consumeTerminator(): void {
    if (this.peek(";;")) {
      this.pos += 2;
    } else if (this.peek(";")) {
      this.pos += 1;
    }
  }

  private skipWs(): void {
    while (this.pos < this.text.length && WHITESPACE.test(this.text[this.pos])) {
      this.pos++;
    }
  }

  private atEnd(): boolean {
    return this.pos >= this.text.length;
  }

  /** Reads exactly `n` Unicode code points starting at `pos`, code-point
   * safe (never splits a surrogate pair), and advances `pos` past them. */
  private readCodePoints(n: number, what: string): string {
    // A generous UTF-16 upper bound (astral code points are at most 2
    // units each); parseRow / row boundaries ensure we never read across a
    // line we shouldn't.
    const window = this.text.slice(this.pos, this.pos + n * 4);
    const codePoints = Array.from(window).slice(0, n);
    if (codePoints.length < n) {
      throw new Error(`Unexpected end of input while reading ${what}`);
    }
    const value = codePoints.join("");
    this.pos += value.length;
    return value;
  }
}

function parseExtentBody(body: string): Extent {
  const parts = body.split(",").map((p) => p.trim());
  if (parts.length < 1 || parts.length > 3) {
    throw new Error(`Extent must have 1, 2, or 3 axes, got <${body}>`);
  }
  return parts.map((p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`Invalid extent value "${p}" in <${body}>`);
    }
    return n;
  });
}

/** Parses one row's text (already stripped of surrounding indentation) into
 * cells, accepting bracketed words and two-code-point glyphs mixed freely
 * in the same row. */
function parseRowCells(rowText: string): Row {
  const codePoints = Array.from(rowText);
  const cells: Cell[] = [];
  let i = 0;
  let glyphBuffer: string[] = [];

  const flushGlyphs = (): void => {
    if (glyphBuffer.length === 0) return;
    const chunk = glyphBuffer.join("");
    for (const glyph of tokenizeGlyphRow(chunk)) {
      cells.push({ kind: "glyph", glyph });
    }
    glyphBuffer = [];
  };

  while (i < codePoints.length) {
    if (codePoints[i] === "[") {
      flushGlyphs();
      const word = scanUntil(codePoints, i + 1, "]", `bracketed word in row: ${rowText}`);
      i = word.next;
      let extent: Extent | undefined;
      if (codePoints[i] === "<") {
        const body = scanUntil(codePoints, i + 1, ">", `extent in row: ${rowText}`);
        extent = parseExtentBody(body.content);
        i = body.next;
      }
      cells.push(extent ? { kind: "word", word: word.content, extent } : { kind: "word", word: word.content });
    } else {
      glyphBuffer.push(codePoints[i]);
      i++;
    }
  }
  flushGlyphs();
  return cells;
}

/** Scans a code-point array from `start` up to (not including) the next
 * occurrence of `closeChar`, returning the content in between and the index
 * just past `closeChar`. Shared by the two delimiter-bounded constructs a
 * row cell can contain (`[word]` and `<extent>`). */
function scanUntil(
  codePoints: string[],
  start: number,
  closeChar: string,
  what: string,
): { content: string; next: number } {
  let j = start;
  while (j < codePoints.length && codePoints[j] !== closeChar) j++;
  if (j >= codePoints.length) {
    throw new Error(`Unterminated ${what}`);
  }
  return { content: codePoints.slice(start, j).join(""), next: j + 1 };
}
