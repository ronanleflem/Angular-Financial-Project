# FrontFinancialProject

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Parameter Catalog Policy

- Source of truth: `public/parameter_catalog.json` (served at `/parameter_catalog.json`).
- Docs mirror: `docs/parameter_catalog.json` must stay byte-identical to runtime catalog.
- Edit flow:
  1. edit `public/parameter_catalog.json`
  2. run `npm run sync:catalog`
  3. run `npm run check:catalog-drift`
  4. commit both files

## Robots actifs overlay

La page « Robots actifs » propose désormais un graphique OHLC et un tableau de signaux en temps réel :

- Le graphique interroge `GET /marketdata/ohlcv/window` pour afficher les 50 bougies précédant l’entrée sélectionnée et prolonge jusqu’à la sortie lorsque `payload.exitTsUtc`/`payload.exitPrice` sont fournis.
- Le tableau des signaux s’abonne au flux Server-Sent Events `/live/stream`. Chaque trade reçu est ajouté en temps réel (les 200 derniers sont conservés) et un clic sur une ligne recharge la fenêtre OHLC.
- L’affichage repose sur la bibliothèque [`lightweight-charts`](https://github.com/tradingview/lightweight-charts) pour le rendu des chandeliers.
