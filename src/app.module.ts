import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { SeizureModule } from './modules/seizure/seizure.module.js';
import { SystemHealthCheck } from './health/system.health.js';

/**
 * Root Application Module
 * 
 * This is the main module that bootstraps the MCP server.
 * It registers all feature modules and health checks for seizure monitoring.
 */
@McpApp({
  module: AppModule,
  server: {
    name: 'seizure-monitor-server',
    version: '1.0.0'
  },
  logging: {
    level: 'info'
  }
})
@Module({
  name: 'app',
  description: 'Root application module for seizure detection and telemetry processing',
  imports: [
    ConfigModule.forRoot(),
    SeizureModule
  ],
  providers: [
    // Health Checks
    SystemHealthCheck,
  ]
})
export class AppModule {}