// src/index.ts
import fs2 from "fs";

// src/parsers/note-archive.ts
import fs from "fs";
import JSZip from "jszip";

// src/parsers/plist-parser.ts
import bplist from "bplist-parser";
function parseBinaryPlist(buffer) {
  const parsed = bplist.parseBuffer(buffer);
  return parsed[0];
}
function resolveKeyedArchive(plistRoot) {
  const objects = plistRoot["$objects"];
  if (!objects) {
    throw new Error("Not a keyed archive: missing $objects");
  }
  const resolved = /* @__PURE__ */ new Map();
  function resolve(index) {
    if (resolved.has(index)) {
      return resolved.get(index);
    }
    const obj = objects[index];
    if (obj === "$null" || obj === null) {
      resolved.set(index, null);
      return null;
    }
    if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
      resolved.set(index, obj);
      return obj;
    }
    if (Buffer.isBuffer(obj)) {
      resolved.set(index, obj);
      return obj;
    }
    if (typeof obj !== "object") {
      resolved.set(index, obj);
      return obj;
    }
    const className = getClassName(obj, objects);
    if (className === "NSArray" || className === "NSMutableArray") {
      const result3 = [];
      resolved.set(index, result3);
      const nsObjects = obj["NS.objects"];
      if (Array.isArray(nsObjects)) {
        for (const item of nsObjects) {
          result3.push(resolveValue(item));
        }
      }
      return result3;
    }
    if (className === "NSDictionary" || className === "NSMutableDictionary") {
      const result3 = {};
      resolved.set(index, result3);
      const nsKeys = obj["NS.keys"];
      const nsObjects = obj["NS.objects"];
      if (Array.isArray(nsKeys) && Array.isArray(nsObjects)) {
        for (let i = 0; i < nsKeys.length; i++) {
          const key = resolveValue(nsKeys[i]);
          const val = resolveValue(nsObjects[i]);
          if (typeof key === "string") {
            result3[key] = val;
          }
        }
      }
      return result3;
    }
    if (className === "NSMutableData" || className === "NSData") {
      const data = obj["NS.data"];
      if (Buffer.isBuffer(data)) {
        resolved.set(index, data);
        return data;
      }
    }
    if (className === "NSDate") {
      const time = obj["NS.time"];
      if (typeof time === "number") {
        const date = new Date((time + 978307200) * 1e3);
        resolved.set(index, date);
        return date;
      }
    }
    if (className === "NSMutableString" || className === "NSString") {
      const str = obj["NS.string"];
      if (typeof str === "string") {
        resolved.set(index, str);
        return str;
      }
      const bytes = obj["NS.bytes"];
      if (Buffer.isBuffer(bytes)) {
        const str2 = bytes.toString("utf-8");
        resolved.set(index, str2);
        return str2;
      }
    }
    const result2 = {};
    resolved.set(index, result2);
    for (const [key, val] of Object.entries(obj)) {
      if (key === "$class") continue;
      result2[key] = resolveValue(val);
    }
    if (className) {
      result2._className = className;
    }
    return result2;
  }
  function resolveValue(val) {
    if (val && typeof val === "object" && "UID" in val) {
      return resolve(val.UID);
    }
    if (Buffer.isBuffer(val)) {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(resolveValue);
    }
    return val;
  }
  const top = plistRoot["$top"];
  if (!top) {
    throw new Error("Not a keyed archive: missing $top");
  }
  const rootRef = top["root"] || top["$0"];
  if (rootRef && typeof rootRef === "object" && "UID" in rootRef) {
    return resolve(rootRef.UID);
  }
  const result = {};
  for (const [key, val] of Object.entries(top)) {
    result[key] = resolveValue(val);
  }
  return result;
}
function getClassName(obj, objects) {
  const classRef = obj["$class"];
  if (!classRef || typeof classRef !== "object" || !("UID" in classRef)) {
    return null;
  }
  const classObj = objects[classRef.UID];
  if (classObj && typeof classObj === "object" && "$classname" in classObj) {
    return classObj["$classname"];
  }
  if (classObj && typeof classObj === "object" && "$classes" in classObj) {
    const classes = classObj["$classes"];
    if (Array.isArray(classes) && classes.length > 0) {
      return classes[0];
    }
  }
  return null;
}

