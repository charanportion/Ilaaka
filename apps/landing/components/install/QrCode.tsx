"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
};

export function QrCode({ value, size = 220 }: Props) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: { dark: "#08070a", light: "#f8f1e3" },
    })
      .then((s) => {
        if (alive) setSvg(s);
      })
      .catch(() => {
        if (alive) setSvg(null);
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <div
      style={{ width: size, height: size }}
      aria-label={`QR code for ${value}`}
      role="img"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
