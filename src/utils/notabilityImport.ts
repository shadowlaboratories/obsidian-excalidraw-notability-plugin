import fs from "node:fs";
import { Notice, TFile } from "obsidian";
import { DEVICE } from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";
import { ExcalidrawSettings } from "src/core/settings";
import { t } from "src/lang/helpers";
import { splitFolderAndFilename } from "src/utils/fileUtils";
import {
  convertNote,
  convertNoteToScene,
} from "../../vendor/notability-to-excalidraw/index.js";

type OpenDialogReturnValue = {
  canceled: boolean;
  filePaths: string[];
};

const INVALID_FILENAME_CHARS = /[*"\\<>:|?#]/g;

function getImportedDrawingExtension(settings: ExcalidrawSettings) {
  if (settings.compatibilityMode) {
    return ".excalidraw";
  }

  return settings.useExcalidrawExtension ? ".excalidraw.md" : ".md";
}

function getImportedDrawingFilename(
  sourcePath: string,
  settings: ExcalidrawSettings,
) {
  const { basename } = splitFolderAndFilename(sourcePath);
  const safeBaseName = (basename || "Imported Notability Note")
    .replace(INVALID_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${safeBaseName || "Imported Notability Note"}${getImportedDrawingExtension(settings)}`;
}

async function promptForNotePath(): Promise<string | null> {
  const remote = window.require("electron").remote;
  const result = (await remote.dialog.showOpenDialog({
    title: t("IMPORT_NOTABILITY_NOTE"),
    filters: [
      { name: "Notability Notes", extensions: ["note"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  })) as OpenDialogReturnValue;

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function buildDrawingData(
  sourcePath: string,
  settings: ExcalidrawSettings,
): Promise<string> {
  const noteBuffer = fs.readFileSync(sourcePath);

  if (settings.compatibilityMode) {
    const scene = await convertNoteToScene(noteBuffer);
    return JSON.stringify(scene);
  }

  return convertNote(noteBuffer, { compress: settings.compress });
}

export async function importNotabilityNote(
  plugin: ExcalidrawPlugin,
): Promise<TFile | null> {
  if (!DEVICE.isDesktop) {
    new Notice(t("IMPORT_NOTABILITY_NOTE_DESKTOP_ONLY"));
    return null;
  }

  const sourcePath = await promptForNotePath();
  if (!sourcePath) {
    return null;
  }

  const filename = getImportedDrawingFilename(sourcePath, plugin.settings);

  try {
    new Notice(t("IMPORT_NOTABILITY_NOTE_RUNNING"), 4000);
    const initData = await buildDrawingData(sourcePath, plugin.settings);
    const file = await plugin.createDrawing(filename, undefined, initData);
    plugin.openDrawing(file, "active-pane", true, undefined, true);
    new Notice(`${t("IMPORT_NOTABILITY_NOTE_DONE")} ${file.path}`, 6000);
    return file;
  } catch (error) {
    console.error("Failed to import Notability note", error);
    new Notice(t("IMPORT_NOTABILITY_NOTE_FAILED"), 8000);
    return null;
  }
}