// src/parsers/session-parser.ts
import bplist2 from "bplist-parser";

// src/parsers/binary-decoder.ts
function decodeFloat32Array(buffer) {
  const count = Math.floor(buffer.length / 4);
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = buffer.readFloatLE(i * 4);
  }
  return result;
}
function decodeInt32Array(buffer) {
  const count = Math.floor(buffer.length / 4);
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = buffer.readInt32LE(i * 4);
  }
  return result;
}

// src/parsers/session-parser.ts
function parseSession(root) {
  const richText = root.richText;
  if (!richText) {
    throw new Error("No richText found in session");
  }
  const strokes = extractStrokes(richText);
  const shapes = extractShapes(richText);
  const mediaObjects = extractMediaObjects(richText);
  const textContent = extractText(richText);
  const reflowState = richText.reflowState || {};
  const pageWidth = reflowState.pageWidthInDocumentCoordsKey || 574;
  const layoutModel = root.NBNoteTakingSessionDocumentPaperLayoutModelKey;
  const paperAttrs = layoutModel?.documentPaperAttributes || {};
  const paperSize = paperAttrs.paperSize || "letter";
  const paperOrientation = paperAttrs.paperOrientation || "portrait";
  return {
    strokes,
    shapes,
    mediaObjects,
    textContent,
    pageWidth,
    paperSize,
    paperOrientation
  };
}
function extractStrokes(richText) {
  const overlay = richText["Handwriting Overlay"];
  if (!overlay) {
    return emptyStrokeData();
  }
  const spatialHash = overlay.SpatialHash;
  if (!spatialHash) {
    return emptyStrokeData();
  }
  const numCurves = spatialHash.numcurves || 0;
  const numPoints = spatialHash.numpoints || 0;
  if (numCurves === 0) {
    return emptyStrokeData();
  }
  const curvesNumPointsBuf = asBuffer(spatialHash.curvesnumpoints);
  const curvesPointsBuf = asBuffer(spatialHash.curvespoints);
  const curvesForcesBuf = asBuffer(spatialHash.curvesforces);
  const curvesColorsBuf = asBuffer(spatialHash.curvescolors);
  const curvesWidthBuf = asBuffer(spatialHash.curveswidth);
  const curvesFracWidthsBuf = asBuffer(spatialHash.curvesfractionalwidths);
  const curvesStylesBuf = asBuffer(spatialHash.curvesstyles);
  const curvesAltitudeAnglesBuf = asBuffer(spatialHash.curvesaltitudeangles);
  const curvesAzimuthUnitVectorBuf = asBuffer(
    spatialHash.curvesazimuthunitvector
  );
  const curveUUIDsBuf = asBuffer(spatialHash.curveUUIDs);
  const curveOptionsBuf = asBuffer(spatialHash.options);
  const curvesNumPoints = curvesNumPointsBuf ? decodeInt32Array(curvesNumPointsBuf) : new Array(numCurves).fill(0);
  const curvesPoints = curvesPointsBuf ? decodeFloat32Array(curvesPointsBuf) : [];
  const curvesForces = curvesForcesBuf ? decodeFloat32Array(curvesForcesBuf) : [];
  const curvesColors = curvesColorsBuf ? decodeRGBAColors(curvesColorsBuf, numCurves) : [];
  const curvesWidth = curvesWidthBuf ? decodeFloat32Array(curvesWidthBuf) : [];
  const curvesFractionalWidths = curvesFracWidthsBuf ? decodeFloat32Array(curvesFracWidthsBuf) : [];
  const curvesStyles = curvesStylesBuf ? Array.from(curvesStylesBuf) : [];
  const curvesAltitudeAngles = curvesAltitudeAnglesBuf ? decodeFloat32Array(curvesAltitudeAnglesBuf) : [];
  const curvesAzimuthUnitVectors = curvesAzimuthUnitVectorBuf ? decodeFloat32Array(curvesAzimuthUnitVectorBuf) : [];
  const curveUUIDs = curveUUIDsBuf ? decodeUUIDArray(curveUUIDsBuf) : [];
  const curveOptions = curveOptionsBuf ? decodeFixedStrideHexStrings(curveOptionsBuf, 8) : [];
  const bezierPathsDataDictionary = spatialHash.bezierPathsDataDictionary && typeof spatialHash.bezierPathsDataDictionary === "object" ? spatialHash.bezierPathsDataDictionary : {};
  return {
    numCurves,
    numPoints,
    curvesNumPoints,
    curvesPoints,
    curvesForces,
    curvesColors,
    curvesWidth,
    curvesFractionalWidths,
    curvesStyles,
    curvesAltitudeAngles,
    curvesAzimuthUnitVectors,
    curveUUIDs,
    curveOptions,
    bezierPathsDataDictionary,
    defaultStrokeWidth: 1,
    defaultStrokeColor: { r: 0, g: 0, b: 0, a: 255 }
  };
}
function decodeRGBAColors(buffer, expectedCount) {
  const count = Math.min(expectedCount, Math.floor(buffer.length / 4));
  const result = [];
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    result.push({
      r: buffer[offset],
      g: buffer[offset + 1],
      b: buffer[offset + 2],
      a: buffer[offset + 3]
    });
  }
  return result;
}
function extractShapes(richText) {
  const overlay = richText["Handwriting Overlay"];
  if (!overlay) return [];
  const spatialHash = overlay.SpatialHash;
  if (!spatialHash) return [];
  const shapesBuf = asBuffer(spatialHash.shapes);
  if (!shapesBuf || shapesBuf.length === 0) return [];
  try {
    const shapesParsed = bplist2.parseBuffer(shapesBuf);
    const shapesRoot = shapesParsed[0];
    const shapesArr = shapesRoot.shapes;
    const indicesArr = shapesRoot.indices;
    const kindsArr = shapesRoot.kinds;
    if (!shapesArr || !indicesArr || !kindsArr) return [];
    const shapes = Object.values(shapesArr);
    const indices = Object.values(indicesArr);
    const kinds = Object.values(kindsArr);
    const results = [];
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      const kind = kinds[i];
      const rgba = s.appearance?.strokeColor?.rgba;
      const strokeColor = rgba ? {
        r: Math.round(rgba[0] * 255),
        g: Math.round(rgba[1] * 255),
        b: Math.round(rgba[2] * 255),
        a: Math.round(rgba[3] * 255)
      } : { r: 0, g: 0, b: 0, a: 255 };
      results.push({
        kind,
        startPt: s.startPt,
        endPt: s.endPt,
        rect: s.rect,
        strokeWidth: s.appearance?.strokeWidth || 1,
        strokeColor,
        curveIndex: indices[i]
      });
    }
    return results;
  } catch {
    return [];
  }
}
function extractMediaObjects(richText) {
  const mediaObjsArray = richText.mediaObjects;
  if (!Array.isArray(mediaObjsArray) || mediaObjsArray.length === 0) {
    return [];
  }
  const results = [];
  for (const mo of mediaObjsArray) {
    try {
      const figure = mo.figure;
      if (!figure) continue;
      const bgObj = figure.FigureBackgroundObjectKey;
      if (!bgObj) continue;
      const snapshot = bgObj.kImageObjectSnapshotKey;
      if (!snapshot) continue;
      const relativePath = snapshot.relativePath;
      if (!relativePath) continue;
      const rect = parseMediaRect(mo);
      const uuidObj = mo.UUID;
      let uuid = "";
      if (typeof uuidObj === "string") {
        uuid = uuidObj;
      } else if (uuidObj && uuidObj["NS.uuidbytes"]) {
        uuid = bufferToUUID(asBuffer(uuidObj["NS.uuidbytes"]));
      }
      results.push({ relativePath, rect, uuid });
    } catch {
    }
  }
  return results;
}
function parseMediaRect(mo) {
  const origin = parseCGPoint(mo.documentOrigin || "{0, 0}");
  const size = parseCGSize(mo.unscaledContentSize || "{0, 0}");
  return {
    x: origin.x,
    y: origin.y,
    width: size.width,
    height: size.height
  };
}
function parseCGPoint(str) {
  const match = str.match(/\{([\d.e+-]+),\s*([\d.e+-]+)\}/);
  if (!match) return { x: 0, y: 0 };
  return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}
