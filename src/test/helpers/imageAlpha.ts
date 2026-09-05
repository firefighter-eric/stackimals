import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import sharp from 'sharp';

export interface PixelBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface AlphaImage {
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

/** Decode the actual delivered WebP, including padding and its alpha plane. */
export async function decodeWebpAlpha(url: URL): Promise<AlphaImage> {
  const { data, info } = await sharp(readFileSync(url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Uint8Array.from({ length: info.width * info.height }, (_, index) => data[index * info.channels + info.channels - 1]!);
  return { width: info.width, height: info.height, alpha };
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! * 0x1000000
    + bytes[offset + 1]! * 0x10000
    + bytes[offset + 2]! * 0x100
    + bytes[offset + 3]!
  );
}

function chunkName(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!,
  );
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function paethPredictor(left: number, above: number, upperLeft: number): number {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

/** Decodes the alpha plane from the checked-in, non-interlaced RGBA PNG sources. */
export function decodeRgbaPngAlpha(url: URL): AlphaImage {
  const bytes = readFileSync(url);
  if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error(`${url.pathname} is not a PNG file.`);
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const imageChunks: Uint8Array[] = [];

  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = readUint32BE(bytes, offset);
    const type = chunkName(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      throw new Error(`${url.pathname} contains a truncated ${type} chunk.`);
    }

    if (type === 'IHDR') {
      width = readUint32BE(bytes, dataStart);
      height = readUint32BE(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8]!;
      colorType = bytes[dataStart + 9]!;
      interlace = bytes[dataStart + 12]!;
    } else if (type === 'IDAT') {
      imageChunks.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0 || bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `${url.pathname} must be an 8-bit, non-interlaced RGBA PNG; got ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}.`,
    );
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(concatenate(imageChunks));
  const expectedLength = (stride + 1) * height;
  if (inflated.length !== expectedLength) {
    throw new Error(`${url.pathname} decoded to ${inflated.length} bytes; expected ${expectedLength}.`);
  }

  const alpha = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset++]!;
    const row = new Uint8Array(stride);

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset++]!;
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel]! : 0;
      const above = previous[x]!;
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel]! : 0;
      let reconstructed: number;

      switch (filter) {
        case 0:
          reconstructed = raw;
          break;
        case 1:
          reconstructed = raw + left;
          break;
        case 2:
          reconstructed = raw + above;
          break;
        case 3:
          reconstructed = raw + Math.floor((left + above) / 2);
          break;
        case 4:
          reconstructed = raw + paethPredictor(left, above, upperLeft);
          break;
        default:
          throw new Error(`${url.pathname} uses unsupported PNG filter ${filter}.`);
      }

      row[x] = reconstructed & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      alpha[y * width + x] = row[x * bytesPerPixel + 3]!;
    }
    previous = row;
  }

  return { width, height, alpha };
}

export function findAlphaBounds(image: AlphaImage, threshold: number): PixelBounds {
  let minX = image.width;
  let maxX = -1;
  let minY = image.height;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.alpha[y * image.width + x]! < threshold) {
        continue;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`Image has no pixels at or above alpha ${threshold}.`);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + bytes[offset + 1]! * 0x100 + bytes[offset + 2]! * 0x10000;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + bytes[offset + 1]! * 0x100;
}

/** Reads the canvas dimensions from VP8X, VP8L, or VP8 WebP headers. */
export function readWebpSize(url: URL): { width: number; height: number } {
  const bytes = readFileSync(url);
  if (chunkName(bytes, 0) !== 'RIFF' || chunkName(bytes, 8) !== 'WEBP') {
    throw new Error(`${url.pathname} is not a WebP file.`);
  }

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = chunkName(bytes, offset);
    const length = (
      bytes[offset + 4]!
      + bytes[offset + 5]! * 0x100
      + bytes[offset + 6]! * 0x10000
      + bytes[offset + 7]! * 0x1000000
    );
    const dataStart = offset + 8;

    if (type === 'VP8X' && length >= 10) {
      return {
        width: readUint24LE(bytes, dataStart + 4) + 1,
        height: readUint24LE(bytes, dataStart + 7) + 1,
      };
    }

    if (type === 'VP8L' && length >= 5 && bytes[dataStart] === 0x2f) {
      const b1 = bytes[dataStart + 1]!;
      const b2 = bytes[dataStart + 2]!;
      const b3 = bytes[dataStart + 3]!;
      const b4 = bytes[dataStart + 4]!;
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }

    if (
      type === 'VP8 '
      && length >= 10
      && bytes[dataStart + 3] === 0x9d
      && bytes[dataStart + 4] === 0x01
      && bytes[dataStart + 5] === 0x2a
    ) {
      return {
        width: readUint16LE(bytes, dataStart + 6) & 0x3fff,
        height: readUint16LE(bytes, dataStart + 8) & 0x3fff,
      };
    }

    offset = dataStart + length + (length % 2);
  }

  throw new Error(`${url.pathname} has no supported WebP dimensions header.`);
}
