import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "모아봄",
    short_name: "모아봄",
    description: "함께 모으는 우리의 봄",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4fb",
    theme_color: "#8e9bff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
