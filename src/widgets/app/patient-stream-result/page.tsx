'use client';

import { useTheme, useWidgetSDK } from '@nitrostack/widgets';
import { prefersReducedMotion } from '@nitrostack/widgets';

/**
 * Patient Stream Result Widget
 *
 * Displays the output of `list_patient_stream`: a live roster of monitored
 * patients — unique ID, name, and current risk status — sorted by severity.
 */

interface StreamPatient {
  patientId: string;
  name: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  probability: number;
  lastUpdate: string;
}

interface PatientStreamData {
  generatedAt: string;
  count: number;
  patients: StreamPatient[];
}

const RISK_STYLES: Record<string, { color: string; label: string; order: number }> = {
  CRITICAL: { color: '#C23B4E', label: 'Critical', order: 0 },
  HIGH: { color: '#D9622B', label: 'High', order: 1 },
  MODERATE: { color: '#C68A1D', label: 'Moderate', order: 2 },
  LOW: { color: '#2F9E6E', label: 'Low', order: 3 },
};

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function PatientStreamResult() {
  const theme = useTheme();
  const { getToolOutput, callTool, isReady } = useWidgetSDK();
  const data = getToolOutput<PatientStreamData>();
  const reduceMotion = prefersReducedMotion();

  const isDark = theme === 'dark';
  const bg = isDark ? '#12151B' : '#F6F7F9';
  const cardBg = isDark ? '#1B1F27' : '#FFFFFF';
  const rowBg = isDark ? '#161A21' : '#FAFBFC';
  const border = isDark ? '#2A2F3A' : '#E3E6EB';
  const ink = isDark ? '#EDEFF3' : '#131722';
  const muted = isDark ? 'rgba(237,239,243,0.62)' : 'rgba(19,23,34,0.6)';
  const mono = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";
  const sans = "'Inter', system-ui, -apple-system, sans-serif";

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: muted, fontFamily: sans, background: bg }}>
        Connecting to stream…
      </div>
    );
  }

  const sorted = [...data.patients].sort(
    (a, b) => (RISK_STYLES[a.riskLevel]?.order ?? 9) - (RISK_STYLES[b.riskLevel]?.order ?? 9),
  );

  const counts = sorted.reduce<Record<string, number>>((acc, p) => {
    acc[p.riskLevel] = (acc[p.riskLevel] ?? 0) + 1;
    return acc;
  }, {});

  const refresh = () => {
    if (!isReady) return;
    callTool('list_patient_stream', {}).catch(() => {});
  };

  return (
    <div style={{ fontFamily: sans, background: bg, padding: 20, borderRadius: 18, maxWidth: 440, color: ink }}>
      {!reduceMotion && (
        <style>{`
          @keyframes halo-pulse {
            0% { box-shadow: 0 0 0 0 var(--pulse-color, rgba(47,158,110,0.55)); }
            70% { box-shadow: 0 0 0 6px rgba(0,0,0,0); }
            100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
          }
        `}</style>
      )}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, fontFamily: mono }}>
              Live Patient Stream
            </div>
            <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>
              {data.count} patient{data.count === 1 ? '' : 's'} monitored
            </div>
          </div>
          <button
            onClick={refresh}
            title="Refresh"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid ${border}`,
              background: 'transparent',
              color: muted,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ↻
          </button>
        </div>

        {/* Risk summary chips */}
        <div style={{ display: 'flex', gap: 6, padding: '0 18px 12px', flexWrap: 'wrap' }}>
          {Object.entries(RISK_STYLES).map(([level, style]) =>
            counts[level] ? (
              <span
                key={level}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: style.color,
                  background: isDark ? `${style.color}22` : `${style.color}18`,
                  border: `1px solid ${style.color}55`,
                  borderRadius: 999,
                  padding: '2px 9px',
                }}
              >
                {counts[level]} {style.label}
              </span>
            ) : null,
          )}
        </div>

        {/* Roster */}
        <div style={{ borderTop: `1px solid ${border}` }}>
          {sorted.map((p) => {
            const style = RISK_STYLES[p.riskLevel] ?? RISK_STYLES.LOW;
            return (
              <div
                key={p.patientId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 18px',
                  borderBottom: `1px solid ${border}`,
                  background: rowBg,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: isDark ? '#232833' : '#EDEFF3',
                    color: muted,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {initials(p.name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: muted, fontFamily: mono }}>{p.patientId}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span
                    style={
                      {
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: style.color,
                        animation: reduceMotion ? 'none' : 'halo-pulse 2s ease-out infinite',
                        ['--pulse-color' as any]: `${style.color}88`,
                      } as React.CSSProperties
                    }
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      color: style.color,
                    }}
                  >
                    {style.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '8px 18px', fontSize: 10.5, color: muted, textAlign: 'right' }}>
          Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
