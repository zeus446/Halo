import { ToolDecorator as Tool, Widget, ExecutionContext, z } from '@nitrostack/core';

type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

type SmsDispatchResult = {
  ok: boolean;
  to: string;
  status?: string;
  sid?: string;
  error?: string;
};

export class SeizureTools {
  private buildCaregiverAlert(riskLevel: RiskLevel, probability: number, patientId = 'unknown-patient') {
    const triggered = probability >= 0.65;

    return {
      triggered,
      alertType: 'caregiver',
      patientId,
      riskLevel,
      probability,
      recipients: ['Emergency Caregiver', 'Primary Physician', 'On-Call Nurse'],
      message: `Seizure risk ${riskLevel} detected for patient ${patientId}. Estimated probability: ${(probability * 100).toFixed(1)}%.`,
      timestamp: new Date().toISOString(),
    };
  }

  private async sendCaregiverSms(patientId: string, riskLevel: RiskLevel, probability: number, latitude?: number, longitude?: number): Promise<SmsDispatchResult[]> {
    const rawRecipients = (process.env.TELEGRAM_CHAT_IDS ?? process.env.TELEGRAM_CHAT_ID ?? '').split(',').map((value) => value.trim()).filter(Boolean);

    if (rawRecipients.length === 0) {
      return [];
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return rawRecipients.map((to) => ({ ok: false, to, error: 'Telegram bot token not configured' }));
    }

    const locationText = latitude !== undefined && longitude !== undefined ? ` Location: ${latitude}, ${longitude}.` : '';
    const messageBody = `Seizure alert for patient ${patientId}: risk level ${riskLevel} (${(probability * 100).toFixed(1)}%).${locationText} Please check on the patient immediately.`;

    const results = await Promise.all(
      rawRecipients.map(async (to) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: to,
              text: messageBody,
              disable_web_page_preview: true,
            }),
          });

          const data = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            description?: string;
            result?: { message_id?: number };
          };

          if (!response.ok || data.ok === false) {
            return {
              ok: false,
              to,
              status: String(response.status),
              error: data.description ?? 'Telegram message send failed',
            };
          }

          return {
            ok: true,
            to,
            status: 'sent',
            sid: data.result?.message_id !== undefined ? String(data.result.message_id) : undefined,
          };
        } catch (error) {
          return {
            ok: false,
            to,
            error: error instanceof Error ? error.message : 'Unknown Telegram delivery error',
          };
        }
      }),
    );

    return results;
  }

  @Tool({
    name: 'predict_seizure_risk',
    description: 'Predicts seizure probability using smartwatch sensor telemetry and emits a caregiver alert when warranted.',
    inputSchema: z.object({
      patientId: z.string().optional().describe('Optional patient identifier used when sending caregiver alerts'),
      heartRate: z.number().describe('Heart rate in BPM'),
      eda: z.number().describe('Electrodermal activity (EDA / GSR)'),
      motionMagnitude: z.number().describe('Calculated 3-axis acceleration magnitude'),
    }),
  })
  @Widget('seizure-risk-result')
  async predictSeizureRisk(input: { patientId?: string; heartRate: number; eda: number; motionMagnitude: number }, ctx: ExecutionContext) {
    const { patientId, heartRate, eda, motionMagnitude } = input;
    const highHR = heartRate > 110;
    const highEDA = eda > 2.5;
    const abnormalMotion = motionMagnitude > 2.5;

    let riskLevel: RiskLevel = 'LOW';
    let probability = 0.05;

    if (highHR && highEDA && abnormalMotion) {
      riskLevel = 'CRITICAL';
      probability = 0.92;
    } else if (highHR && highEDA) {
      riskLevel = 'HIGH';
      probability = 0.68;
    } else if (highEDA || abnormalMotion) {
      riskLevel = 'MODERATE';
      probability = 0.35;
    }

    const caregiverAlert = this.buildCaregiverAlert(riskLevel, probability, patientId ?? 'unknown-patient');
    const smsResults = caregiverAlert.triggered
      ? await this.sendCaregiverSms(patientId ?? 'unknown-patient', riskLevel, probability)
      : [];

    ctx.logger.info('Seizure risk evaluated', {
      patientId,
      heartRate,
      eda,
      motionMagnitude,
      riskLevel,
      probability,
      caregiverAlert,
      smsResults,
    });

    return {
      timestamp: new Date().toISOString(),
      riskLevel,
      probability,
      heartRate,
      eda,
      motionMagnitude,
      alertRequired: caregiverAlert.triggered,
      caregiverAlert: {
        ...caregiverAlert,
        sms: {
          enabled: smsResults.length > 0,
          sent: smsResults.filter((result) => result.ok).length,
          failed: smsResults.filter((result) => !result.ok).length,
          results: smsResults,
        },
      },
    };
  }

  @Tool({
    name: 'trigger_emergency_alert',
    description: 'Triggers emergency notifications and broadcasts patient location to caregivers.',
    inputSchema: z.object({
      patientId: z.string().describe('Unique identifier for the patient'),
      riskLevel: z.string().describe('Current risk level (e.g., CRITICAL, HIGH)'),
      latitude: z.number().optional().describe('Patient GPS latitude'),
      longitude: z.number().optional().describe('Patient GPS longitude'),
    }),
  })
  @Widget('emergency-alert-result')
  async triggerEmergencyAlert(
    input: { patientId: string; riskLevel: string; latitude?: number; longitude?: number },
    ctx: ExecutionContext,
  ) {
    const alertId = `ALT-${Math.floor(100000 + Math.random() * 900000)}`;
    const riskLevel = (input.riskLevel.toUpperCase() as RiskLevel) || 'HIGH';
    const smsResults = await this.sendCaregiverSms(input.patientId, riskLevel, 0.9, input.latitude, input.longitude);

    ctx.logger.warn('Caregiver emergency alert dispatched', {
      patientId: input.patientId,
      riskLevel: input.riskLevel,
      alertId,
      latitude: input.latitude,
      longitude: input.longitude,
      smsResults,
    });

    return {
      success: true,
      alertId,
      timestamp: new Date().toISOString(),
      status: 'DISPATCHED',
      notifiedContacts: ['Emergency Caregiver', 'Primary Physician', 'On-Call Nurse'],
      locationAttached: input.latitude !== undefined && input.longitude !== undefined,
      sms: {
        enabled: smsResults.length > 0,
        sent: smsResults.filter((result) => result.ok).length,
        failed: smsResults.filter((result) => !result.ok).length,
        results: smsResults,
      },
    };
  }
}