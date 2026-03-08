import type * as Base from "../../dist/excalidraw-notability-types/element/src/types";

type CompatExcalidrawTextElement = Base.ExcalidrawTextElement & {
  rawText?: string;
  hasTextLink?: boolean;
};

type CompatExcalidrawFrameElement = Base.ExcalidrawFrameElement & {
  frameRole?: string;
};

type CompatExcalidrawMagicFrameElement = Base.ExcalidrawMagicFrameElement & {
  frameRole?: string;
};

type CompatExcalidrawEmbeddableElement = Base.ExcalidrawEmbeddableElement & {
  scale?: [number, number];
};

declare module "@zsviczian/excalidraw/types/element/src/types" {
  export * from "../../dist/excalidraw-notability-types/element/src/types";

  export type ExcalidrawTextElement = CompatExcalidrawTextElement;
  export type ExcalidrawFrameElement = CompatExcalidrawFrameElement;
  export type ExcalidrawMagicFrameElement = CompatExcalidrawMagicFrameElement;
  export type ExcalidrawEmbeddableElement = CompatExcalidrawEmbeddableElement;
  export type ExcalidrawFrameLikeElement =
    | ExcalidrawFrameElement
    | ExcalidrawMagicFrameElement;
  export type ExcalidrawRectanguloidElement =
    | Base.ExcalidrawRectangleElement
    | Base.ExcalidrawImageElement
    | ExcalidrawTextElement
    | Base.ExcalidrawFreeDrawElement
    | Base.ExcalidrawIframeLikeElement
    | ExcalidrawFrameLikeElement
    | ExcalidrawEmbeddableElement
    | Base.ExcalidrawSelectionElement;
  export type ExcalidrawElement =
    | Base.ExcalidrawGenericElement
    | ExcalidrawTextElement
    | Base.ExcalidrawLinearElement
    | Base.ExcalidrawArrowElement
    | Base.ExcalidrawFreeDrawElement
    | Base.ExcalidrawImageElement
    | ExcalidrawFrameElement
    | ExcalidrawMagicFrameElement
    | Base.ExcalidrawIframeElement
    | ExcalidrawEmbeddableElement;
  export type ExcalidrawNonSelectionElement = Exclude<
    ExcalidrawElement,
    Base.ExcalidrawSelectionElement
  >;
  export type Ordered<TElement extends ExcalidrawElement> = TElement & {
    index: Base.FractionalIndex;
  };
  export type OrderedExcalidrawElement = Ordered<ExcalidrawElement>;
  export type NonDeleted<TElement extends ExcalidrawElement> = TElement & {
    isDeleted: boolean;
  };
  export type NonDeletedExcalidrawElement = NonDeleted<ExcalidrawElement>;
  export type ExcalidrawBindableElement =
    | Base.ExcalidrawRectangleElement
    | Base.ExcalidrawDiamondElement
    | Base.ExcalidrawEllipseElement
    | ExcalidrawTextElement
    | Base.ExcalidrawImageElement
    | Base.ExcalidrawIframeElement
    | ExcalidrawEmbeddableElement
    | ExcalidrawFrameElement
    | ExcalidrawMagicFrameElement;
  export type ExcalidrawTextContainer = Base.ExcalidrawTextContainer;
  export type ExcalidrawTextElementWithContainer = {
    containerId: ExcalidrawTextContainer["id"];
  } & ExcalidrawTextElement;
}
