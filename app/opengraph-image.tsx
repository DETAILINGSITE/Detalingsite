import { ImageResponse } from "next/og";
import { business } from "@/config/business";

export const alt = `${business.name} — premium car detailing`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social card; pages inherit it unless a segment defines its own. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 72,
          background: "radial-gradient(ellipse at 70% 30%, #2a2f36 0%, #0b0c0e 65%)",
          color: "#f4f3ef",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, color: "#8cc4ff", textTransform: "uppercase" }}>{business.name}</div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, marginTop: 18, maxWidth: 900 }}>{business.tagline}</div>
        <div style={{ fontSize: 30, color: "#b1b4ba", marginTop: 24 }}>{`Book online · ${business.contact.phoneDisplay}`}</div>
      </div>
    ),
    size,
  );
}
