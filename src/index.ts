/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
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
import { CIF, CifFrame } from 'molstar/lib/mol-io/reader/cif'
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Model, Structure } from 'molstar/lib/mol-model/structure';
import { ajaxGet } from 'molstar/lib/mol-util/data-source';
import { ColorNames } from 'molstar/lib/mol-util/color/tables';

const width = 2048
const height = 1536
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
function getCartoonRepr() {
    return CartoonRepresentationProvider.factory(reprCtx, CartoonRepresentationProvider.getParams)
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

async function getModels(frame: CifFrame) {
    return await trajectoryFromMmCIF(frame).run();
}

async function getStructure(model: Model) {
    return Structure.ofModel(model);
}

async function run(id: string, out: string) {
    try {
        const cif = await downloadFromPdb(id)
        const models = await getModels(cif as CifFrame)
        const structure = await getStructure(models[0])

        const cartoonRepr = getCartoonRepr()
        cartoonRepr.setTheme({
            color: reprCtx.colorThemeRegistry.create('sequence-id', { structure }),
            size: reprCtx.sizeThemeRegistry.create('uniform', { structure })
        })
        await cartoonRepr.createOrUpdate({ ...CartoonRepresentationProvider.defaultValues, quality: 'auto' }, structure).run()

        canvas3d.add(cartoonRepr)
        canvas3d.resetCamera()
    } catch (e) {
        console.error(e)
        process.exit(1)
    }

    const pixelData = canvas3d.getPixelData('color')
    const png = new PNG({ width, height })
    png.data = Buffer.from(pixelData.array)
    png.pack().pipe(fs.createWriteStream(out)).on('finish', () => {
        process.exit()
    })
}

//

const parser = new argparse.ArgumentParser({
    addHelp: true,
    description: 'render image as PNG (work in progress)'
});
parser.addArgument([ 'id' ], {
    help: 'PDB ID'
});
parser.addArgument([ 'out' ], {
    help: 'image output path'
});

interface Args {
    id: string
    out: string
}
const args: Args = parser.parseArgs();

run(args.id, args.out)