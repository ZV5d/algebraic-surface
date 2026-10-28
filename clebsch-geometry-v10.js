/* ============================================================
   CLEBSCH GEOMETRY CATALOG — IMMUTABLE PAGE-2 SOURCE DATA
   Keeps each exact displayed line aligned with its two affine
   defining planes. It owns no UI, Desmos instance, or mutable state.
   ============================================================ */

const clebschGeometry = (() => {
    const doubleSixOrangeNumbers = Object.freeze([16, 19, 20, 22, 25, 26]);
    const doubleSixBlueNumbers = Object.freeze([27, 24, 23, 21, 18, 17]);
    const projectionPoint = Object.freeze({ x: 4 / 7, y: -1 / 8, z: -55 / 168 });
    const s5 = Math.sqrt(5);

    /* Affine plane coefficients [x,y,z,1]. Each pair defines the line
       with the same one-based index in lineLatex. Entries involving
       sqrt(5) retain that algebraic value. */
    const linePlanePairs = Object.freeze([
        [[1,1,0,0],[0,0,3,1]], [[0,3,0,1],[1,0,1,0]],
        [[3,0,0,1],[0,1,1,0]], [[3,3,0,-1],[0,0,1,0]],
        [[3,3,0,-2],[0,0,3,-1]], [[0,1,0,0],[3,0,3,-1]],
        [[0,3,0,-1],[3,0,3,-2]], [[1,0,0,0],[0,3,3,-1]],
        [[3,0,0,-1],[0,3,3,-2]], [[0,3,0,0],[3,0,-9,1]],
        [[3,-9,0,1],[0,0,3,0]], [[3,0,0,0],[0,3,-9,1]],
        [[9,-3,0,-1],[0,0,1,0]], [[1,0,0,0],[0,9,-3,-1]],
        [[0,1,0,0],[9,0,-3,-1]],
        [[30,0,-18*s5-30,-5-s5],[0,30,6*s5,-3*s5-5]],
        [[30,0,6*s5,-3*s5-5],[0,30,-18*s5-30,-5-s5]],
        [[6,0,6*s5+18,-7-3*s5],[0,6,6*s5,-3-s5]],
        [[12,0,-3*s5+9,-3-s5],[0,12,-9*s5+15,-1+s5]],
        [[12,0,15+9*s5,-s5-1],[0,12,3*s5+9,-3+s5]],
        [[6,0,-6*s5,-3+s5],[0,6,-6*s5+18,-7+3*s5]],
        [[6,0,6*s5,-3-s5],[0,6,6*s5+18,-7-3*s5]],
        [[12,0,-9*s5+15,-1+s5],[0,12,-3*s5+9,-3-s5]],
        [[12,0,3*s5+9,-3+s5],[0,12,15+9*s5,-s5-1]],
        [[6,0,-6*s5+18,-7+3*s5],[0,6,-6*s5,-3+s5]],
        [[30,0,-6*s5,-5+3*s5],[0,30,-30+18*s5,-5+s5]],
        [[30,0,-30+18*s5,-5+s5],[0,30,-6*s5,-5+3*s5]]
    ].map(pair => Object.freeze(pair.map(plane => Object.freeze(plane)))));

    const lineLatex = Object.freeze([
        String.raw`x + y=0\left\{3 z + 1=0\right\}`,
        String.raw`3 y + 1=0\left\{x + z=0\right\}`,
        String.raw`3 x + 1=0\left\{y + z=0\right\}`,
        String.raw`3 x + 3 y - 1=0\left\{z=0\right\}`,
        String.raw`3 x + 3 y - 2=0\left\{3 z - 1=0\right\}`,
        String.raw`y=0\left\{3 x + 3 z - 1=0\right\}`,
        String.raw`3 y - 1=0\left\{3 x + 3 z - 2=0\right\}`,
        String.raw`x=0\left\{3 y + 3 z - 1=0\right\}`,
        String.raw`3 x - 1=0\left\{3 y + 3 z - 2=0\right\}`,
        String.raw`3 y=0\left\{3 x - 9 z + 1=0\right\}`,
        String.raw`3 x - 9 y + 1=0\left\{3 z=0\right\}`,
        String.raw`3 x=0\left\{3 y - 9 z + 1=0\right\}`,
        String.raw`9 x - 3 y - 1=0\left\{z=0\right\}`,
        String.raw`x=0\left\{9 y - 3 z - 1=0\right\}`,
        String.raw`y=0\left\{9 x - 3 z - 1=0\right\}`,
        String.raw`30 x - 18 \sqrt{5} z - 30 z - 5 - \sqrt{5}=0\left\{30 y + 6 \sqrt{5} z - 3 \sqrt{5} - 5=0\right\}`,
        String.raw`30 x + 6 \sqrt{5} z - 3 \sqrt{5} - 5=0\left\{30 y - 18 \sqrt{5} z - 30 z - 5 - \sqrt{5}=0\right\}`,
        String.raw`6 x + 6 \sqrt{5} z + 18 z - 7 - 3 \sqrt{5}=0\left\{6 y + 6 \sqrt{5} z - 3 - \sqrt{5}=0\right\}`,
        String.raw`12 x - 3 \sqrt{5} z + 9 z - 3 - \sqrt{5}=0\left\{12 y - 9 \sqrt{5} z + 15 z - 1 + \sqrt{5}=0\right\}`,
        String.raw`12 x + 15 z + 9 \sqrt{5} z - \sqrt{5} - 1=0\left\{12 y + 3 \sqrt{5} z + 9 z - 3 + \sqrt{5}=0\right\}`,
        String.raw`6 x - 6 \sqrt{5} z - 3 + \sqrt{5}=0\left\{6 y - 6 \sqrt{5} z + 18 z - 7 + 3 \sqrt{5}=0\right\}`,
        String.raw`6 x + 6 \sqrt{5} z - 3 - \sqrt{5}=0\left\{6 y + 6 \sqrt{5} z + 18 z - 7 - 3 \sqrt{5}=0\right\}`,
        String.raw`12 x - 9 \sqrt{5} z + 15 z - 1 + \sqrt{5}=0\left\{12 y - 3 \sqrt{5} z + 9 z - 3 - \sqrt{5}=0\right\}`,
        String.raw`12 x + 3 \sqrt{5} z + 9 z - 3 + \sqrt{5}=0\left\{12 y + 15 z + 9 \sqrt{5} z - \sqrt{5} - 1=0\right\}`,
        String.raw`6 x - 6 \sqrt{5} z + 18 z - 7 + 3 \sqrt{5}=0\left\{6 y - 6 \sqrt{5} z - 3 + \sqrt{5}=0\right\}`,
        String.raw`30 x - 6 \sqrt{5} z - 5 + 3 \sqrt{5}=0\left\{30 y - 30 z + 18 \sqrt{5} z - 5 + \sqrt{5}=0\right\}`,
        String.raw`30 x - 30 z + 18 \sqrt{5} z - 5 + \sqrt{5}=0\left\{30 y - 6 \sqrt{5} z - 5 + 3 \sqrt{5}=0\right\}`
    ]);

    if (linePlanePairs.length !== 27 || lineLatex.length !== 27) {
        throw new Error("Clebsch line catalog must contain 27 aligned entries");
    }

    function createLineExpressions({ complementaryColor, doubleSixColor }) {
        return lineLatex.map((latex, index) => ({
            id: `clebsch-line-${String(index + 1).padStart(2, "0")}`,
            latex,
            color: index < 15 ? complementaryColor : doubleSixColor,
            lineWidth: 0.8
        }));
    }

    return Object.freeze({
        doubleSixOrangeNumbers,
        doubleSixBlueNumbers,
        projectionPoint,
        linePlanePairs,
        createLineExpressions
    });
})();
