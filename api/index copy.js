// api/index.js
import express from "express";
import * as tf from "@tensorflow/tfjs"; // pure JS
import { PNG } from "pngjs";

const app = express();
app.use(express.json({ limit: "15mb" }));

// Helper: convert tensor (HWC) ke PNG buffer
async function tensorToPng(tensor) {
  const [height, width, channels] = tensor.shape;
  const png = new PNG({ width, height });

  const data = await tensor.data();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const pxIdx = (y * width + x) * channels;

      png.data[idx] = data[pxIdx]; // R
      png.data[idx + 1] = data[pxIdx + 1]; // G
      png.data[idx + 2] = data[pxIdx + 2]; // B
      png.data[idx + 3] = channels === 4 ? data[pxIdx + 3] : 255; // A
    }
  }

  return PNG.sync.write(png);
}

app.get("/", (req, res) => {
  res.send("🚀 Lightweight Upscale API (tfjs + pngjs) running on Vercel!");
});

app.post("/upscale", async (req, res) => {
  try {
    const { image, scale } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Image (base64) is required" });
    }

    const factor = scale || 2;

    // decode base64 jadi buffer
    const buffer = Buffer.from(
      image.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    // Decode PNG dengan pngjs
    const decoded = PNG.sync.read(buffer);
    const { width, height, data } = decoded;

    // Convert ke tensor [H, W, 4]
    let inputTensor = tf.tensor3d(
      new Uint8Array(data),
      [height, width, 4],
      "int32"
    );

    // Resize pakai tfjs
    const resized = tf.image.resizeBilinear(inputTensor, [
      height * factor,
      width * factor,
    ]);

    // Convert balik ke PNG base64
    const outBuffer = await tensorToPng(resized);
    const base64 = "data:image/png;base64," + outBuffer.toString("base64");

    inputTensor.dispose();
    resized.dispose();

    res.json({ upscaled: base64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upscaling failed", details: err.message });
  }
});

export default app;
app.listen(3000, () => {
  console.log("🚀 Upscale API running on http://localhost:3000");
});
