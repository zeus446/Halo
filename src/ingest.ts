import express from 'express';
import 'dotenv/config';

const app = express();

app.use(express.json({ limit: '10mb' }));

const token = process.env.TELEGRAM_BOT_TOKEN || '8665069056:AAHuJVQqQSWAXu8wsiUfIp8ciajjc8AbaBg';
const chatId = process.env.TELEGRAM_CHAT_ID || '8613811117';

async function sendTelegramAlert(text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    if (response.ok) {
      console.log('📤 [Telegram] Alert dispatched successfully!');
    }
  } catch (err) {
    console.error('❌ Telegram Send Error:', err);
  }
}

app.post('/api/telemetry', async (req, res) => {
  const body = req.body;

  let accelX = 0, accelY = 0, accelZ = 0.98;
  let heartRate = 75;
  let hrv = 50;
  let eda = 1.2;

  if (body.payload && Array.isArray(body.payload)) {
    for (const sensorEntry of body.payload) {
      const name = sensorEntry.name;
      const values = sensorEntry.values;

      if (name === 'accelerometer' && values) {
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
  } else {
    accelX = body.accelX ?? 0;
    accelY = body.accelY ?? 0;
    accelZ = body.accelZ ?? 0.98;
    heartRate = body.heartRate ?? 75;
    hrv = body.hrv ?? 50;
    eda = body.eda ?? 1.2;
  }

  const motionMagnitude = Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2);

  let riskScore = 0;
  if (motionMagnitude > 2.8) riskScore += 50;
  if (hrv < 25) riskScore += 30;
  if (heartRate > 100 && motionMagnitude < 1.4) riskScore += 25;
  if (eda > 4.5) riskScore += 20;
  riskScore = Math.min(100, riskScore);

  let prediction = 'NORMAL';
  if (motionMagnitude > 2.8) prediction = 'ACUTE_SEIZURE';
  else if (riskScore >= 45 || hrv < 25) prediction = 'PRE-ICTAL';
  else if (motionMagnitude > 1.5 || heartRate > 90) prediction = 'ACTIVE';

  console.log(`📱 [Stream] HR: ${Math.round(heartRate)} BPM | Motion: ${motionMagnitude.toFixed(2)}g | Risk: ${riskScore}% | State: [${prediction}]`);

  if (riskScore >= 70 && prediction === 'PRE-ICTAL') {
    await sendTelegramAlert(`⚠️ *HIGH RISK PRE-ICTAL ALERT*\n\nRisk: ${riskScore}%\nState: ${prediction}`);
  }

  res.status(200).json({ status: 'success', data: { heartRate, motionMagnitude, riskScore, prediction } });
});

app.listen(4000, '0.0.0.0', () => {
  console.log('📡 Telemetry Engine live on port 4000!');
  console.log('\n🔴 [HOTKEY READY] Press [2] in this terminal to instantly fire a PRE-ICTAL alert (no Enter needed)!\n');
});

// Raw single-keypress hotkey handler
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}
process.stdin.resume();
process.stdin.setEncoding('utf8');

let lastTrigger = 0;
const COOLDOWN_MS = 3000;

process.stdin.on('data', async (data) => {
  const key = data.toString();

  // Ctrl+C still exits cleanly in raw mode
  if (key === '\u0003') {
    process.exit();
  }

  if (key === '2') {
    const now = Date.now();
    if (now - lastTrigger < COOLDOWN_MS) {
      console.log('⏳ Cooldown active, ignoring repeat press.');
      return;
    }
    lastTrigger = now;

    console.log(`\n🚨 [HOTKEY '2'] Simulating PRE-ICTAL emergency state...`);
    await sendTelegramAlert(
      `🚨 *SIMULATED PRE-ICTAL EMERGENCY ALERT*\n\n` +
      `Risk: 92%\n` +
      `State: PRE-ICTAL\n` +
      `Triggers: Critical Vagal HRV Collapse (12ms) & Shaking Spike (3.8g)`
    );
    console.log(`✅ Simulated Telegram Emergency Alert dispatched successfully!\n`);
  }
});