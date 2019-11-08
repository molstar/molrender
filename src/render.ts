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
import { BallAndStickRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/ball-and-stick';
import { CarbohydrateRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/carbohydrate'
import { CIF, CifFrame } from 'molstar/lib/mol-io/reader/cif'
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Model, Structure, StructureSymmetry, QueryContext, StructureSelection } from 'molstar/lib/mol-model/structure';
import { ColorNames } from 'molstar/lib/mol-util/color/tables';
import { RepresentationProvider, Representation } from 'molstar/lib/mol-repr/representation';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin/util/structure-selection-helper';

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
        const data = new Uint8Array(input.byteLength);
        for (let i = 0; i < input.byteLength; i++) data[i] = input[i];
        return data;
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
    const parsed = await comp.run();
    if (parsed.isError) throw parsed;
    return parsed.result;
}

/**
 * ImageRenderer class used to initialize 3dcanvas for rendering
 */
export class ImageRenderer {

    gl: WebGLRenderingContext
    reprCtx: {wegbl: any, colorThemeRegistry: any, sizeThemeRegistry: any}
    canvas3d: Canvas3D
    width: number
    height: number
    unitThreshold: number
    constructor(w: number, h: number, u: number, style: number, bg: number) {
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
                occlusionEnable: true,
                outlineEnable: OUTLINE[style]
            },
            trackball: {
                ...Canvas3DParams.trackball.defaultValue,

            }
        })
        this.canvas3d.animate()

        this.reprCtx = {
            wegbl: this.canvas3d.webgl,
            colorThemeRegistry: ColorTheme.createRegistry(),
            sizeThemeRegistry: SizeTheme.createRegistry()
        }

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
    async createImage(outPath: string) {
        return new Promise<void>(resolve => {
            setTimeout( async () => {
                const pixelData = this.canvas3d.getPixelData('color')
                const options: PNGOptions = {width: this.width, height: this.height}
                const generatedPng = new PNG(options)
                generatedPng.data = Buffer.from(pixelData.array)
                this.createFile(generatedPng, outPath).then(() => {
                    resolve()
                })
            }, 50)
        })
    }

    /**
     * Helper method to create PNG with given PNG data
     * @param generatedPng PNG data
     * @param outPath path to put created PNG
     */
    async createFile(generatedPng: PNG, outPath: string) {
        return new Promise<void>(resolve => {
            generatedPng.pack().pipe(fs.createWriteStream(outPath)).on('finish', resolve)
        })
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
        return new Promise<void>(async resolve => {
            const asmName = models[modIndex].symmetry.assemblies[asmIndex].id
            console.log(`Rendering ${id} model ${models[modIndex].modelNum} assembly ${asmName}...`)

            // Get model structure and assembly structure
            let structure = await this.getStructure(models[modIndex])

            let origStructure = await this.getStructure(models[modIndex])
            const task = StructureSymmetry.buildAssembly(origStructure, models[modIndex].symmetry.assemblies[asmIndex].id)
            const wholeStructure = await task.run()

            // Add carbs to canvas
            const carbRepr = CarbohydrateRepresentationProvider.factory(this.reprCtx, CarbohydrateRepresentationProvider.getParams)

            carbRepr.setTheme({
                color: this.reprCtx.colorThemeRegistry.create('carbohydrate-symbol', { structure: wholeStructure }),
                size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: wholeStructure })
            })
            await carbRepr.createOrUpdate({ ...CarbohydrateRepresentationProvider.defaultValues, quality: 'auto' }, wholeStructure).run()
            this.canvas3d.add(carbRepr)

            // Add model to canvas
            let provider: RepresentationProvider<any, any, any>

            if (wholeStructure.polymerUnitCount > this.unitThreshold) {
                provider = MolecularSurfaceRepresentationProvider
            } else {
                provider = CartoonRepresentationProvider
            }
            const repr = provider.factory(this.reprCtx, provider.getParams)

            if (wholeStructure.polymerUnitCount === 1) {
                repr.setTheme({
                    color: this.reprCtx.colorThemeRegistry.create('sequence-id', { structure: wholeStructure }),
                    size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: wholeStructure })
                })
            } else {
                repr.setTheme({
                    color: this.reprCtx.colorThemeRegistry.create('polymer-id', { structure: wholeStructure }),
                    size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: wholeStructure })
                })
            }
            await repr.createOrUpdate({ ... provider.defaultValues, quality: 'auto' }, wholeStructure).run()

            this.canvas3d.add(repr)

            // Query and add ligands to canvas
            const expression = MS.struct.modifier.union([
                MS.struct.combinator.merge([ Q.ligandPlusConnected.expression, Q.branchedConnectedOnly.expression ])
            ])
            const query = compile<StructureSelection>(expression)
            const selection = query(new QueryContext(wholeStructure))
            structure = StructureSelection.unionStructure(selection)

            const ligandRepr = BallAndStickRepresentationProvider.factory(this.reprCtx, BallAndStickRepresentationProvider.getParams)
            repr.setTheme({
                color: this.reprCtx.colorThemeRegistry.create('element-symbol', { structure }),
                size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure })
            })
            await ligandRepr.createOrUpdate({ ...BallAndStickRepresentationProvider.defaultValues, quality: 'auto' }, structure).run()
            this.canvas3d.add(ligandRepr)

            this.canvas3d.resetCamera()

            // Write png to file
            let imagePathName = `${outPath}/${id}_model-${models[modIndex].modelNum}-assembly-${asmName}.png`
            await this.createImage(imagePathName)

            // Finished writing to file and clear canvas
            console.log('Finished.')
            this.canvas3d.remove(ligandRepr)
            this.canvas3d.clear()
            resolve()
        })
    }

    /**
     * Renders a model given parameters
     * @param modIndex index of model in CIF data
     * @param models list of models from CIF data
     * @param outPath output path of image
     * @param id PDB ID
     */
    async renderMod(modIndex: number, models: readonly Model[], outPath: string, id: string) {
        return new Promise<void>(async resolve => {
            console.log(`Rendering ${id} model ${models[modIndex].modelNum}...`)

            // Get model structure
            let structure = await this.getStructure(models[modIndex])

            // Add carbs to canvas
            const carbRepr = CarbohydrateRepresentationProvider.factory(this.reprCtx, CarbohydrateRepresentationProvider.getParams)

            carbRepr.setTheme({
                color: this.reprCtx.colorThemeRegistry.create('carbohydrate-symbol', { structure: structure }),
                size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: structure })
            })
            await carbRepr.createOrUpdate({ ...CarbohydrateRepresentationProvider.defaultValues, quality: 'auto' }, structure).run()
            this.canvas3d.add(carbRepr)

            // Add model to canvas
            let provider: RepresentationProvider<any, any, any>
            provider = CartoonRepresentationProvider
            if (structure.polymerUnitCount > this.unitThreshold) {
                provider = MolecularSurfaceRepresentationProvider
            }
            const repr = provider.factory(this.reprCtx, provider.getParams)

            if (structure.polymerUnitCount === 1) {
                repr.setTheme({
                    color: this.reprCtx.colorThemeRegistry.create('sequence-id', { structure: structure }),
                    size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: structure })
                })
            } else {
                repr.setTheme({
                    color: this.reprCtx.colorThemeRegistry.create('polymer-id', { structure: structure }),
                    size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: structure })
                })
            }
            await repr.createOrUpdate({ ... provider.defaultValues, quality: 'auto' }, structure).run()

            this.canvas3d.add(repr)

            // Query and add ligands to canvas
            const expression = MS.struct.modifier.union([
                MS.struct.combinator.merge([ Q.ligandPlusConnected.expression, Q.branchedConnectedOnly.expression ])
            ])
            const query = compile<StructureSelection>(expression)
            const selection = query(new QueryContext(structure))
            structure = StructureSelection.unionStructure(selection)

            const ligandRepr = BallAndStickRepresentationProvider.factory(this.reprCtx, BallAndStickRepresentationProvider.getParams)
            repr.setTheme({
                color: this.reprCtx.colorThemeRegistry.create('element-symbol', { structure }),
                size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure })
            })
            await ligandRepr.createOrUpdate({ ...BallAndStickRepresentationProvider.defaultValues, quality: 'auto' }, structure).run()
            this.canvas3d.add(ligandRepr)

            this.canvas3d.resetCamera()

            // Write png to file
            let imagePathName = `${outPath}/${id}_model-${models[modIndex].modelNum}.png`
            await this.createImage(imagePathName)

            // Finished writing to file and clear canvas
            console.log('Finished.')
            this.canvas3d.remove(ligandRepr)
            this.canvas3d.clear()
            resolve()
        }).catch(()=>{console.error('what')})
    }

    /**
     * Renders a chain from given inputs
     * @param chnName name of chain
     * @param models list of models from CIF data
     * @param outPath path to put rendered image
     * @param id PDB ID
     */
    async renderChn(chnName: string, models: readonly Model[], outPath: string, id: string) {
        return new Promise<void>(async resolve => {
            console.log(`Rendering ${id} chain ${chnName}...`)

            let wholeStructure = await this.getStructure(models[0])

            const expression = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.ammp('label_asym_id'), chnName])
            })
            const query = compile<StructureSelection>(expression)
            const selection = query(new QueryContext(wholeStructure))
            const structure = StructureSelection.unionStructure(selection)

            let provider: RepresentationProvider<any, any, any>
            provider = CartoonRepresentationProvider
            let repr: Representation<any, any, any>
            if (structure.polymerResidueCount < 5) {
                provider = BallAndStickRepresentationProvider
                repr = provider.factory(this.reprCtx, provider.getParams)
                repr.setTheme({
                    color: this.reprCtx.colorThemeRegistry.create('element-id', { structure: structure }),
                    size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: structure })
                })
            } else {
                provider = CartoonRepresentationProvider
                repr = provider.factory(this.reprCtx, provider.getParams)
                repr.setTheme({
                    color: this.reprCtx.colorThemeRegistry.create('sequence-id', { structure: structure }),
                    size: this.reprCtx.sizeThemeRegistry.create('uniform', { structure: structure })
                })
            }

            await repr.createOrUpdate({ ...provider.defaultValues, quality: 'auto' }, structure).run()

            this.canvas3d.add(repr)
            this.canvas3d.resetCamera()

            // Write png to file
            let imagePathName = `${outPath}/${id}_chain-${chnName}.png`
            await this.createImage(imagePathName)

            // Finished writing to file and clear canvas
            console.log('Finished.')
            this.canvas3d.clear()
            resolve()
        })
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

        // Render all chains
        for (let i = 0, il = label_asym_id.rowCount; i < il; i++) {
            const eI = entities.getEntityIndex(label_entity_id.value(i))
            if (entities.data.type.value(eI) !== 'polymer') {
                continue
            }
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