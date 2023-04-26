/**
 * Copyright (c) 2022-2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Ke Ma <mark.ma@rcsb.org>
 */

import { Camera } from 'molstar/lib/mol-canvas3d/camera';
import { Structure } from 'molstar/lib/mol-model/structure';
import { FocusFactoryI } from './focus-factory-interface';
import { getPositions, ImageRenderer } from '../render';
import { PrincipalAxes } from 'molstar/lib/mol-math/linear-algebra/matrix/principal-axes';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra/3d/vec3';
import { calculateDisplacement } from './focus-util';
export class FocusFirstResidue implements FocusFactoryI {
    public getFocus(imageRender: ImageRenderer): (structure: Structure) => void {

        return (structure: Structure) => {

            imageRender.canvas3d.camera.setState({
                ...Camera.createDefaultSnapshot(),
                mode: 'orthographic'
            });
            const caPositions = getPositions(structure);
            const principalAxes = PrincipalAxes.ofPositions(caPositions);
            const positionToFlip = getFirstResidueOrAveragePosition(structure, caPositions);
            const { origin, dirA, dirB, dirC } = principalAxes.boxAxes;

            const { aroundX, aroundY } = getAxesToFlip(positionToFlip, origin, dirA, dirB);
            if (aroundY) {
                Vec3.negate(dirC, dirC);
            } else if (aroundX) {
                Vec3.negate(dirA, dirA);
                Vec3.negate(dirC, dirC);
            }

            const radius = Vec3.magnitude(dirC);
            // move camera far in the direction from the origin, so we get a view from the outside
            const position = Vec3();
            Vec3.scaleAndAdd(position, position, origin, 100);
            imageRender.canvas3d.camera.setState({ position }, 0);
            // tight zoom

            // Counteract the matchDirection() in focus()
            const deltaDistance = Vec3();
            Vec3.negate(deltaDistance, position);
            if (Vec3.dot(deltaDistance, dirC) <= 0) {
                Vec3.negate(imageRender.canvas3d.camera.position, position);
            }
            const up = Vec3.create(0, 1, 0);
            if (Vec3.dot(up, dirA) <= 0) {
                Vec3.negate(imageRender.canvas3d.camera.up, imageRender.canvas3d.camera.up);
            }
            imageRender.canvas3d.camera.focus(origin, radius, 0, dirA, dirC);
            // ensure nothing is clipped off in the front
            const state = Camera.copySnapshot(Camera.createDefaultSnapshot(), imageRender.canvas3d.camera.state);
            state.radius = structure.boundary.sphere.radius;
            state.radiusMax = structure.boundary.sphere.radius;
            imageRender.canvas3d.camera.setState(state);
        };
    }
}

function getAxesToFlip(position: Vec3, origin: Vec3, up: Vec3, normalDir: Vec3) {
    const toYAxis = calculateDisplacement(position, origin, normalDir);
    const toXAxis = calculateDisplacement(position, origin, up);
    return {
        aroundX: toXAxis < 0,
        aroundY: toYAxis < 0,
    };
}

function getFirstResidueOrAveragePosition(structure: Structure, caPositions: Float32Array): Vec3 {
    // if only one chain => first residue coordinates
    if (structure.units.length === 1) {
        return Vec3.create(caPositions[0], caPositions[1], caPositions[2]);
    } else {
    // if more than one chain, return average of the coordinates of the first polymer chain
        const pos = Vec3.zero();
        const center = Vec3.zero();
        let atomIndexs;
        if (structure.units[0].props.polymerElements) {
            atomIndexs = structure.units[0].props.polymerElements;
        } else {
            atomIndexs = structure.units[0].elements;
        }
        const { position } = structure.units[0].conformation;
        for (let i = 0; i < atomIndexs.length; i++) {
            position(atomIndexs[i], pos);
            Vec3.add(center, center, pos);
        }
        Vec3.scale(center, center, 1 / atomIndexs.length);
        return center;
    }
}