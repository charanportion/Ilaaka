import { ImageResponse } from "next/og";

/* iOS home-screen icon. iOS rounds its own corners, so we ship a square. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#08070a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="120"
          height="104"
          viewBox="0 0 60 52"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="30,1 58,16 58,38 30,52 2,38 2,16"
            fill="#f8f1e3"
          />
        </svg>
      </div>
    ),
    size,
  );
}
