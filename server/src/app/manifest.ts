import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "결혼자금 대시보드",
    short_name: "결혼자금",
    start_url: "/",
    display: "standalone",
    background_color: "#edf0f4",
    theme_color: "#17284a",
    icons: [],
  };
}
