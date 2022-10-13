/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Ke Ma <mark.ma@rcsb.org>
 */

import { Structure } from 'molstar/lib/mol-model/structure';
import { ImageRenderer } from '../render';

export interface FocusFactoryI {
    getFocus(imageRender: ImageRenderer): (structure: Structure) => void;
}

