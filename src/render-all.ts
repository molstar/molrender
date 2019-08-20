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
import { GaussianSurfaceRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/gaussian-surface';
import { CIF, CifFrame } from 'molstar/lib/mol-io/reader/cif'
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Model, Structure, StructureSymmetry, QueryContext, StructureSelection } from 'molstar/lib/mol-model/structure';
import { ColorNames } from 'molstar/lib/mol-util/color/tables';
import { RepresentationProvider, Representation } from 'molstar/lib/mol-repr/representation';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';


export enum Rep {
    Cartoon = 0,
    BallAndStick = 1,
    Molecular = 2,
    Gaussian = 3
}

function getID(inPath: string) {
    const arr = inPath.split('/')
    return arr[arr.length - 1].split('.')[0]
}

const readFileAsync = util.promisify(fs.readFile);

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

export async function openCif(path: string) {
    const data = await readFile(path);
    return parseCif(data);
}

export async function readCifFile(path: string) {
    const parsed = await openCif(path);
    return parsed.blocks[0];
}

async function parseCif(data: string|Uint8Array) {
    const comp = CIF.parse(data);
    const parsed = await comp.run();
    if (parsed.isError) throw parsed;
    return parsed.result;
}

export class RenderAll {

    gl: WebGLRenderingContext
    canvas3d: Canvas3D
    width: number
    height: number
    constructor(w: number, h: number) {
        this.width = w
        this.height = h

        this.gl = createContext(this.width, this.height, {
            alpha: false,
            antialias: true,
            depth: true,
            preserveDrawingBuffer: true
        })
        const input = InputObserver.create()
        this.canvas3d = Canvas3D.create(this.gl, input, {
            multiSample: {
                mode: 'on',
                sampleLevel: 3
            },
            renderer: {
                ...Canvas3DParams.renderer.defaultValue,
                lightIntensity: 0,
                ambientIntensity: 1,
                backgroundColor: ColorNames.white
            },
            postprocessing: {
                ...Canvas3DParams.postprocessing.defaultValue,
                occlusionEnable: true,
                outlineEnable: true
            }
        })
        this.canvas3d.animate()

    }

    async getModels(frame: CifFrame) {
        return await trajectoryFromMmCIF(frame).run();
    }

    async getStructure(model: Model) {
        return Structure.ofModel(model);
    }

    async renderAsm(modIndex: number, asmIndex: number, inPath: string, outPath: string, rep: Rep) {
        const reprCtx = {
            wegbl: this.canvas3d.webgl,
            colorThemeRegistry: ColorTheme.createRegistry(),
            sizeThemeRegistry: SizeTheme.createRegistry()
        }
        const id = getID(inPath)
        const folderName = `${id[1]}${id[2]}`

        try {
            if (!fs.existsSync(outPath + '/' + folderName)) {
                fs.mkdirSync(outPath + '/' + folderName)
            }

            if (!fs.existsSync(`${outPath}/${folderName}/${id}`)) {
                fs.mkdirSync(`${outPath}/${folderName}/${id}`)
            }

            const cif = await readCifFile(inPath)
            const models = await this.getModels(cif as CifFrame)

            let structure = await this.getStructure(models[modIndex])

            const asmName = models[modIndex].symmetry.assemblies[asmIndex].id
            console.log(`Rendering ${id} model ${models[modIndex].modelNum} assembly ${asmName}...`)

            const task = StructureSymmetry.buildAssembly(structure, models[modIndex].symmetry.assemblies[asmIndex].id)
            structure = await task.run()

            let repr: Representation<any, any, any>
            let provider: RepresentationProvider<any, any, any>

            switch (rep) {
                case Rep.Cartoon:
                    repr = CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
                    provider = CartoonRepresentationProvider
                    break;
                case Rep.BallAndStick:
                    repr = BallAndStickRepresentationProvider.factory(reprCtx, BallAndStickRepresentationProvider.getParams)
                    provider = BallAndStickRepresentationProvider
                    break;
                case Rep.Gaussian:
                    repr = GaussianSurfaceRepresentationProvider.factory(reprCtx, GaussianSurfaceRepresentationProvider.getParams)
                    provider = GaussianSurfaceRepresentationProvider
                    break;
                case Rep.Molecular:
                    repr = MolecularSurfaceRepresentationProvider.factory(reprCtx, MolecularSurfaceRepresentationProvider.getParams)
                    provider = GaussianSurfaceRepresentationProvider
                    break;
                default:
                    repr = CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
                    provider = CartoonRepresentationProvider
            }

            repr.setTheme({
                color: reprCtx.colorThemeRegistry.create('sequence-id', { structure }),
                size: reprCtx.sizeThemeRegistry.create('uniform', { structure })
            })
            await repr.createOrUpdate({ ...provider.defaultValues, quality: 'auto' }, structure).run()

            this.canvas3d.add(repr)
            this.canvas3d.resetCamera()
            setTimeout(() => {
                const pixelData = this.canvas3d.getPixelData('color')
                const options: PNGOptions = {width: this.width, height: this.height}
                const generatedPng = new PNG(options)
                generatedPng.data = Buffer.from(pixelData.array)
                let imagePathName = `${outPath}/${folderName}/${id}/${id}_model-${models[modIndex].modelNum}-assembly-${asmName}.png`
                generatedPng.pack().pipe(fs.createWriteStream(imagePathName)).on('finish', () => {
                    console.log('Finished.')
                    process.exit()
                })
            }, 50)

        } catch (e) {
            console.error(e)
            process.exit(1)
        }

    }

