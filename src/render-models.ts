/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 */

import * as argparse from 'argparse'
import createContext = require('gl')
import fs = require('fs')
import { PNG } from 'pngjs'
import { Canvas3D, Canvas3DParams } from 'molstar/lib/mol-canvas3d/canvas3d';
import InputObserver from 'molstar/lib/mol-util/input/input-observer';
import { ColorTheme } from 'molstar/lib/mol-theme/color';
import { SizeTheme } from 'molstar/lib/mol-theme/size';
import { CartoonRepresentationProvider } from 'molstar/lib/mol-repr/structure/representation/cartoon';
import { CIF, CifFrame, CifBlock } from 'molstar/lib/mol-io/reader/cif'
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Model, Structure } from 'molstar/lib/mol-model/structure';
import { ColorNames } from 'molstar/lib/mol-util/color/tables';
import { ajaxGet } from 'molstar/lib/mol-util/data-source';

const width = 420
const height = 420
const IMAGE_PATH = './images/'

const gl = createContext(width, height, {
    alpha: false,
    antialias: true,
    depth: true,
    preserveDrawingBuffer: true
})

const input = InputObserver.create()
const canvas3d = Canvas3D.create(gl, input, {
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
canvas3d.animate()

const reprCtx = {
    wegbl: canvas3d.webgl,
    colorThemeRegistry: ColorTheme.createRegistry(),
    sizeThemeRegistry: SizeTheme.createRegistry()
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

function getCartoonRepr() {
    return CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
}

async function getModels(frame: CifFrame) {
    return await trajectoryFromMmCIF(frame).run();
}

async function getStructure(model: Model) {
    return Structure.ofModel(model);
}

async function runTests(id: string, modIndex: number) {
    console.log('Rendering + ' + id + ' model ' + modIndex + '...')
    try {
/*
            // create an image for each model (example PDB ID: 1NMR or 1GRM)
    const modelStructure = Structure.ofModel(models[0]);

    // create image for each assembly in the first model (example PDB ID: 3PQR)
    StructureSymmetry.buildAssembly(Structure.ofModel(models[0]), models[0].symmetry.assemblies[0].id)


    */

        const cif = await downloadFromPdb(id)
        const models = await getModels(cif as CifFrame)

        let structure = await getStructure(models[modIndex])

        const cartoonRepr = getCartoonRepr()

        cartoonRepr.setTheme({
            color: reprCtx.colorThemeRegistry.create('sequence-id', { structure }),
            size: reprCtx.sizeThemeRegistry.create('uniform', { structure })
        })
        await cartoonRepr.createOrUpdate({ ...CartoonRepresentationProvider.defaultValues, quality: 'auto' }, structure).run()

        canvas3d.add(cartoonRepr)
        canvas3d.resetCamera()

        await setTimeout(() => {
            const pixelData = canvas3d.getPixelData('color')
            const generatedPng = new PNG({ width, height })
            generatedPng.data = Buffer.from(pixelData.array)

            let imagePathName = IMAGE_PATH + id + '-m' + modIndex + '.png'
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

const parser = new argparse.ArgumentParser({
    addHelp: true,
    description: 'render image as PNG (work in progress)'
});

parser.addArgument([ 'id' ], {
    help: 'PDB ID'
});
parser.addArgument([ 'index' ], {
    help: 'Model index'
});


interface Args {
    id: string
    index: number
}
const args: Args = parser.parseArgs();

runTests(args.id, args.index)