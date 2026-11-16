// Tiny SDF sculpting kit: build smooth, single-surface character parts from blended primitives,
// mesh them with Surface Nets, project vertices onto the true surface, take normals from the SDF
// gradient, and bake ambient occlusion so creases (cheeks, sockets, belly, toes) read as shadow.
import * as THREE from 'three';

// ---------- SDF primitives & operators ----------
export const sdSphere = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;

export function sdEllipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx;
  const py = (y - cy) / ry;
  const pz = (z - cz) / rz;
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / rx, py / ry, pz / rz);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

export function sdCapsule(x, y, z, ax, ay, az, bx, by, bz, r) {
  const pax = x - ax;
  const pay = y - ay;
  const paz = z - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

// polynomial smooth union
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// smooth subtraction: carve `cut` out of `base`
export function ssub(base, cut, k) {
  const h = Math.max(0, Math.min(1, 0.5 - (0.5 * (base + cut)) / k));
  return base * (1 - h) + -cut * h + k * h * (1 - h);
}

// ---------- Surface Nets mesher ----------
export function meshSDF(sdf, min, max, cell, { project = 2, aoScale = 1 } = {}) {
  const [x0, y0, z0] = min;
  const nx = Math.ceil((max[0] - x0) / cell) + 1;
  const ny = Math.ceil((max[1] - y0) / cell) + 1;
  const nz = Math.ceil((max[2] - z0) / cell) + 1;
  const field = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) field[id(i, j, k)] = sdf(x0 + i * cell, y0 + j * cell, z0 + k * cell);
    }
  }
  const cx = nx - 1;
  const cy = ny - 1;
  const cz = nz - 1;
  const cellVert = new Int32Array(cx * cy * cz).fill(-1);
  const cid = (i, j, k) => i + cx * (j + cy * k);
  const pos = [];
  const corners = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const [a, b, d] = corners[c];
          v[c] = field[id(i + a, j + b, k + d)];
          if (v[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [e0, e1] of edges) {
          const a = v[e0];
          const b = v[e1];
          if (a < 0 === b < 0) continue;
          const t = a / (a - b);
          const p0 = corners[e0];
          const p1 = corners[e1];
          sx += p0[0] + (p1[0] - p0[0]) * t;
          sy += p0[1] + (p1[1] - p0[1]) * t;
          sz += p0[2] + (p1[2] - p0[2]) * t;
          n++;
        }
        cellVert[cid(i, j, k)] = pos.length / 3;
        pos.push(x0 + (i + sx / n) * cell, y0 + (j + sy / n) * cell, z0 + (k + sz / n) * cell);
      }
    }
  }
  const tris = [];
  const quad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < cz; k++) {
    for (let j = 1; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        // edge along x from grid (i,j,k)
        const a = field[id(i, j, k)] < 0;
        const b = field[id(i + 1, j, k)] < 0;
        if (a !== b) quad(cellVert[cid(i, j - 1, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i, j - 1, k)]);
      }
    }
  }
  for (let k = 1; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 1; i < cx; i++) {
        const a = field[id(i, j, k)] < 0;
        const b = field[id(i, j + 1, k)] < 0;
        if (a !== b) quad(cellVert[cid(i - 1, j, k - 1)], cellVert[cid(i, j, k - 1)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)]);
      }
    }
  }
  for (let k = 0; k < cz; k++) {
    for (let j = 1; j < cy; j++) {
      for (let i = 1; i < cx; i++) {
        const a = field[id(i, j, k)] < 0;
        const b = field[id(i, j, k + 1)] < 0;
        if (a !== b) quad(cellVert[cid(i - 1, j - 1, k)], cellVert[cid(i, j - 1, k)], cellVert[cid(i, j, k)], cellVert[cid(i - 1, j, k)]);
      }
    }
  }

  // Project onto the true surface and take normals from the gradient
  const h = cell * 0.25;
  const grad = (x, y, z, out) => {
    out[0] = sdf(x + h, y, z) - sdf(x - h, y, z);
    out[1] = sdf(x, y + h, z) - sdf(x, y - h, z);
    out[2] = sdf(x, y, z + h) - sdf(x, y, z - h);
    const l = Math.hypot(out[0], out[1], out[2]) || 1;
    out[0] /= l;
    out[1] /= l;
    out[2] /= l;
    return out;
  };
  const g = [0, 0, 0];
  const nrm = new Float32Array(pos.length);
  for (let p = 0; p < pos.length; p += 3) {
    for (let it = 0; it < project; it++) {
      const d = sdf(pos[p], pos[p + 1], pos[p + 2]);
      grad(pos[p], pos[p + 1], pos[p + 2], g);
      pos[p] -= g[0] * d;
      pos[p + 1] -= g[1] * d;
      pos[p + 2] -= g[2] * d;
    }
    grad(pos[p], pos[p + 1], pos[p + 2], g);
    nrm[p] = g[0];
    nrm[p + 1] = g[1];
    nrm[p + 2] = g[2];
  }
  // Orient triangles outward (agree with the SDF gradient)
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t] * 3;
    const b = tris[t + 1] * 3;
    const c = tris[t + 2] * 3;
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    const tx = uy * vz - uz * vy;
    const ty = uz * vx - ux * vz;
    const tz = ux * vy - uy * vx;
    const dot = tx * (nrm[a] + nrm[b] + nrm[c]) + ty * (nrm[a + 1] + nrm[b + 1] + nrm[c + 1]) + tz * (nrm[a + 2] + nrm[b + 2] + nrm[c + 2]);
    if (dot < 0) {
      const tmp = tris[t + 1];
      tris[t + 1] = tris[t + 2];
      tris[t + 2] = tmp;
    }
  }
  // Ambient occlusion: how much the surface is "closed in" along its normal
  const ao = new Float32Array(pos.length / 3);
  for (let p = 0, vi = 0; p < pos.length; p += 3, vi++) {
    let occ = 0;
    let w = 1;
    for (let s = 1; s <= 5; s++) {
      const dist = 0.014 * s * aoScale;
      const d = sdf(pos[p] + nrm[p] * dist, pos[p + 1] + nrm[p + 1] * dist, pos[p + 2] + nrm[p + 2] * dist);
      occ += Math.max(0, dist - d) * w;
      w *= 0.7;
    }
    ao[vi] = Math.max(0.5, Math.min(1, 1 - occ * (10 / aoScale)));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(tris);
  geo.computeBoundingSphere();
  return { geo, ao, positions: pos, normals: nrm };
}

