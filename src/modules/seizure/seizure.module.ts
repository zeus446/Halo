import { Module } from '@nitrostack/core';
import { SeizureTools } from './seizure.tools.js';
import { SeizureResources } from './seizure.resources.js';

@Module({
  name: 'seizure',
  description: 'Seizure monitoring and alerting module',
  controllers: [SeizureTools, SeizureResources],
})
export class SeizureModule {}