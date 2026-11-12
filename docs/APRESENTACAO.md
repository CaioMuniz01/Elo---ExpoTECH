# Roteiro da apresentação

## Preparação

1. No computador, execute `npm run server`. Mantenha o computador e o celular na mesma rede. Para a prévia no navegador, execute também `npm run web`.
2. No celular Android ARM64, instale o APK do artefato `elo-android-apk` da execução aprovada no GitHub Actions. Configure a conexão na tela inicial com o IPv4 do computador e porta 3001.
3. Confirme que `server/.env` contém a chave local e que a API foi reiniciada depois de salvá-la. Não exiba esse arquivo, o banco ou credenciais ao projetar a tela.
4. Combine a demonstração com um contato de teste. Não telefone para centrais reais durante os testes.

## Demonstração sugerida

1. Entre na conta de exemplo. Mostre um perfil, os detalhes e a navegação com foto.
2. Abra filtros rápidos. Escolha uma religião com prioridade e mostre que a ordem muda sem excluir os demais; depois mude para obrigatório e explique a exclusão. Mostre o controle de distância até 30 km e as opções inclusivas de gênero.
3. Curta um perfil e abra o match. Explique que os exemplos são fictícios e que já curtiram a conta demo. Envie uma mensagem; ela persiste, mas não há resposta automática dessas pessoas. Para conversa real, duas contas precisam curtir reciprocamente.
4. Em Segurança, cadastre o contato de teste e autorize a conversa com a IA. Envie: “É uma simulação para apresentação. Estou desconfortável em um encontro; como posso pedir ajuda?”. Mostre a resposta real, o primeiro nome e a orientação considerando o contato cadastrado. Ative a leitura em voz em um ambiente adequado.
5. Use Preparar SOS com localização autorizada. Mostre o ponto no mapa e o texto pronto. Explique a diferença entre preparado, aplicativo de mensagens aberto e envio informado pelo aparelho. Confirme o envio apenas se o contato de teste consentiu; caso contrário, cancele.
6. Abra GitHub Actions: verificações, testes de interface, JMeter e compilação Android. Mostre o relatório HTML e o APK publicado como artefato.

## Como explicar a IA

O modelo treinado do provedor recebe mensagens por API e um contexto mínimo real do app. Produz uma resposta contextual e uma categoria estruturada do relato. O app pode ler o texto por voz usando o sistema operacional. Não há treinamento próprio neste projeto; a atividade permite chatbot integrado por API. Os filtros usam regras determinísticas e as fotos geradas não são a integração de IA usada para cumprir o requisito.

## Limites para declarar

Os testes de interface automatizados rodam na prévia web. Voz, SMS, GPS, discador e instalação exigem verificação no aparelho. O SOS prepara o envio com confirmação do usuário, sem rastreamento contínuo ou central de monitoramento. A medição JMeter é de API local/CI com SQLite em memória, sem incluir a OpenAI. O APK de apresentação usa assinatura de desenvolvimento e depende do servidor para os dados.
