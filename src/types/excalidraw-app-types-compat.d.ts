import type * as Base from "../../dist/excalidraw-notability-types/excalidraw/types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";

type CompatFrameRendering = Base.AppState["frameRendering"] & {
  markerEnabled?: boolean;
  markerName?: boolean;
};

type CompatColorPalette = Record<string, string | string[]>;
type CompatResetCustomPen = {
  currentItemStrokeWidth: Base.AppState["currentItemStrokeWidth"];
  currentItemBackgroundColor: Base.AppState["currentItemBackgroundColor"];
  currentItemStrokeColor: Base.AppState["currentItemStrokeColor"];
  currentItemFillStyle: Base.AppState["currentItemFillStyle"];
  currentItemRoughness: Base.AppState["currentItemRoughness"];
};

type CompatAppState = Omit<
  Base.AppState,
  | "currentItemFrameRole"
  | "gridColor"
  | "colorPalette"
  | "currentStrokeOptions"
  | "disableContextMenu"
  | "pinnedScripts"
  | "customPens"
  | "allowPinchZoom"
  | "allowWheelZoom"
  | "resetCustomPen"
  | "linkOpacity"
  | "frameRendering"
> & {
  currentItemFrameRole?: string | null;
  gridColor?: string;
  colorPalette?: CompatColorPalette;
  currentStrokeOptions?: unknown;
  disableContextMenu?: boolean;
  pinnedScripts?: string[];
  customPens?: unknown[];
  allowPinchZoom?: boolean;
  allowWheelZoom?: boolean;
  resetCustomPen?: CompatResetCustomPen | null;
  linkOpacity?: number;
  frameRendering: CompatFrameRendering;
};

type CompatExcalidrawImperativeAPI = Omit<
  Base.ExcalidrawImperativeAPI,
  "updateScene" | "getAppState"
> & {
  updateScene(sceneData: {
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<CompatAppState> | null;
    collaborators?: Base.SceneData["collaborators"];
    captureUpdate?: Base.SceneData["captureUpdate"];
  }): void;
  getAppState(): Readonly<CompatAppState>;
  updateContainerSize(containers: unknown): void;
  refreshAllArrows(): void;
  getHTMLIFrameElement(id: string): HTMLIFrameElement | null;
  isTrayModeEnabled(): boolean;
  selectElements(
    elements: ExcalidrawElement[],
    shouldScrollTo?: boolean,
  ): void;
  setDesktopUIMode(mode: string): void;
  setForceRenderAllEmbeddables(force: boolean): void;
  zoomToFit(
    elements: ExcalidrawElement[],
    zoomLevel?: number,
    padding?: number,
  ): void;
  isTouchScreen?: boolean;
};

declare module "@zsviczian/excalidraw/types/excalidraw/types" {
  export * from "../../dist/excalidraw-notability-types/excalidraw/types";

  export type AppState = CompatAppState;
  export type UIAppState = Omit<
    AppState,
    "startBoundElement" | "cursorButton" | "scrollX" | "scrollY"
  >;
  export type ExcalidrawImperativeAPI = CompatExcalidrawImperativeAPI;
  export type SceneData = Omit<Base.SceneData, "appState"> & {
    appState?: Partial<AppState>;
  };
}
