/**
 * Safe binary buffer utilities for local document processing, Web Worker isolation,
 * and structured-clone-safe IndexedDB persistence.
 */

export function isArrayBufferDetached(buffer: ArrayBuffer): boolean {
  const maybeWithDetached = buffer as ArrayBuffer & { detached?: boolean };
  if (maybeWithDetached.detached === true) {
    return true;
  }

  try {
    // ECMAScript spec: ArrayBuffer.prototype.slice throws TypeError if IsDetachedBuffer is true.
    buffer.slice(0, 0);
    return false;
  } catch {
    return true;
  }
}

/**
 * Produces an independent, non-detached ArrayBuffer copy from either an ArrayBuffer
 * or any ArrayBufferView (such as Uint8Array), strictly honoring byteOffset and byteLength.
 */
export function cloneBinaryToArrayBuffer(
  input: ArrayBuffer | ArrayBufferView,
  expectedByteLength?: number
): ArrayBuffer {
  let sourceView: Uint8Array;

  if (ArrayBuffer.isView(input)) {
    const backing = input.buffer;
    if (backing instanceof ArrayBuffer && isArrayBufferDetached(backing)) {
      throw new Error(
        'Cannot copy binary view: the underlying ArrayBuffer has been detached.'
      );
    }
    sourceView = new Uint8Array(backing, input.byteOffset, input.byteLength);
  } else {
    if (isArrayBufferDetached(input)) {
      throw new Error(
        'Cannot copy document buffer: the ArrayBuffer is detached and can no longer be cloned.'
      );
    }
    sourceView = new Uint8Array(input);
  }

  if (
    typeof expectedByteLength === 'number' &&
    expectedByteLength > 0 &&
    sourceView.byteLength !== expectedByteLength
  ) {
    throw new Error(
      `Document binary size mismatch: expected ${expectedByteLength} bytes, got ${sourceView.byteLength} bytes.`
    );
  }

  const copy = new Uint8Array(sourceView.byteLength);
  copy.set(sourceView);

  if (isArrayBufferDetached(copy.buffer)) {
    throw new Error('Failed to allocate a non-detached ArrayBuffer copy.');
  }

  return copy.buffer;
}

/**
 * Returns a Uint8Array backed by its own freshly cloned ArrayBuffer.
 * Safe to pass into PDF.js / Web Workers that may transfer ownership of the buffer.
 */
export function cloneToFreshUint8Array(
  input: ArrayBuffer | ArrayBufferView
): Uint8Array {
  return new Uint8Array(cloneBinaryToArrayBuffer(input));
}

/**
 * Defensive check before writing binary document payloads to IndexedDB or disk vault.
 * Guarantees the returned ArrayBuffer is non-detached, structured-clone-safe, and untruncated.
 */
export function assertValidStorableBinary(
  input: ArrayBuffer | ArrayBufferView | undefined,
  options: {
    required?: boolean;
    expectedByteLength?: number;
    label?: string;
  } = {}
): ArrayBuffer | undefined {
  const { required = false, expectedByteLength, label = 'document' } = options;

  if (!input) {
    if (required) {
      throw new Error(
        `Missing binary payload for "${label}". Please re-select the file and try again.`
      );
    }
    return undefined;
  }

  const cloned = cloneBinaryToArrayBuffer(input, expectedByteLength);

  if (required && cloned.byteLength === 0) {
    throw new Error(`Binary payload for "${label}" is empty (0 bytes).`);
  }

  if (isArrayBufferDetached(cloned)) {
    throw new Error(`Binary payload for "${label}" became detached before storage.`);
  }

  return cloned;
}
