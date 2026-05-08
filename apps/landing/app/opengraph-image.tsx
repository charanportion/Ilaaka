import { ImageResponse } from "next/og";

/* OG/Twitter card. Next.js auto-discovers and emits the meta tags;
   the same image is reused for twitter:image when no twitter-image
   route exists. */
export const alt = "Ilaaka — Apna Ilaaka. Apni Fitness.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEX_POINTS = "30,1 58,16 58,38 30,52 2,38 2,16";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#08070a",
          color: "#f8f1e3",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          position: "relative",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI'",
        }}
      >
        {/* Hex pattern accent — a faint cluster in the bottom-right */}
        <div
          style={{
            position: "absolute",
            right: -120,
            bottom: -120,
            display: "flex",
            opacity: 0.08,
          }}
        >
          <svg width="640" height="554" viewBox="0 0 60 52">
            <polygon points={HEX_POINTS} fill="#f8f1e3" />
          </svg>
        </div>

        {/* Top row: wordmark + version pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <svg
              width="44"
              height="38"
              viewBox="0 0 60 52"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon points={HEX_POINTS} fill="#f8f1e3" />
            </svg>
            <span
              style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: -1.5,
                lineHeight: 1,
              }}
            >
              ilaaka
            </span>
          </div>
          <span
            style={{
              fontSize: 18,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "rgba(248, 241, 227, 0.65)",
              border: "1px solid rgba(248, 241, 227, 0.25)",
              padding: "10px 20px",
              borderRadius: 999,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            Hyderabad · Beta v1
          </span>
        </div>

        {/* Tagline — the headline copy from the hero */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 132,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -4,
              fontFamily:
                "ui-serif, 'Iowan Old Style', 'Hoefler Text', Georgia, serif",
            }}
          >
            Apna Ilaaka.
          </div>
          <div
            style={{
              fontSize: 132,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -4,
              fontStyle: "italic",
              fontFamily:
                "ui-serif, 'Iowan Old Style', 'Hoefler Text', Georgia, serif",
            }}
          >
            Apni Fitness.
          </div>
        </div>

        {/* Bottom mono caption */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 20,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "rgba(248, 241, 227, 0.55)",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          <span>Walk it · Claim it · Defend it</span>
          <span>ilaaka.dotportion.com</span>
        </div>
      </div>
    ),
    size,
  );
}
