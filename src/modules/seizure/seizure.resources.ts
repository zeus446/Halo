import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';

export class SeizureResources {
  @Resource({
    uri: 'seizure://status',
    name: 'Seizure Monitor System Status',
    description: 'Current status for the seizure monitoring system',
    mimeType: 'application/json',
    examples: {
      response: {
        status: 'ACTIVE',
        connectedDevice: 'Smartwatch Gen 3',
        batteryLevel: '88%',
        lastSync: new Date().toISOString(),
      },
    },
  })
  async getStatus(uri: string, ctx: ExecutionContext) {
    ctx.logger.info('Fetching seizure system status');

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          status: 'ACTIVE',
          connectedDevice: 'Smartwatch Gen 3',
          batteryLevel: '88%',
          lastSync: new Date().toISOString(),
        }, null, 2),
      }],
    };
  }
}