    async renderMod(modIndex: number, inPath: string, outPath: string, rep: Rep) {
        const reprCtx = {
            wegbl: this.canvas3d.webgl,
            colorThemeRegistry: ColorTheme.createRegistry(),
            sizeThemeRegistry: SizeTheme.createRegistry()
        }
        const id = getID(inPath)
        const folderName = `${id[1]}${id[2]}`

        try {
            if (!fs.existsSync(`${outPath}/${folderName}`)) {
                fs.mkdirSync(`${outPath}/${folderName}`)
            }

            if (!fs.existsSync(`${outPath}/${folderName}/${id}`)) {
                fs.mkdirSync(`${outPath}/${folderName}/${id}`)
            }

            const cif = await readCifFile(inPath)
            const models = await this.getModels(cif as CifFrame)

            let structure = await this.getStructure(models[modIndex])

            console.log(`Rendering ${id} model ${models[modIndex].modelNum}...`)

            let repr: Representation<any, any, any>
            let provider: RepresentationProvider<any, any, any>

            switch (rep) {
                case Rep.Cartoon:
                    repr = CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
                    provider = CartoonRepresentationProvider
                    break;
                case Rep.BallAndStick:
                    repr = BallAndStickRepresentationProvider.factory(reprCtx, BallAndStickRepresentationProvider.getParams)
                    provider = BallAndStickRepresentationProvider
                    break;
                case Rep.Gaussian:
                    repr = GaussianSurfaceRepresentationProvider.factory(reprCtx, GaussianSurfaceRepresentationProvider.getParams)
                    provider = GaussianSurfaceRepresentationProvider
                    break;
                case Rep.Molecular:
                    repr = MolecularSurfaceRepresentationProvider.factory(reprCtx, MolecularSurfaceRepresentationProvider.getParams)
                    provider = GaussianSurfaceRepresentationProvider
                    break;
                default:
                    repr = CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
                    provider = CartoonRepresentationProvider
            }

            repr.setTheme({
                color: reprCtx.colorThemeRegistry.create('sequence-id', { structure }),
                size: reprCtx.sizeThemeRegistry.create('uniform', { structure })
            })
            await repr.createOrUpdate({ ...provider.defaultValues, quality: 'auto' }, structure).run()

            this.canvas3d.add(repr)
            this.canvas3d.resetCamera()

            setTimeout(() => {
                const pixelData = this.canvas3d.getPixelData('color')
                const options: PNGOptions = {width: this.width, height: this.height}
                const generatedPng = new PNG(options)
                generatedPng.data = Buffer.from(pixelData.array)

                let imagePathName = `${outPath}/${folderName}/${id}/${id}_model-${models[modIndex].modelNum}.png`
                generatedPng.pack().pipe(fs.createWriteStream(imagePathName)).on('finish', () => {
                    console.log('Finished.')
                    process.exit()
                })
            }, 50)


        } catch (e) {
            console.error(e)
            process.exit(1)
        }

    }

