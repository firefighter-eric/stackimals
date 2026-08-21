declare module 'node:fs' {
  export function readFileSync(path: string | URL): Uint8Array;
}

declare module 'node:module' {
  interface NodeRequire {
    (id: string): unknown;
    resolve(id: string): string;
  }

  export function createRequire(filename: string | URL): NodeRequire;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array;
}
