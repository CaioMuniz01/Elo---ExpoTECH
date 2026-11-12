# Requisitos da Opção A — Mobile + Machine Learning

| Requisito | Implementação e evidência |
| --- | --- |
| Aplicativo híbrido em React Native | Expo SDK 55, React Native e TypeScript. Prebuild Android e exportação do bundle Android concluídos localmente. |
| Autenticação | Cadastro, login, scrypt, sessões com validade, logout e autorização de rotas. Testes de acesso entre contas e revogação. |
| Persistência SQL/NoSQL | SQLite: contas, sessões, filtros, curtidas, matches, chat, denúncias, contatos, conversa com IA e pedidos SOS. Teste de reinício do banco. |
| Modelo de ML ou chatbot por API usando dados reais do app | OpenAI Responses API, saída estruturada e contexto limitado do usuário. Conexão real validada em 12/11/2026, com retorno de gpt-4.1-mini-2025-04-14. Os filtros continuam determinísticos; o requisito de IA é atendido pelo chatbot. |
| Testes unitários | Regras de ranking, distância, catálogo e adaptador da IA; acompanhados de testes de integração HTTP/SQLite. 18 testes do servidor passaram localmente. |
| Testes de interface | 7 testes Playwright passaram localmente e no GitHub: cadastro, filtros, login/logout, fotos, match/chat e segurança. Testes nativos em aparelho ainda são necessários para voz, discador, SMS e GPS. |
| Desempenho com JMeter | Plano performance/elo.jmx e execução automatizada isolada. 610 requisições, 10 usuários, zero falhas, média 8,46 ms e p95 28 ms na execução local inicial. Não mede a latência da OpenAI nem rede de produção. |
| CI/CD publicando APK como artefato | Execução [43147579601](https://github.com/CaioMuniz01/elo/actions/runs/43147579601) aprovada em 12/11/2026: verificações, JMeter e Android. APK release ARM64 publicado como elo-android-apk, junto aos relatórios. |

## Regras dos filtros

Indiferente não altera resultados. Dar prioridade soma um ponto por critério compatível e preserva os demais perfis. Obrigatório exclui incompatíveis e dados ausentes. Opções no mesmo campo usam OU; campos obrigatórios distintos usam E. Distância é calculada no servidor e limitada a 30 km. Coordenadas exatas não são expostas no perfil público.

Há pelo menos duas pessoas por opção isolada no catálogo de 100 perfis. Combinações, bloqueios e perfis já consumidos podem reduzir a quantidade. Veja [CATALOGO.md](CATALOGO.md).

## Limites da segurança

A IA orienta e classifica relatos; não comprova que um crime ocorreu. Preparar um pedido não significa enviar ou entregar. O usuário confirma no aplicativo de mensagens. A localização é pontual e consentida, sem rastreamento em segundo plano. O SOS não depende da resposta da IA, mas a preparação persistida ainda depende da API Elo. Não há operação de central de emergência.
