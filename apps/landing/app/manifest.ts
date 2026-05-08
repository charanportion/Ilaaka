import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ilaaka — Apna Ilaaka. Apni Fitness.",
    short_name: "Ilaaka",
    description:
      "The fitness app where every step claims territory. Walk, run, or cycle your neighbourhood and your route locks in zones on the map.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08070a",
    theme_color: "#08070a",
    categories: ["health", "fitness", "lifestyle", "sports"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
