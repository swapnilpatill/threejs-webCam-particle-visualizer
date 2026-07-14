/**
 * Browser-only helpers for acquiring a pixel source: either the real webcam,
 * or a synthetic animated "face" used as a fallback / demo when no camera is
 * available or permission is denied.
 */

/** The kinds of image source the renderer can sample from. */
export type PixelSource = HTMLVideoElement | HTMLCanvasElement;

export async function requestCamera(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia is not available in this environment");
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: "user",
    },
    audio: false,
  });
}

/** Create a <video> element bound to a camera stream, played inline & muted. */
export async function createVideoElement(
  stream: MediaStream,
): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  await video.play();
  return video;
}

/**
 * A self-animating canvas that paints a stylized, gently breathing face.
 * Used so the visualizer is fully explorable without a physical camera.
 */
export function createDemoSource(): { canvas: HTMLCanvasElement; stop: () => void } {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext("2d")!;
  const start = performance.now();
  let raf = 0;

  const draw = () => {
    const time = (performance.now() - start) / 1000;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = "#050608";
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2 + Math.sin(time * 0.5) * 8;
    const cy = H / 2 + Math.sin(time * 0.8) * 6;
    const rw = 72;
    const rh = 96;

    // Head
    const g = ctx.createRadialGradient(cx, cy - 12, 12, cx, cy, 120);
    g.addColorStop(0, "#efe0cc");
    g.addColorStop(0.55, "#bb8f70");
    g.addColorStop(1, "#0a0a10");
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rw / rh, 1);
    ctx.beginPath();
    ctx.arc(0, 0, rh, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // Eyes (with occasional blink + wandering gaze)
    const eyeY = cy - 16;
    const eyeDX = 27;
    const blink = Math.sin(time * 1.7) > 0.95 ? 0.15 : 1;
    const gaze = Math.sin(time * 0.9) * 3;
    for (const s of [-1, 1] as const) {
      ctx.save();
      ctx.translate(cx + s * eyeDX, eyeY);
      ctx.fillStyle = "#f5f5f5";
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b2b4d";
      ctx.beginPath();
      ctx.arc(gaze, 0, 5 * blink, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(gaze, 0, 2.2 * blink, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Eyebrows
    ctx.strokeStyle = "rgba(60,40,30,0.7)";
    ctx.lineWidth = 4;
    for (const s of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + s * (eyeDX + 12), eyeY - 14);
      ctx.quadraticCurveTo(cx + s * eyeDX, eyeY - 20, cx + s * (eyeDX - 12), eyeY - 15);
      ctx.stroke();
    }

    // Nose
    ctx.strokeStyle = "rgba(80,50,40,0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, eyeY + 10);
    ctx.lineTo(cx - 5, cy + 20);
    ctx.lineTo(cx + 7, cy + 22);
    ctx.stroke();

    // Mouth (opens & closes)
    const mo = 0.5 + 0.5 * Math.sin(time * 1.2);
    ctx.strokeStyle = "#7a2e2e";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy + 52);
    ctx.quadraticCurveTo(cx, cy + 52 + 20 * mo, cx + 24, cy + 52);
    ctx.stroke();

    // Roaming cinematic light
    const lx = cx + Math.cos(time * 0.7) * 90;
    const ly = cy + Math.sin(time * 0.7) * 70;
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 130);
    lg.addColorStop(0, "rgba(120,170,255,0.28)");
    lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);

    raf = requestAnimationFrame(draw);
  };

  draw();
  return { canvas, stop: () => cancelAnimationFrame(raf) };
}
