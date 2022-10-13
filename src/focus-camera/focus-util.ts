/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Ke Ma <mark.ma@rcsb.org>
 */

import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';

export function calculateDisplacement(positions: Float32Array, origin: Vec3, normalDir: Vec3) {
    const toReturn = new Float32Array(positions.length / 3);
    const A = normalDir[0];
    const B = normalDir[1];
    const C = normalDir[2];
    const D = -A * origin[0] - B * origin[1] - C * origin[2];
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        const displacement = (A * x + B * y + C * z + D) / Math.sqrt(A * A + B * B + C * C);
        toReturn[i / 3] = displacement;
    }
    return toReturn;
}

