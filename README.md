# Mahmoud Hafez portfolio

Personal site, served by GitHub Pages from the `docs` folder of the `main` branch: https://hafeztheanalyst.github.io/Portfolio/

GitHub Pages for this repository is set to **main / docs** (Settings > Pages). Keep the site files inside `docs/` and leave that setting as it is.

Plain HTML, CSS and JavaScript. There is no build step and no framework, so any file can be edited directly.

## Layout

All paths below are inside `docs/`.

| Path | What it is |
|---|---|
| `index.html` | Home page |
| `projects/*.html` | One page per project or case study |
| `css/site.css` | All styles, including the light and dark colours at the top of the file |
| `js/site.js` | Theme switch, scroll animations, the hero chart and the illustrations |
| `assets/Mahmoud_Hafez_CV.pdf` | The CV behind every "Download CV" button |
| `images/` | Photo, project screenshots and certificate thumbnails |

## Common changes

**Add a project**

1. Copy the closest page in `projects/` (for example `sales-analysis.html`) and rename it.
2. Change the title, the three facts, the text and the screenshots.
3. Put the screenshots in `docs/images/Projects/<project-name>/`.
4. Add a card for it on the home page: copy one `<a class="card">` block in `index.html` (section `id="projects"`) and point it at the new page.
5. Update the "Next" link at the bottom of the previous project page so it leads to the new one.

**Update the CV**

Replace `docs/assets/Mahmoud_Hafez_CV.pdf` with the new file and keep the same file name. Every download button picks it up.

**Change the colours**

Edit the values under `:root` (light) and `:root[data-theme="dark"]` (dark) at the top of `docs/css/site.css`.

**Change a number**

The headline results on the home page are in the `results` section and in each case-study card in `index.html`. The same numbers also appear on the case-study page and in the CV, so change all three together.

## Notes

- The case studies describe work for an employer in general terms only. Keep internal tool names, data, screenshots and detection details out of this repository.
- The charts and network illustrations use made-up data generated in `docs/js/site.js`.
