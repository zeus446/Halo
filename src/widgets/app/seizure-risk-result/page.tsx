'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme, useWidgetState, useWidgetSDK, prefersReducedMotion } from '@nitrostack/widgets';

/**
 * Seizure Risk Result Widget
 *
 * Primary data source is the snapshot returned by `predict_seizure_risk`.
 * On top of that, this widget can also track CONTINUOUS input two ways:
 *
 *  1. LIVE — if a Server-Sent Events endpoint is reachable (e.g. the
 *     `/api/stream` broadcaster in `src/ingest.ts`), each event updates the
 *     gauge in place without a new tool call.
 *  2. TEST MODE — press Ctrl+Shift+T to simulate a continuous stream of
 *     readings locally, so continuous-input handling can be verified
 *     without a live backend running. Press again to stop.
 *
 * Whichever live/test reading arrived most recently takes priority over the
 * static tool-call snapshot; if neither is active, the snapshot is shown.
 */

interface SmsResult {
  ok: boolean;
  to: string;
  status?: string;
  sid?: string;
  error?: string;
}

interface SeizureRiskData {
  timestamp: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  probability: number;
  alertRequired: boolean;
  heartRate?: number;
  eda?: number;
  motionMagnitude?: number;
  caregiverAlert: {
    triggered: boolean;
    patientId: string;
    recipients: string[];
    message: string;
    sms: {
      enabled: boolean;
      sent: number;
      failed: number;
      results: SmsResult[];
    };
  };
}

const RISK_STYLES: Record<string, { color: string; ink: string; label: string }> = {
  LOW: { color: '#2F9E6E', ink: '#0F3D2C', label: 'Low' },
  MODERATE: { color: '#C68A1D', ink: '#4A340A', label: 'Moderate' },
  HIGH: { color: '#D9622B', ink: '#4A210C', label: 'High' },
  CRITICAL: { color: '#C23B4E', ink: '#4A0F17', label: 'Critical' },
};

const EMPTY_ALERT = {
  triggered: false,
  patientId: 'unknown-patient',
  recipients: [] as string[],
  message: '',
  sms: { enabled: false, sent: 0, failed: 0, results: [] as SmsResult[] },
};

// Maps the raw telemetry payload shape broadcast by src/ingest.ts
// ({ heartRate, hrv, eda, motionMagnitude, riskScore, prediction, riskFactors })
// onto the widget's SeizureRiskData shape.
function fromTelemetryPayload(raw: any, previousAlert: SeizureRiskData['caregiverAlert']): SeizureRiskData {
  const predictionToRisk: Record<string, SeizureRiskData['riskLevel']> = {
    NORMAL: 'LOW',
    ACTIVE: 'MODERATE',
    'PRE-ICTAL': 'HIGH',
    ACUTE_SEIZURE: 'CRITICAL',
  };
  const riskLevel = predictionToRisk[raw.prediction] ?? 'LOW';
  const probability = typeof raw.riskScore === 'number' ? Math.max(0, Math.min(1, raw.riskScore / 100)) : 0;

  return {
    timestamp: new Date().toISOString(),
    riskLevel,
    probability,
    alertRequired: probability >= 0.65,
    heartRate: raw.heartRate,
    eda: raw.eda,
    motionMagnitude: typeof raw.motionMagnitude === 'number' ? Number(raw.motionMagnitude.toFixed(2)) : raw.motionMagnitude,
    caregiverAlert: previousAlert,
  };
}

function synthesizeTestReading(previousAlert: SeizureRiskData['caregiverAlert']): SeizureRiskData {
  const cycle: SeizureRiskData['riskLevel'][] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'HIGH', 'MODERATE'];
  const level = cycle[Math.floor(Date.now() / 1400) % cycle.length];
  const base = { LOW: 0.08, MODERATE: 0.4, HIGH: 0.7, CRITICAL: 0.93 }[level];
  const probability = Math.max(0, Math.min(1, base + (Math.random() - 0.5) * 0.08));
  return {
    timestamp: new Date().toISOString(),
    riskLevel: level,
    probability,
    alertRequired: probability >= 0.65,
    heartRate: Math.round(72 + probability * 70 + (Math.random() - 0.5) * 6),
    eda: Number((1 + probability * 3.5 + (Math.random() - 0.5) * 0.3).toFixed(2)),
    motionMagnitude: Number((0.6 + probability * 3.2 + (Math.random() - 0.5) * 0.3).toFixed(2)),
    caregiverAlert: previousAlert,
  };
}

