/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

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
import { CIF, CifFrame, CifBlock, CifCategory } from 'molstar/lib/mol-io/reader/cif'
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Model, Structure, StructureSymmetry } from 'molstar/lib/mol-model/structure';
import { ColorNames } from 'molstar/lib/mol-util/color/tables';
import { ajaxGet } from 'molstar/lib/mol-util/data-source';
import { readCifFile } from 'molstar/lib/apps/structure-info/model';
import { RepresentationProvider, Representation } from 'molstar/lib/mol-repr/representation';

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

async function cifReader(path: string) {
    let result = Buffer.alloc(0, undefined, 'utf-8')
    try {
        fs.readFile(path, await async function read(err, data) {
            if (err) throw err
            result = data
            console.log(data)
        })
    } catch (e) {
        console.log('huh')

        throw e
    }
    return result
}

async function cifParser(path: string) {
    const data = await cifReader(path)
    const comp = CIF.parse(data);
    const parsed = await comp.run();
    if (parsed.isError) throw parsed;
    return parsed.result.blocks[0];
}

async function parseCif(data: string|Uint8Array) {
    const comp = CIF.parse(data);
    const parsed = await comp.run();
    if (parsed.isError) throw parsed;
    return parsed.result;
}

async function downloadCif(url: string, isBinary: boolean) {
    const data = await ajaxGet({ url, type: isBinary ? 'binary' : 'string' }).run();
    return parseCif(data);
}

async function downloadFromPdb(pdb: string) {
    const parsed = await downloadCif(`https://files.rcsb.org/download/${pdb}.cif`, false);
    return parsed.blocks[0];
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

        try {

            if (!fs.existsSync(outPath + '/' + id)) {
                fs.mkdirSync(outPath + '/' + id)
            }

            const cif = await readCifFile(inPath)
            const models = await this.getModels(cif as CifFrame)

            console.log('Rendering + ' + id + ' model ' + modIndex + ', assembly ' + asmIndex + '...')


            let structure = await this.getStructure(models[modIndex])

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

            await setTimeout(() => {
                const pixelData = this.canvas3d.getPixelData('color')
                const options: PNGOptions = {width: this.width, height: this.width}
                const generatedPng = new PNG(options)
                generatedPng.data = Buffer.from(pixelData.array)

                let imagePathName = outPath + '/' + id + '/'  + id + '-m' + modIndex + 'a' + asmIndex + '.png'
                generatedPng.pack().pipe(fs.createWriteStream(imagePathName)).on('finish', () => {
                    console.log('Finished.')
                    process.exit()
                })
            }, 500)

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
        try {

            if (!fs.existsSync(outPath + '/' + id)) {
                fs.mkdirSync(outPath + '/' + id)
            }

            const cif = await readCifFile(inPath)
            const models = await this.getModels(cif as CifFrame)

            console.log('Rendering + ' + id + ' model ' + modIndex + '...')

            let structure = await this.getStructure(models[modIndex])

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

            await setTimeout(() => {
                const pixelData = this.canvas3d.getPixelData('color')
                const options: PNGOptions = {width: this.width, height: this.width}
                const generatedPng = new PNG(options)
                generatedPng.data = Buffer.from(pixelData.array)

                let imagePathName = outPath + '/' + id + '/' + id + '-m' + modIndex + '.png'
                generatedPng.pack().pipe(fs.createWriteStream(imagePathName)).on('finish', () => {
                    console.log('Finished.')
                    process.exit()
                })
            }, 500)


        } catch (e) {
            console.error(e)
            process.exit(1)
        }

    }
}

export async function getArrLengths(bool: boolean, index: number, inPath: string) {
    try {
        const cif = await cifParser(inPath)
        const id = getID(inPath)
        // const cif = await downloadFromPdb(id)
        const models = await trajectoryFromMmCIF(cif as CifFrame).run()
        if (bool) {
            console.log(models.length)
        } else {
            console.log(models[index].symmetry.assemblies.length)
        }
    } catch (e) {
        console.log(e)
        process.exit(1)
    }
}

// getArrLengths(true, 0, './examples/1crn.cif')

// const renderer = new RenderAll(420, 420)
// renderer.renderMod(0, './examples/1crn.cif', './images/', 0)
// renderer.renderAsm(0, 0, './examples/1crn.cif', './images/', 0)