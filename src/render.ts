/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as util from 'util'
import createContext = require('gl')
import fs = require('fs')
import { PNG, PNGOptions } from 'pngjs'
import { Canvas3D, Canvas3DParams } from 'molstar/lib/mol-canvas3d/canvas3d';
import InputObserver from 'molstar/lib/mol-util/input/input-observer';
import { ColorTheme } from 'molstar/lib/mol-theme/color';
import { SizeTheme } from 'molstar/lib/mol-theme/size';
import { CartoonRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/cartoon';
import { MolecularSurfaceRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/molecular-surface';
import { GaussianSurfaceRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/gaussian-surface';
import { BallAndStickRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/ball-and-stick';
import { CarbohydrateRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/carbohydrate'
import { CIF, CifFrame } from 'molstar/lib/mol-io/reader/cif'
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Model, Structure, StructureSymmetry, QueryContext, StructureSelection } from 'molstar/lib/mol-model/structure';
import { ColorNames } from 'molstar/lib/mol-util/color/tables';
import { RepresentationProvider } from 'molstar/lib/mol-repr/representation';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin/util/structure-selection-helper';
import { ImagePass } from 'molstar/lib/mol-canvas3d/passes/image';
import { PrincipalAxes } from 'molstar/lib/mol-math/linear-algebra/matrix/principal-axes';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import Expression from 'molstar/lib/mol-script/language/expression';
import { VisualQuality } from 'molstar/lib/mol-geo/geometry/base';
import { getStructureQuality } from 'molstar/lib/mol-repr/util';
import { computeStructureBoundaryFromElements } from 'molstar/lib/mol-model/structure/structure/util/boundary';

type Nullable<T> = T | null

const readFileAsync = util.promisify(fs.readFile);

// Constants for the style and background options
const OUTLINE = [true, false, false, false]
const LIGHT = [0, 0.6, 0.6, 0.6]
const AMBIENT = [1, 0.4, 0.4, 0.4]
const ROUGHNESS = [0.4, 1, 0.4, 0.6]
const METALNESS = [0, 0, 0, 0.4]
const BGCOLOR = [ColorNames.white, ColorNames.black, ColorNames.white]
const TRANS = [false, false, true]

/**
 * Get the PDB id of file
 * @param inPath path of file
 */
export function getID(inPath: string) {
    const arr = inPath.split('/')
    return arr[arr.length - 1].split('.')[0]
}

/**
 * Helper method that reads file and returns the data
 * @param path path to file
 */
async function readFile(path: string) {
    if (path.match(/\.bcif$/)) {
        const input = await readFileAsync(path)
        return new Uint8Array(input);
    } else {
        return readFileAsync(path, 'utf8');
    }
}

/**
 * Helper method to get the models from a cif data
 * @param frame CifFrame data from file
 */
export async function getModels(frame: CifFrame) {
    return await trajectoryFromMmCIF(frame).run();
}

/**
 * Helper method to open cif file
 * @param path path to file
 */
export async function openCif(path: string) {
    const data = await readFile(path);
    return parseCif(data);
}

/**
 * Reads cif file and returns the parsed data
 * @param path path to file
 */
export async function readCifFile(path: string) {
    const parsed = await openCif(path);
    return parsed.blocks[0];
}

/**
 * Helper method to parse cif data
 * @param data string of cif data
 */
async function parseCif(data: string|Uint8Array) {
    const comp = CIF.parse(data);
    console.time('parseCif')
    const parsed = await comp.run();
    console.timeEnd('parseCif')
    if (parsed.isError) throw parsed;
    return parsed.result;
}

/**
 * Helper method to create PNG with given PNG data
 * @param generatedPng PNG data
 * @param outPath path to put created PNG
 */
async function createPngFile(png: PNG, outPath: string) {
    return new Promise<void>(resolve => {
        png.pack().pipe(fs.createWriteStream(outPath)).on('finish', resolve)
    })
}

const tmpMatrixPos = Vec3.zero()
function getPositions(structure: Structure) {
    const positions = new Float32Array(structure.elementCount * 3)
    for (let i = 0, m = 0, il = structure.units.length; i < il; ++i) {
        const unit = structure.units[i]
        const { elements } = unit
        const pos = unit.conformation.position
        for (let j = 0, jl = elements.length; j < jl; ++j) {
            pos(elements[j], tmpMatrixPos)
            Vec3.toArray(tmpMatrixPos, positions, m + j * 3)
        }
        m += elements.length * 3
    }
    return positions
}

function getStructureFromExpression(structure: Structure, expression: Expression) {
    const compiled = compile<StructureSelection>(expression)
    const selection = compiled(new QueryContext(structure))
    return StructureSelection.unionStructure(selection)
}

function isBigStructure(structure: Structure) {
    return structure.elementCount > 50_000
}

function getQuality(structure: Structure) {
    const quality = getStructureQuality(structure)
    switch (quality) {
        case 'lowest':
        case 'lower':
        case 'low':
            return 'low'
        default:
            return quality
    }
}

/**
 * ImageRenderer class used to initialize 3dcanvas for rendering
 */
export class ImageRenderer {

    gl: WebGLRenderingContext
    reprCtx: {wegbl: any, colorThemeRegistry: any, sizeThemeRegistry: any}
    canvas3d: Canvas3D
    imagePass: ImagePass
    width: number
    height: number
    unitThreshold: number

    constructor(w: number, h: number, u: number, style: number, bg: number) {
        console.time('ImageRenderer.constructor')
        this.width = w
        this.height = h
        this.unitThreshold = u

        this.gl = createContext(this.width, this.height, {
            alpha: false,
            antialias: true,
            depth: true,
            preserveDrawingBuffer: true,
            premultipliedAlpha: false
        })
        const input = InputObserver.create()
        this.canvas3d = Canvas3D.create(this.gl, input, {
            multiSample: {
                mode: 'on',
                sampleLevel: 3
            },
            renderer: {
                ...Canvas3DParams.renderer.defaultValue,
                lightIntensity: LIGHT[style],
                ambientIntensity: AMBIENT[style],
                backgroundColor: BGCOLOR[bg],
                metalness: METALNESS[style],
                roughness: ROUGHNESS[style],
                transparentBackground: TRANS[bg]
            },
            postprocessing: {
                ...Canvas3DParams.postprocessing.defaultValue,
                occlusionEnable: false,
                outlineEnable: OUTLINE[style]
            },
            trackball: {
                ...Canvas3DParams.trackball.defaultValue,
            }
        })

        this.imagePass = this.canvas3d.getImagePass()
        this.imagePass.setProps({
            multiSample: { mode: 'on', sampleLevel: 2 },
            postprocessing: this.canvas3d.props.postprocessing
        })
        this.imagePass.setSize(this.width, this.height)

        this.reprCtx = {
            wegbl: this.canvas3d.webgl,
            colorThemeRegistry: ColorTheme.createRegistry(),
            sizeThemeRegistry: SizeTheme.createRegistry()
        }
        console.timeEnd('ImageRenderer.constructor')
    }

    async addRepresentation(structure: Structure, provider: RepresentationProvider<any, any, any>, colorTheme: string, sizeTheme: string, quality: VisualQuality = 'auto') {
        const repr = provider.factory(this.reprCtx, provider.getParams)
        repr.setTheme({
            color: this.reprCtx.colorThemeRegistry.create(colorTheme, { structure }),
            size: this.reprCtx.sizeThemeRegistry.create(sizeTheme, { structure })
        })
        await repr.createOrUpdate({ ...provider.defaultValues, quality }, structure).run()
        await this.canvas3d.add(repr)
    }

    async addCartoon(structure: Structure, quality?: VisualQuality) {
        const colorTheme = structure.polymerUnitCount === 1 ? 'sequence-id' : 'polymer-id'
        const sizeTheme = 'uniform'
        await this.addRepresentation(structure, CartoonRepresentationProvider, colorTheme, sizeTheme, quality)
    }

    async addGaussianSurface(structure: Structure, quality?: VisualQuality) {
        const colorTheme = structure.polymerUnitCount === 1 ? 'sequence-id' : 'polymer-id'
        const sizeTheme = 'uniform'
        await this.addRepresentation(structure, GaussianSurfaceRepresentationProvider, colorTheme, sizeTheme, quality)
    }

    async addMolecularSurface(structure: Structure, quality?: VisualQuality) {
        const colorTheme = structure.polymerUnitCount === 1 ? 'sequence-id' : 'polymer-id'
        const sizeTheme = 'uniform'
        await this.addRepresentation(structure, MolecularSurfaceRepresentationProvider, colorTheme, sizeTheme, quality)
    }

    async addBallAndStick(structure: Structure, quality?: VisualQuality) {
        const colorTheme = 'element-symbol'
        const sizeTheme = 'physical'
        await this.addRepresentation(structure, BallAndStickRepresentationProvider, colorTheme, sizeTheme, quality)
    }

    async addCarbohydrate(structure: Structure, quality?: VisualQuality) {
        const colorTheme = 'carbohydrate-symbol'
        const sizeTheme = 'uniform'
        await this.addRepresentation(structure, CarbohydrateRepresentationProvider, colorTheme, sizeTheme, quality)
    }

    /**
     * Retreive structure from model
     * @param model model to retreive structure from
     */
    async getStructure(model: Model) {
        return Structure.ofModel(model);
    }

    /**
     * Creates PNG with the current 3dcanvas data
     * @param outPath path to put created PNG
     */
    async createImage(outPath: string, occlusionEnable = false, outlineEnable = false) {
        this.imagePass.setProps({
            postprocessing: { ...this.canvas3d.props.postprocessing, occlusionEnable, outlineEnable }
        })

        this.imagePass.render()
        const imageData = this.imagePass.colorTarget.getPixelData()
        const options: PNGOptions = {width: this.width, height: this.height}
        const generatedPng = new PNG(options)
        generatedPng.data = Buffer.from(imageData.array)
        await createPngFile(generatedPng, outPath)
    }

    focusCamera(structure: Structure, extraRadius = 0) {
        const principalAxes = PrincipalAxes.ofPositions(getPositions(structure))
        const { origin, dirA, dirC } = principalAxes.boxAxes
        const { sphere } = computeStructureBoundaryFromElements(structure)
        this.canvas3d.camera.focus(origin, sphere.radius + extraRadius, 0, dirA, dirC)
    }

    /**
     * Renders an assembly given parameters
     * @param modIndex index of model in CIF data
     * @param asmIndex index of assembly in current model
     * @param models list of models from CIF data
     * @param outPath output path of image
     * @param id PDB ID
     */
    async renderAsm(modIndex: number, asmIndex: number, models: readonly Model[], outPath: string, id: string) {
        const asmName = models[modIndex].symmetry.assemblies[asmIndex].id
        console.log(`Rendering ${id} model ${models[modIndex].modelNum} assembly ${asmName}...`)

        const modelStructure = await this.getStructure(models[modIndex])
        const structure = await StructureSymmetry.buildAssembly(modelStructure, models[modIndex].symmetry.assemblies[asmIndex].id).run()
        const isBig = isBigStructure(structure)
        const quality = getQuality(structure)
        let focusStructure: Structure

        if (isBig) {
            focusStructure = getStructureFromExpression(structure, Q.polymer.expression)
            await this.addGaussianSurface(focusStructure, quality)
        } else {
            await this.addCartoon(getStructureFromExpression(structure, Q.polymer.expression), quality)
            await this.addCarbohydrate(getStructureFromExpression(structure, Q.branchedPlusConnected.expression), quality)
            await this.addBallAndStick(getStructureFromExpression(structure, MS.struct.modifier.union([
                MS.struct.combinator.merge([
                    Q.ligandPlusConnected.expression,
                    Q.branchedConnectedOnly.expression,
                    Q.disulfideBridges.expression,
                    Q.nonStandardPolymer.expression,
                    Q.water.expression
                ])
            ])), quality)
            focusStructure = getStructureFromExpression(structure, MS.struct.modifier.union([
                MS.struct.combinator.merge([
                    Q.trace.expression,
                    Q.branchedPlusConnected.expression,
                    Q.ligandPlusConnected.expression,
                    Q.branchedConnectedOnly.expression,
                    Q.disulfideBridges.expression,
                    Q.nonStandardPolymer.expression,
                    Q.water.expression
                ])
            ]))
        }

        this.focusCamera(focusStructure, isBig ? 5 : 1)

        // Write png to file
        let imagePathName = `${outPath}/${id}_model-${models[modIndex].modelNum}-assembly-${asmName}.png`
        await this.createImage(imagePathName, isBig, isBig)

        // Finished writing to file and clear canvas
        console.log('Finished.')

        this.canvas3d.clear()
    }

    /**
     * Renders a model given parameters
     * @param modIndex index of model in CIF data
     * @param models list of models from CIF data
     * @param outPath output path of image
     * @param id PDB ID
     */
    async renderMod(modIndex: number, models: readonly Model[], outPath: string, id: string) {
        console.log(`Rendering ${id} model ${models[modIndex].modelNum}...`)

        const structure = await this.getStructure(models[modIndex])
        const isBig = isBigStructure(structure)
        const quality = getQuality(structure)
        let focusStructure: Structure

        if (isBig) {
            focusStructure = getStructureFromExpression(structure, Q.polymer.expression)
            await this.addGaussianSurface(getStructureFromExpression(structure, Q.polymer.expression), quality)
        } else {
            await this.addCartoon(getStructureFromExpression(structure, Q.polymer.expression), quality)
            await this.addCarbohydrate(getStructureFromExpression(structure, Q.branchedPlusConnected.expression), quality)
            await this.addBallAndStick(getStructureFromExpression(structure, MS.struct.modifier.union([
                MS.struct.combinator.merge([
                    Q.ligandPlusConnected.expression,
                    Q.branchedConnectedOnly.expression,
                    Q.disulfideBridges.expression,
                    Q.nonStandardPolymer.expression,
                    Q.water.expression
                ])
            ])), quality)
            focusStructure = getStructureFromExpression(structure, MS.struct.modifier.union([
                MS.struct.combinator.merge([
                    Q.trace.expression,
                    Q.branchedPlusConnected.expression,
                    Q.ligandPlusConnected.expression,
                    Q.branchedConnectedOnly.expression,
                    Q.disulfideBridges.expression,
                    Q.nonStandardPolymer.expression,
                    Q.water.expression
                ])
            ]))
        }

        this.focusCamera(focusStructure, isBig ? 5 : 1)

        // Write png to file
        let imagePathName = `${outPath}/${id}_model-${models[modIndex].modelNum}.png`
        await this.createImage(imagePathName, isBig, isBig)

        // Finished writing to file and clear canvas
        console.log('Finished.')
        this.canvas3d.clear()
    }

    /**
     * Renders a chain from given inputs
     * @param chnName name of chain
     * @param models list of models from CIF data
     * @param outPath path to put rendered image
     * @param id PDB ID
     */
    async renderChn(chnName: string, models: readonly Model[], outPath: string, id: string) {
        console.log(`Rendering ${id} chain ${chnName}...`)

        const modelStructure = await this.getStructure(models[0])
        const structure = getStructureFromExpression(modelStructure, MS.struct.generator.atomGroups({
            'chain-test': MS.core.rel.eq([MS.ammp('label_asym_id'), chnName])
        }))
        const isBig = isBigStructure(structure)
        const quality = getQuality(structure)
        let focusStructure: Structure

        if (isBig) {
            focusStructure = getStructureFromExpression(structure, Q.polymer.expression)
            await this.addGaussianSurface(focusStructure, quality)
        } else if (structure.polymerResidueCount < 5) {
            focusStructure = getStructureFromExpression(structure, Q.polymer.expression)
            await this.addBallAndStick(focusStructure, quality)
        } else {
            await this.addCartoon(getStructureFromExpression(structure, Q.polymer.expression), quality)
            await this.addBallAndStick(getStructureFromExpression(structure, MS.struct.modifier.union([
                MS.struct.combinator.merge([
                    Q.ligandPlusConnected.expression,
                    Q.disulfideBridges.expression,
                    Q.nonStandardPolymer.expression,
                ])
            ])), quality)
            focusStructure = getStructureFromExpression(structure, MS.struct.modifier.union([
                MS.struct.combinator.merge([
                    Q.trace.expression,
                    Q.ligandPlusConnected.expression,
                    Q.disulfideBridges.expression,
                    Q.nonStandardPolymer.expression,
                ])
            ]))
        }

        this.focusCamera(focusStructure, isBig ? 5 : 1)

        // Write png to file
        let imagePathName = `${outPath}/${id}_chain-${chnName}.png`
        await this.createImage(imagePathName, isBig, isBig)

        // Finished writing to file and clear canvas
        console.log('Finished.')
        this.canvas3d.clear()
    }

    /**
     * Render chains, models, and assemblies of a single PDB
     * @param inPath path of CIF file
     * @param outPath path to put rendered image
     */
    async renderCombined(inPath: string, outPath: string) {
        const cif = await readCifFile(inPath)
        const models = await getModels(cif as CifFrame)
        const id = getID(inPath)

        const folderName = `${id[1]}${id[2]}`

        if (!fs.existsSync(outPath + '/' + folderName)) {
            fs.mkdirSync(outPath + '/' + folderName)
        }

        if (!fs.existsSync(`${outPath}/${folderName}/${id}`)) {
            fs.mkdirSync(`${outPath}/${folderName}/${id}`)
        }

        outPath += `/${folderName}/${id}/`

        // Render all assemblies and models
        for (let i = 0; i < models.length; i++) {
            await this.renderMod(i, models, outPath, id)
            for (let j = 0; j < models[i].symmetry.assemblies.length; j++) {
                await this.renderAsm(i, j, models, outPath, id)
            }
        }

        const { entities } = models[0]
        const { label_asym_id, label_entity_id } = models[0].atomicHierarchy.chains

        // Render all polymer chains
        for (let i = 0, il = label_asym_id.rowCount; i < il; i++) {
            const eI = entities.getEntityIndex(label_entity_id.value(i))
            if (entities.data.type.value(eI) !== 'polymer') continue
            const chnName = label_asym_id.value(i)
            await this.renderChn(chnName, models, outPath, id)
        }
    }

    /**
     * Render all chains, assemblies, and models from list or directory. If no list was given, all CIFs in the input directory will be rendered
     * @param inPath path to the CIF files
     * @param outPath path to put all rendered images
     * @param listPath path
     */
    async renderList(inPath: string, outPath: string, listPath: Nullable<String>) {
        let list: string[] = []
        if (listPath === null) {
            list = fs.readdirSync(inPath)
        } else {
            let listFile = await readFileAsync(listPath as string)
            let listCont = listFile.toString()
            list = listCont.split('\n')
        }

        for (let i = 0; i < list.length; i++) {
            let fileName = list[i]
            if (listPath === null) {
                let splitStr = list[i].split('.')
                if (splitStr.length !== 2 || splitStr[1] !== 'cif') {
                    continue;
                }
                fileName = splitStr[0]
            }
            if (fileName.length !== 4) {
                continue;
            }
            let path = `${inPath}/${fileName}.cif`
            await this.renderCombined(path, outPath)
        }
    }

}