// Find where the ray from `origin` along `dir` exits the surface (origin may be inside the
// shape): start `maxDist` out along the ray and sphere-trace back toward the origin.
export function traceSurface(sdf, origin, dir, maxDist = 1) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d0 = [dir[0] / l, dir[1] / l, dir[2] / l];
  const start = [origin[0] + d0[0] * maxDist, origin[1] + d0[1] * maxDist, origin[2] + d0[2] * maxDist];
  return marchToSurface(sdf, start, [-d0[0], -d0[1], -d0[2]], maxDist);
}

function marchToSurface(sdf, origin, dir, maxDist = 1) {
  let t = 0;
  for (let i = 0; i < 80 && t < maxDist; i++) {
    const x = origin[0] + dir[0] * t;
    const y = origin[1] + dir[1] * t;
    const z = origin[2] + dir[2] * t;
    const d = sdf(x, y, z);
    if (Math.abs(d) < 0.0005) return [x, y, z];
    t += Math.max(0.002, Math.abs(d)) * (d > 0 ? 1 : -1) * 0.9;
    if (t < 0) t = 0;
  }
  return [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
}

// Write vertex colours from a per-vertex colour function (base colours in linear space)
export function paintVertices(geo, fn) {
  const pos = geo.attributes.position.array;
  const n = pos.length / 3;
  let col = geo.attributes.color;
  if (!col) {
    col = new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute('color', col);
  }
  const out = new THREE.Color();
  for (let i = 0; i < n; i++) {
    fn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], i, out);
    col.array[i * 3] = out.r;
    col.array[i * 3 + 1] = out.g;
    col.array[i * 3 + 2] = out.b;
  }
  col.needsUpdate = true;
}