function parseCGSize(str) {
  const match = str.match(/\{([\d.e+-]+),\s*([\d.e+-]+)\}/);
  if (!match) return { width: 0, height: 0 };
  return { width: parseFloat(match[1]), height: parseFloat(match[2]) };
}
function extractText(richText) {
  let text = "";
  const attrStr = richText.attributedString;
  if (attrStr) {
    if (typeof attrStr === "object" && attrStr.stringKey) {
      text = attrStr.stringKey;
    } else if (typeof attrStr === "string") {
      text = attrStr;
    }
  }
  if (!text || text.trim().length === 0) {
    const backing = richText.NBAttributedBackingString;
    if (backing) {
      if (typeof backing === "string") {
        text = backing;
      } else if (backing.NBAttributedBackingStringCodingKey) {
        const coding = backing.NBAttributedBackingStringCodingKey;
        if (coding.stringKey) {
          const sk = coding.stringKey;
          if (typeof sk === "string") {
            text = sk;
          } else if (Buffer.isBuffer(sk)) {
            text = sk.toString("utf-8");
          } else if (sk && sk["NS.bytes"]) {
            const bytes = asBuffer(sk["NS.bytes"]);
            if (bytes) {
              text = bytes.toString("utf-8");
            }
          }
        }
      }
    }
  }
  return {
    text: text.trim(),
    fontSize: 20,
    alignment: richText.formattedStringTextAlignmentKey || 0,
    color: { r: 0, g: 0, b: 0, a: 255 }
  };
}
function emptyStrokeData() {
  return {
    numCurves: 0,
    numPoints: 0,
    curvesNumPoints: [],
    curvesPoints: [],
    curvesForces: [],
    curvesColors: [],
    curvesWidth: [],
    curvesFractionalWidths: [],
    curvesStyles: [],
    curvesAltitudeAngles: [],
    curvesAzimuthUnitVectors: [],
    curveUUIDs: [],
    curveOptions: [],
    bezierPathsDataDictionary: {},
    defaultStrokeWidth: 1,
    defaultStrokeColor: { r: 0, g: 0, b: 0, a: 255 }
  };
}
function asBuffer(val) {
  if (Buffer.isBuffer(val)) return val;
  if (val instanceof Uint8Array) return Buffer.from(val);
  return null;
}
function bufferToUUID(buf) {
  if (buf.length < 16) return buf.toString("hex");
  const hex = buf.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join("-");
}
function decodeUUIDArray(buffer) {
  const stride = 16;
  const count = Math.floor(buffer.length / stride);
  const uuids = new Array(count);
  for (let i = 0; i < count; i++) {
    uuids[i] = bufferToUUID(buffer.subarray(i * stride, (i + 1) * stride));
  }
  return uuids;
}
function decodeFixedStrideHexStrings(buffer, stride) {
  const count = Math.floor(buffer.length / stride);
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = buffer.subarray(i * stride, (i + 1) * stride).toString("hex");
  }
  return values;
}

