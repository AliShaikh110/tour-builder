import { describe, expect, it } from "vitest";
import { embedCode, embedLink, tourLink } from "@/lib/share";

describe("share links", () => {
  it("builds the viewer link, with an optional start scene", () => {
    expect(tourLink("http://localhost:3000", "abc123")).toBe("http://localhost:3000/tours/abc123");
    expect(tourLink("https://tours.example", "abc", "s 1")).toBe("https://tours.example/tours/abc?scene=s+1");
    expect(embedLink("https://tours.example", "abc")).toBe("https://tours.example/embed/abc");
  });

  it("escapes the title in the embed code", () => {
    const code = embedCode("https://tours.example", { id: "abc", title: `Tom & Jo's "Loft" <3>` });
    expect(code).toContain(`src="https://tours.example/embed/abc"`);
    expect(code).toContain(`title="Tom &amp; Jo's &quot;Loft&quot; &lt;3&gt;"`);
    expect(code).toMatch(/^<iframe [^>]*allowfullscreen loading="lazy"><\/iframe>$/);
  });
});
