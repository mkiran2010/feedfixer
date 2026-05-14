export function buildReelUrl(platform: string, videoId: string): string {
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/shorts/${videoId}`;
    case "instagram":
      return `https://www.instagram.com/reels/${videoId}/`;
    case "tiktok":
      return `https://www.tiktok.com/@_/video/${videoId}`;
    case "x":
      return `https://x.com/i/status/${videoId}`;
    default:
      return "";
  }
}