// src/parsers/note-archive.ts
async function parseNoteArchive(input) {
  const buffer = typeof input === "string" ? fs.readFileSync(input) : input;
  const zip = await JSZip.loadAsync(buffer);
  const rootPrefix = detectRootPrefix(zip);
  const sessionEntry = zip.file(`${rootPrefix}Session.plist`);
  if (!sessionEntry) {
    throw new Error("Session.plist not found in .note archive");
  }
  const sessionBuffer = Buffer.from(await sessionEntry.async("arraybuffer"));
  const rawPlist = parseBinaryPlist(sessionBuffer);
  const resolvedPlist = resolveKeyedArchive(rawPlist);
  const session = parseSession(resolvedPlist);
  const images = /* @__PURE__ */ new Map();
  const imagesFolder = `${rootPrefix}Images/`;
  for (const [path2, entry] of Object.entries(zip.files)) {
    if (path2.startsWith(imagesFolder) && !entry.dir) {
      const relativePath = path2.slice(rootPrefix.length);
      const imageBuffer = Buffer.from(await entry.async("arraybuffer"));
      images.set(relativePath, imageBuffer);
    }
  }
  let metadata = { name: "Untitled", uuid: "" };
  const metadataEntry = zip.file(`${rootPrefix}metadata.plist`);
  if (metadataEntry) {
    try {
      const metaBuf = Buffer.from(await metadataEntry.async("arraybuffer"));
      const rawMeta = parseBinaryPlist(metaBuf);
      const resolvedMeta = resolveKeyedArchive(rawMeta);
      metadata = {
        name: resolvedMeta.noteName || resolvedMeta.name || "Untitled",
        uuid: resolvedMeta.uuidKey || ""
      };
    } catch {
    }
  }
  return { session, images, metadata };
}
function detectRootPrefix(zip) {
  for (const path2 of Object.keys(zip.files)) {
    const parts = path2.split("/");
    if (parts.length >= 2 && parts[1] === "Session.plist") {
      return parts[0] + "/";
    }
  }
  for (const [path2, entry] of Object.entries(zip.files)) {
    if (entry.dir && path2.endsWith("/") && !path2.includes("/", 0)) {
      return path2;
    }
  }
  return "";
}

