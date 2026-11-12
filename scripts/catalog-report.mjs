import { catalog } from '../server/catalog.mjs';
import choices from '../shared/filter-options.json' with { type: 'json' };
import { writeFileSync } from 'node:fs';
let text = '# Catálogo de demonstração\n\n100 pessoas fictícias adultas, fotografias geradas por IA. Identidades e religiões são declaradas no cadastro e não inferidas pela aparência. Cada opção isolada tem pelo menos dois exemplos; combinações de filtros e perfis consumidos podem reduzir os resultados. Localizações são simuladas em São Paulo.\n';
for (const [field, values] of Object.entries(choices)) { text += `\n## ${field}\n\n| Opção | Quantidade |\n| --- | ---: |\n`; for (const value of values) text += `| ${value} | ${catalog.filter(p => p[field] === value).length} |\n`; }
text += '\nOs 24 retratos originais estão em assets/profiles. Os outros 76 são distribuídos em 19 imagens com quatro retratos independentes; ProfileImage recorta cada célula na interface. Os prompts estão em assets/profiles/sheets/generation-manifest.json. Nenhum gênero é deduzido das fotos.\n';
writeFileSync(new URL('../docs/CATALOGO.md', import.meta.url), text);