function ArcGauge({ probability, color, isDark }: { probability: number; color: string; isDark: boolean }) {
  const pct = Math.max(0, Math.min(1, probability));
  const radius = 78;
  const cx = 100;
  const cy = 100;
  const startAngle = 180;
  const endAngle = 0;
  const sweep = startAngle - (startAngle - endAngle) * pct;

  const toXY = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  };

  const start = toXY(startAngle);
  const end = toXY(sweep);
  const largeArc = startAngle - sweep > 180 ? 1 : 0;

  const trackStart = toXY(180);
  const trackEnd = toXY(0);

  return (
    <svg viewBox="0 0 200 118" width="220" height="130" role="img" aria-label={`Seizure risk probability ${(pct * 100).toFixed(0)} percent`}>
      <path
        d={`M ${trackStart.x} ${trackStart.y} A ${radius} ${radius} 0 1 1 ${trackEnd.x} ${trackEnd.y}`}
        fill="none"
        stroke={isDark ? '#2A2F3A' : '#E3E6EB'}
        strokeWidth={14}
        strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
        />
      )}
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const angle = 180 - 180 * tick;
        const inner = toXY(angle);
        const rad = (angle * Math.PI) / 180;
        const outer = { x: cx + (radius + 10) * Math.cos(rad), y: cy - (radius + 10) * Math.sin(rad) };
        return (
          <line
            key={tick}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={isDark ? '#3A404C' : '#C8CDD6'}
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

export default function SeizureRiskResult() {
  const theme = useTheme();
  const { getToolOutput } = useWidgetSDK();
  const [state, setState] = useWidgetState<{ showRecipients: boolean }>(() => ({ showRecipients: false }));
  const snapshot = getToolOutput<SeizureRiskData>();
  const reduceMotion = prefersReducedMotion();

  // Continuous-input state: whichever of these is set most recently wins
  // over the static tool-call snapshot.
  const [liveReading, setLiveReading] = useState<SeizureRiskData | null>(null);
  const [connMode, setConnMode] = useState<'snapshot' | 'live' | 'test'>('snapshot');
  const testTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAlertRef = useRef(EMPTY_ALERT);

  useEffect(() => {
    if (snapshot?.caregiverAlert) lastAlertRef.current = snapshot.caregiverAlert;
  }, [snapshot]);

  // 1. Try to attach to a live SSE telemetry stream, if one is reachable.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return;
    const streamUrl = (process.env.NEXT_PUBLIC_TELEMETRY_STREAM_URL as string | undefined) || '/api/stream';

    let source: EventSource | null = null;
    try {
      source = new EventSource(streamUrl);
    } catch {
      return;
    }

    source.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        setLiveReading(fromTelemetryPayload(raw, lastAlertRef.current));
        setConnMode((mode) => (mode === 'test' ? mode : 'live'));
      } catch {
        // ignore malformed frames
      }
    };
    source.onerror = () => {
      setConnMode((mode) => (mode === 'live' ? 'snapshot' : mode));
    };

    return () => source?.close();
  }, []);

  // 2. Ctrl+Shift+T toggles a local synthetic continuous-input test.
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (testTimerRef.current) {
          clearInterval(testTimerRef.current);
          testTimerRef.current = null;
          setConnMode('snapshot');
          setLiveReading(null);
        } else {
          setConnMode('test');
          setLiveReading(synthesizeTestReading(lastAlertRef.current));
          testTimerRef.current = setInterval(() => {
            setLiveReading(synthesizeTestReading(lastAlertRef.current));
          }, 1400);
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (testTimerRef.current) clearInterval(testTimerRef.current);
    };
  }, []);

  const isDark = theme === 'dark';
  const bg = isDark ? '#12151B' : '#F6F7F9';
  const cardBg = isDark ? '#1B1F27' : '#FFFFFF';
  const border = isDark ? '#2A2F3A' : '#E3E6EB';
  const ink = isDark ? '#EDEFF3' : '#131722';
  const muted = isDark ? 'rgba(237,239,243,0.62)' : 'rgba(19,23,34,0.6)';
  const mono = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";
  const sans = "'Inter', system-ui, -apple-system, sans-serif";

  const data = liveReading ?? snapshot;

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: muted, fontFamily: sans, background: bg }}>
        Reading telemetry… <span style={{ display: 'block', fontSize: 11, marginTop: 6 }}>(Ctrl+Shift+T to simulate a stream)</span>
      </div>
    );
  }

  const risk = RISK_STYLES[data.riskLevel] ?? RISK_STYLES.LOW;
  const pctLabel = `${(data.probability * 100).toFixed(0)}%`;
  const vitals = [
    data.heartRate !== undefined ? { label: 'Heart rate', value: `${data.heartRate}`, unit: 'bpm' } : null,
    data.eda !== undefined ? { label: 'EDA', value: `${data.eda}`, unit: 'µS' } : null,
    data.motionMagnitude !== undefined ? { label: 'Motion', value: `${data.motionMagnitude}`, unit: 'g' } : null,
  ].filter(Boolean) as { label: string; value: string; unit: string }[];

  return (
    <div
      style={{
        fontFamily: sans,
        background: bg,
        padding: 20,
        borderRadius: 18,
        maxWidth: 420,
        color: ink,
      }}
    >
      {!reduceMotion && (
        <style>{`
          @keyframes halo-live-pulse {
            0% { opacity: 1; }
            50% { opacity: 0.35; }
            100% { opacity: 1; }
          }
        `}</style>
      )}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: 16,
          padding: '20px 22px 18px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, fontFamily: mono }}>
            Seizure Monitor
          </span>
          <span style={{ fontSize: 11, color: muted, fontFamily: mono }}>
            {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: muted }}>
            Patient <strong style={{ color: ink }}>{lastAlertRef.current.patientId}</strong>
          </span>
          {connMode === 'live' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: '#2F9E6E' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2F9E6E', animation: reduceMotion ? 'none' : 'halo-live-pulse 1.6s ease-in-out infinite' }} />
              LIVE
            </span>
          )}
          {connMode === 'test' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: '#C68A1D' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C68A1D', animation: reduceMotion ? 'none' : 'halo-live-pulse 1.6s ease-in-out infinite' }} />
              TEST MODE
            </span>
          )}
        </div>

        {/* Gauge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0 8px' }}>
          <ArcGauge probability={data.probability} color={risk.color} isDark={isDark} />
          <div style={{ marginTop: -34, textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, fontFamily: mono, color: risk.color, lineHeight: 1 }}>
              {pctLabel}
            </div>
            <div
              style={{
                marginTop: 6,
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: risk.color,
                background: isDark ? `${risk.color}22` : `${risk.color}18`,
                border: `1px solid ${risk.color}55`,
              }}
            >
              {risk.label} risk
            </div>
          </div>
        </div>

        {/* Vitals */}
        {vitals.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {vitals.map((v) => (
              <div
                key={v.label}
                style={{
                  flex: 1,
                  background: isDark ? '#161A21' : '#F6F7F9',
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {v.label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, fontFamily: mono }}>
                  {v.value}
                  <span style={{ fontSize: 10, color: muted, marginLeft: 2 }}>{v.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alert status */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px dashed ${border}`,
          }}
        >
          {data.alertRequired ? (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: ink }}>
                {data.caregiverAlert.message || `Seizure risk ${risk.label.toUpperCase()} detected. Estimated probability: ${pctLabel}.`}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: muted }}>
                  {data.caregiverAlert.sms.enabled
                    ? `SMS: ${data.caregiverAlert.sms.sent} sent${data.caregiverAlert.sms.failed ? `, ${data.caregiverAlert.sms.failed} failed` : ''}`
                    : connMode === 'snapshot'
                      ? 'SMS delivery not configured'
                      : 'Awaiting caregiver dispatch'}
                </span>
                {data.caregiverAlert.recipients.length > 0 && (
                  <button
                    onClick={() => setState({ showRecipients: !state?.showRecipients })}
                    style={{
                      fontSize: 11,
                      color: risk.color,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    {state?.showRecipients ? 'Hide recipients' : 'Show recipients'}
                  </button>
                )}
              </div>
              {state?.showRecipients && data.caregiverAlert.recipients.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: muted }}>
                  {data.caregiverAlert.recipients.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: muted }}>No caregiver alert triggered at this reading.</div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 10, color: muted, textAlign: 'right' }}>
          Ctrl+Shift+T to {connMode === 'test' ? 'stop' : 'simulate'} a live stream
        </div>
      </div>
    </div>
  );
}
