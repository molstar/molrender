import { Camera } from "molstar/lib/mol-canvas3d/camera";
import { Structure } from "molstar/lib/mol-model/structure";
import { FocusFactoryI } from "./focus-factory-interface";
import { getPositions, ImageRenderer } from "../render"
import { PrincipalAxes } from "molstar/lib/mol-math/linear-algebra/matrix/principal-axes";
import { Vec3 } from "molstar/lib/mol-math/linear-algebra/3d/vec3";
import { calculateDisplacement } from "./focus-util";
export class FocusFirstResidue implements FocusFactoryI {
    public getFocus(imageRender: ImageRenderer): (structure: Structure) => void {
        
        return (structure: Structure) => {

            imageRender.canvas3d.camera.setState({
                ...Camera.createDefaultSnapshot(),
                mode:"orthographic"
            });
            const caPositions=getPositions(structure)
            const principalAxes = PrincipalAxes.ofPositions(caPositions);
            
            let { origin,dirA,dirB,dirC } = principalAxes.boxAxes;

            const toFlip=this.getAxesToFlip(caPositions,origin,dirA,dirB)
            toFlip.forEach((axis)=>{
                if(axis=='aroundY'){
                    Vec3.negate(dirC,dirC)
                }
                else if(axis=='aroundX'){
                    Vec3.negate(dirA,dirA)
                    Vec3.negate(dirC,dirC)
                }
            })

            const radius = Vec3.magnitude(dirC);
            // move camera far in the direction from the origin, so we get a view from the outside
            const position = Vec3();
            Vec3.scaleAndAdd(position, position, origin, 100);
            imageRender.canvas3d.camera.setState({position}, 0);
            // tight zoom

            // Counteract the matchDirection() in focus()
            const deltaDistance=Vec3();
            Vec3.negate(deltaDistance,position);
            if(Vec3.dot(deltaDistance,dirC)<=0){
                Vec3.negate(imageRender.canvas3d.camera.position,position)
            }
            const up = Vec3.create(0, 1, 0);
            if(Vec3.dot(up,dirA)<=0){
                Vec3.negate(imageRender.canvas3d.camera.up,imageRender.canvas3d.camera.up)
            }
            imageRender.canvas3d.camera.focus(origin, radius, 0, dirA,dirC);
            // ensure nothing is clipped off in the front
            const state = Camera.copySnapshot(Camera.createDefaultSnapshot(), imageRender.canvas3d.camera.state);
            state.radius = structure.boundary.sphere.radius;
            state.radiusMax = structure.boundary.sphere.radius;
            imageRender.canvas3d.camera.setState(state);
        };
    }
    getAxesToFlip(positions: Float32Array, origin:Vec3, up: Vec3, normalDir:Vec3){
        const toYAxis=calculateDisplacement(positions,origin,normalDir)
        const toXAxis=calculateDisplacement(positions,origin,up)
        let Axes: string[] = []
        if(toYAxis[0]<0) Axes.push('aroundY')
        if(toXAxis[0]<0) Axes.push('aroundX')
        return Axes
    } 
}