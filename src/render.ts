/**
 * Copyright (c) 2019-2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */

import getGLContext = require('gl');
import fs = require('fs');
import { PNG } from 'pngjs';
import * as JPEG from 'jpeg-js';
import { createContext, WebGLContext } from 'molstar/lib/mol-gl/webgl/context';
import { Canvas3D, Canvas3DContext, DefaultCanvas3DParams } from 'molstar/lib/mol-canvas3d/canvas3d';
import { InputObserver } from 'molstar/lib/mol-util/input/input-observer';
import { ColorTheme } from 'molstar/lib/mol-theme/color';
import { SizeTheme } from 'molstar/lib/mol-theme/size';
import { CartoonRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/cartoon';
import { MolecularSurfaceRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/molecular-surface';
import { GaussianSurfaceRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/gaussian-surface';
import { BallAndStickRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/ball-and-stick';
import { CarbohydrateRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/carbohydrate';
import {
    Model,
    Structure,
    StructureSymmetry,
    QueryContext,
    StructureSelection,
    Trajectory
} from 'molstar/lib/mol-model/structure';
import { ModelSymmetry } from 'molstar/lib/mol-model-formats/structure/property/symmetry';
import { RepresentationContext, RepresentationProvider } from 'molstar/lib/mol-repr/representation';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { ImagePass } from 'molstar/lib/mol-canvas3d/passes/image';
import { PrincipalAxes } from 'molstar/lib/mol-math/linear-algebra/matrix/principal-axes';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Expression } from 'molstar/lib/mol-script/language/expression';
import { VisualQuality } from 'molstar/lib/mol-geo/geometry/base';
import { getStructureQuality } from 'molstar/lib/mol-repr/util';
import { Camera } from 'molstar/lib/mol-canvas3d/camera';
import { SyncRuntimeContext } from 'molstar/lib/mol-task/execution/synchronous';
import { AssetManager } from 'molstar/lib/mol-util/assets';
import { RuntimeContext, Task } from 'molstar/lib/mol-task';
import { Passes } from 'molstar/lib/mol-canvas3d/passes/passes';
import DefaultAttribs = Canvas3DContext.DefaultAttribs;
import { PixelData } from 'molstar/lib/mol-util/image';
import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { PLDDTConfidenceColorThemeProvider } from 'molstar/lib/extensions/model-archive/quality-assessment/color/plddt';
import { FocusExpression, FocusExpressionNoBranched,
    RepresentationExpression, RepresentationExpressionNoBranched, SmallFocusExpression } from './expression';

/**
 * Helper method to create PNG with given PNG data
 */
async function writePngFile(png: PNG, outPath: string) {
    await new Promise<void>(resolve => {
        png.pack().pipe(fs.createWriteStream(outPath)).on('finish', resolve);
    });
}

async function writeJpegFile(jpeg: JPEG.BufferRet, outPath: string) {
    await new Promise<void>(resolve => {
        fs.writeFile(outPath, jpeg.data, () => resolve());
    });
}

const tmpMatrixPos = Vec3.zero();
function getPositions(structure: Structure) {
    const positions = new Float32Array(structure.elementCount * 3);
    for (let i = 0, m = 0, il = structure.units.length; i < il; ++i) {
        const unit = structure.units[i];
        const { elements } = unit;
        const pos = unit.conformation.position;
        for (let j = 0, jl = elements.length; j < jl; ++j) {
            pos(elements[j], tmpMatrixPos);
            Vec3.toArray(tmpMatrixPos, positions, m + j * 3);
        }
        m += elements.length * 3;
    }
    return positions;
}

function getStructureFromExpression(structure: Structure, expression: Expression) {
    const compiled = compile<StructureSelection>(expression);
    const selection = compiled(new QueryContext(structure));
    return StructureSelection.unionStructure(selection);
}

function getColorTheme(structure: Structure) {
    if (structure.polymerUnitCount === 1) return 'sequence-id';
    else if (structure.polymerUnitCount < 40) return 'polymer-index';
    else return 'polymer-id';
}

enum StructureSize { Big, Medium, Small }

/**
 * Try to match fiber-like structures like 6nk4
 */
function isFiberLike(structure: Structure) {
    const polymerSymmetryGroups = structure.unitSymmetryGroups.filter(ug => {
        return ug.units[0].polymerElements.length > 0;
    });

    return (
        polymerSymmetryGroups.length === 1 &&
        polymerSymmetryGroups[0].units.length > 2 &&
        polymerSymmetryGroups[0].units[0].polymerElements.length < 15
    );
}

function getStructureSize(structure: Structure): StructureSize {
    if (structure.polymerResidueCount > 4000) {
        return StructureSize.Big;
    } else if (isFiberLike(structure)) {
        return StructureSize.Small;
    } else if (structure.polymerResidueCount < 10) {
        return StructureSize.Small;
    } else {
        return StructureSize.Medium;
    }
}

function getQuality(structure: Structure): VisualQuality {
    const quality = getStructureQuality(structure);
    switch (quality) {
        case 'lowest':
        case 'lower':
        case 'low':
            return 'low';
        default:
            return quality;
    }
}

interface ReprParams {
    colorTheme: string,
    sizeTheme: string,
    quality?: VisualQuality,
    radiusOffset?: number
}

/**
 * ImageRenderer class used to initialize 3dcanvas for rendering
 */
export class ImageRenderer {
    webgl: WebGLContext;
    reprCtx: RepresentationContext;
    canvas3d: Canvas3D;
    imagePass: ImagePass;
    assetManager = new AssetManager();

    constructor(private width: number, private height: number, private format: 'png' | 'jpeg', private plddt: 'on' | 'single-chain' | 'off') {
        this.webgl = createContext(getGLContext(this.width, this.height, {
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true, // the renderer requires an alpha channel
            depth: true, // the renderer requires a depth buffer
            premultipliedAlpha: true, // the renderer outputs PMA
        }));

        const input = InputObserver.create();
        const attribs = { ...DefaultAttribs };
        const passes = new Passes(this.webgl, attribs);

        this.canvas3d = Canvas3D.create({ webgl: this.webgl, input, passes, attribs } as Canvas3DContext, {
            camera: {
                mode: 'orthographic',
                helper: {
                    axes: { name: 'off', params: {} }
                },
                stereo: {
                    name: 'off', params: {}
                },
                manualReset: false
            },
            cameraFog: {
                name: 'on',
                params: {
                    intensity: 50
                }
            },
            renderer: {
                ...DefaultCanvas3DParams.renderer,
                backgroundColor: ColorNames.white,
            },
            postprocessing: {
                occlusion: {
                    name: 'off', params: {}
                },
                outline: {
                    name: 'off', params: {}
                },
                antialiasing: {
                    name: 'fxaa',
                    params: {
                        edgeThresholdMin: 0.0312,
                        edgeThresholdMax: 0.063,
                        iterations: 12,
                        subpixelQuality: 0.3
                    }
                }
            }
        });
        this.imagePass = this.canvas3d.getImagePass({
            cameraHelper: {
                axes: { name: 'off', params: {} }
            },
            multiSample: {
                mode: 'on',
                sampleLevel: 4
            }
        });
        this.imagePass.setSize(this.width, this.height);

        const colorThemeRegistry = ColorTheme.createRegistry();
        colorThemeRegistry.add(PLDDTConfidenceColorThemeProvider);
        this.reprCtx = {
            webgl: this.canvas3d.webgl,
            colorThemeRegistry,
            sizeThemeRegistry: SizeTheme.createRegistry()
        };
    }

    async addRepresentation(structure: Structure, provider: RepresentationProvider<any, any, any>, params: ReprParams) {
        if (provider.ensureCustomProperties) {
            await provider.ensureCustomProperties.attach({ assetManager: this.assetManager, runtime: SyncRuntimeContext }, structure);
        }
        const colorThemeProvider = this.reprCtx.colorThemeRegistry.get(params.colorTheme);
        if (colorThemeProvider.ensureCustomProperties) {
            await colorThemeProvider.ensureCustomProperties.attach({ assetManager: this.assetManager, runtime: SyncRuntimeContext }, { structure });
        }

        const repr = provider.factory(this.reprCtx, provider.getParams);
        repr.setTheme({
            color: this.reprCtx.colorThemeRegistry.create(params.colorTheme, { structure }, { carbonColor: { name: 'element-symbol' } }),
            size: this.reprCtx.sizeThemeRegistry.create(params.sizeTheme, { structure })
        });
        const props = { ...provider.defaultValues, quality: params.quality || 'auto', ignoreHydrogens: true };
        if (params.radiusOffset) Object.assign(props, { radiusOffset: params.radiusOffset });
        await repr.createOrUpdate(props, structure).run();
        this.canvas3d.add(repr);
    }

    async addCartoon(structure: Structure, params: Partial<ReprParams> = {}) {
        await this.addRepresentation(structure, CartoonRepresentationProvider, {
            colorTheme: getColorTheme(structure),
            sizeTheme: 'uniform',
            ...params
        });
    }

    async addGaussianSurface(structure: Structure, params: Partial<ReprParams> = {}) {
        await this.addRepresentation(structure, GaussianSurfaceRepresentationProvider, {
            colorTheme: getColorTheme(structure),
            sizeTheme: 'uniform',
            radiusOffset: 0.75,
            ...params
        });
    }

    async addMolecularSurface(structure: Structure, params: Partial<ReprParams> = {}) {
        await this.addRepresentation(structure, MolecularSurfaceRepresentationProvider, {
            colorTheme: getColorTheme(structure),
            sizeTheme: 'uniform',
            ...params
        });
    }

    async addBallAndStick(structure: Structure, params: Partial<ReprParams> = {}) {
        await this.addRepresentation(structure, BallAndStickRepresentationProvider, {
            colorTheme: 'element-symbol',
            sizeTheme: 'physical',
            ...params
        });
    }

    async addCarbohydrate(structure: Structure, params: Partial<ReprParams> = {}) {
        await this.addRepresentation(structure, CarbohydrateRepresentationProvider, {
            colorTheme: 'carbohydrate-symbol',
            sizeTheme: 'uniform',
            ...params
        });
    }

    /**
     * Creates PNG with the current 3dcanvas data
     */
    async createImage(outPath: string, size: StructureSize) {
        const occlusion = size === StructureSize.Big ? { name: 'on' as const, params: {
            samples: 32,
            radius: 5,
            bias: 0.8,
            blurKernelSize: 15,
            resolutionScale: 1,
        } } : { name: 'off' as const, params: {} };
        const outline = size === StructureSize.Big ? { name: 'on' as const, params: {
            scale: 1,
            threshold: 0.95,
        } } : { name: 'off' as const, params: {} };

        this.canvas3d.commit(true);

        this.imagePass.setProps({
            postprocessing: {
                ...this.canvas3d.props.postprocessing,
                outline,
                occlusion
            }
        });

        const imageData = this.getImageData(this.width, this.height);

        if (this.format === 'png') {
            const generatedPng = new PNG({ width: this.width, height: this.height });
            generatedPng.data = Buffer.from(imageData.data.buffer);
            await writePngFile(generatedPng, `${outPath}.png`);
        } else if (this.format === 'jpeg') {
            const generatedJpeg = JPEG.encode({
                data: imageData.data,
                width: this.width,
                height: this.height
            }, 90);
            await writeJpegFile(generatedJpeg, `${outPath}.jpeg`);
        } else {
            throw new Error(`unknown image type '${this.format}'`);
        }
    }

    getImageData(width: number, height: number) {
        this.imagePass.setSize(width, height);
        this.imagePass.render();
        this.imagePass.colorTarget.bind();

        const array = new Uint8Array(width * height * 4);
        this.webgl.readPixels(0, 0, width, height, array);
        const pixelData = PixelData.create(array, width, height);
        PixelData.flipY(pixelData);
        PixelData.divideByAlpha(pixelData);
        // ImageData is not defined in Node
        return { data: new Uint8ClampedArray(array), width, height };
    }

    focusCamera(structure: Structure) {
        const principalAxes = PrincipalAxes.ofPositions(getPositions(structure));
        const { origin, dirA, dirC } = principalAxes.boxAxes;
        const radius = Vec3.magnitude(dirA);

        // move camera far in the direction from the origin, so we get a view from the outside
        const position = Vec3();
        Vec3.scaleAndAdd(position, position, origin, 100);
        this.canvas3d.camera.setState({ position }, 0);

        // tight zoom
        this.canvas3d.camera.focus(origin, radius, 0, dirA, dirC);

        // ensure nothing is clipped off in the front
        const state = Camera.copySnapshot(Camera.createDefaultSnapshot(), this.canvas3d.camera.state);
        state.radius = structure.boundary.sphere.radius;
        state.radiusMax = structure.boundary.sphere.radius;
        this.canvas3d.camera.setState(state);
    }

    /**
     * Renders the assembly
     */
    async renderAssembly(asmIndex: number, model: Model, outPath: string, fileName: string) {
        const symmetry = ModelSymmetry.Provider.get(model)!;
        const asmId = symmetry.assemblies[asmIndex].id;
        console.log(`Rendering ${fileName} assembly ${asmId}...`);

        const modelStructure = Structure.ofModel(model);
        const structure = await StructureSymmetry.buildAssembly(modelStructure, symmetry.assemblies[asmIndex].id).run();
        const colorTheme = this.checkPlddtColorTheme(structure);
        await this.render(structure, `${outPath}/${fileName}_assembly-${asmId}`, { colorTheme });
    }

    /**
     * Renders the model
     */
    async renderModel(oneIndex: number, model: Model, outPath: string, fileName: string) {
        console.log(`Rendering ${fileName} model ${model.modelNum} with index ${oneIndex}...`);

        const structure = Structure.ofModel(model);
        const colorTheme = this.checkPlddtColorTheme(structure);
        await this.render(structure, `${outPath}/${fileName}_model-${oneIndex}`, { colorTheme });
    }

    /**
     * Renders the chain
     */
    async renderChain(chainName: string, model: Model, outPath: string, fileName: string) {
        console.log(`Rendering ${fileName} chain ${chainName}...`);

        const modelStructure = Structure.ofModel(model);
        const structure = getStructureFromExpression(modelStructure, MS.struct.generator.atomGroups({
            'chain-test': MS.core.rel.eq([MS.ammp('label_asym_id'), chainName])
        }));
        const colorTheme = this.checkPlddtColorTheme(structure);
        await this.render(structure, `${outPath}/${fileName}_chain-${chainName}`, { colorTheme, suppressBranched: true });
    }

    async renderModels(models: Trajectory, outPath: string, fileName: string) {
        console.log(`Rendering ${fileName} models`);

        const structure = await Structure.ofTrajectory(models, RuntimeContext.Synchronous);
        const firstModelStructure = Structure.ofModel(models.representative);
        const colorTheme = firstModelStructure.polymerUnitCount === 1 ? 'sequence-id' : 'polymer-id';
        await this.render(structure, `${outPath}/${fileName}_models`, { colorTheme, suppressSurface: true });
    }

    private checkPlddtColorTheme(structure: Structure): 'plddt-confidence' | undefined {
        if (this.plddt === 'off') return;
        if (this.plddt === 'single-chain' && structure.polymerUnitCount !== 1) return;
        if (PLDDTConfidenceColorThemeProvider.isApplicable({ structure })) return PLDDTConfidenceColorThemeProvider.name;
    }

    private async render(structure: Structure, imagePathName: string, options?: { colorTheme?: string, suppressSurface?: boolean, suppressBranched?: boolean }) {
        const size = getStructureSize(structure);
        const quality = getQuality(structure);
        let focusStructure: Structure;

        if (!options?.suppressSurface && size === StructureSize.Big) {
            focusStructure = getStructureFromExpression(structure, Q.polymer.expression);
            await this.addGaussianSurface(focusStructure, { quality });
        } else {
            const p = { quality, ...options?.colorTheme && ({ colorTheme: options.colorTheme }) };
            await this.addCartoon(getStructureFromExpression(structure, Q.polymer.expression), p);
            if (!options?.suppressBranched) await this.addCarbohydrate(getStructureFromExpression(structure, Q.branchedPlusConnected.expression), { quality });
            if (size === StructureSize.Small) {
                focusStructure = getStructureFromExpression(structure, SmallFocusExpression);
                await this.addBallAndStick(focusStructure, { quality });
            } else {
                focusStructure = getStructureFromExpression(structure, options?.suppressBranched ? FocusExpressionNoBranched : FocusExpression);
                await this.addBallAndStick(getStructureFromExpression(structure, options?.suppressBranched ? RepresentationExpressionNoBranched : RepresentationExpression), { quality });
            }
        }

        this.focusCamera(focusStructure);

        // Write image to file
        await this.createImage(imagePathName, size);

        // Finished writing to file and clear canvas
        console.log('Finished.');

        this.canvas3d.clear();
    }

    /**
     * Render chains, models, and assemblies of a single structure.
     * @param trajectory source data
     * @param outPath directory to put rendered images
     * @param fileName output file name
     */
    async renderAll(trajectory: Trajectory, outPath: string, fileName: string) {
        // Render all models
        for (let i = 0; i < trajectory.frameCount; i++) {
            await this.renderModel(i + 1, await Task.resolveInContext(trajectory.getFrameAtIndex(i)), outPath, fileName);
        }

        // Render all assemblies
        const { representative } = trajectory;
        const assemblies = ModelSymmetry.Provider.get(representative)?.assemblies || [];
        for (let i = 0, il = assemblies.length; i < il; i++) {
            await this.renderAssembly(i, representative, outPath, fileName);
        }

        const { entities } = representative;
        const { label_asym_id, label_entity_id } = representative.atomicHierarchy.chains;

        // Render all polymer chains
        for (let i = 0, il = label_asym_id.rowCount; i < il; i++) {
            const eI = entities.getEntityIndex(label_entity_id.value(i));
            if (entities.data.type.value(eI) !== 'polymer') continue;
            const chnName = label_asym_id.value(i);
            await this.renderChain(chnName, representative, outPath, fileName);
        }

        // Render models ensemble
        if (trajectory.frameCount > 1) {
            await this.renderModels(trajectory, outPath, fileName);
        }
    }
}