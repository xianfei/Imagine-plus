declare module 'libheif-js/wasm-bundle' {
  interface HeifImage {
    get_width(): number
    get_height(): number
    display(
      target: { data: Uint8ClampedArray, width: number, height: number },
      callback: (result: unknown) => void,
    ): void
  }

  class HeifDecoder {
    decode(buffer: Uint8Array | ArrayBuffer): HeifImage[]
  }

  const libheif: { HeifDecoder: typeof HeifDecoder, default?: { HeifDecoder: typeof HeifDecoder } }
  export = libheif
}
