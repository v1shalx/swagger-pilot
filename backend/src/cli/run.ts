/**
 * SwaggerPilot CLI — run API audits from CI/CD
 *
 * Usage:
 *   node dist/cli/run.js --spec <swagger-url> [--base <base-url>] [--profile smoke|full]
 *     [--fail-under 80] [--out report.json] [--auth-type bearer] [--token <jwt>]
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RunOrchestratorService } from '../run-orchestrator/run-orchestrator.service';
import { RunTestsDto, AuthType } from '../swagger-parser/swagger-parser.dto';
import * as fs from 'fs';
import * as path from 'path';

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '').replace(/-/g, '_');
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

function printHelp() {
  console.log(`
SwaggerPilot CLI — automated OpenAPI audit

Required:
  --spec <url>          OpenAPI/Swagger JSON URL

Optional:
  --base <url>          API base URL override
  --profile smoke|full  smoke = auth + happy path only (default: full)
  --fail-under <n>      Exit 1 if pass rate below n% (default: 0 = disabled)
  --out <file>          Write JSON report to file
  --auth-type <type>    none|bearer|apikey|basic|autologin
  --token <value>       Bearer token or api key value
  --delay <ms>          Delay between tests (default: 100)
  --skip-ai             Skip Gemini edge cases

Example:
  node dist/cli/run.js --spec https://petstore.swagger.io/v2/swagger.json \\
    --base https://petstore.swagger.io/v2 --profile smoke --fail-under 50 --out report.json
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h || !args.spec) {
    printHelp();
    process.exit(args.spec ? 0 : 1);
  }

  const failUnder = args.fail_under ? Number(args.fail_under) : 0;
  const profile = args.profile === 'smoke' ? 'smoke' : 'full';

  const dto: RunTestsDto & { runProfile?: 'smoke' | 'full' } = {
    swaggerUrl: args.spec,
    baseUrl: args.base,
    authType: (args.auth_type as AuthType) || AuthType.NONE,
    authValue: args.token || args.auth_value,
    delayBetweenTests: args.delay ? Number(args.delay) : 100,
    skipAiGeneration: args.skip_ai === 'true' || profile === 'smoke',
    runProfile: profile,
  };

  console.log(`\n✈️  SwaggerPilot CLI`);
  console.log(`   Spec: ${dto.swaggerUrl}`);
  console.log(`   Profile: ${profile}`);
  if (dto.baseUrl) console.log(`   Base: ${dto.baseUrl}`);
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const orchestrator = app.get(RunOrchestratorService);
    const report = await orchestrator.executeRun(dto, {
      onStatus: (s) => console.log(`[${s.phase}] ${s.message}`),
      onWarning: (w) => console.warn(`⚠️  ${w}`),
      onTestResult: (r) => {
        if (r.progress && r.progress.completed % 10 === 0) {
          process.stdout.write(`\r   Progress: ${r.progress.completed}/${r.progress.total}`);
        }
      },
    });

    console.log('\n');
    console.log('════════════════════════════════════════');
    console.log(` ${report.title}`);
    console.log('════════════════════════════════════════');
    console.log(` Total:   ${report.totalTests}`);
    console.log(` Passed:  ${report.passed} (${report.passRate}%)`);
    console.log(` Failed:  ${report.failed}`);
    console.log(` Errors:  ${report.errors}`);
    console.log(` Skipped: ${report.skipped}`);
    console.log(` Time:    ${(report.durationMs / 1000).toFixed(1)}s`);
    console.log('════════════════════════════════════════\n');

    if (args.out) {
      const outPath = path.resolve(args.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log(`Report written to ${outPath}`);
    }

    let exitCode = 0;
    if (failUnder > 0 && report.passRate < failUnder) {
      console.error(`❌ Pass rate ${report.passRate}% is below threshold ${failUnder}%`);
      exitCode = 1;
    }
    if (report.failed > 0 && args.fail_on_failures === 'true') {
      exitCode = 1;
    }

    await app.close();
    process.exit(exitCode);
  } catch (err) {
    console.error(`❌ Run failed: ${err.message}`);
    await app.close();
    process.exit(1);
  }
}

main();
