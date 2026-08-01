import express from 'express';
import type { Response } from 'express';
import 'dotenv/config';

const app = express();

// Increase JSON payload limit because Sensor Logger sends batched sensor arrays
app.use(express.json({ limit: '10mb' }));

// Enable CORS for React UI
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// SSE Connected UI Clients Pool
let sseClients: Response[] = [];

// Telegram Config
const token = process.env.TELEGRAM_BOT_TOKEN || '8665069056:AAHuJVQqQSWAXu8wsiUfIp8ciajjc8AbaBg';
const chatId = process.env.TELEGRAM_CHAT_ID || '8613811117';

// -------------------------------------------------------------
// 1. REAL-TIME SSE STREAM ENDPOINT FOR REACT UI
// -------------------------------------------------------------
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  console.log(`💻 UI Connected to Live Stream! Active Clients: ${sseClients.length}`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`🔌 UI Disconnected. Active Clients: ${sseClients.length}`);
  });
});

function broadcastToUI(payload: object) {
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
  });
}

// Helper: Telegram Dispatcher
async function sendTelegramAlert(text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (err) {
    console.error('❌ Telegram Send Error:', err);
  }
}

// -------------------------------------------------------------
// 2. INGESTION ENDPOINT (PARSES SENSOR LOGGER & CUSTOM PAYLOADS)
// -------------------------------------------------------------
app.post('/api/telemetry', async (req, res) => {
  const body = req.body;

  let accelX = 0, accelY = 0, accelZ = 0.98;
  let heartRate = 75;
  let hrv = 50;
  let eda = 1.2;
  let sleepScore = 65;

  // A. PARSE SENSOR LOGGER PAYLOAD FORMAT
  if (body.payload && Array.isArray(body.payload)) {
    for (const sensorEntry of body.payload) {
      const name = sensorEntry.name;
      const values = sensorEntry.values;

      if (name === 'accelerometer' && values) {
        // Take latest accelerometer readings from array
        const latest = Array.isArray(values) ? values[values.length - 1] : values;
        accelX = latest.x || latest[0] || 0;
        accelY = latest.y || latest[1] || 0;
        accelZ = latest.z || latest[2] || 0.98;
      }

      if ((name === 'heart_rate' || name === 'wrist_heart_rate') && values) {
        const latest = Array.isArray(values) ? values[values.length - 1] : values;
        heartRate = latest.bpm || latest.value || latest[0] || heartRate;
      }
    }
  } 
  // B. PARSE STANDARD / SYNTHETIC JSON FORMAT
  else {
    accelX = body.accelX ?? 0;
    accelY = body.accelY ?? 0;
    accelZ = body.accelZ ?? 0.98;
    heartRate = body.heartRate ?? 75;
    hrv = body.hrv ?? 50;
    eda = body.eda ?? 1.2;
    sleepScore = body.sleepScore ?? 65;
  }

  // Calculate Kinetic Motion Magnitude
  const motionMagnitude = Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2);

  // Compute Seizure Risk Score
  let riskScore = 0;
  const riskFactors: string[] = [];

  if (motionMagnitude > 2.8) {
    riskScore += 50;
    riskFactors.push(`Convulsive Kinetic Movement (${motionMagnitude.toFixed(2)}g)`);
  }

  if (hrv < 25) {
    riskScore += 30;
    riskFactors.push(`Vagal HRV Collapse (${hrv}ms)`);
  }

  if (heartRate > 100 && motionMagnitude < 1.4) {
    riskScore += 25;
    riskFactors.push(`Resting Tachycardia Surge (${heartRate} BPM)`);
  }

  if (eda > 4.5) {
    riskScore += 20;
    riskFactors.push(`Galvanic Skin Response Spike (${eda}µS)`);
  }

  riskScore = Math.min(100, riskScore);

  let prediction: 'NORMAL' | 'ACTIVE' | 'PRE-ICTAL' | 'ACUTE_SEIZURE' = 'NORMAL';
  if (motionMagnitude > 2.8) prediction = 'ACUTE_SEIZURE';
  else if (riskScore >= 45 || hrv < 25) prediction = 'PRE-ICTAL';
  else if (motionMagnitude > 1.5 || heartRate > 90) prediction = 'ACTIVE';

  const processedPayload = {
    heartRate: Math.round(heartRate),
    hrv,
    eda,
    motionMagnitude,
    riskScore,
    prediction,
    riskFactors
  };

  console.log(`📱 Stream Received -> HR: ${processedPayload.heartRate} BPM | Risk: ${riskScore}% | State: [${prediction}]`);

  // Broadcast to React UI
  broadcastToUI(processedPayload);

  // Dispatch alert on high risk
  if (riskScore >= 70 && prediction === 'PRE-ICTAL') {
    sendTelegramAlert(`⚠️ *HIGH RISK PRE-ICTAL ALERT*\n\nRisk: ${riskScore}%\nState: ${prediction}`);
  }

  res.status(200).json({ status: 'success', data: processedPayload });
});

app.listen(4000, '0.0.0.0', () => {
  console.log('📡 Telemetry Engine live on port 4000!');
});