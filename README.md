# benchmaaark

**[nglmrtn.com/benchmaaark](https://nglmrtn.com/benchmaaark/)**

charts of ai models (intelligence, cost, speed, benchmarks) built from several public sources and exported with the aaangelmartin.com brand, ready for x, linkedin and instagram.

## quick start

```sh
pnpm install
pnpm data     # fetch every source and build public/data/dataset.json
pnpm dev      # open the editor
```

while `pnpm dev` runs, the data refreshes itself: on start when it is older than 6 hours, every 30 minutes after that under the same rule, and from the "actualizar" button in the header. the page reloads the numbers on its own. `pnpm data` still works by hand. if a source fails, the last copy in `data/raw/` is used.

the only key is optional: `AA_API_KEY` for artificial analysis. put it in `.env` (see `.env.example`) locally, and as a repository secret for the deploy workflow.

## published site

`.github/workflows/deploy.yml` rebuilds the data every 6 hours and on every push to `main`, then publishes to github pages under `/<repo>/`.

## sources

| source                                                                    | what it adds                                                                                                    | access                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [cursorbench](https://cursor.com/cursorbench)                             | the default: score, cost per task, tokens per task and steps per task for every model at every reasoning effort | public leaderboard page                                      |
| [epoch ai](https://epoch.ai/benchmarks)                                   | capabilities index (eci), ~70 benchmarks, release dates, open or closed weights, metr time horizons             | public zip, cc-by 4.0                                        |
| [openrouter](https://openrouter.ai/models)                                | input, output and blended (3:1) prices, context window                                                          | public api                                                   |
| [lmarena](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) | human-preference elo: text, webdev, vision, search                                                              | public hugging face dataset                                  |
| [artificial analysis](https://artificialanalysis.ai)                      | intelligence, coding and math indices, output speed, latency                                                    | free api key in `AA_API_KEY` (copy `.env.example` to `.env`) |
| `data/manual.json`                                                        | your own numbers, aliases and exclusions                                                                        | local                                                        |

every exported chart prints the sources it used and the data date in the footer.

## matching models across sources

each source names models differently (`claude-opus-5-5_max`, `anthropic/claude-opus-5.5`, `claude-opus-5.5-high`). `src/lib/match.ts` reduces them all to one key. epoch, artificial analysis, lmarena and manual entries can create models; openrouter only attaches prices to models someone measured.

when something matches wrong or not at all, check `data/raw/match-report.json` and fix it in `data/manual.json`:

```json
{
  "aliases": { "openrouter:openai/gpt-6.1-sol-pro": "gpt-6-1-sol" },
  "ignore": ["lmarena:some-test-model"],
  "metrics": [],
  "models": [
    {
      "id": "my-model",
      "name": "My Model",
      "lab": "anthropic",
      "releaseDate": "2026-10-01",
      "openWeights": false,
      "values": { "eci": 150 }
    }
  ]
}
```

manual values always win over fetched ones.

## the site

- **galería**: every chart the data allows, a couple of hundred, generated per source and per metric (ranking, by effort, score vs cost, over time, table), with the curated ones first. filter by source, by kind, or search. a click opens a fresh editor on that chart.
- **editor**: four steps. chart and source, labs (all of them, by logo), models (lists grouped by lab, sorted by release, score or name, with search), look. by default it picks the latest model of each line of each lab (opus, sonnet, haiku...); older ones are one click away. a star makes a model solid white and dims the rest. models run at several reasoning efforts can show each effort, joined by a line.
- **mis gráficas**: whatever you edit is saved in the browser as you go.
- **modelos**: every model with all its metrics and its rank in each.

charts are interactive in the editor: hover a point or bar for its numbers, click it for the model's profile.

## two editions

the same site under two brands, one entry page each:

- `/` is aaa.: the cyan `#00b5e2` is the canvas, white on top.
- `/laaabs/` is laaabs.: black `#0a0a0a` canvas, white on top, cyan only as a signal (the dot of the wordmark).

posters carry the brand mark top right and the domain bottom left.

## export

- png at 2x, svg (font embedded), csv with the plotted data, or copy the png straight to the clipboard
- formats: 16:9 (1600×900), 1:1 (1080), 4:5 (1080×1350), 9:16 (1080×1920), 1.91:1 (1200×628)
- zip of one chart in every format and both languages, or of every template in one format

## brand

follows [aaangelmartin.com/brand](https://aaangelmartin.com/brand) and the laaabs. brand: one canvas colour, everything on it white at 100/80/50/30/20/10% strength, outfit 500 to 700, lowercase, no em dashes. on charts, shape is the lab and opacity is the model, never other colours.

## scripts

| command       | does                                             |
| ------------- | ------------------------------------------------ |
| `pnpm data`   | fetch sources and rebuild the dataset            |
| `pnpm dev`    | editor at localhost:5173                         |
| `pnpm build`  | typecheck and build the static site into `dist/` |
| `pnpm test`   | unit tests (model matching)                      |
| `pnpm format` | prettier                                         |

## license

code under the [MIT license](LICENSE).

not covered by it:

- the aaa. and aaangelmartin marks and the aaangelmartin.com brand (`src/assets/`, `public/brand/`) belong to ángel martín. fork the code, not the brand.
- data stays under each source's terms: epoch ai is [cc-by 4.0](https://creativecommons.org/licenses/by/4.0/), lmarena is cc-by 4.0, artificial analysis asks for attribution, openrouter is a public api. every chart credits the sources it uses.
- lab logos come from [@lobehub/icons](https://github.com/lobehub/lobe-icons) (mit) and remain trademarks of their owners. outfit is under the [sil open font license](https://openfontlicense.org).
