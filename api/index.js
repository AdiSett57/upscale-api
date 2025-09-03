// api/index.js
import express from "express";
import * as tf from "@tensorflow/tfjs";
import { PNG } from "pngjs";
import sharp from "sharp";
import { injectSpeedInsights } from "@vercel/speed-insights";

const app = express();

// app.set("trust proxy", 1);
app.set("trust proxy", true);

app.use(express.json({ limit: "15mb" }));

// Helper: convert tensor (HWC) ke PNG buffer
async function tensorToPng(tensor) {
  const [height, width, channels] = tensor.shape;
  const png = new PNG({ width, height });
  const data = await tensor.data();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2; // Index untuk buffer PNG (selalu 4 channel: RGBA)
      const pxIdx = (y * width + x) * channels; // Index untuk data tensor
      png.data[idx] = data[pxIdx]; // R
      png.data[idx + 1] = data[pxIdx + 1]; // G
      png.data[idx + 2] = data[pxIdx + 2]; // B
      // Jika gambar input (JPG) tidak punya Alpha, set ke 255 (opaque)
      png.data[idx + 3] = channels === 4 ? data[pxIdx + 3] : 255; // A
    }
  }
  return PNG.sync.write(png);
}

// app.get("/", (req, res) => {
//   res.send("🚀 Lightweight Upscale API (tfjs + sharp) running on Vercel!");
// });

app.get("/", (req, res) => {
  res.type("text/html").send(`
    <h1>🚀 Lightweight Upscale API</h1>
    <p>API ini menggunakan <b>TensorFlow.js</b> + <b>Sharp</b> untuk melakukan upscaling gambar.</p>
    
    <h2>🔗 Endpoint</h2>
    <ul>
      <li><code>GET /</code> → Menampilkan dokumentasi API ini</li>
      <li><code>POST /upscale</code> → Upscale gambar</li>
    </ul>

    <h2>📩 Cara Request</h2>
    <p>Kirim request <code>POST</code> ke <code>/upscale</code> dengan body JSON:</p>
    <pre>{
  "image": "data:image/png;base64,...",
  "scale": 2
}</pre>

    <h2>📤 Response</h2>
    <p>Jika sukses, response akan berupa JSON:</p>
    <pre>{
  "upscaled": "data:image/png;base64,..."
}</pre>

    <h2>⚠️ Catatan</h2>
    <ul>
      <li><code>image</code> wajib diisi (format base64)</li>
      <li><code>scale</code> opsional (default = 2)</li>
      <li>Output selalu dalam format <b>PNG base64</b></li>
    </ul>

    <hr>
    <p>📘 Source: API berjalan di atas <b>Vercel Serverless</b></p>
    <p>Kontak Developer : adisett57@gmail.com</p>
  `);
});

app.post("/upscale", async (req, res) => {
  injectSpeedInsights();
  try {
    const { image, scale } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Image (base64) is required" });
    }

    const factor = scale || 2;
    const buffer = Buffer.from(
      image.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    // 🚀 Gunakan sharp untuk decode gambar (PNG/JPG/dll)
    const { data, info } = await sharp(buffer)
      .raw() // Ambil data pixel mentah
      .toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;
    // Convert ke tensor [H, W, C] (channels bisa 3 untuk JPG, 4 untuk PNG)
    const inputTensor = tf.tensor3d(data, [height, width, channels], "int32");
    // Resize pakai tfjs
    const resized = tf.image.resizeBilinear(inputTensor, [
      height * factor,
      width * factor,
    ]);

    // Convert balik ke PNG base64 (output kita buat konsisten PNG)
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

// Hapus bagian listen(), Vercel akan menanganinya secara otomatis
app.listen(3000, () => {
  console.log("🚀 Upscale API running on http://localhost:3000");
});
