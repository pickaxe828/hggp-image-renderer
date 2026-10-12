import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotationInput } from "./notation-input";
import { parseDocument } from "@/lib/notation";

afterEach(() => {
  cleanup();
});

const validNotation = `---
.. ::= [$_]<8,8>;
██ ::= [!<$]<8,8>;
@@ ::= /@/;
---

[[
  ......@@....
  ████████████
]]:=/C/;
`;

const malformedNotation = "[[ .. ";

describe("NotationInput", () => {
  it("parses valid pasted notation and calls onParsed", async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();
    render(<NotationInput onParsed={onParsed} />);

    await user.click(screen.getByRole("textbox"));
    await user.paste(validNotation);
    await user.click(screen.getByRole("button", { name: /render/i }));

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(parseDocument(validNotation));
    });
  });

  it("shows a specific parse error and does not call onParsed on malformed input", async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();
    render(<NotationInput onParsed={onParsed} />);

    await user.click(screen.getByRole("textbox"));
    await user.paste(malformedNotation);
    await user.click(screen.getByRole("button", { name: /render/i }));

    let expectedMessage = "";
    try {
      parseDocument(malformedNotation);
    } catch (error) {
      expectedMessage = error instanceof Error ? error.message : String(error);
    }
    expect(expectedMessage).not.toBe("");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(expectedMessage);
    expect(onParsed).not.toHaveBeenCalled();
  });

  it("parses valid notation selected as a file and calls onParsed", async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();
    render(<NotationInput onParsed={onParsed} />);

    const file = new File([validNotation], "model.hggp", {
      type: "text/plain",
    });
    await user.upload(screen.getByLabelText(/notation file/i), file);

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(parseDocument(validNotation));
    });
  });

  it("shows the alert for malformed notation selected as a file and does not call onParsed", async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();
    render(<NotationInput onParsed={onParsed} />);

    const file = new File([malformedNotation], "model.hggp", {
      type: "text/plain",
    });
    await user.upload(screen.getByLabelText(/notation file/i), file);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it("recovers after a failed parse once the textarea holds valid notation", async () => {
    const user = userEvent.setup();
    const onParsed = vi.fn();
    render(<NotationInput onParsed={onParsed} />);

    await user.click(screen.getByRole("textbox"));
    await user.paste(malformedNotation);
    await user.click(screen.getByRole("button", { name: /render/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.clear(screen.getByRole("textbox"));
    await user.click(screen.getByRole("textbox"));
    await user.paste(validNotation);
    await user.click(screen.getByRole("button", { name: /render/i }));

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledWith(parseDocument(validNotation));
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
