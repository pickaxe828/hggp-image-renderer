import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportMapping } from "./import-mapping";
import { MAPPING_STORAGE_KEY, saveMapping } from "@/lib/mapping/storage";

afterEach(() => {
  cleanup();
});

const validMapping = {
  version: 1,
  words: { $test1: "minecraft:stone" },
};
const validJson = JSON.stringify(validMapping);

describe("ImportMapping", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves a valid pasted mapping and calls onImport", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ImportMapping onImport={onImport} />);

    await user.click(screen.getByRole("textbox"));
    await user.paste(validJson);
    await user.click(screen.getByRole("button", { name: /import/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(validMapping);
    });
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).not.toBeNull();
  });

  it("shows a specific validation error and does not touch localStorage on invalid shape", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ImportMapping onImport={onImport} />);

    await user.click(screen.getByRole("textbox"));
    await user.paste(JSON.stringify({ words: {} }));
    await user.click(screen.getByRole("button", { name: /import/i }));

    expect(await screen.findByText(/version/i)).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).toBeNull();
  });

  it("shows an error for unparsable JSON and does not touch localStorage", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ImportMapping onImport={onImport} />);

    await user.click(screen.getByRole("textbox"));
    await user.paste("{ not json");
    await user.click(screen.getByRole("button", { name: /import/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/json/i);
    expect(onImport).not.toHaveBeenCalled();
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).toBeNull();
  });

  it("shows whatever mapping is already in localStorage as the textarea content on mount", () => {
    saveMapping(validMapping);
    render(<ImportMapping onImport={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue(
      JSON.stringify(validMapping, null, 2)
    );
  });

  it("disables Import until the text differs from the loaded baseline, and re-disables it after a successful import", async () => {
    const user = userEvent.setup();
    render(<ImportMapping onImport={vi.fn()} />);
    const importButton = screen.getByRole("button", { name: /import/i });

    // Nothing pasted/changed yet, and nothing was previously loaded --
    // there's nothing to (re-)import.
    expect(importButton).toBeDisabled();

    await user.click(screen.getByRole("textbox"));
    await user.paste(validJson);
    expect(importButton).toBeEnabled();

    await user.click(importButton);
    await waitFor(() => expect(importButton).toBeDisabled());
  });

  it("loads a selected file into the textarea without importing it -- Import must still be clicked", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ImportMapping onImport={onImport} />);

    const file = new File([validJson], "mapping.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText(/mapping json file/i), file);

    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue(validJson)
    );
    expect(onImport).not.toHaveBeenCalled();
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /import/i })).toBeEnabled();
  });

  it("saves a valid mapping selected as a file once Import is clicked", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ImportMapping onImport={onImport} />);

    const file = new File([validJson], "mapping.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText(/mapping json file/i), file);
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue(validJson)
    );
    await user.click(screen.getByRole("button", { name: /import/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(validMapping);
    });
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).not.toBeNull();
  });

  it("shows a specific validation error for an invalid mapping file once Import is clicked", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ImportMapping onImport={onImport} />);

    const invalidJson = JSON.stringify({ words: {} });
    const file = new File([invalidJson], "mapping.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText(/mapping json file/i), file);
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue(invalidJson)
    );
    await user.click(screen.getByRole("button", { name: /import/i }));

    expect(await screen.findByText(/version/i)).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
    expect(localStorage.getItem(MAPPING_STORAGE_KEY)).toBeNull();
  });
});
