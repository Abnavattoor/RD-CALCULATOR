/**
 * Polyfill DOMMatrix for Node.js / SSR / test environments where PDF.js 5+ expects DOMMatrix
 */
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    m11 = 1;
    m12 = 0;
    m21 = 0;
    m22 = 1;
    m41 = 0;
    m42 = 0;
    is2D = true;
    isIdentity = true;
    constructor(init?: any) {
      if (Array.isArray(init)) {
        this.a = init[0] ?? 1;
        this.b = init[1] ?? 0;
        this.c = init[2] ?? 0;
        this.d = init[3] ?? 1;
        this.e = init[4] ?? 0;
        this.f = init[5] ?? 0;
      }
    }
    multiply(other: any) { return this; }
    translate(tx: number, ty: number) { return this; }
    scale(sx: number, sy?: number) { return this; }
    rotate(angle: number) { return this; }
    transformPoint(point: any) { return point; }
  };
}

export {};
