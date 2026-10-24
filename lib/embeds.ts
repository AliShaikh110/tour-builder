/**
 * Author HTML for "HTML pop-up" infospots, split into plain HTML (rendered in
 * a sandboxed frame without allow-same-origin) and recognised video embeds.
 *
 * Video embeds can't live inside that sandbox: frames inherit their parent's
 * sandbox, so the player would get an opaque origin and fail to load. Instead
 * they are rebuilt from a validated video id as their own provider frame.
 */
export type HtmlPart =
  | { type: "html"; html: string }
  | { type: "video"; provider: "youtube" | "vimeo"; src: string; title: string };

const IFRAME = /<iframe\b[^>]*>(?:[\s\S]*?<\/iframe\s*>)?/gi;

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

/** Start time in seconds from `start=90`, `t=90` or `t=1m30s`. */
function startSeconds(url: URL): number | null {
  const raw = url.searchParams.get("start") ?? url.searchParams.get("t");
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

/** A canonical embed URL for a YouTube or Vimeo link, or null. */
export function videoEmbed(src: string): { provider: "youtube" | "vimeo"; src: string } | null {
  let url: URL;
  try {
    url = new URL(src, "https://www.youtube.com");
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let youtubeId: string | undefined;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    youtubeId = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})(?:[/?]|$)/)?.[1];
    if (!youtubeId && url.pathname === "/watch") youtubeId = url.searchParams.get("v") ?? undefined;
  } else if (host === "youtu.be") {
    youtubeId = url.pathname.slice(1);
  }
  if (youtubeId && /^[\w-]{11}$/.test(youtubeId)) {
    const start = startSeconds(url);
    return {
      provider: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0${start ? `&start=${start}` : ""}`,
    };
  }
  if (host === "player.vimeo.com" || host === "vimeo.com") {
    const vimeoId = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/|$)/)?.[1];
    if (vimeoId) return { provider: "vimeo", src: `https://player.vimeo.com/video/${vimeoId}` };
  }
  return null;
}

export function splitVideoEmbeds(html: string): HtmlPart[] {
  const parts: HtmlPart[] = [];
  let last = 0;
  for (const match of html.matchAll(IFRAME)) {
    const embed = videoEmbed(attribute(match[0], "src") ?? "");
    if (!embed) continue;
    const before = html.slice(last, match.index);
    if (before.trim()) parts.push({ type: "html", html: before });
    parts.push({
      type: "video",
      ...embed,
      title: attribute(match[0], "title") || (embed.provider === "youtube" ? "YouTube video" : "Vimeo video"),
    });
    last = match.index + match[0].length;
  }
  const rest = html.slice(last);
  if (rest.trim()) parts.push({ type: "html", html: rest });
  return parts;
}
