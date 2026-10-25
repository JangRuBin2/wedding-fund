import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "결혼자금 대시보드",
    short_name: "결혼자금",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#1f6b52",
    icons: [],
  };
}
