# Testes e evidências

Requer Node.js 24 e `npm ci`.

| Comando | Escopo |
| --- | --- |
| npm run typecheck | Tipos do app TypeScript |
| npm test | 20 testes de regras e integração do servidor, SQLite, autorização e IA |
| npm run test:ui | Playwright em viewport de celular, servidor em memória e IA substituída por fixture explícita |
| npm run test:performance | JMeter real com relatório JTL, HTML e resumo JSON |

Windows usa Microsoft Edge nos testes de interface; CI usa Chromium instalado por `npx playwright install --with-deps chromium`. O Playwright inicia API isolada na porta 3002 e Expo na 8082; não altera o banco do usuário. A fixture de IA não é evidência de integração real: essa conexão foi validada separadamente, com a chave local e uma chamada real à OpenAI.

## JMeter 5.6.3

Baixe os binários do [Apache JMeter](https://jmeter.apache.org/download_jmeter.cgi) e o JDK 17 do [Adoptium](https://adoptium.net/installation/archives/), verificando os checksums. Extraia em `tools/` ou defina `JMETER_HOME` e `JAVA_HOME`. O runner detecta `tools/apache-jmeter-5.6.3` e `tools/jdk-*`. As ferramentas são locais e ignoradas pelo Git.

```powershell
$env:JMETER_HOME = 'C:\caminho\apache-jmeter-5.6.3'
$env:JAVA_HOME = 'C:\caminho\jdk-17'
npm run test:performance
```

O runner cria uma API temporária em memória numa porta livre, inicia Java/JMeter e fecha a API ao terminar. São 10 usuários, 20 ciclos, um login por usuário e consultas autenticadas a descoberta, matches e segurança: 610 amostras. Não chama a OpenAI, não envia mensagens nem pede socorro. Critérios de aprovação: zero falhas, 610 amostras e p95 até 2 segundos.

Evidência local inicial em 12/11/2026: `artifacts/jmeter-2026-11-12T03-07-30-002Z/`. Resultado: 610 amostras, zero falhas, média 8,46 ms, p95 28 ms, máximo 77 ms. É uma carga acadêmica local, com banco em memória; não demonstra capacidade de produção.

## Android

`npx expo prebuild --platform android --no-install` e `npx expo export --platform android --output-dir artifacts/android-bundle` passaram localmente. A compilação final e o upload do APK passaram no [workflow 43151179131](https://github.com/CaioMuniz01/elo/actions/runs/43151179131). A versão release inclui o bundle; a configuração de conexão fica disponível na tela inicial. O pacote foi baixado em artifacts/apk-v02/app-release.apk e inspecionado com scripts/inspect-apk.ps1.

São 8 testes de interface e 20 testes do servidor aprovados localmente e no CI. O JMeter no CI registrou 610 amostras, zero falhas, média 2,49 ms, p95 5 ms e máximo 57 ms.

O teste real da IA pode ser repetido manualmente com `node scripts/smoke-ai.mjs`. Ele faz uma chamada paga ao provedor usando um banco temporário em memória, sem enviar SMS, e salva artifacts/ai-smoke.json. Não faz parte dos testes automáticos do CI. As evidências estão em [EVIDENCIAS.md](EVIDENCIAS.md).

Antes da apresentação, validar em aparelho ARM64: instalação, conexão à API na rede, permissões GPS negada/concedida, reprodução/interrupção de voz, abertura/cancelamento de SMS, compartilhamento, discador e retomada do app. Use somente um contato de teste consentido e não ligue para serviços reais durante demonstrações.

## Dependências

Foi aplicada a correção compatível `npm audit fix`. Permanecem avisos em dependências transitivas do tooling Expo SDK 55; a correção sugerida pelo npm exige migração principal do Expo. Não foi aplicada atualização forçada sem validar a migração. Reexecute `npm audit` antes de disponibilizar o projeto publicamente. A API utiliza módulos nativos do Node, sem as dependências do tooling no caminho das requisições.

Versão 0.2.0: `node scripts/smoke-assistant.mjs` repete três chamadas reais (dicas, resumo e proposta de ação), com cobrança do provedor e sem notificações. Os PDFs de apresentação e suas evidências organizadas ficam somente em entregas/, ignorada pelo Git.
