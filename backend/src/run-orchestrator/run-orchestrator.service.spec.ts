import { RunOrchestratorService } from './run-orchestrator.service';

describe('RunOrchestratorService', () => {
  const service = new RunOrchestratorService(
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );

  it('filters to smoke categories only', () => {
    const plans = [
      {
        endpoint: '/pet',
        method: 'POST',
        tests: [
          { category: 'auth', isSkipped: false },
          { category: 'happy-path', isSkipped: false },
          { category: 'body', isSkipped: false },
          { category: 'boundary', isSkipped: true },
        ],
      },
    ] as any;

    const filtered = service.applyRunProfile(plans, 'smoke');
    expect(filtered[0].tests).toHaveLength(3);
    expect(filtered[0].tests.map((t: any) => t.category)).toEqual([
      'auth',
      'happy-path',
      'boundary',
    ]);
  });

  it('leaves plans unchanged for full profile', () => {
    const plans = [{ endpoint: '/x', method: 'GET', tests: [{ category: 'body' }] }] as any;
    expect(service.applyRunProfile(plans, 'full')).toBe(plans);
  });
});
