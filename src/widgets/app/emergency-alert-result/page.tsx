'use client';

import { useTheme, useWidgetSDK } from '@nitrostack/widgets';

/**
 * Emergency Alert Result Widget
 *
 * Displays the output of `trigger_emergency_alert`: a dispatch confirmation
 * ticket with the alert ID, notified contacts, and per-recipient SMS status.
 */

interface SmsResult {
  ok: boolean;
  to: string;
  status?: string;
  sid?: string;
  error?: string;
}

interface EmergencyAlertData {
  success: boolean;
  alertId: string;
  timestamp: string;
  status: string;
  notifiedContacts: string[];
  locationAttached: boolean;
  sms: {
    enabled: boolean;
    sent: number;
    failed: number;
    results: SmsResult[];
  };
}

export default function EmergencyAlertResult() {
  const theme = useTheme();
  const { getToolOutput } = useWidgetSDK();
  const data = getToolOutput<EmergencyAlertData>();

  const isDark = theme === 'dark';
  const bg = isDark ? '#12151B' : '#F6F7F9';
  const cardBg = isDark ? '#1B1F27' : '#FFFFFF';
  const border = isDark ? '#2A2F3A' : '#E3E6EB';
  const ink = isDark ? '#EDEFF3' : '#131722';
  const muted = isDark ? 'rgba(237,239,243,0.62)' : 'rgba(19,23,34,0.6)';
  const mono = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";
  const sans = "'Inter', system-ui, -apple-system, sans-serif";
  const seal = '#C23B4E';

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: muted, fontFamily: sans, background: bg }}>
        Dispatching…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: sans, background: bg, padding: 20, borderRadius: 18, maxWidth: 420, color: ink }}>
      <div
        style={{
          position: 'relative',
          background: cardBg,
          border: `1px solid ${border}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {/* Ticket header */}
        <div style={{ padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, fontFamily: mono }}>
              Emergency Dispatch
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: mono }}>{data.alertId}</div>
          </div>

          {/* Stamp seal */}
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              border: `2.5px solid ${seal}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(-9deg)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.03em',
                color: seal,
                textAlign: 'center',
                lineHeight: 1.15,
                fontFamily: mono,
              }}
            >
              {data.status}
            </span>
          </div>
        </div>

        {/* Perforation divider */}
        <div style={{ position: 'relative', height: 1 }}>
          <div
            style={{
              borderTop: `1.5px dashed ${border}`,
              margin: '0 0',
            }}
          />
          <div style={{ position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: '50%', background: bg }} />
          <div style={{ position: 'absolute', right: -9, top: -9, width: 18, height: 18, borderRadius: '50%', background: bg }} />
        </div>

        <div style={{ padding: '16px 22px 20px' }}>
          <div style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
            {new Date(data.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            {data.locationAttached && (
              <span
                style={{
                  marginLeft: 8,
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: isDark ? '#8FB8FF' : '#2A5FBF',
                  background: isDark ? '#8FB8FF1A' : '#2A5FBF14',
                }}
              >
                Location attached
              </span>
            )}
          </div>

          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: muted, marginBottom: 6 }}>
            Notified contacts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {data.notifiedContacts.map((contact) => (
              <div key={contact} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: seal, flexShrink: 0 }} />
                {contact}
              </div>
            ))}
          </div>

          {data.sms.enabled ? (
            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: muted, marginBottom: 8 }}>
                <span>SMS delivery</span>
                <span>
                  {data.sms.sent} sent{data.sms.failed ? `, ${data.sms.failed} failed` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.sms.results.map((r) => (
                  <div
                    key={r.to}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      fontFamily: mono,
                      padding: '5px 8px',
                      borderRadius: 8,
                      background: isDark ? '#161A21' : '#F6F7F9',
                    }}
                  >
                    <span>{r.to}</span>
                    <span style={{ color: r.ok ? '#2F9E6E' : seal, fontWeight: 600 }}>
                      {r.ok ? 'delivered' : r.error ?? 'failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: muted, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
              SMS delivery not configured for this alert.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
