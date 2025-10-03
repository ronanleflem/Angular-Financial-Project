# Front Financial Project Overview

![Node.js](https://img.shields.io/badge/Node.js-unknown-lightgrey) ![Angular](https://img.shields.io/badge/Angular-19.2.0-red)

## Résumé
Cette application Angular fournit des tableaux de bord financiers pour explorer des bougies historiques, surveiller des flux en direct et analyser la performance de stratégies de trading. Elle s'adresse aux traders quantitatifs, aux analystes financiers et aux équipes produit qui souhaitent visualiser et backtester des stratégies multi-actifs.

## Stack principale
- **Framework** : Angular 19.2 (standalone components)
- **Langage** : TypeScript
- **Librairies clés** : RxJS (~7.8), Chart.js 4 avec `chartjs-chart-financial`, `chartjs-plugin-zoom`, `chartjs-plugin-annotation`, wrapper `ng2-charts`, date-fns
- **Tooling** : Angular CLI 19, TypeScript 5.7

## Installation & commandes
```bash
npm install
npm run start   # démarrage développement (ng serve)
npm run build   # build production (ng build)
```

## Arborescence rapide
```
/
├── angular.json
├── package.json
├── public/
├── src/
│   ├── app/
│   │   ├── components/
│   │   ├── services/
│   │   └── labs/
│   ├── environments/
│   ├── main.ts
│   └── styles.css
└── PROJECT_OVERVIEW.md
```
