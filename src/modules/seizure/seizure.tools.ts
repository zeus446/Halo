import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';

export class SeizureTools {
  @Tool({
    name: 'predict_seizure_risk',
    description: 'Predicts seizure probability using smartwatch sensor telemetry.',
    inputSchema: z.object({
      heartRate: z.number().describe('Heart rate in BPM'),
      eda: z.number().describe('Electrodermal activity (EDA / GSR)'),
      motionMagnitude: z.number().describe('Calculated 3-axis acceleration magnitude'),
    }),
  })
  async predictSeizureRisk(input: any, ctx: ExecutionContext) {
    const { heartRate, eda, motionMagnitude } = input;
    const highHR = heartRate > 110;
    const highEDA = eda > 2.5;
    const abnormalMotion = motionMagnitude > 2.5;

    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
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

    ctx.logger.info('Seizure risk evaluated', {
      heartRate,
      eda,
      motionMagnitude,
      riskLevel,
      probability,
    });

    return {
      timestamp: new Date().toISOString(),
      riskLevel,
      probability,
      alertRequired: probability >= 0.65,
    };
  }
}