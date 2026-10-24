import { describe, expect, it } from "vitest";
import { cleanInfospot, createInfospotRecord, infospotLabel, infospotProblem, safeUrl } from "@/lib/infospots";

const at = { yaw: 0, pitch: 0 };

describe("cleanInfospot", () => {
  it("keeps only the fields of its kind", () => {
    const spot = createInfospotRecord(at, {
      kind: "link",
      previewText: "  Visit us ",
      url: " example.com ",
      imageKey: "stale-image",
      caption: "old caption",
      html: "<b>old</b>",
    });
    const clean = cleanInfospot(spot);
    expect(clean).toMatchObject({ kind: "link", previewText: "Visit us", url: "https://example.com/", newWindow: true });
    expect(clean).not.toHaveProperty("imageKey");
    expect(clean).not.toHaveProperty("caption");
    expect(clean).not.toHaveProperty("html");
  });

  it("always keeps previewText and leaves HTML untrimmed", () => {
    const long = cleanInfospot(createInfospotRecord(at, { kind: "long", previewText: "x", title: "T", description: "D" }));
    expect(long).toMatchObject({ previewText: "", title: "T", description: "D" });
    const html = cleanInfospot(createInfospotRecord(at, { kind: "html", html: "  <p>hi</p>\n" }));
    expect(html.html).toBe("  <p>hi</p>\n");
  });
});

describe("safeUrl", () => {
  it.each([
    ["https://example.com/a?b=1", "https://example.com/a?b=1"],
    ["example.com", "https://example.com/"],
    ["mailto:hi@example.com", "mailto:hi@example.com"],
    ["javascript:alert(1)", null],
    ["data:text/html,hi", null],
    ["", null],
    [undefined, null],
  ])("%s → %s", (input, expected) => {
    expect(safeUrl(input)).toBe(expected);
  });
});

describe("infospotProblem and infospotLabel", () => {
  it("names what is missing for each kind", () => {
    expect(infospotProblem(createInfospotRecord(at, { kind: "short" }))).toMatch(/text/);
    expect(infospotProblem(createInfospotRecord(at, { kind: "short", previewText: "Hi" }))).toBeNull();
    expect(infospotProblem(createInfospotRecord(at, { kind: "link", url: "javascript:x" }))).toMatch(/address/);
    expect(infospotProblem(createInfospotRecord(at, { kind: "image" }))).toMatch(/image/i);
    expect(infospotProblem(createInfospotRecord(at, { kind: "long" }))).toMatch(/title/);
    expect(infospotProblem(createInfospotRecord(at, { kind: "html", html: "<p>x</p>" }))).toBeNull();
  });

  it("labels by preview text, then title or URL, then kind", () => {
    expect(infospotLabel(createInfospotRecord(at, { previewText: "Admissions open" }))).toBe("Admissions open");
    expect(infospotLabel(createInfospotRecord(at, { kind: "long", title: "History" }))).toBe("History");
    expect(infospotLabel(createInfospotRecord(at, { kind: "link", url: "example.com" }))).toBe("example.com");
    expect(infospotLabel(createInfospotRecord(at, { kind: "image" }))).toBe("Image");
  });
});
