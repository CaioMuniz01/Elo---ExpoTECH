import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
const root = resolve(import.meta.dirname, '..');
const jmeter = process.env.JMETER_HOME || join(root, 'tools', 'apache-jmeter-5.6.3');
const localJdk = existsSync(join(root, 'tools')) ? readdirSync(join(root, 'tools')).find(name => name.startsWith('jdk-')) : null;
const javaHome = process.env.JAVA_HOME || (localJdk ? join(root, 'tools', localJdk) : null);
const java = javaHome ? join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const jar = join(jmeter, 'bin', 'ApacheJMeter.jar');
if (!existsSync(jar)) throw new Error('Instale JMeter 5.6.3 e defina JMETER_HOME (veja docs/TESTES.md).');
const output = join(root, 'artifacts', `jmeter-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(output, { recursive: true });
const server = createApp(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const args = ['-Xms128m', '-Xmx512m', '-Djava.awt.headless=true', '-jar', jar, '-n', '-t', join(root, 'performance', 'elo.jmx'), '-l', join(output, 'results.jtl'), '-j', join(output, 'jmeter.log'), '-e', '-o', join(output, 'html'), `-Jport=${server.address().port}`, '-Jjmeter.save.saveservice.output_format=csv'];
  const child = spawn(java, args, { cwd: root, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  if (code !== 0) throw new Error(`JMeter terminou com código ${code}`);
  const rows = readFileSync(join(output, 'results.jtl'), 'utf8').trim().split(/\r?\n/).map(line => line.split(','));
  const columns = rows.shift(), values = rows.map(row => Number(row[columns.indexOf('elapsed')])).sort((a, b) => a - b);
  const failures = rows.filter(row => row[columns.indexOf('success')] !== 'true').length;
  const summary = { date: new Date().toISOString(), samples: rows.length, failures, meanMs: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2), p95Ms: values[Math.ceil(values.length * 0.95) - 1], maxMs: values.at(-1), scenario: '10 usuários, 20 ciclos, login uma vez e GET autenticado discover/matches/safety; SQLite em memória; IA e SMS não são chamados', html: join(output, 'html', 'index.html') };
  writeFileSync(join(output, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2));
  if (failures || rows.length !== 610 || summary.p95Ms > 2000) process.exitCode = 1;
} finally { await new Promise(resolve => server.close(resolve)); }
