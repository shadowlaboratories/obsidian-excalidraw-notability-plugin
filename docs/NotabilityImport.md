# Importing Notability `.note` files

This fork adds direct Notability import on top of the Obsidian Excalidraw plugin.

## What it does

- Adds the command palette action `Import Notability .note`
- Lets you pick a `.note` archive from disk on desktop
- Converts that archive into a new Excalidraw file in your vault
- Preserves Notability-specific stroke payload in the scene so `excalidraw-notability` can render imported ink with the Notability-aware pipeline

## Why the fork exists

The original Obsidian Excalidraw plugin is not built around rendering imported Notability ink. This fork swaps the embedded Excalidraw runtime to [`excalidraw-notability`](https://github.com/shadowlaboratories/excalidraw-notability) and vendors the `notability-to-excalidraw` importer so Notability notes can be brought into Obsidian and rendered with the matching stroke engine.

The converter is used only to parse the `.note` archive and write the initial Excalidraw scene. Rendering of imported strokes is handled by `excalidraw-notability`.

## How to use it

1. Reload Obsidian after installing or updating the plugin.
2. Open the command palette.
3. Run `Import Notability .note`.
4. Pick a `.note` archive from your local filesystem.
5. The plugin creates a new drawing in your configured Excalidraw folder and opens it immediately.

## Output format

The created file respects the plugin's normal save-format settings:

- `compatibilityMode = true` creates a `.excalidraw` file
- `compatibilityMode = false` and `useExcalidrawExtension = true` creates a `.excalidraw.md` file
- Otherwise the plugin creates a plain `.md` file with Excalidraw frontmatter and drawing data

## Limitations

- Import is desktop-only because the picker and archive parsing path use the desktop Electron/Node runtime.
- The imported file is a converted Excalidraw scene, not a live `.note` view. Re-import the source `.note` if you want to refresh from Notability.
