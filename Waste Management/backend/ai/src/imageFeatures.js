/**
 * Facts read directly from the uploaded bytes, with no native image
 * dependency. These are genuinely measured — they are what the fraud model
 * and the confidence damping are built on.
 */

/** Dimensions from the JPEG SOF / PNG IHDR / WebP VP8X headers. */
export function imageSize(buffer) {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'png' };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7), format: 'jpeg' };
      }
      offset += 2 + length;
    }
  }
  if (buffer.length > 30 && buffer.toString('ascii', 8, 12) === 'WEBP' && buffer.toString('ascii', 12, 16) === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3), format: 'webp' };
  }
  return { width: 0, height: 0, format: 'unknown' };
}

/**
 * EXIF presence and a few useful tags. A camera photo carries EXIF; a
 * screenshot or a re-saved download usually does not — one of the strongest
 * cheap signals for the fake-report classifier.
 */
export function readExif(buffer) {
  const result = { hasExif: false, make: null, model: null, dateTime: null, hasGps: false, orientation: null };
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return result;

  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xda) break; // start of scan — headers are done
    const length = buffer.readUInt16BE(offset + 2);

    if (marker === 0xe1 && buffer.toString('ascii', offset + 4, offset + 10) === 'Exif\0\0') {
      result.hasExif = true;
      try {
        Object.assign(result, parseTiff(buffer.subarray(offset + 10, offset + 2 + length)));
      } catch {
        /* malformed EXIF is itself a weak signal; presence is what we keep */
      }
      return result;
    }
    offset += 2 + length;
  }
  return result;
}

function parseTiff(tiff) {
  const little = tiff.toString('ascii', 0, 2) === 'II';
  const u16 = (o) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));

  const out = {};
  const ifd0 = u32(4);
  const count = u16(ifd0);

  for (let i = 0; i < count; i += 1) {
    const entry = ifd0 + 2 + i * 12;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const valueCount = u32(entry + 4);
    const valueOffset = u32(entry + 8);

    const readString = () => {
      if (valueCount > 4 && valueOffset + valueCount <= tiff.length) {
        return tiff.toString('ascii', valueOffset, valueOffset + valueCount).replace(/\0+$/, '').trim();
      }
      return null;
    };

    if (tag === 0x010f) out.make = readString();
    if (tag === 0x0110) out.model = readString();
    if (tag === 0x0132) out.dateTime = readString();
    if (tag === 0x0112 && type === 3) out.orientation = u16(entry + 8);
    if (tag === 0x8825) out.hasGps = true;
  }
  return out;
}

/**
 * Shannon entropy over a byte histogram, normalised to 0..1. Photographic
 * detail scores high; flat, blurred or heavily re-compressed frames score low.
 */
export function byteEntropy(buffer, sampleBytes = 65536) {
  const step = Math.max(1, Math.floor(buffer.length / sampleBytes));
  const histogram = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < buffer.length; i += step) {
    histogram[buffer[i]] += 1;
    n += 1;
  }
  let entropy = 0;
  for (const freq of histogram) {
    if (!freq) continue;
    const p = freq / n;
    entropy -= p * Math.log2(p);
  }
  return entropy / 8;
}

/** Bytes per pixel after compression — a usable sharpness/blur proxy. */
export function detailDensity(buffer, size) {
  const pixels = Math.max(1, size.width * size.height);
  return Math.min(1, (buffer.length / pixels) * 4);
}

export function describe(buffer) {
  const size = imageSize(buffer);
  const exif = readExif(buffer);
  const entropy = byteEntropy(buffer);
  const detail = detailDensity(buffer, size);

  return {
    size,
    exif,
    entropy: Number(entropy.toFixed(3)),
    detail: Number(detail.toFixed(3)),
    megapixels: Number(((size.width * size.height) / 1e6).toFixed(2)),
    bytes: buffer.length,
    quality: entropy > 0.86 ? 'good' : entropy > 0.7 ? 'fair' : 'poor',
  };
}

export default { imageSize, readExif, byteEntropy, detailDensity, describe };
