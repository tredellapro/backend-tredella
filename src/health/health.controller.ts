import { Controller, Get } from '@nestjs/common';

/* Serverless hosts have no long-lived connections, so subscriptions and disk
   uploads are unavailable there. `realtime` tells the clients which it is. */
const realtime = (): boolean => !process.env.VERCEL;

@Controller()
export class HealthController {
  /** Opening the API in a browser should explain itself, not 404. */
  @Get()
  index(): Record<string, unknown> {
    return {
      name: 'Tredella marketplace API',
      graphql: '/graphql (POST)',
      health: '/health',
      realtime: realtime(),
    };
  }

  @Get('health')
  health(): { ok: boolean; realtime: boolean } {
    return { ok: true, realtime: realtime() };
  }
}
