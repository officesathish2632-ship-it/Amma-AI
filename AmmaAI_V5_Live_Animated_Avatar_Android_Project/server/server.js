import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.text({ type: ["application/sdp", "text/plain"], limit: "64kb" }));

const PORT = process.env.PORT || 3000;
const MODEL = process.env.REALTIME_MODEL || "gpt-realtime-2.1-mini";

app.get("/health", (_req, res) => res.json({ ok: true, service: "Amma AI V4 session server" }));

app.post("/session", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).type("text/plain").send("Server is missing OPENAI_API_KEY.");
  }
  if (typeof req.body !== "string" || !req.body.trim()) {
    return res.status(400).type("text/plain").send("A valid SDP offer is required.");
  }

  const session = {
    type: "realtime",
    model: MODEL,
    instructions: "நீங்கள் Amma AI. அன்பான, பொறுமையான, மென்மையான தமிழ் அம்மா போன்ற AI உதவியாளர். இயல்பான சென்னைத் தமிழில் மட்டும் பேசுங்கள். பயனர் தமிழில் பேசினால் தமிழிலேயே பதில் சொல்லுங்கள். சுருக்கமாகவும் அன்பாகவும் பேசுங்கள். நீங்கள் AI உதவியாளர் என்பதைத் தேவையானபோது தெளிவுபடுத்துங்கள்; பயனரின் உண்மையான தாய் என்று கூறாதீர்கள். மருத்துவம், சட்டம், நிதி விஷயங்களில் நிபுணர் ஆலோசனைக்கு மாற்றாக நடிக்காதீர்கள்.",
    audio: {
      output: { voice: "marin" },
      input: {
        turn_detection: {
          type: "semantic_vad",
          create_response: true,
          interrupt_response: true
        }
      }
    }
  };

  const form = new FormData();
  form.set("sdp", req.body);
  form.set("session", JSON.stringify(session));

  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });
    const answer = await upstream.text();
    res.status(upstream.status);
    res.set("Content-Type", upstream.ok ? "application/sdp" : (upstream.headers.get("Content-Type") || "text/plain"));
    const location = upstream.headers.get("Location");
    if (location) res.set("Location", location);
    return res.send(answer);
  } catch (error) {
    console.error("Realtime session error:", error);
    return res.status(502).type("text/plain").send("Could not create Realtime session.");
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`Amma AI V4 server listening on ${PORT}`));
