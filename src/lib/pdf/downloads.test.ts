import { describe, expect, it } from "vitest";

import { HOLD_MS, heldPdf, holdPdf, pdfDownload } from "./downloads";

const pdf = new Uint8Array([37, 80, 68, 70]);

describe("held PDFs", () => {
  it("keeps a rendered PDF for its download, more than once, until it expires", () => {
    const now = Date.now();
    const id = holdPdf(pdf, "Jane – Resume.pdf", "owner", now);
    expect(heldPdf(id, "owner", now + 1_000)).toEqual({ pdf, fileName: "Jane – Resume.pdf" });
    expect(heldPdf(id, "owner", now + 2_000)).not.toBeNull();
    expect(heldPdf(id, "owner", now + HOLD_MS)).toBeNull();
  });

  it("hands a PDF only to the user it was rendered for", () => {
    const now = Date.now();
    const id = holdPdf(pdf, "Jane – Resume.pdf", "owner", now);
    expect(heldPdf(id, "someone-else", now)).toBeNull();
    expect(heldPdf(id, "owner", now)).not.toBeNull();
  });

  it("drops a user's oldest when too many of theirs wait at once, and nobody else's", () => {
    const now = Date.now();
    const others = holdPdf(pdf, "Theirs.pdf", "someone-else", now);
    const ids = Array.from({ length: 21 }, (_, index) => holdPdf(pdf, `${index}.pdf`, "owner", now));
    expect(heldPdf(others, "someone-else", now)).toMatchObject({ fileName: "Theirs.pdf" });
    expect(heldPdf(ids[0], "owner", now)).toBeNull();
    expect(heldPdf(ids[20], "owner", now)).toMatchObject({ fileName: "20.pdf" });
  });

  it("answers with the PDF as a named download", async () => {
    const response = pdfDownload(pdf, "Jane – Resume.pdf");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''Jane%20%E2%80%93%20Resume.pdf");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdf);
  });
});
