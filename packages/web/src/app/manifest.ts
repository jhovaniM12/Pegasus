import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/login/staff",
    name: "Pegaso Staff",
    short_name: "Pegaso",
    description: "Juzgamiento y operación de ferias para staff Pegaso.",
    start_url: "/login/staff",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#1d3d6b",
    lang: "es",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
