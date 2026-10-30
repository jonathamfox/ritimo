# Ritmo — Dieta & Treino

App de dieta, treino e evolução que roda no navegador do celular e pode ser instalado na tela inicial.
Não usa servidor: os dados de cada pessoa ficam guardados no próprio celular dela.

## O que tem
- **Hoje**: semana com dias treinados, calorias restantes, macros, água e peso
- **Dieta**: 5 refeições, busca de alimentos (70+ alimentos comuns), cadastro pelo rótulo, **leitor de código de barras** (busca automática no Open Food Facts)
- **Treino**: fichas A/B/C editáveis, marcar exercícios, carga, cronômetro de descanso, histórico
- **Evolução**: gráfico de peso com meta, cintura, calorias dos últimos 7 dias
- **Perfil**: metas calculadas automaticamente (ou manuais), backup (exportar/importar)

## Publicar no GitHub Pages (grátis)
1. Crie uma conta em https://github.com (se ainda não tiver).
2. Clique em **New repository** → nome: `ritmo` → marque **Public** → **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste **todos os arquivos ** desta pasta (não o ZIP) → **Commit changes**.
5. Vá em **Settings → Pages** → em *Branch* escolha **main** e pasta **/ (root)** → **Save**.
6. Em 1–2 minutos o endereço aparece no topo dessa página, algo como
   `https://SEU-USUARIO.github.io/ritmo/`

Mande esse link para a família. Cada um abre no celular e instala:
- **iPhone (Safari)**: Compartilhar → Adicionar à Tela de Início
- **Android (Chrome)**: menu ⋮ → Instalar app

## Importante sobre os dados
- Ficam só no celular de cada pessoa. Ninguém vê os dados do outro.
- Use **Perfil → Exportar backup** de vez em quando (e antes de trocar de celular).
- Instalado na tela inicial, o iPhone protege melhor os dados do que abrindo pelo Safari.

## Atualizar o app depois
Envie os arquivos alterados para o repositório (mesmo caminho do passo 3) e, no `sw.js`,
mude `ritmo-v1` para `ritmo-v2` (e assim por diante) para os celulares pegarem a versão nova.

Os valores nutricionais da base são aproximados. As metas são estimativas — ajuste conforme seus resultados
ou a orientação de um nutricionista.
