/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Ke Ma <mark.ma@rcsb.org>
 */

import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';

export function calculateDisplacement(position: Vec3, origin: Vec3, normalDir: Vec3) {
    const A = normalDir[0];
    const B = normalDir[1];
    const C = normalDir[2];
    const D = -A * origin[0] - B * origin[1] - C * origin[2];

    const x = position[0];
    const y = position[1];
    const z = position[2];

    const displacement = (A * x + B * y + C * z + D) / Math.sqrt(A * A + B * B + C * C);
    return displacement;
}

