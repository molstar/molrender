/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
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

            const toFlip = this.getAxesToFlip(positionToFlip, origin, dirA, dirB);
            toFlip.forEach((axis)=>{
                if (axis === 'aroundY') {
                    Vec3.negate(dirC, dirC);
                } else if (axis === 'aroundX') {
                    Vec3.negate(dirA, dirA);
                    Vec3.negate(dirC, dirC);
                }
            });

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
    getAxesToFlip(position: Vec3, origin: Vec3, up: Vec3, normalDir: Vec3) {
        const toYAxis = calculateDisplacement(position, origin, normalDir);
        const toXAxis = calculateDisplacement(position, origin, up);
        const Axes: string[] = [];
        if (toYAxis < 0) Axes.push('aroundY');
        if (toXAxis < 0) Axes.push('aroundX');
        return Axes;
    }
}

function getFirstResidueOrAveragePosition(structure: Structure, caPositions: Float32Array): Vec3 {
    //TODO Is this the best way to test single chain?
    // if only one chain => first residue coordinates
    if (structure.units.length === 1) {
        return Vec3.create(caPositions[0], caPositions[1], caPositions[2]);
    } else {
    // if more than one chain => average of coordinates of the first chain
        const tmpMatrixPos = Vec3.zero();
        let atomIndexs;
        if (structure.units[0].props.polymerElements) {
            atomIndexs = structure.units[0].props.polymerElements;
        } else {
            atomIndexs = structure.units[0].elements;
        }
        const firstChainPositions = [];
        const readPosition = structure.units[0].conformation.position;
        for (let i = 0; i < atomIndexs.length; i++) {
            const coordinates = readPosition(atomIndexs[i], tmpMatrixPos);
            for (let j = 0; j < coordinates.length; j++) {
                firstChainPositions.push(coordinates[j]);
            }
        }
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        for (let i = 0; i < firstChainPositions.length; i += 3) {
            sumX += firstChainPositions[i];
            sumY += firstChainPositions[i + 1];
            sumZ += firstChainPositions[i + 2];
        }
        const averagePosition = Vec3.zero();
        averagePosition[0] = sumX / atomIndexs.length;
        averagePosition[1] = sumY / atomIndexs.length;
        averagePosition[2] = sumZ / atomIndexs.length;
        return averagePosition;
    }
}