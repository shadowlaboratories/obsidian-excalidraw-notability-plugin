interface ExcalidrawScene {
    type: "excalidraw";
    version: 2;
    source: string;
    elements: ExcalidrawElement[];
    appState: ExcalidrawAppState;
    files: Record<string, ExcalidrawFileEntry>;
    notability?: NotabilitySceneMetadata;
}
interface NotabilitySceneMetadata {
    pageWidth: number;
    paperSize: string;
    paperOrientation: string;
}
type ExcalidrawElement = ExcalidrawFreedrawElement | ExcalidrawImageElement | ExcalidrawTextElement | ExcalidrawLineElement | ExcalidrawEllipseElement;
interface ExcalidrawBaseElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    strokeColor: string;
    backgroundColor: string;
    fillStyle: string;
    strokeWidth: number;
    strokeStyle: string;
    roughness: number;
    opacity: number;
    seed: number;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    groupIds: string[];
    frameId: string | null;
    boundElements: null;
    updated: number;
    link: string | null;
    locked: boolean;
    customData?: Record<string, unknown>;
}
interface ExcalidrawFreedrawElement extends ExcalidrawBaseElement {
    type: "freedraw";
    points: [number, number][];
    pressures: number[];
    simulatePressure: boolean;
    lastCommittedPoint: [number, number];
    penVariant?: string;
}
interface ExcalidrawImageElement extends ExcalidrawBaseElement {
    type: "image";
    fileId: string;
    status: "saved";
    scale: [number, number];
}
interface ExcalidrawTextElement extends ExcalidrawBaseElement {
    type: "text";
    text: string;
    fontSize: number;
    fontFamily: 1 | 2 | 3;
    textAlign: "left" | "center" | "right";
    verticalAlign: "top";
    baseline: number;
    containerId: null;
    originalText: string;
    autoResize: boolean;
    lineHeight: number;
}
interface ExcalidrawLineElement extends ExcalidrawBaseElement {
    type: "line";
    points: [number, number][];
    lastCommittedPoint: [number, number] | null;
    startBinding: null;
    endBinding: null;
    startArrowhead: null;
    endArrowhead: null;
}
interface ExcalidrawEllipseElement extends ExcalidrawBaseElement {
    type: "ellipse";
}
interface ExcalidrawFileEntry {
    mimeType: string;
    id: string;
    dataURL: string;
    created: number;
    lastRetrieved: number;
}
interface ExcalidrawAppState {
    gridSize: null;
    viewBackgroundColor: string;
}
interface ConversionOptions {
    scaleFactor?: number;
    strokeWidthScale?: number;
    defaultFontFamily?: 1 | 2 | 3;
    compress?: boolean;
}

/**
 * Convert a Notability .note file to Excalidraw scene JSON.
 */
declare function convertNoteToScene(input: Buffer | string, options?: ConversionOptions): Promise<ExcalidrawScene>;
/**
 * Convert a Notability .note file to Obsidian .excalidraw.md content string.
 */
declare function convertNote(input: Buffer | string, options?: ConversionOptions): Promise<string>;
/**
 * Convert a Notability .note file and write the result to disk.
 */
declare function convertNoteToFile(inputPath: string, outputPath: string, options?: ConversionOptions): Promise<void>;

export { type ConversionOptions, type ExcalidrawScene, convertNote, convertNoteToFile, convertNoteToScene };
