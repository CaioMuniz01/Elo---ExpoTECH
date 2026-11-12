# Evidências da entrega acadêmica

Data: 12/11/2026. Código do app compilado: commit `38ff1d0` no repositório privado [CaioMuniz01/elo](https://github.com/CaioMuniz01/elo).

## Pipeline aprovada

[Execução 43147579601](https://github.com/CaioMuniz01/elo/actions/runs/43147579601): todos os jobs concluídos com sucesso.

| Job | Resultado |
| --- | --- |
| checks | TypeScript, 18 testes do servidor e 7 testes de interface aprovados |
| performance | 610 amostras JMeter, 10 usuários, zero falhas, média 5,71 ms, p95 30 ms, máximo 70 ms |
| android | APK release ARM64 compilado com JavaScript incluído e publicado como artefato |

Artefatos na execução: [APK](https://github.com/CaioMuniz01/elo/actions/runs/43147579601/artifacts/13913295297), [JMeter](https://github.com/CaioMuniz01/elo/actions/runs/43147579601/artifacts/13912271969) e [interface](https://github.com/CaioMuniz01/elo/actions/runs/43147579601/artifacts/13911863868). Exigem acesso ao repositório e têm retenção de 14 dias. As cópias baixadas estão nas pastas locais artifacts/apk, artifacts/github-jmeter e artifacts/github-interface.

## Inspeção do APK baixado

- Arquivo: artifacts/apk/app-release.apk, 135.846.786 bytes.
- Pacote: com.elo.app.
- Bundle JavaScript: assets/index.android.bundle, 1.229.784 bytes.
- 3 arquivos DEX e 14 bibliotecas nativas ARM64.
- SHA-256: `8C5F8BADE39F4ED38340AB612BB1777BC8A59C0A8DFB24402A30FCC6BFF7D0F0`.

Verificado com `scripts/inspect-apk.ps1`. Esta inspeção confirma a estrutura do pacote; não substitui instalação e testes em aparelho. A assinatura é de desenvolvimento, como configurado pelo template Expo.

## IA real

Uma chamada real ao fluxo POST /safety/chat foi realizada com banco temporário e contato fictício. O provedor retornou origem ai, modelo gpt-4.1-mini-2025-04-14 e categoria concern. A resposta usou o nome Alex e explicou o botão Preparar SOS e a confirmação do envio. Consumo informado: 555 tokens de entrada e 79 de saída. Nenhuma notificação foi enviada.

O registro local está em artifacts/ai-smoke.json. A execução é reproduzível por `node scripts/smoke-ai.mjs`, com a chave local e cobrança do provedor. Os testes automáticos usam fixtures explícitas e não consomem a API paga.

## Conferência pendente no aparelho

Instalação Android, conexão por Wi-Fi à API, GPS permitido/negado, reprodução e interrupção de voz, abertura/cancelamento de SMS, compartilhamento e discador. O resultado do CI e a inspeção do APK não comprovam esses fluxos nativos.
