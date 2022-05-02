/**
 * Copyright (c) 2022 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Jesse Liang <jesse.liang@rcsb.org>
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */

import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';

export const SmallFocusExpression = MS.struct.modifier.union([
    MS.struct.modifier.exceptBy({
        0: MS.struct.generator.all(),
        by: Q.water.expression
    })
]);

export const RepresentationExpression = MS.struct.modifier.union([
    MS.struct.combinator.merge([
        Q.ion.expression,
        Q.ligandPlusConnected.expression,
        Q.branchedConnectedOnly.expression,
        Q.disulfideBridges.expression,
        Q.nonStandardPolymer.expression
    ])
]);

export const RepresentationExpressionNoBranched = MS.struct.modifier.union([
    MS.struct.combinator.merge([
        Q.ion.expression,
        Q.ligandPlusConnected.expression,
        Q.disulfideBridges.expression,
        Q.nonStandardPolymer.expression
    ])
]);

export const FocusExpression = MS.struct.modifier.union([
    MS.struct.combinator.merge([
        Q.trace.expression,
        Q.nucleic.expression,
        Q.branchedPlusConnected.expression,
        Q.ion.expression,
        Q.ligandPlusConnected.expression,
        Q.branchedConnectedOnly.expression,
        Q.disulfideBridges.expression,
        Q.nonStandardPolymer.expression
    ])
]);

export const FocusExpressionNoBranched = MS.struct.modifier.union([
    MS.struct.combinator.merge([
        Q.trace.expression,
        Q.nucleic.expression,
        Q.ion.expression,
        Q.ligandPlusConnected.expression,
        Q.disulfideBridges.expression,
        Q.nonStandardPolymer.expression
    ])
]);