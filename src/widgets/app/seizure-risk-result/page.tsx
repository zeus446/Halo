'use client';

import { useTheme, useWidgetState, useWidgetSDK } from '@nitrostack/widgets';

/**
 * Seizure Risk Result Widget
 *
 * Displays the output of `predict_seizure_risk`: a probability dial, the
 * telemetry that drove the reading, and — when a caregiver alert fired —
 * delivery status for each recipient.
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
  const data = getToolOutput<SeizureRiskData>();

  const isDark = theme === 'dark';
  const bg = isDark ? '#12151B' : '#F6F7F9';
  const cardBg = isDark ? '#1B1F27' : '#FFFFFF';
  const border = isDark ? '#2A2F3A' : '#E3E6EB';
  const ink = isDark ? '#EDEFF3' : '#131722';
  const muted = isDark ? 'rgba(237,239,243,0.62)' : 'rgba(19,23,34,0.6)';
  const mono = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";
  const sans = "'Inter', system-ui, -apple-system, sans-serif";

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: muted, fontFamily: sans, background: bg }}>
        Reading telemetry…
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
            {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div style={{ fontSize: 13, color: muted, marginBottom: 10 }}>
          Patient <strong style={{ color: ink }}>{data.caregiverAlert?.patientId ?? 'unknown'}</strong>
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
              <div style={{ fontSize: 13, lineHeight: 1.4, color: ink }}>{data.caregiverAlert.message}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: muted }}>
                  {data.caregiverAlert.sms.enabled
                    ? `SMS: ${data.caregiverAlert.sms.sent} sent${data.caregiverAlert.sms.failed ? `, ${data.caregiverAlert.sms.failed} failed` : ''}`
                    : 'SMS delivery not configured'}
                </span>
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
              </div>
              {state?.showRecipients && (
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
      </div>
    </div>
  );
}