    async renderChain(inPath: string, outPath: string, rep: Rep) {
        const reprCtx = {
            wegbl: this.canvas3d.webgl,
            colorThemeRegistry: ColorTheme.createRegistry(),
            sizeThemeRegistry: SizeTheme.createRegistry()
        }
        const id = getID(inPath)
        const folderName = `${id[1]}${id[2]}`

        // console.log(`Rendering ${id} model ${modIndex}...`)

        try {
            if (!fs.existsSync(`${outPath}/${folderName}`)) {
                fs.mkdirSync(`${outPath}/${folderName}`)
            }

            if (!fs.existsSync(`${outPath}/${folderName}/${id}`)) {
                fs.mkdirSync(`${outPath}/${folderName}/${id}`)
            }

            const cif = await readCifFile(inPath)
            const models = await this.getModels(cif as CifFrame)

            let wholeStructure = await this.getStructure(models[0])

            const expression = MS.struct.generator.atomGroups({
                'chain-test': MS.core.rel.eq([MS.ammp('label_asym_id'), 'A']),
            })
            const query = compile<StructureSelection>(expression)
            const selection = query(new QueryContext(wholeStructure))
            const structure = StructureSelection.unionStructure(selection)

            let repr: Representation<any, any, any>
            let provider: RepresentationProvider<any, any, any>

            switch (rep) {
                case Rep.Cartoon:
                    repr = CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
                    provider = CartoonRepresentationProvider
                    break;
                case Rep.BallAndStick:
                    repr = BallAndStickRepresentationProvider.factory(reprCtx, BallAndStickRepresentationProvider.getParams)
                    provider = BallAndStickRepresentationProvider
                    break;
                case Rep.Gaussian:
                    repr = GaussianSurfaceRepresentationProvider.factory(reprCtx, GaussianSurfaceRepresentationProvider.getParams)
                    provider = GaussianSurfaceRepresentationProvider
                    break;
                case Rep.Molecular:
                    repr = MolecularSurfaceRepresentationProvider.factory(reprCtx, MolecularSurfaceRepresentationProvider.getParams)
                    provider = GaussianSurfaceRepresentationProvider
                    break;
                default:
                    repr = CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
                    provider = CartoonRepresentationProvider
            }

            repr.setTheme({
                color: reprCtx.colorThemeRegistry.create('sequence-id', { structure }),
                size: reprCtx.sizeThemeRegistry.create('uniform', { structure })
            })
            await repr.createOrUpdate({ ...provider.defaultValues, quality: 'auto' }, structure).run()

            this.canvas3d.add(repr)
            this.canvas3d.resetCamera()

            setTimeout(() => {
                const pixelData = this.canvas3d.getPixelData('color')
                const options: PNGOptions = {width: this.width, height: this.height}
                const generatedPng = new PNG(options)
                generatedPng.data = Buffer.from(pixelData.array)

                let imagePathName = `${outPath}/${folderName}/${id}/${id}_model-${models[0].modelNum}.png`
                generatedPng.pack().pipe(fs.createWriteStream(imagePathName)).on('finish', () => {
                    console.log('Finished.')
                    process.exit()
                })
            }, 50)


        } catch (e) {
            console.error(e)
            process.exit(1)
        }

    }

}

export async function getArrLengths(index: number, inPath: string) {
    try {
        const cif = await readCifFile(inPath)
        const models = await trajectoryFromMmCIF(cif as CifFrame).run()
        console.log(models.length)
        console.log(models[index].symmetry.assemblies.length)
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}