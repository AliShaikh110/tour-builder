import { describe, expect, it } from "vitest";
import { splitVideoEmbeds, videoEmbed } from "@/lib/embeds";

describe("videoEmbed", () => {
  it.each([
    ["https://www.youtube.com/embed/M7lc1UVf-VE", "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0"],
    ["https://youtu.be/M7lc1UVf-VE?t=1m30s", "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&start=90"],
    ["https://www.youtube.com/watch?v=M7lc1UVf-VE&start=12", "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&start=12"],
    ["https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1", "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0"],
    ["https://player.vimeo.com/video/76979871?h=abc", "https://player.vimeo.com/video/76979871"],
  ])("recognises %s", (input, src) => {
    expect(videoEmbed(input)?.src).toBe(src);
  });

  it.each([
    "https://evil.example/embed/M7lc1UVf-VE",
    "https://www.youtube.com/embed/not-an-id",
    "https://www.youtube.com.evil.example/embed/M7lc1UVf-VE",
    "javascript:alert(1)",
    "",
  ])("rejects %s", (input) => {
    expect(videoEmbed(input)).toBeNull();
  });
});

describe("splitVideoEmbeds", () => {
  it("lifts video iframes out of the HTML, in order", () => {
    const html = `<h3>Story</h3><iframe width="560" height="315" src="https://www.youtube.com/embed/M7lc1UVf-VE" title="Lighthouse film" allowfullscreen></iframe><p>After</p>`;
    expect(splitVideoEmbeds(html)).toEqual([
      { type: "html", html: "<h3>Story</h3>" },
      {
        type: "video",
        provider: "youtube",
        src: "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0",
        title: "Lighthouse film",
      },
      { type: "html", html: "<p>After</p>" },
    ]);
  });

  it("leaves other iframes and markup inside the HTML part", () => {
    const html = `<iframe src="https://maps.example/x"></iframe><script>alert(1)</script>`;
    expect(splitVideoEmbeds(html)).toEqual([{ type: "html", html }]);
  });

  it("drops empty HTML between videos", () => {
    const html = `<iframe src='https://youtu.be/M7lc1UVf-VE'></iframe>\n  <iframe src=https://player.vimeo.com/video/1></iframe>`;
    expect(splitVideoEmbeds(html).map((p) => p.type)).toEqual(["video", "video"]);
  });
});
