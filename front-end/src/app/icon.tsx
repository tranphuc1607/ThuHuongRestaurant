import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #c2410c 0%, #ea580c 60%, #f97316 100%)",
          borderRadius: 8,
        }}
      >
        {/* Lantern body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Top bar */}
          <div
            style={{
              width: 12,
              height: 2,
              background: "#7c2d12",
              borderRadius: 1,
            }}
          />
          {/* Lantern oval body */}
          <div
            style={{
              width: 14,
              height: 16,
              background: "white",
              borderRadius: "45%",
              opacity: 0.9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                color: "#ea580c",
                fontSize: 7,
                fontWeight: 900,
                letterSpacing: "-0.5px",
                lineHeight: 1,
              }}
            >
              TH
            </div>
          </div>
          {/* Bottom bar */}
          <div
            style={{
              width: 12,
              height: 2,
              background: "#7c2d12",
              borderRadius: 1,
            }}
          />
          {/* Tassel */}
          <div
            style={{
              width: 1.5,
              height: 4,
              background: "#7c2d12",
              borderRadius: 1,
              marginTop: 0,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