// src/converters/coordinate-mapper.ts
function computeBoundingBox(points) {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
function toRelativePoints(points, bbox) {
  return points.map((p) => [p.x - bbox.x, p.y - bbox.y]);
}

// src/converters/color-converter.ts
function argbBytesToHex(a, r, g, b) {
  const rr = r.toString(16).padStart(2, "0");
  const gg = g.toString(16).padStart(2, "0");
  const bb = b.toString(16).padStart(2, "0");
  return {
    color: `#${rr}${gg}${bb}`,
    opacity: Math.round(a / 255 * 100)
  };
}

// src/generators/id-generator.ts
import { nanoid } from "nanoid";
import crypto from "crypto";
function generateElementId() {
  return nanoid();
}
function generateSeed() {
  return crypto.randomInt(0, 2 ** 31);
}
function generateVersionNonce() {
  return crypto.randomInt(0, 2 ** 31);
}

// src/converters/stroke-converter.ts
function convertStrokes(strokeData, options = {}) {
  const {
    scaleFactor = 1,
    strokeWidthScale = 1,
    skipIndices = /* @__PURE__ */ new Set()
  } = options;
  const elements = [];
  let pointOffset = 0;
  let attributeOffset = 0;
  for (let i = 0; i < strokeData.numCurves; i++) {
    const pointCount = strokeData.curvesNumPoints[i];
    const isShapeCurve = skipIndices.has(i);
    const attributeCount = Math.floor((pointCount - 1) / 3) + 1;
    if (pointCount < 2) {
      pointOffset += pointCount;
      attributeOffset += attributeCount;
      continue;
    }
    const rawControlPoints = strokeData.curvesPoints.slice(
      pointOffset * 2,
      (pointOffset + pointCount) * 2
    );
    const absPoints = [];
    for (let j = 0; j < pointCount; j++) {
      const idx = j * 2;
      absPoints.push({
        x: rawControlPoints[idx] * scaleFactor,
        y: rawControlPoints[idx + 1] * scaleFactor
      });
    }
    const rawForces = strokeData.curvesForces.slice(
      attributeOffset,
      attributeOffset + attributeCount
    );
    const rawFractionalWidths = strokeData.curvesFractionalWidths.slice(
      attributeOffset,
      attributeOffset + attributeCount
    );
    const rawAltitudeAngles = strokeData.curvesAltitudeAngles.slice(
      attributeOffset,
      attributeOffset + attributeCount
    );
    const rawAzimuthUnitVectors = strokeData.curvesAzimuthUnitVectors.slice(
      attributeOffset * 2,
      (attributeOffset + attributeCount) * 2
    );
    attributeOffset += attributeCount;
    let strokeColor = "#000000";
    let opacity = 100;
    let rawColor = null;
    if (i < strokeData.curvesColors.length) {
      const c = strokeData.curvesColors[i];
      rawColor = c;
      const hex = argbBytesToHex(c.a, c.r, c.g, c.b);
      strokeColor = hex.color;
      opacity = hex.opacity;
    }
    let rawCurveWidth = strokeData.defaultStrokeWidth;
    if (i < strokeData.curvesWidth.length) {
      rawCurveWidth = strokeData.curvesWidth[i];
    }
    const strokeWidth = Math.max(0.1, rawCurveWidth * strokeWidthScale);
    const bbox = computeBoundingBox(absPoints);
    const relPoints = toRelativePoints(absPoints, bbox);
    const lastPoint = relPoints[relPoints.length - 1];
    const fallbackPressure = rawForces[rawForces.length - 1] ?? 0.5;
    const now = Date.now();
    const notabilityStroke = {
      version: 1,
      source: "notability-spatial-hash",
      curveIndex: i,
      referencedByShape: isShapeCurve,
      scaleFactor,
      strokeWidthScale,
      rawControlPoints,
      rawForces,
      rawFractionalWidths,
      rawAltitudeAngles,
      rawAzimuthUnitVectors,
      rawCurveWidth,
      rawCurveStyle: i < strokeData.curvesStyles.length ? strokeData.curvesStyles[i] : null,
      rawCurveOptions: i < strokeData.curveOptions.length ? strokeData.curveOptions[i] : null,
      curveUuid: i < strokeData.curveUUIDs.length ? strokeData.curveUUIDs[i] : null,
      bezierPathData: i < strokeData.curveUUIDs.length ? strokeData.bezierPathsDataDictionary[strokeData.curveUUIDs[i]] ?? null : null,
      rawColor,
      defaultStrokeWidth: strokeData.defaultStrokeWidth,
      defaultStrokeColor: strokeData.defaultStrokeColor
    };
    elements.push({
      id: generateElementId(),
      type: "freedraw",
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      angle: 0,
      strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth,
      strokeStyle: "solid",
      roughness: 0,
      opacity,
      seed: generateSeed(),
      version: 1,
      versionNonce: generateVersionNonce(),
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: now,
      link: null,
      locked: false,
      customData: {
        notabilityStroke
      },
      points: relPoints,
      pressures: new Array(relPoints.length).fill(fallbackPressure),
      simulatePressure: rawForces.length === 0,
      lastCommittedPoint: lastPoint,
      penVariant: "pen"
    });
    pointOffset += pointCount;
  }
  return elements;
}

// src/converters/image-converter.ts
import crypto2 from "crypto";
import path from "path";
var MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml"
};
function convertImages(mediaObjects, imageFiles, scaleFactor = 1) {
  const elements = [];
  const files = {};
  const now = Date.now();
  for (const mo of mediaObjects) {
    const imageBuffer = imageFiles.get(mo.relativePath);
    if (!imageBuffer) continue;
    const fileId = crypto2.createHash("sha1").update(imageBuffer).digest("hex");
    const ext = path.extname(mo.relativePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "image/png";
    const dataURL = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
    files[fileId] = {
      mimeType,
      id: fileId,
      dataURL,
      created: now,
      lastRetrieved: now
    };
    elements.push({
      id: generateElementId(),
      type: "image",
      x: mo.rect.x * scaleFactor,
      y: mo.rect.y * scaleFactor,
      width: mo.rect.width * scaleFactor,
      height: mo.rect.height * scaleFactor,
      angle: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 0,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      seed: generateSeed(),
      version: 1,
      versionNonce: generateVersionNonce(),
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: now,
      link: null,
      locked: false,
      fileId,
      status: "saved",
      scale: [1, 1]
    });
  }
  return { elements, files };
}

// src/converters/text-converter.ts
var ALIGNMENT_MAP = {
  0: "left",
  1: "center",
  2: "right"
};
function convertText(textContent, pageWidth, fontFamily = 2) {
  const text = textContent.text.trim();
  if (!text) return [];
  const { color: strokeColor, opacity } = argbBytesToHex(
    textContent.color.a,
    textContent.color.r,
    textContent.color.g,
    textContent.color.b
  );
  const fontSize = textContent.fontSize || 20;
  const textAlign = ALIGNMENT_MAP[textContent.alignment] || "left";
  const lines = text.split("\n");
  const lineHeight = 1.25;
  const charWidth = fontSize * 0.6;
  const maxLineLength = Math.max(...lines.map((l) => l.length));
  const width = Math.min(maxLineLength * charWidth, pageWidth);
  const height = lines.length * fontSize * lineHeight;
  const now = Date.now();
  return [
    {
      id: generateElementId(),
      type: "text",
      x: 0,
      y: 0,
      width,
      height,
      angle: 0,
      strokeColor,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity,
      seed: generateSeed(),
      version: 1,
      versionNonce: generateVersionNonce(),
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: now,
      link: null,
      locked: false,
      text,
      fontSize,
      fontFamily,
      textAlign,
      verticalAlign: "top",
      baseline: fontSize,
      containerId: null,
      originalText: text,
      autoResize: true,
      lineHeight
    }
  ];
}

// src/converters/shape-converter.ts
function convertShapes(shapes, options = {}) {
  const { scaleFactor = 1, strokeWidthScale = 1 } = options;
  const elements = [];
  const now = Date.now();
  for (const shape of shapes) {
    const { color: strokeColor, opacity } = argbBytesToHex(
      shape.strokeColor.a,
      shape.strokeColor.r,
      shape.strokeColor.g,
      shape.strokeColor.b
    );
    const strokeWidth = Math.max(0.5, shape.strokeWidth * strokeWidthScale);
    if (shape.kind === "line" && shape.startPt && shape.endPt) {
      elements.push(
        createLineElement(
          shape,
          strokeColor,
          opacity,
          strokeWidth,
          scaleFactor,
          now
        )
      );
    } else if (shape.kind === "circle" || shape.kind === "ellipse") {
      elements.push(
        createEllipseElement(shape, strokeColor, opacity, strokeWidth, scaleFactor, now)
      );
    } else if (shape.kind === "polygon") {
      elements.push(
        createRectLineElement(shape, strokeColor, opacity, strokeWidth, scaleFactor, now)
      );
    }
  }
  return elements;
}
function createLineElement(shape, strokeColor, opacity, strokeWidth, scaleFactor, now) {
  const x = shape.startPt[0] * scaleFactor;
  const y = shape.startPt[1] * scaleFactor;
  const dx = (shape.endPt[0] - shape.startPt[0]) * scaleFactor;
  const dy = (shape.endPt[1] - shape.startPt[1]) * scaleFactor;
  return {
    id: generateElementId(),
    type: "line",
    x,
    y,
    width: Math.abs(dx),
    height: Math.abs(dy),
    angle: 0,
    strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth,
    strokeStyle: "solid",
    roughness: 0,
    opacity,
    seed: generateSeed(),
    version: 1,
    versionNonce: generateVersionNonce(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    customData: buildShapeCustomData(shape),
    points: [
      [0, 0],
      [dx, dy]
    ],
    lastCommittedPoint: [dx, dy],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null
  };
}
function createEllipseElement(shape, strokeColor, opacity, strokeWidth, scaleFactor, now) {
  const x = shape.rect[0][0] * scaleFactor;
  const y = shape.rect[0][1] * scaleFactor;
  const width = shape.rect[1][0] * scaleFactor;
  const height = shape.rect[1][1] * scaleFactor;
  return {
    id: generateElementId(),
    type: "ellipse",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth,
    strokeStyle: "solid",
    roughness: 0,
    opacity,
    seed: generateSeed(),
    version: 1,
    versionNonce: generateVersionNonce(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    customData: buildShapeCustomData(shape)
  };
}
function createRectLineElement(shape, strokeColor, opacity, strokeWidth, scaleFactor, now) {
  const x = shape.rect[0][0] * scaleFactor;
  const y = shape.rect[0][1] * scaleFactor;
  const width = shape.rect[1][0] * scaleFactor;
  const height = shape.rect[1][1] * scaleFactor;
  const points = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
    [0, 0]
  ];
  return {
    id: generateElementId(),
    type: "line",
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    angle: 0,
    strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth,
    strokeStyle: "solid",
    roughness: 0,
    opacity,
    seed: generateSeed(),
    version: 1,
    versionNonce: generateVersionNonce(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    customData: buildShapeCustomData(shape),
    points,
    lastCommittedPoint: [0, 0],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null
  };
}
function getShapeCurveIndices(shapes) {
  return new Set(shapes.map((s) => s.curveIndex));
}
function buildShapeCustomData(shape) {
  return {
    notabilityShape: {
      kind: shape.kind,
      curveIndex: shape.curveIndex,
      rect: shape.rect,
      startPt: shape.startPt,
      endPt: shape.endPt,
      strokeWidth: shape.strokeWidth,
      strokeColor: shape.strokeColor
    }
  };
}

// src/generators/excalidraw-scene.ts
function buildScene(elements, files, notability) {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: "#ffffff"
    },
    files,
    notability
  };
}

// src/generators/markdown-writer.ts
import LZString from "lz-string";
function generateExcalidrawMarkdown(scene, compress = true) {
  const parts = [];
  parts.push("---\n\n");
  parts.push("excalidraw-plugin: parsed\n");
  parts.push("tags: [excalidraw]\n");
  parts.push("\n---\n");
  parts.push(
    "==\u26A0  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. \u26A0== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'\n"
  );
  parts.push("\n");
  parts.push("\n# Excalidraw Data\n\n");
  parts.push("## Text Elements\n");
  const textElements = scene.elements.filter((e) => e.type === "text");
  for (const el of textElements) {
    if ("text" in el) {
      parts.push(`${el.text} ^${el.id}

`);
    }
  }
  parts.push("%%\n");
  parts.push("## Drawing\n");
  const json = JSON.stringify(scene);
  if (compress) {
    const compressed = LZString.compressToBase64(json);
    const lines = compressed.match(/.{1,256}/g) || [];
    parts.push("```compressed-json\n");
    parts.push(lines.join("\n"));
    parts.push("\n```\n");
  } else {
    parts.push("```json\n");
    parts.push(json);
    parts.push("\n```\n");
  }
  parts.push("%%");
  return parts.join("");
}

// src/index.ts
async function convertNoteToScene(input, options = {}) {
  const archive = await parseNoteArchive(input);
  const { session, images } = archive;
  const scaleFactor = options.scaleFactor ?? 1;
  const strokeWidthScale = options.strokeWidthScale ?? 1;
  const shapeCurveIndices = getShapeCurveIndices(session.shapes);
  const shapeElements = convertShapes(session.shapes, {
    scaleFactor,
    strokeWidthScale
  });
  const freedrawElements = convertStrokes(session.strokes, {
    scaleFactor,
    strokeWidthScale,
    skipIndices: shapeCurveIndices
  });
  const { elements: imageElements, files } = convertImages(
    session.mediaObjects,
    images,
    scaleFactor
  );
  const textElements = convertText(
    session.textContent,
    session.pageWidth,
    options.defaultFontFamily
  );
  const allElements = [
    ...imageElements,
    ...shapeElements,
    ...freedrawElements,
    ...textElements
  ];
  return buildScene(allElements, files, {
    pageWidth: session.pageWidth,
    paperSize: session.paperSize,
    paperOrientation: session.paperOrientation
  });
}
async function convertNote(input, options = {}) {
  const scene = await convertNoteToScene(input, options);
  const compress = options.compress !== false;
  return generateExcalidrawMarkdown(scene, compress);
}
async function convertNoteToFile(inputPath, outputPath, options = {}) {
  const markdown = await convertNote(inputPath, options);
  fs2.writeFileSync(outputPath, markdown, "utf-8");
}
export {
  convertNote,
  convertNoteToFile,
  convertNoteToScene
};
