# Elo

Projeto semestral: aplicativo mobile de relacionamento para adultos, feito com React Native, Expo e TypeScript. API Node.js 24, persistência SQLite e assistente de segurança integrado à OpenAI Responses API.

## Executar

```powershell
npm ci
npm run server
```

Em outro terminal:

```powershell
npm start
```

Para a prévia web: `npm run web`. A API usa a porta 3001; o banco é criado em `server/data/elo.sqlite`. Preserve esse arquivo para manter contas e conversas. A conta de exemplo é `demo@elo.app`, senha `EloDemo123!`. Use dados fictícios neste ambiente acadêmico.

No celular, use a mesma rede Wi-Fi do computador. O Expo Go detecta o endereço do computador; no APK, toque em **Configurar conexão** na tela inicial e informe `http://IP_DO_COMPUTADOR:3001`. Android Emulator: `http://10.0.2.2:3001`. Também é possível definir `EXPO_PUBLIC_API_URL` antes de iniciar ou compilar. O servidor precisa permanecer ligado; permita Node.js no firewall somente na rede privada utilizada. HTTP está habilitado para apresentação local; uma implantação pública exige HTTPS.

## Assistente e SOS

Copie `server/.env.example` para `server/.env` e preencha `OPENAI_API_KEY` somente nesse arquivo. A chave fica no servidor, nunca em variáveis `EXPO_PUBLIC_*`, no APK ou no GitHub. O modelo padrão é `gpt-4.1-mini`, configurável com `OPENAI_MODEL`. Reinicie a API ao alterar o arquivo. As chamadas de IA podem consumir créditos da conta do provedor.

Na aba **Segurança**, cadastre um contato de confiança. O botão **Preparar SOS** monta uma mensagem com um ponto atual no mapa, quando autorizado e disponível. Você confirma o envio no SMS ou compartilha em outro aplicativo. O app não confirma entrega, não rastreia continuamente e não aciona serviços de emergência automaticamente. Ligações abrem o discador do celular. Esses recursos nativos precisam de validação em aparelho.

O chat pede consentimento antes de enviar mensagens à OpenAI. Usa o primeiro nome, a existência de contato cadastrado e o estado do último pedido, sem enviar o telefone nem coordenadas ao modelo. Respostas podem ser lidas em voz pelo dispositivo; a voz começa desligada. A classificação do relato é feita pelo modelo, não por regras de palavras-chave. Se a IA falhar, aparece uma orientação fixa identificada como tal, e o SOS permanece independente da chamada de IA.

## Funcionalidades

- Cadastro 18+, autenticação com scrypt e sessões revogáveis; SecureStore no celular e sessionStorage na prévia web.
- Descoberta, curtir/passar, matches recíprocos, chat persistente, perfil e foto, bloqueio e denúncia.
- Filtros de religião, intenção, gênero e distância de 1 a 30 km: indiferente, prioridade ou obrigatório. Mulheres e homens incluem pessoas cis e trans; há outras identidades.
- 100 perfis fictícios adultos com retratos gerados por IA. A conta de exemplo recebe curtidas preparadas para demonstração; os perfis não respondem sozinhos. Novas contas só conversam após curtidas recíprocas.
- Fontes locais, fundos desfocados, navegação mobile, atalhos de filtros e fotos também nas conversas.

## Qualidade e entrega

```powershell
npm run typecheck
npm test
npm run test:ui
npm run test:performance
```

Instalação do JMeter e evidências: [docs/TESTES.md](docs/TESTES.md). Requisitos: [docs/REQUISITOS.md](docs/REQUISITOS.md). Distribuição dos perfis: [docs/CATALOGO.md](docs/CATALOGO.md). Arquitetura e limites: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

A pipeline `.github/workflows/quality.yml` executa verificações, Playwright e JMeter antes de compilar `assembleRelease`. Publica `elo-android-apk` para aparelhos ARM64. O JavaScript está incluído no APK e não precisa do Metro, mas precisa acessar a API. A assinatura gerada pelo template é de desenvolvimento, adequada à apresentação; uma publicação em loja exige chave própria. É possível definir a variável de repositório `ELO_API_URL`; o endereço também pode ser configurado no próprio app.

A [pipeline aprovada](https://github.com/CaioMuniz01/elo/actions/runs/43147579601) publicou o APK e os relatórios. Veja [evidências](docs/EVIDENCIAS.md) e o [roteiro da apresentação](docs/APRESENTACAO.md).

O projeto é um protótipo acadêmico funcional. Hospedagem pública, verificação de identidade/e-mail, recuperação de senha, moderação operacional e envio automatizado com confirmação de entrega ficam fora desta entrega.
