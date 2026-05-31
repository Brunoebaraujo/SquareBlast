# SquareBlast

SquareBlast is a mobile-friendly offline block puzzle game built with plain HTML, CSS, and JavaScript.

## Play

Open `index.html` in a browser. No build step, network access, ads, or external dependencies are required.

Hosted version: https://brunoebaraujo.github.io/SquareBlast/

## GitHub Pages

This repository includes a `gh-pages` branch with the static game files. In GitHub, enable Pages with:

- Source: Deploy from a branch
- Branch: `gh-pages`
- Folder: `/ (root)`

## Rules

- The board is a 10x10 grid.
- New games start with 10 to 15 filled cells.
- Three connected pieces are available at a time.
- Drag a piece onto the board to place it.
- Full rows and columns clear after every placement.
- Best score is saved in `localStorage`.
