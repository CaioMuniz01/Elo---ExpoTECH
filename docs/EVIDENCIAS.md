# Evidências da versão 0.2.0

Data: 12/11/2026. Commit do aplicativo: b8e24c4956ab448b91fa240cbdaab984377089e2.

Pipeline aprovada: https://github.com/CaioMuniz01/elo/actions/runs/43151179131

- checks: TypeScript, 20 testes do servidor e 8 testes de interface aprovados.
- performance: 610 amostras JMeter, zero falhas, média 2,49 ms, p95 5 ms e máximo 57 ms. API e JMeter no mesmo runner, SQLite em memória; não inclui latência da IA.
- android: APK release ARM64 publicado como elo-android-apk.

## APK inspecionado

Arquivo local: artifacts/apk-v02/app-release.apk. 135855042 bytes. Pacote com.elo.app. Bundle JavaScript com 1238028 bytes; 3 arquivos DEX e 14 bibliotecas ARM64.

SHA-256: C058D22A3DC92AD73872D551FB93F0CDDD74BF9FCCEE2E166EA640FF96F288B1

[APK no GitHub](https://github.com/CaioMuniz01/elo/actions/runs/43151179131/artifacts/13914755536) · [JMeter](https://github.com/CaioMuniz01/elo/actions/runs/43151179131/artifacts/13913517360) · [Interface](https://github.com/CaioMuniz01/elo/actions/runs/43151179131/artifacts/13913937082). Artefatos exigem acesso ao repositório e têm retenção de 14 dias.

## Integração real de IA

Três chamadas reais registradas localmente em artifacts/ai-smoke-enhanced.json: dicas de encontro (dating), resumo do perfil de Marina (profile) e proposta de abrir discador do contato (call_contact). Não houve envio de notificação nem ligação. O script scripts/smoke-assistant.mjs reproduz as chamadas com cobrança do provedor. O segundo retorno resumiu o perfil, mas não forneceu todas as perguntas solicitadas: isso é uma limitação observada de seguimento de instrução.

## Material de apresentação

Os três PDFs e as evidências organizadas ficam somente no computador, em entregas/, conforme preferência do autor. Essa pasta e as ferramentas locais de geração são ignoradas pelo Git.

## Conferência no aparelho

Instalação, GPS, reprodução/interrupção da voz, SMS, compartilhamento e discador ainda precisam de validação física. Testes de interface web e inspeção estrutural não comprovam esses fluxos. Assinatura de desenvolvimento; uso acadêmico em rede local.
