/* ============================================================
   ELEMENTS
   ============================================================ */

const visualStage =
    document.getElementById("visual-stage");

const geometryControls =
    document.getElementById("geometry-controls");

const controlSectionHeading =
    document.getElementById("control-section-heading");

const controlHeadingActions =
    document.getElementById("control-heading-actions");

const infoPanel =
    document.getElementById("info-panel");

const appShell =
    document.querySelector(".app-shell");

const rightPanel =
    document.querySelector(".right-panel");

const workspaceScroll =
    document.getElementById("workspace-scroll");

const themeToggle =
    document.getElementById("theme-toggle");


/* ============================================================
   COLORS
   ============================================================ */

const COLORS = {
    surface: "#527A50",
    purplePlane: "#BEAEC1",
    purpleCurve: "#A944A7",
    bluePlane: "#A5BAC5",
    blueCurve: "#009FE3",
    intersection: "#FFAB00",
    intersectionBorder: "#A16600",
    clebschLine12: "#A3BF81",
    clebschLine15: "#789D35"
};

/* The complete Clebsch page implementation lives in clebsch-page-v10.js,
   loaded before this shared application shell. */


/* ============================================================
   ACTIVE CALCULATORS
   ============================================================ */

let activeCalculators = [];
let siteDarkMode = false;

function applyThemeToCalculator(calculator) {
    if (
        !calculator
        || typeof calculator.updateSettings !== "function"
    ) {
        return;
    }

    try {
        calculator.updateSettings({
            invertedColors: siteDarkMode
        });
    } catch (error) {
        console.warn(
            "Could not update Desmos theme",
            error
        );
    }
}

function applySiteTheme() {
    document.body.classList.toggle(
        "dark-mode",
        siteDarkMode
    );

    if (themeToggle) {
        themeToggle.textContent =
            siteDarkMode ? "☀" : "☾";
        themeToggle.title =
            siteDarkMode
                ? "Use light mode"
                : "Use dark mode";
        themeToggle.setAttribute(
            "aria-label",
            themeToggle.title
        );
        themeToggle.setAttribute(
            "aria-pressed",
            String(siteDarkMode)
        );
    }

    activeCalculators.forEach(
        applyThemeToCalculator
    );

    clebschPage?.refreshTheme?.();
}

function initializeSiteTheme() {
    let stored = null;

    try {
        stored =
            window.localStorage.getItem(
                "ags-theme"
            );
    } catch (error) {
        stored = null;
    }

    siteDarkMode =
        stored === "dark";

    applySiteTheme();

    themeToggle?.addEventListener(
        "click",
        () => {
            siteDarkMode = !siteDarkMode;

            try {
                window.localStorage.setItem(
                    "ags-theme",
                    siteDarkMode
                        ? "dark"
                        : "light"
                );
            } catch (error) {
                /* Theme still works for the current session. */
            }

            applySiteTheme();
        }
    );
}

let mainCalculator = null;
let warmup3D = null;
let purple2D = null;
let blue2D = null;
let solver2D = null;

let activeExpressionIds = [];
let currentWarmupMode = "intro";
let currentWarmupProof = null;
let warmupProofCollapsed = false;
let warmupProjectionResizeObserver = null;
let warmupProjectionLayoutFrame = null;
let warmupEquationDrawerResizeObserver = null;
let warmupEquationDrawerMutationObserver = null;
let warmupObservedExpressionPanel = null;
let warmupProofAutoCollapsedForDrawer = false;

const warmupAnimations = {};
const warmupHelperSyncTimers = {};

/* Geometry visibility has one authority: the actual Desmos expressions.
   Sidebar checkboxes and the floating legend are mirrors/remotes only. */
let warmupVisibilitySyncTimer = null;
let warmupVisibilityObserversInstalled = false;

/* One requestAnimationFrame clock drives warm-up playback.  The Desmos rows
   remain genuine native sliders, but autoplay is deliberately committed by
   this page so alpha,p,q, the 3D line and the JavaScript intersection points
   advance as one state instead of on two asynchronous clocks. */
let warmupMasterAnimationFrame = null;
let warmupMasterAnimationLastTime = 0;
let warmupMasterAnimationLastCommitTime = 0;

/* Desmos HelperExpressions echo programmatic alpha/p/q writes asynchronously.
   Keep a short history of values written by this page so those echoes can
   never overwrite a newer authoritative sidebar value.  This matters most
   for held angle-arrow keys, whose next 1/360 step can arrive before the
   preceding alpha echo has returned from Desmos. */
const warmupRecentProgrammaticParameterValues = {
    angle: [],
    p: [],
    q: []
};

/* p and q can be animated either by the website controls or by Desmos's
   own local play buttons in the expression drawer.  Exactly one source may
   own a parameter at a time.  Native Desmos playback is mirrored into the
   sidebar/2D views, but is never echoed back into the 3D p/q expression. */
let warmupNativePlaybackObserverInstalled = false;
let warmupNativePlaybackStateFrame = null;
/* Native HelperExpression callbacks already arrive after Desmos has advanced
   its sliders.  Waiting another requestAnimationFrame made snapshot-driven
   geometry visibly one frame late.  This token marks a microtask-coalesced
   flush instead: callbacks from the same Desmos update are combined before
   the browser paints, without introducing another animation-frame delay. */
let warmupNativeParameterSyncFrame = null;
let warmupNativeParameterSyncGeneration = 0;
const warmupPendingNativeParameterValues = new Map();

let warmupGloballyPaused = false;
let warmupGloballyPausedParameters = [];
let warmupGlobalStopButton = null;

const warmupVisibilityByMode = {
    intro: {
        surface: true,
        purplePlane: true,
        bluePlane: true,
        purpleCubic: true,
        blueCubic: false,
        line: true,
        points: true,
        purpleProjection: false,
        blueProjection: false
    },
    restriction: {
        surface: true,
        purplePlane: true,
        bluePlane: true,
        purpleCubic: true,
        blueCubic: false,
        line: true,
        points: true,
        purpleProjection: false,
        blueProjection: false
    },
    bezout: {
        surface: true,
        purplePlane: true,
        bluePlane: true,
        purpleCubic: true,
        blueCubic: false,
        line: true,
        points: true,
        purpleProjection: true,
        blueProjection: false
    },
    complete: {
        surface: true,
        purplePlane: true,
        bluePlane: true,
        purpleCubic: true,
        blueCubic: true,
        line: true,
        points: true,
        purpleProjection: true,
        blueProjection: true
    }
};

function warmupVisibilityForMode(mode = currentWarmupMode) {
    return warmupVisibilityByMode[mode]
        ?? warmupVisibilityByMode.intro;
}


/* ============================================================
   WARM-UP PARAMETERS
   ============================================================ */

const WARMUP_ANGLE_STEPS_PER_PI = 360;

/* Match the original smooth warm-up pacing: before switching to native
   Desmos playback, one full slider traversal took about 13 seconds.
   Desmos's default native animation is much faster, so set the native
   animation period once when the sliders are created. */
const WARMUP_NATIVE_ANIMATION_PERIOD_MS = 13000; // 0.5 degree = pi/360

/* Runtime budget for interactive motion.  Desmos implicit 3D rendering is
   much more expensive than ordinary DOM work, so parameter motion is
   intentionally decoupled from the real-root calculation.  The geometry
   stays responsive while orange intersection points are refreshed at a
   lower, degree-aware rate. */
const WARMUP_CONTROL_RENDER_INTERVAL_MS = 36;

/* v10 has no mathematical degree cutoff.  Cheap restrictions are solved
   synchronously so the 2D/3D snapshot remains same-frame; expensive compact
   expressions are isolated in a cancellable Web Worker with a watchdog.
   The lane is chosen from the actual work implied by the current algebra,
   not from a user-visible degree rule. */

/* Expensive Desmos work is shared by all running animations.  The DOM
   sliders may move independently at requestAnimationFrame speed, but the
   three calculators are updated through one coalesced commit stream. */
function warmupActiveAnimationCount() {
    return ["angle", "p", "q"].filter(
        parameter => warmupAnimations[parameter]?.running
    ).length;
}

function warmupInteractiveRenderInterval() {
    const active = warmupActiveAnimationCount();

    /* The implicit 3D scene is by far the expensive renderer.  Keep it at
       a modest cadence while the DOM sliders and the two lightweight 2D
       cards are allowed to move more smoothly on their own stream. */
    if (active >= 3) {
        return 100;
    }

    if (active === 2) {
        return 80;
    }

    if (active === 1) {
        return 60;
    }

    return WARMUP_CONTROL_RENDER_INTERVAL_MS;
}

const warmupInitialParameters = Object.freeze({
    angle: -0.25,   // azimuth alpha / pi, so alpha = -pi/4 initially
    p: 1.7,
    q: 0.9
});

const warmupParameters = {
    ...warmupInitialParameters
};

let warmupCompleteControlsExpanded = false;
let warmupDesmosEquationsVisible = false;
let warmupAlphaHelper = null;
let warmupPHelper = null;
let warmupQHelper = null;
let warmupLastLineConditionLatex = null;
let warmupLast3DLineLatex = null;
let warmup3DLineZMin = null;
let warmup3DLineZMax = null;
let warmup3DLineBoundsTimer = null;
let warmupLastIntersectionNoteText = null;
let warmupWorkerIntersectionTimer = null;
let warmupWorkerIntersectionGeneration = 0;
let warmupWorkerIntersectionStatus = null;
let warmupIntersectionWorker = null;
let warmupIntersectionWorkerTimeout = null;
let warmupWorkerStatusTimer = null;
let warmupIntersectionWorkerUrl = null;

/* Intersection lifecycle state.  A protected solve is identified by the
   exact surface revision plus one frozen (alpha,p,q) snapshot.  Repeated UI
   callbacks for the same state must never clear a valid result, cancel an
   identical pending worker, or start the same solve again. */
let warmupIntersectionPendingState = null;
let warmupIntersectionCommittedState = null;
let warmupIntersectionFailedState = null;


/* ============================================================
   WARM-UP SURFACE ENGINE
   ============================================================ */

/*
   The warm-up is no longer tied to the Clebsch cubic.  The only surface
   datum is a polynomial f(x,y,z).  Desmos renders f symbolically, while
   JavaScript now keeps the same formula compact as a syntax tree.  Small
   algebra stays synchronous for exact snapshot rendering; expensive
   restriction/root work is isolated in a cancellable background Worker.

   The Clebsch cubic is simply the initial polynomial.
*/

const DEFAULT_WARMUP_SURFACE_SOURCE = `
    81*(x^3+y^3+z^3)
    -189*(x^2*y+x^2*z+y^2*x+y^2*z+z^2*x+z^2*y)
    +54*x*y*z
    +126*(x*y+y*z+z*x)
    -9*(x^2+y^2+z^2)
    -9*(x+y+z)
    +1`;

const DEFAULT_WARMUP_SURFACE_LATEX = String.raw`
    f(x,y,z)=
    81(x^3+y^3+z^3)
    -189(x^2y+x^2z+y^2x+y^2z+z^2x+z^2y)
    +54xyz
    +126(xy+yz+zx)
    -9(x^2+y^2+z^2)
    -9(x+y+z)
    +1`;

/* Compact polynomial syntax tree -------------------------------------------------
   v10 deliberately separates "understanding the formula" from "expanding the
   formula".  Desmos is already good at keeping expressions such as P(x,y,z)^N
   compact.  JavaScript now does the same: parsing is linear in the typed formula
   and never multiplies polynomial supports merely to discover the degree.

   A small guarded sparse expansion is still useful for ordinary surfaces because
   it preserves the old same-frame orange-point behaviour.  Crucially, that
   expansion is optional and protected by operation/term fuses; expressions that
   do not fit the fast lane stay compact and are solved in a cancellable Worker.
*/

const WARMUP_MAIN_EXPANSION_TERM_CAP = 12000;
const WARMUP_MAIN_EXPANSION_PAIR_CAP = 120000;
const WARMUP_SYNC_SOLVE_WORK_BUDGET = 500000;
const WARMUP_WORKER_SETTLE_MS = 180;
/* Do not flash a background-computation message for ordinary keyboard taps
   or workers that finish almost immediately.  The status is shown only if
   the protected computation remains alive long enough to be useful feedback. */
const WARMUP_WORKER_STATUS_DELAY_MS = 250;
const WARMUP_WORKER_TIMEOUT_MS = 3500;
const WARMUP_WORKER_MAX_COEFFICIENTS = 500000;
const WARMUP_WORKER_RESTRICTION_OPERATION_FUSE = 60000000;
const WARMUP_WORKER_ROOT_OPERATION_FUSE = 80000000;
const WARMUP_WORKER_DERIVATIVE_CELL_FUSE = 4000000;

class WarmupResourceLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = "WarmupResourceLimitError";
        this.code = "resource-limit";
    }
}

function warmupAstConstant(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error("Polynomial coefficients must be finite numbers.");
    }
    return { type: "constant", value: numeric };
}

function warmupAstVariable(name) {
    return { type: "variable", name };
}

function warmupAstAdd(left, right) {
    if (left.type === "constant" && left.value === 0) return right;
    if (right.type === "constant" && right.value === 0) return left;
    if (left.type === "constant" && right.type === "constant") {
        return warmupAstConstant(left.value + right.value);
    }
    return { type: "add", left, right };
}

function warmupAstMultiply(left, right) {
    if (
        (left.type === "constant" && left.value === 0)
        || (right.type === "constant" && right.value === 0)
    ) {
        return warmupAstConstant(0);
    }
    if (left.type === "constant" && left.value === 1) return right;
    if (right.type === "constant" && right.value === 1) return left;
    if (left.type === "constant" && right.type === "constant") {
        return warmupAstConstant(left.value * right.value);
    }
    return { type: "multiply", left, right };
}

function warmupAstPower(base, exponent) {
    if (exponent === 0) return warmupAstConstant(1);
    if (exponent === 1) return base;
    if (base.type === "constant") {
        return warmupAstConstant(base.value ** exponent);
    }
    return { type: "power", base, exponent };
}

function warmupAstConstantValue(node) {
    switch (node?.type) {
        case "constant":
            return Number(node.value);
        case "add": {
            const left = warmupAstConstantValue(node.left);
            const right = warmupAstConstantValue(node.right);
            return Number.isFinite(left) && Number.isFinite(right)
                ? left + right
                : null;
        }
        case "multiply": {
            const left = warmupAstConstantValue(node.left);
            const right = warmupAstConstantValue(node.right);
            return Number.isFinite(left) && Number.isFinite(right)
                ? left * right
                : null;
        }
        case "power": {
            const base = warmupAstConstantValue(node.base);
            return Number.isFinite(base)
                ? base ** node.exponent
                : null;
        }
        default:
            return null;
    }
}

function warmupAstDegreeUpperBound(node) {
    switch (node?.type) {
        case "constant":
            return node.value === 0 ? -Infinity : 0;
        case "variable":
            return 1;
        case "add":
            return Math.max(
                warmupAstDegreeUpperBound(node.left),
                warmupAstDegreeUpperBound(node.right)
            );
        case "multiply": {
            const left = warmupAstDegreeUpperBound(node.left);
            const right = warmupAstDegreeUpperBound(node.right);
            if (left === -Infinity || right === -Infinity) return -Infinity;
            return left + right;
        }
        case "power": {
            const base = warmupAstDegreeUpperBound(node.base);
            if (node.exponent === 0) return 0;
            if (base === -Infinity) return -Infinity;
            return base * node.exponent;
        }
        default:
            throw new Error("Invalid polynomial syntax tree.");
    }
}

function warmupAstNodeCount(node) {
    switch (node?.type) {
        case "constant":
        case "variable":
            return 1;
        case "add":
        case "multiply":
            return 1 + warmupAstNodeCount(node.left) + warmupAstNodeCount(node.right);
        case "power":
            return 1 + warmupAstNodeCount(node.base);
        default:
            return 1;
    }
}

function warmupReadBraceGroup(text, startIndex) {
    if (text[startIndex] !== "{") {
        throw new Error("Expected { in LaTeX expression.");
    }

    let depth = 0;

    for (let index = startIndex; index < text.length; index += 1) {
        if (text[index] === "{") {
            depth += 1;
        } else if (text[index] === "}") {
            depth -= 1;
            if (depth === 0) {
                return {
                    content: text.slice(startIndex + 1, index),
                    endIndex: index
                };
            }
        }
    }

    throw new Error("Unclosed { in LaTeX expression.");
}

function warmupExpandLatexFractions(text) {
    let output = "";

    for (let index = 0; index < text.length;) {
        if (text.startsWith("\\frac", index)) {
            let cursor = index + 5;
            while (/\\s/.test(text[cursor] || "")) cursor += 1;
            const numerator = warmupReadBraceGroup(text, cursor);
            cursor = numerator.endIndex + 1;
            while (/\\s/.test(text[cursor] || "")) cursor += 1;
            const denominator = warmupReadBraceGroup(text, cursor);
            output += `((`;
            output += warmupExpandLatexFractions(numerator.content);
            output += `)/(`;
            output += warmupExpandLatexFractions(denominator.content);
            output += `))`;
            index = denominator.endIndex + 1;
            continue;
        }
        output += text[index];
        index += 1;
    }

    return output;
}

function warmupNormalizePolynomialInput(input) {
    let text = String(input ?? "")
        .replace(/−/g, "-")
        .replace(/\\left/g, "")
        .replace(/\\right/g, "")
        .replace(/\\,/g, "")
        .replace(/\\;/g, "")
        .replace(/\\!/g, "")
        .replace(/\\cdot/g, "*")
        .replace(/\\times/g, "*");

    text = warmupExpandLatexFractions(text);
    text = text
        .replace(/[{}]/g, match => match === "{" ? "(" : ")")
        .replace(/\s+/g, "");

    const equalsIndex = text.indexOf("=");
    if (equalsIndex >= 0) {
        const left = text.slice(0, equalsIndex);
        const right = text.slice(equalsIndex + 1);
        if (/^f\(x,y,z\)$/.test(left) || /^f$/.test(left)) {
            text = right;
        } else if (left === "0") {
            text = right;
        } else {
            throw new Error("Use f(x,y,z)=... or enter only the polynomial.");
        }
    }

    return text;
}

function warmupTokenizePolynomial(input) {
    const text = warmupNormalizePolynomialInput(input);
    const tokens = [];
    let index = 0;

    while (index < text.length) {
        const rest = text.slice(index);
        const numberMatch = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
        if (numberMatch) {
            tokens.push({ type: "number", value: Number(numberMatch[0]) });
            index += numberMatch[0].length;
            continue;
        }

        const character = text[index];
        if (/[xyz]/i.test(character)) {
            tokens.push({ type: "variable", value: character.toLowerCase() });
            index += 1;
            continue;
        }
        if ("+-*/^()".includes(character)) {
            tokens.push({ type: character, value: character });
            index += 1;
            continue;
        }
        throw new Error(`Unsupported symbol “${character}”. Use a polynomial in x, y, z.`);
    }

    tokens.push({ type: "eof" });
    return tokens;
}

function warmupParsePolynomialAst(input) {
    const tokens = warmupTokenizePolynomial(input);
    let position = 0;
    const peek = () => tokens[position];
    const take = type => {
        const token = peek();
        if (token.type !== type) {
            throw new Error(`Expected ${type}, found ${token.type}.`);
        }
        position += 1;
        return token;
    };
    const startsImplicitFactor = token =>
        token.type === "number" || token.type === "variable" || token.type === "(";

    function parseExpression() {
        let value = parseTerm();
        while (peek().type === "+" || peek().type === "-") {
            const operator = peek().type;
            position += 1;
            const right = parseTerm();
            value = warmupAstAdd(
                value,
                operator === "+" ? right : warmupAstMultiply(warmupAstConstant(-1), right)
            );
        }
        return value;
    }

    function parseTerm() {
        let value = parseUnary();
        while (true) {
            const token = peek();
            if (token.type === "*") {
                position += 1;
                value = warmupAstMultiply(value, parseUnary());
                continue;
            }
            if (token.type === "/") {
                position += 1;
                const divisorNode = parseUnary();
                const divisor = warmupAstConstantValue(divisorNode);
                if (divisor === null || !Number.isFinite(divisor) || divisor === 0) {
                    throw new Error("Division is allowed only by a nonzero numeric constant.");
                }
                value = warmupAstMultiply(value, warmupAstConstant(1 / divisor));
                continue;
            }
            if (startsImplicitFactor(token)) {
                value = warmupAstMultiply(value, parseUnary());
                continue;
            }
            break;
        }
        return value;
    }

    function parseUnary() {
        if (peek().type === "+") {
            position += 1;
            return parseUnary();
        }
        if (peek().type === "-") {
            position += 1;
            return warmupAstMultiply(warmupAstConstant(-1), parseUnary());
        }
        return parsePower();
    }

    function parsePower() {
        let value = parsePrimary();
        if (peek().type === "^") {
            position += 1;
            let exponentNode;
            if (peek().type === "(") {
                position += 1;
                exponentNode = parseExpression();
                take(")");
            } else {
                exponentNode = parseUnary();
            }
            const exponent = warmupAstConstantValue(exponentNode);
            if (exponent === null || !Number.isInteger(exponent) || exponent < 0) {
                throw new Error("Exponents must be non-negative integers.");
            }
            value = warmupAstPower(value, exponent);
        }
        return value;
    }

    function parsePrimary() {
        const token = peek();
        if (token.type === "number") {
            position += 1;
            return warmupAstConstant(token.value);
        }
        if (token.type === "variable") {
            position += 1;
            return warmupAstVariable(token.value);
        }
        if (token.type === "(") {
            position += 1;
            const value = parseExpression();
            take(")");
            return value;
        }
        throw new Error(`Unexpected token ${token.type}.`);
    }

    const ast = parseExpression();
    if (peek().type !== "eof") {
        throw new Error(`Unexpected token ${peek().type}.`);
    }

    const degree = warmupAstDegreeUpperBound(ast);
    if (degree === -Infinity) {
        throw new Error("The zero polynomial does not define a surface hypersurface.");
    }
    if (degree < 1) {
        throw new Error("Please enter a nonconstant polynomial.");
    }
    if (!Number.isFinite(degree) || degree > Number.MAX_SAFE_INTEGER) {
        throw new Error("The polynomial degree is too large to represent safely.");
    }

    return ast;
}

function warmupPolynomialKey(exponents) {
    return exponents.join(",");
}

function warmupPolynomialExponents(key) {
    return key.split(",").map(Number);
}

function warmupPolynomialClean(poly) {
    const result = new Map();
    poly.forEach((coefficient, key) => {
        const numeric = Number(coefficient);
        if (Number.isFinite(numeric) && numeric !== 0) result.set(key, numeric);
    });
    return result;
}

function warmupGuardedPolynomialMultiply(left, right, budget) {
    const pairs = left.size * right.size;
    if (!Number.isFinite(pairs) || budget.operations + pairs > budget.pairCap) {
        throw new WarmupResourceLimitError("Compact mode required for this expansion.");
    }
    budget.operations += pairs;
    const result = new Map();

    left.forEach((leftCoefficient, leftKey) => {
        const leftExponents = warmupPolynomialExponents(leftKey);
        right.forEach((rightCoefficient, rightKey) => {
            const rightExponents = warmupPolynomialExponents(rightKey);
            const key = warmupPolynomialKey([
                leftExponents[0] + rightExponents[0],
                leftExponents[1] + rightExponents[1],
                leftExponents[2] + rightExponents[2]
            ]);
            result.set(key, (result.get(key) || 0) + leftCoefficient * rightCoefficient);
            if (result.size > budget.termCap) {
                throw new WarmupResourceLimitError("Compact mode required for this expansion.");
            }
        });
    });

    return warmupPolynomialClean(result);
}

function warmupMaterializeAstGuarded(ast) {
    const budget = {
        operations: 0,
        termCap: WARMUP_MAIN_EXPANSION_TERM_CAP,
        pairCap: WARMUP_MAIN_EXPANSION_PAIR_CAP
    };

    const constant = value => value === 0
        ? new Map()
        : new Map([["0,0,0", value]]);
    const variable = name => {
        const exponents = { x: [1,0,0], y: [0,1,0], z: [0,0,1] }[name];
        return new Map([[warmupPolynomialKey(exponents), 1]]);
    };
    const add = (left, right) => {
        const result = new Map(left);
        right.forEach((coefficient, key) => {
            result.set(key, (result.get(key) || 0) + coefficient);
        });
        if (result.size > budget.termCap) {
            throw new WarmupResourceLimitError("Compact mode required for this expansion.");
        }
        return warmupPolynomialClean(result);
    };

    const visit = node => {
        switch (node.type) {
            case "constant": return constant(node.value);
            case "variable": return variable(node.name);
            case "add": return add(visit(node.left), visit(node.right));
            case "multiply": return warmupGuardedPolynomialMultiply(visit(node.left), visit(node.right), budget);
            case "power": {
                let result = constant(1);
                let base = visit(node.base);
                let exponent = node.exponent;
                while (exponent > 0) {
                    if (exponent % 2 === 1) {
                        result = warmupGuardedPolynomialMultiply(result, base, budget);
                    }
                    exponent = Math.floor(exponent / 2);
                    if (exponent > 0) {
                        base = warmupGuardedPolynomialMultiply(base, base, budget);
                    }
                }
                return result;
            }
            default:
                throw new Error("Invalid polynomial syntax tree.");
        }
    };

    return visit(ast);
}

function warmupPolynomialDegree(poly) {
    let degree = -Infinity;
    poly.forEach((coefficient, key) => {
        if (coefficient === 0) return;
        const exponents = warmupPolynomialExponents(key);
        degree = Math.max(degree, exponents[0] + exponents[1] + exponents[2]);
    });
    return degree === -Infinity ? -1 : degree;
}

function warmupCreateSurface(ast, definitionLatex) {
    let polynomial = null;
    let terms = null;
    let exactDegree = null;

    try {
        polynomial = warmupMaterializeAstGuarded(ast);
        if (polynomial.size === 0) {
            throw new Error("The zero polynomial does not define a surface hypersurface.");
        }

        terms = [];
        polynomial.forEach((coefficient, key) => {
            const [a, b, c] = warmupPolynomialExponents(key);
            terms.push({ coefficient, a, b, c });
        });
        exactDegree = warmupPolynomialDegree(polynomial);
    } catch (error) {
        if (!(error instanceof WarmupResourceLimitError)) throw error;
    }

    const degreeUpperBound = warmupAstDegreeUpperBound(ast);
    const degree = exactDegree ?? degreeUpperBound;

    return {
        ast,
        terms,
        degree,
        degreeExact: exactDegree !== null,
        degreeUpperBound,
        nodeCount: warmupAstNodeCount(ast),
        definitionLatex
    };
}

let warmupSurface =
    warmupCreateSurface(
        warmupParsePolynomialAst(DEFAULT_WARMUP_SURFACE_SOURCE),
        DEFAULT_WARMUP_SURFACE_LATEX
    );

let warmupSurfaceDraftValid = true;
let warmupSurfaceRevision = 0;
let warmupSurfaceDraftLatex =
    warmupSurface.definitionLatex;
/* Track the last f-expression value observed in the 3D calculator
   separately from the last parsed/applied surface.  Native slider playback
   emits calculator "change" events continuously; those unrelated events
   must not keep restarting the surface-edit debounce. */
let warmupSurfacePendingLatex =
    warmupSurfaceDraftLatex;
let warmupSurfaceSyncTimer = null;
let warmupSurfaceChangeObserverInstalled = false;

function warmupEvaluateAstAtPoint(node, x, y, z) {
    switch (node.type) {
        case "constant": {
            const value = Number(node.value);
            return { value, scale: Math.abs(value) };
        }
        case "variable": {
            const value = node.name === "x" ? x : (node.name === "y" ? y : z);
            return { value, scale: Math.abs(value) };
        }
        case "add": {
            const left = warmupEvaluateAstAtPoint(node.left, x, y, z);
            const right = warmupEvaluateAstAtPoint(node.right, x, y, z);
            return {
                value: left.value + right.value,
                scale: left.scale + right.scale
            };
        }
        case "multiply": {
            const left = warmupEvaluateAstAtPoint(node.left, x, y, z);
            const right = warmupEvaluateAstAtPoint(node.right, x, y, z);
            return {
                value: left.value * right.value,
                scale: left.scale * right.scale
            };
        }
        case "power": {
            const base = warmupEvaluateAstAtPoint(node.base, x, y, z);
            return {
                value: base.value ** node.exponent,
                scale: base.scale ** node.exponent
            };
        }
        default:
            return { value: NaN, scale: Infinity };
    }
}

function warmupEvaluateAstAlongLine(
    node,
    t,
    x0,
    x1,
    y0,
    y1
) {
    switch (node.type) {
        case "constant": {
            const value = Number(node.value);
            return {
                value,
                scale: Math.abs(value),
                derivative: 0,
                derivativeScale: 0
            };
        }
        case "variable": {
            if (node.name === "x") {
                const value = x0 + x1 * t;
                return {
                    value,
                    scale: Math.abs(value),
                    derivative: x1,
                    derivativeScale: Math.abs(x1)
                };
            }
            if (node.name === "y") {
                const value = y0 + y1 * t;
                return {
                    value,
                    scale: Math.abs(value),
                    derivative: y1,
                    derivativeScale: Math.abs(y1)
                };
            }
            return {
                value: t,
                scale: Math.abs(t),
                derivative: 1,
                derivativeScale: 1
            };
        }
        case "add": {
            const left = warmupEvaluateAstAlongLine(node.left, t, x0, x1, y0, y1);
            const right = warmupEvaluateAstAlongLine(node.right, t, x0, x1, y0, y1);
            return {
                value: left.value + right.value,
                scale: left.scale + right.scale,
                derivative: left.derivative + right.derivative,
                derivativeScale: left.derivativeScale + right.derivativeScale
            };
        }
        case "multiply": {
            const left = warmupEvaluateAstAlongLine(node.left, t, x0, x1, y0, y1);
            const right = warmupEvaluateAstAlongLine(node.right, t, x0, x1, y0, y1);
            return {
                value: left.value * right.value,
                scale: left.scale * right.scale,
                derivative:
                    left.derivative * right.value
                    + left.value * right.derivative,
                derivativeScale:
                    left.derivativeScale * right.scale
                    + left.scale * right.derivativeScale
            };
        }
        case "power": {
            const base = warmupEvaluateAstAlongLine(node.base, t, x0, x1, y0, y1);
            const exponent = node.exponent;
            if (exponent === 0) {
                return {
                    value: 1,
                    scale: 1,
                    derivative: 0,
                    derivativeScale: 0
                };
            }
            const basePower = base.value ** (exponent - 1);
            const scalePower = base.scale ** (exponent - 1);
            return {
                value: base.value * basePower,
                scale: base.scale * scalePower,
                derivative: exponent * basePower * base.derivative,
                derivativeScale: exponent * scalePower * base.derivativeScale
            };
        }
        default:
            return {
                value: NaN,
                scale: Infinity,
                derivative: NaN,
                derivativeScale: Infinity
            };
    }
}

function warmupSurfaceValue(x, y, z) {
    return warmupEvaluateAstAtPoint(
        warmupSurface.ast,
        x,
        y,
        z
    ).value;
}

/* Evaluate f together with an absolute expression-tree scale.  This gives a
   conservative floating-point residual scale without ever expanding a large
   compact surface merely to verify one candidate intersection. */
function warmupSurfaceValueAndScale(x, y, z) {
    return warmupEvaluateAstAtPoint(
        warmupSurface.ast,
        x,
        y,
        z
    );
}

function warmupSurfaceRestrictionValueAndDerivative(
    t,
    angle,
    p,
    q
) {
    const {
        cosine: c,
        sine: r
    } = warmupTrig(angle);

    const x0 = r * p + c * q;
    const x1 = -(r + c);
    const y0 = -c * p + r * q;
    const y1 = c - r;

    return warmupEvaluateAstAlongLine(
        warmupSurface.ast,
        t,
        x0,
        x1,
        y0,
        y1
    );
}

function warmupPolishIntersectionRootDirect(
    initial,
    angle,
    p,
    q
) {
    let t = initial;

    for (let iteration = 0; iteration < 18; iteration += 1) {
        const evaluation =
            warmupSurfaceRestrictionValueAndDerivative(
                t,
                angle,
                p,
                q
            );

        if (
            !Number.isFinite(evaluation.value)
            || !Number.isFinite(evaluation.derivative)
        ) {
            break;
        }

        if (evaluation.value === 0) {
            break;
        }

        if (
            Math.abs(evaluation.derivative)
            <= 256 * Number.EPSILON
                * Math.max(
                    Number.MIN_VALUE,
                    evaluation.derivativeScale
                )
        ) {
            break;
        }

        const correction =
            evaluation.value / evaluation.derivative;
        const next = t - correction;

        if (!Number.isFinite(next)) {
            break;
        }

        t = next;

        if (
            Math.abs(correction)
            <= 64 * Number.EPSILON
                * Math.max(1, Math.abs(t))
        ) {
            break;
        }
    }

    return t;
}

function warmupValidatedIntersectionRoots(
    roots,
    angle,
    p,
    q
) {
    const polishedRoots = roots
        .filter(Number.isFinite)
        .map(t =>
            warmupPolishIntersectionRootDirect(
                t,
                angle,
                p,
                q
            )
        );

    return warmupUniqueRealRoots(
        polishedRoots.filter(t => {
            if (!Number.isFinite(t)) {
                return false;
            }

            const [x, y, z] = warmupLinePoint(
                t,
                angle,
                p,
                q
            );

            if (![x, y, z].every(Number.isFinite)) {
                return false;
            }

            const {
                value,
                scale
            } = warmupSurfaceValueAndScale(x, y, z);

            if (!Number.isFinite(value) || !Number.isFinite(scale)) {
                return false;
            }

            /* 1e-8 is intentionally much tighter than the critical-point
               heuristic used while isolating roots, but still generous
               compared with double-precision roundoff for the displayed
               geometry.  False high-degree roots typically have residuals
               comparable with the whole monomial scale and are rejected by
               many orders of magnitude. */
            /* Floating-point error is relative to the magnitudes of the
               monomials actually evaluated.  A unit absolute floor is wrong
               for high powers: for f=x^45 it would accept every point with
               |x|^45<1e-8 as if it were on S. */
            if (value === 0) {
                return true;
            }

            const tolerance =
                2e-8 * Math.max(Number.MIN_VALUE, scale);

            return Math.abs(value) <= tolerance;
        })
    );
}

function warmupSurfaceNoteText(error = null) {
    if (error) {
        return `Surface equation: ${error}`;
    }

    const degreeText = warmupSurface.degreeExact
        ? `detected degree d=${warmupSurface.degree}`
        : `formal degree d=${warmupSurface.degree} (kept compact)`;

    return `Surface f=0, ${degreeText}. Edit f below to change the polynomial surface; all sections and intersection points update from the same f.`;
}

function warmupIntersectionNoteText(
    restrictedDegree = null,
    lineContained = false
) {
    if (lineContained) {
        return "The restriction f|_L is identically zero, so the whole line L lies on S; isolated orange intersection points are not drawn.";
    }

    const degreeText =
        Number.isInteger(restrictedDegree)
            ? ` Here deg(f|_L)=${restrictedDegree}.`
            : "";

    return `Orange points S ∩ L are the real affine roots of f|_L computed in JavaScript, rather than by another Desmos restriction.${degreeText} Non-real roots and intersections at infinity are not drawn.`;
}

function warmupSynchronousSolveWorkEstimate() {
    if (!Array.isArray(warmupSurface?.terms)) {
        return Infinity;
    }

    const degree = Math.max(0, Number(warmupSurface.degree) || 0);
    let restrictionWork = degree + 1;

    warmupSurface.terms.forEach(({ a, b }) => {
        restrictionWork +=
            (a * (a + 1)) / 2
            + (b * (b + 1)) / 2
            + (a + 1) * (b + 1);
    });

    /* This mirrors the expensive pieces of the existing exact-ish solver:
       derivative recursion plus the independent 24*d sign scan.  It is only
       a lane selector; exceeding it never rejects the surface, it moves the
       computation into the cancellable Worker. */
    const rootWork =
        degree * (degree + 1) / 2
        + 24 * degree * degree;

    return restrictionWork + rootWork;
}

function warmupUseSynchronousIntersectionSolver() {
    return (
        Array.isArray(warmupSurface?.terms)
        && warmupSynchronousSolveWorkEstimate()
            <= WARMUP_SYNC_SOLVE_WORK_BUDGET
    );
}

function warmupIntersectionState(snapshot, revision = warmupSurfaceRevision) {
    return {
        revision,
        snapshot: {
            angle: snapshot.angle,
            p: snapshot.p,
            q: snapshot.q
        }
    };
}

function warmupIntersectionStateMatches(state, snapshot, revision = warmupSurfaceRevision) {
    return Boolean(
        state
        && state.revision === revision
        && warmupSnapshotsMatch(state.snapshot, snapshot)
    );
}

function warmupResetIntersectionLifecycle() {
    warmupIntersectionPendingState = null;
    warmupIntersectionCommittedState = null;
    warmupIntersectionFailedState = null;
}

function warmupCancelWorkerIntersectionSolve() {
    if (warmupWorkerIntersectionTimer !== null) {
        clearTimeout(warmupWorkerIntersectionTimer);
        warmupWorkerIntersectionTimer = null;
    }

    if (warmupIntersectionWorkerTimeout !== null) {
        clearTimeout(warmupIntersectionWorkerTimeout);
        warmupIntersectionWorkerTimeout = null;
    }

    if (warmupWorkerStatusTimer !== null) {
        clearTimeout(warmupWorkerStatusTimer);
        warmupWorkerStatusTimer = null;
    }

    if (warmupIntersectionWorker) {
        warmupIntersectionWorker.terminate();
        warmupIntersectionWorker = null;
    }

    warmupIntersectionPendingState = null;
    warmupWorkerIntersectionGeneration += 1;
}

function warmupSetWorkerIntersectionStatus(status, text, clearPoints = true) {
    const unchanged =
        warmupWorkerIntersectionStatus === status
        && warmupLastIntersectionNoteText === text;

    warmupWorkerIntersectionStatus = status;
    warmupLastIntersectionNoteText = text;

    if (!unchanged) {
        warmup3D?.setExpression({
            id: "note-points",
            type: "text",
            text
        });
    }

    if (clearPoints) {
        warmupClearIntersectionPointExpressions();
    }
}

function warmupWorkerExactTrig(angleCoefficient) {
    const steps = 360;
    const index = Math.max(-steps, Math.min(steps, Math.round(Number(angleCoefficient) * steps)));
    const quarter = steps / 4;

    if (Number.isInteger(quarter) && index % quarter === 0) {
        const turn = ((index / quarter) % 8 + 8) % 8;
        const h = Math.SQRT1_2;
        const values = [
            [1,0], [h,h], [0,1], [-h,h],
            [-1,0], [-h,-h], [0,-1], [h,-h]
        ];
        return { cosine: values[turn][0], sine: values[turn][1] };
    }

    const alpha = index * Math.PI / steps;
    return { cosine: Math.cos(alpha), sine: Math.sin(alpha) };
}

function warmupWorkerBudgetTick(budget, amount) {
    const next = budget.operations + amount;
    if (!Number.isFinite(next) || next > budget.operationFuse) {
        const error = new Error("The compact restriction became too expensive to materialize safely.");
        error.code = "resource-limit";
        throw error;
    }
    budget.operations = next;
}

function warmupWorkerPolyConstant(value) {
    return { values: [Number(value)], scales: [Math.abs(Number(value))] };
}

function warmupWorkerPolyTrim(poly) {
    let last = poly.values.length - 1;

    /* Never delete a merely small coefficient in compact/worker mode.  The
       construction-scale bound can become deliberately conservative after
       repeated powers, so using it as a trimming threshold can erase genuine
       high-degree terms.  Exact shared trig values already make the intended
       quarter-turn cancellations literal zeros; everything else stays. */
    while (last > 0 && poly.values[last] === 0) {
        last -= 1;
    }

    return {
        values: poly.values.slice(0, last + 1),
        scales: poly.scales.slice(0, last + 1)
    };
}

function warmupWorkerPolyAdd(left, right, budget) {
    const length = Math.max(left.values.length, right.values.length);
    if (length > budget.maxCoefficients) {
        const error = new Error("The restricted polynomial is too large for the browser algebra worker.");
        error.code = "resource-limit";
        throw error;
    }
    warmupWorkerBudgetTick(budget, length);
    const values = Array(length).fill(0);
    const scales = Array(length).fill(0);
    for (let i = 0; i < length; i += 1) {
        const lv = left.values[i] || 0;
        const rv = right.values[i] || 0;
        values[i] = lv + rv;
        scales[i] = (left.scales[i] || 0) + (right.scales[i] || 0);
    }
    return { values, scales };
}

function warmupWorkerPolyMultiply(left, right, budget) {
    const length = left.values.length + right.values.length - 1;
    if (length > budget.maxCoefficients) {
        const error = new Error("The restricted polynomial is too large for the browser algebra worker.");
        error.code = "resource-limit";
        throw error;
    }

    warmupWorkerBudgetTick(
        budget,
        left.values.length * right.values.length
    );

    const values = Array(length).fill(0);
    const compensation = Array(length).fill(0);
    const scales = Array(length).fill(0);

    for (let i = 0; i < left.values.length; i += 1) {
        for (let j = 0; j < right.values.length; j += 1) {
            const target = i + j;
            const contribution = left.values[i] * right.values[j];
            const corrected = contribution - compensation[target];
            const next = values[target] + corrected;
            compensation[target] = (next - values[target]) - corrected;
            values[target] = next;
            scales[target] += (left.scales[i] || 0) * (right.scales[j] || 0);
        }
    }

    return { values, scales };
}

function warmupWorkerPolyPower(base, exponent, budget) {
    let result = warmupWorkerPolyConstant(1);
    let factor = base;
    let power = exponent;

    while (power > 0) {
        if (power % 2 === 1) {
            result = warmupWorkerPolyMultiply(result, factor, budget);
        }
        power = Math.floor(power / 2);
        if (power > 0) {
            factor = warmupWorkerPolyMultiply(factor, factor, budget);
        }
    }

    return result;
}

function warmupWorkerRestrictAst(ast, snapshot, limits) {
    const trig = warmupWorkerExactTrig(snapshot.angle);
    const c = trig.cosine;
    const r = trig.sine;
    const x = {
        values: [r * snapshot.p + c * snapshot.q, -(r + c)],
        scales: [Math.abs(r * snapshot.p + c * snapshot.q), Math.abs(r + c)]
    };
    const y = {
        values: [-c * snapshot.p + r * snapshot.q, c - r],
        scales: [Math.abs(-c * snapshot.p + r * snapshot.q), Math.abs(c - r)]
    };
    const z = { values: [0, 1], scales: [0, 1] };
    const budget = {
        operations: 0,
        operationFuse: limits.restrictionOperationFuse,
        maxCoefficients: limits.maxCoefficients
    };

    const visit = node => {
        switch (node.type) {
            case "constant": return warmupWorkerPolyConstant(node.value);
            case "variable": return node.name === "x" ? x : (node.name === "y" ? y : z);
            case "add": return warmupWorkerPolyAdd(visit(node.left), visit(node.right), budget);
            case "multiply": return warmupWorkerPolyMultiply(visit(node.left), visit(node.right), budget);
            case "power": return warmupWorkerPolyPower(visit(node.base), node.exponent, budget);
            default: throw new Error("Invalid compact polynomial syntax tree.");
        }
    };

    const restricted = warmupWorkerPolyTrim(visit(ast));
    const allZero = restricted.values.every(value => value === 0);

    if (allZero) {
        return {
            coefficients: [],
            degree: -1,
            lineContained: true
        };
    }

    return {
        coefficients: restricted.values,
        degree: restricted.values.length - 1,
        lineContained: false
    };
}

function warmupWorkerEvaluateAstAlongLine(node, t, x0, x1, y0, y1) {
    switch (node.type) {
        case "constant": {
            const value = Number(node.value);
            return { value, scale: Math.abs(value), derivative: 0, derivativeScale: 0 };
        }
        case "variable": {
            if (node.name === "x") {
                const value = x0 + x1 * t;
                return { value, scale: Math.abs(value), derivative: x1, derivativeScale: Math.abs(x1) };
            }
            if (node.name === "y") {
                const value = y0 + y1 * t;
                return { value, scale: Math.abs(value), derivative: y1, derivativeScale: Math.abs(y1) };
            }
            return { value: t, scale: Math.abs(t), derivative: 1, derivativeScale: 1 };
        }
        case "add": {
            const left = warmupWorkerEvaluateAstAlongLine(node.left, t, x0, x1, y0, y1);
            const right = warmupWorkerEvaluateAstAlongLine(node.right, t, x0, x1, y0, y1);
            return {
                value: left.value + right.value,
                scale: left.scale + right.scale,
                derivative: left.derivative + right.derivative,
                derivativeScale: left.derivativeScale + right.derivativeScale
            };
        }
        case "multiply": {
            const left = warmupWorkerEvaluateAstAlongLine(node.left, t, x0, x1, y0, y1);
            const right = warmupWorkerEvaluateAstAlongLine(node.right, t, x0, x1, y0, y1);
            return {
                value: left.value * right.value,
                scale: left.scale * right.scale,
                derivative: left.derivative * right.value + left.value * right.derivative,
                derivativeScale: left.derivativeScale * right.scale + left.scale * right.derivativeScale
            };
        }
        case "power": {
            const base = warmupWorkerEvaluateAstAlongLine(node.base, t, x0, x1, y0, y1);
            const n = node.exponent;
            if (n === 0) return { value: 1, scale: 1, derivative: 0, derivativeScale: 0 };
            const valuePower = base.value ** (n - 1);
            const scalePower = base.scale ** (n - 1);
            return {
                value: base.value * valuePower,
                scale: base.scale * scalePower,
                derivative: n * valuePower * base.derivative,
                derivativeScale: n * scalePower * base.derivativeScale
            };
        }
        default:
            return { value: NaN, scale: Infinity, derivative: NaN, derivativeScale: Infinity };
    }
}

function warmupWorkerValidateRoots(roots, ast, snapshot) {
    const trig = warmupWorkerExactTrig(snapshot.angle);
    const c = trig.cosine;
    const r = trig.sine;
    const x0 = r * snapshot.p + c * snapshot.q;
    const x1 = -(r + c);
    const y0 = -c * snapshot.p + r * snapshot.q;
    const y1 = c - r;

    const polished = roots.filter(Number.isFinite).map(initial => {
        let t = initial;
        for (let iteration = 0; iteration < 18; iteration += 1) {
            const evaluation = warmupWorkerEvaluateAstAlongLine(ast, t, x0, x1, y0, y1);
            if (!Number.isFinite(evaluation.value) || !Number.isFinite(evaluation.derivative)) break;
            if (evaluation.value === 0) break;
            if (
                Math.abs(evaluation.derivative)
                <= 256 * Number.EPSILON * Math.max(Number.MIN_VALUE, evaluation.derivativeScale)
            ) break;
            const correction = evaluation.value / evaluation.derivative;
            const next = t - correction;
            if (!Number.isFinite(next)) break;
            t = next;
            if (Math.abs(correction) <= 64 * Number.EPSILON * Math.max(1, Math.abs(t))) break;
        }
        return t;
    });

    return warmupUniqueRealRoots(
        polished.filter(t => {
            if (!Number.isFinite(t)) return false;
            const evaluation = warmupWorkerEvaluateAstAlongLine(ast, t, x0, x1, y0, y1);
            if (!Number.isFinite(evaluation.value) || !Number.isFinite(evaluation.scale)) return false;
            if (evaluation.value === 0) return true;
            return Math.abs(evaluation.value)
                <= 2e-8 * Math.max(Number.MIN_VALUE, evaluation.scale);
        })
    );
}

function warmupWorkerSolve(ast, snapshot, limits) {
    const restriction = warmupWorkerRestrictAst(ast, snapshot, limits);
    if (restriction.lineContained) {
        return { roots: [], degree: -1, lineContained: true };
    }

    const degree = restriction.degree;
    const rootOperations = 24 * degree * degree;
    const derivativeCells = degree * (degree + 1) / 2;

    if (
        !Number.isFinite(rootOperations)
        || !Number.isFinite(derivativeCells)
        || rootOperations > limits.rootOperationFuse
        || derivativeCells > limits.derivativeCellFuse
    ) {
        const error = new Error(
            "The complete global real-root isolation would exceed the worker safety fuse for this restriction."
        );
        error.code = "resource-limit";
        throw error;
    }

    const rawRoots = warmupRealPolynomialRootsGeneric(
        restriction.coefficients,
        0
    );
    const roots = warmupWorkerValidateRoots(rawRoots, ast, snapshot);

    return {
        roots,
        degree,
        lineContained: false
    };
}

function warmupBuildIntersectionWorkerSource() {
    return `
${warmupPolynomialValueAndScale1D.toString()}
${warmupTrimUnivariateCoefficients.toString()}
${warmupFujiwaraRootBound.toString()}
${warmupScalePolynomialToUnitRootInterval.toString()}
${warmupPolynomialDerivative.toString()}
${warmupRootResidualAccepted.toString()}
${warmupPolishPolynomialRoot.toString()}
${warmupUniqueRealRoots.toString()}
${warmupRealRootsOnUnitInterval.toString()}
${warmupSignChangeRootsOnUnitInterval.toString()}
${warmupRealPolynomialRootsGeneric.toString()}
${warmupWorkerExactTrig.toString()}
${warmupWorkerBudgetTick.toString()}
${warmupWorkerPolyConstant.toString()}
${warmupWorkerPolyTrim.toString()}
${warmupWorkerPolyAdd.toString()}
${warmupWorkerPolyMultiply.toString()}
${warmupWorkerPolyPower.toString()}
${warmupWorkerRestrictAst.toString()}
${warmupWorkerEvaluateAstAlongLine.toString()}
${warmupWorkerValidateRoots.toString()}
${warmupWorkerSolve.toString()}
self.onmessage = event => {
    try {
        const { ast, snapshot, limits } = event.data;
        const result = warmupWorkerSolve(ast, snapshot, limits);
        self.postMessage({ ok: true, result });
    } catch (error) {
        self.postMessage({
            ok: false,
            code: error && error.code ? error.code : "worker-error",
            message: error && error.message ? error.message : "Intersection computation failed."
        });
    }
};`;
}

function warmupIntersectionWorkerObjectUrl() {
    if (warmupIntersectionWorkerUrl) return warmupIntersectionWorkerUrl;
    const source = warmupBuildIntersectionWorkerSource();
    warmupIntersectionWorkerUrl = URL.createObjectURL(
        new Blob([source], { type: "text/javascript" })
    );
    return warmupIntersectionWorkerUrl;
}

function warmupSnapshotsMatch(left, right) {
    if (!left || !right) return false;
    return (
        warmupAngleIndex(left.angle) === warmupAngleIndex(right.angle)
        && Math.abs(Number(left.p) - Number(right.p)) <= 1e-12
        && Math.abs(Number(left.q) - Number(right.q)) <= 1e-12
    );
}

function warmupStartWorkerIntersectionSolve(snapshot, revision, generation) {
    if (
        generation !== warmupWorkerIntersectionGeneration
        || revision !== warmupSurfaceRevision
        || !warmupSurfaceDraftValid
        || !warmupIntersectionStateMatches(
            warmupIntersectionPendingState,
            snapshot,
            revision
        )
    ) {
        return;
    }

    let worker;
    try {
        worker = new Worker(warmupIntersectionWorkerObjectUrl());
    } catch (error) {
        warmupSetWorkerIntersectionStatus(
            "worker-unavailable",
            "Background algebra isolation is unavailable in this browser context; orange points are paused rather than risking the page.",
            false
        );
        return;
    }

    warmupIntersectionWorker = worker;
    let timeoutId = null;
    let statusTimerId = null;

    /* The protected lane is an implementation detail, not a mode the user
       needs to see on every small adjustment.  Only surface a progress
       message if this exact worker is still computing after a short delay. */
    statusTimerId = setTimeout(() => {
        if (warmupWorkerStatusTimer === statusTimerId) {
            warmupWorkerStatusTimer = null;
        }
        if (
            warmupIntersectionWorker === worker
            && generation === warmupWorkerIntersectionGeneration
            && revision === warmupSurfaceRevision
            && warmupIntersectionStateMatches(
                warmupIntersectionPendingState,
                snapshot,
                revision
            )
        ) {
            warmupSetWorkerIntersectionStatus(
                "computing",
                "Computing global intersection points in the background…",
                false
            );
        }
    }, WARMUP_WORKER_STATUS_DELAY_MS);
    warmupWorkerStatusTimer = statusTimerId;

    const finish = () => {
        if (warmupIntersectionWorker === worker) {
            warmupIntersectionWorker = null;
        }

        worker.terminate();

        if (
            statusTimerId !== null
            && warmupWorkerStatusTimer === statusTimerId
        ) {
            clearTimeout(statusTimerId);
            warmupWorkerStatusTimer = null;
        }

        /* An old worker message can already be queued when a newer snapshot
           replaces it.  Never let that stale message clear the newer
           worker's watchdog timer. */
        if (
            timeoutId !== null
            && warmupIntersectionWorkerTimeout === timeoutId
        ) {
            clearTimeout(timeoutId);
            warmupIntersectionWorkerTimeout = null;
        }
    };

    timeoutId = setTimeout(() => {
        if (warmupIntersectionWorker !== worker) return;
        finish();
        if (
            generation === warmupWorkerIntersectionGeneration
            && revision === warmupSurfaceRevision
            && warmupIntersectionStateMatches(
                warmupIntersectionPendingState,
                snapshot,
                revision
            )
        ) {
            warmupIntersectionPendingState = null;
            warmupIntersectionFailedState =
                warmupIntersectionState(snapshot, revision);
            warmupSetWorkerIntersectionStatus(
                "timeout",
                "Intersection computation was stopped by the watchdog before it could make the page unresponsive. The synchronized surface, sections and line remain available; no approximate roots are substituted.",
                false
            );
        }
    }, WARMUP_WORKER_TIMEOUT_MS);
    warmupIntersectionWorkerTimeout = timeoutId;

    worker.onmessage = event => {
        const message = event.data || {};
        finish();

        if (
            generation !== warmupWorkerIntersectionGeneration
            || revision !== warmupSurfaceRevision
            || !warmupSnapshotsMatch(snapshot, warmupParameters)
            || !warmupIntersectionStateMatches(
                warmupIntersectionPendingState,
                snapshot,
                revision
            )
        ) {
            return;
        }

        if (!message.ok) {
            const resource = message.code === "resource-limit";
            warmupIntersectionPendingState = null;
            warmupIntersectionFailedState =
                warmupIntersectionState(snapshot, revision);
            warmupSetWorkerIntersectionStatus(
                resource ? "resource-limit" : "error",
                resource
                    ? `Intersection computation stopped safely: ${message.message} The surface and sections remain synchronized; no viewport-filtered roots are substituted.`
                    : `Intersection computation failed in the background worker: ${message.message}`,
                false
            );
            return;
        }

        warmupIntersectionPendingState = null;
        warmupIntersectionFailedState = null;
        warmupWorkerIntersectionStatus = null;
        warmupCommitIntersectionRoots(
            message.result.roots,
            {
                degree: message.result.degree,
                lineContained: message.result.lineContained
            },
            snapshot,
            {
                update3D: true,
                update2D: true,
                guardViewport: false
            }
        );
    };

    worker.onerror = event => {
        finish();
        if (
            generation === warmupWorkerIntersectionGeneration
            && revision === warmupSurfaceRevision
            && warmupIntersectionStateMatches(
                warmupIntersectionPendingState,
                snapshot,
                revision
            )
        ) {
            warmupIntersectionPendingState = null;
            warmupIntersectionFailedState =
                warmupIntersectionState(snapshot, revision);
            warmupSetWorkerIntersectionStatus(
                "error",
                `Intersection computation failed in the background worker: ${event.message || "unknown worker error"}`,
                false
            );
        }
    };

    worker.postMessage({
        ast: warmupSurface.ast,
        snapshot,
        limits: {
            maxCoefficients: WARMUP_WORKER_MAX_COEFFICIENTS,
            restrictionOperationFuse: WARMUP_WORKER_RESTRICTION_OPERATION_FUSE,
            rootOperationFuse: WARMUP_WORKER_ROOT_OPERATION_FUSE,
            derivativeCellFuse: WARMUP_WORKER_DERIVATIVE_CELL_FUSE
        }
    });
}

function warmupScheduleWorkerIntersectionSolve(snapshot) {
    const revision = warmupSurfaceRevision;

    /* A duplicate refresh of the same geometry is not a new algebra job.
       This is the core v10 invariant: harmless UI/HelperExpression echoes
       must never erase a valid result or restart an identical Worker. */
    if (
        warmupIntersectionStateMatches(
            warmupIntersectionCommittedState,
            snapshot,
            revision
        )
        || warmupIntersectionStateMatches(
            warmupIntersectionPendingState,
            snapshot,
            revision
        )
        || warmupIntersectionStateMatches(
            warmupIntersectionFailedState,
            snapshot,
            revision
        )
    ) {
        return false;
    }

    warmupCancelWorkerIntersectionSolve();
    const generation = warmupWorkerIntersectionGeneration;
    const frozenSnapshot = {
        angle: snapshot.angle,
        p: snapshot.p,
        q: snapshot.q
    };

    /* The previous committed roots are about to be cleared because this is a
       genuinely different geometry state.  They must no longer be treated as
       resident/visible if the user later returns to that state; without a
       root cache, returning correctly launches a fresh solve. */
    warmupIntersectionCommittedState = null;
    warmupIntersectionPendingState =
        warmupIntersectionState(frozenSnapshot, revision);
    warmupIntersectionFailedState = null;

    /* Waiting for the 180 ms quiet period is intentionally silent.  During
       continuous Play the timer is reset by every genuinely new snapshot,
       so no worker is launched until motion pauses.  Keeping this state
       silent avoids the old keyboard flicker between a transient "compact"
       label and the normal intersection note. */
    warmupWorkerIntersectionStatus = "waiting";

    warmupWorkerIntersectionTimer = setTimeout(() => {
        warmupWorkerIntersectionTimer = null;
        warmupStartWorkerIntersectionSolve(
            frozenSnapshot,
            revision,
            generation
        );
    }, WARMUP_WORKER_SETTLE_MS);

    return true;
}

/* ============================================================
   PAGE DATA
   ============================================================ */

const pages = {

    warmup: {
        title: "Degree of a surface"
    },

    clebsch: clebschPage.createData(),

};


/* ============================================================
   CALCULATOR LIFECYCLE
   ============================================================ */

function registerCalculator(calculator) {
    activeCalculators.push(calculator);
    applyThemeToCalculator(calculator);
    return calculator;
}

function destroyCalculators() {
    Object.keys(warmupAnimations)
        .forEach(stopWarmupAnimation);

    clebschPage.destroy();

    appShell?.classList.remove(
        "complete-picture-layout",
        "warmup-proof-collapsed"
    );

    rightPanel?.classList.remove(
        "complete-picture-mode",
        "warmup-proof-collapsed"
    );

    warmupProofCollapsed = false;

    workspaceScroll?.scrollTo?.({
        left: 0,
        top: 0,
        behavior: "auto"
    });

    if (warmupProjectionResizeObserver) {
        warmupProjectionResizeObserver.disconnect();
        warmupProjectionResizeObserver = null;
    }

    if (warmupProjectionLayoutFrame !== null) {
        cancelAnimationFrame(
            warmupProjectionLayoutFrame
        );
        warmupProjectionLayoutFrame = null;
    }

    if (warmupEquationDrawerResizeObserver) {
        warmupEquationDrawerResizeObserver.disconnect();
        warmupEquationDrawerResizeObserver = null;
    }

    if (warmupEquationDrawerMutationObserver) {
        warmupEquationDrawerMutationObserver.disconnect();
        warmupEquationDrawerMutationObserver = null;
    }

    warmupObservedExpressionPanel = null;
    warmupProofAutoCollapsedForDrawer = false;

    Object.keys(warmupHelperSyncTimers).forEach(parameter => {
        clearTimeout(warmupHelperSyncTimers[parameter]);
        delete warmupHelperSyncTimers[parameter];
    });

    if (warmupMasterAnimationFrame !== null) {
        cancelAnimationFrame(warmupMasterAnimationFrame);
        warmupMasterAnimationFrame = null;
    }
    warmupMasterAnimationLastTime = 0;
    warmupRecentProgrammaticParameterValues.angle = [];
    warmupRecentProgrammaticParameterValues.p = [];
    warmupRecentProgrammaticParameterValues.q = [];

    if (warmupNativePlaybackStateFrame !== null) {
        cancelAnimationFrame(warmupNativePlaybackStateFrame);
        warmupNativePlaybackStateFrame = null;
    }

    if (warmupNativeParameterSyncFrame !== null) {
        /* A queued microtask cannot be cancelled.  Clearing the marker and
           advancing the generation makes that stale flush a no-op. */
        warmupNativeParameterSyncFrame = null;
        warmupNativeParameterSyncGeneration += 1;
    }

    warmupPendingNativeParameterValues.clear();
    warmupNativePlaybackObserverInstalled = false;

    if (warmupVisibilitySyncTimer !== null) {
        clearTimeout(warmupVisibilitySyncTimer);
        warmupVisibilitySyncTimer = null;
    }
    warmupVisibilityObserversInstalled = false;

    /* A protected algebra job belongs to the warm-up page that launched it.
       Never let it survive navigation and report into calculators that have
       already been destroyed/replaced. */
    warmupCancelWorkerIntersectionSolve();
    warmupResetIntersectionLifecycle();
    warmupWorkerIntersectionStatus = null;

    activeCalculators.forEach(calculator => {
        if (
            calculator
            && typeof calculator.destroy === "function"
        ) {
            calculator.destroy();
        }
    });

    activeCalculators = [];

    mainCalculator = null;
    warmup3D = null;
    purple2D = null;
    blue2D = null;
    solver2D = null;
    warmupAlphaHelper = null;
    warmupPHelper = null;
    warmupQHelper = null;
    warmupSurfaceChangeObserverInstalled = false;

    if (warmupSurfaceSyncTimer) {
        clearTimeout(warmupSurfaceSyncTimer);
        warmupSurfaceSyncTimer = null;
    }
    warmupSurfacePendingLatex =
        warmupSurfaceDraftLatex;

    warmupGlobalStopButton = null;
    warmupGloballyPaused = false;
    warmupGloballyPausedParameters = [];

    Object.keys(warmupAnimations).forEach(parameter => {
        delete warmupAnimations[parameter];
    });

    activeExpressionIds = [];
    visualStage.innerHTML = "";
}


/* ============================================================
   MATHJAX
   ============================================================ */

function typeset(element) {
    if (
        window.MathJax
        && MathJax.typesetPromise
    ) {
        MathJax.typesetPromise([element]);
    }
}


/* ============================================================
   WARM-UP VIEW
   ============================================================ */

function buildWarmupView() {
    currentWarmupMode = "intro";
    currentWarmupProof = null;

    visualStage.innerHTML = `
        <div class="warmup-view">

            <div class="warmup-stage">
                <div
                    id="warmup-calculator"
                    class="warmup-calculator">
                </div>

                <button
                    id="desmos-equations-toggle"
                    class="desmos-equations-toggle"
                    type="button"
                    title="Show Desmos equations"
                    aria-label="Show Desmos equations">
                    ƒx
                </button>
            </div>

            <div
                id="scene-labels"
                class="scene-labels">

                <div class="scene-label-row" data-geometry-key="surface">
                    <svg
                        class="surface-swatch"
                        viewBox="0 0 44 26"
                        preserveAspectRatio="none"
                        aria-hidden="true">

                        <defs>
                            <linearGradient
                                id="surface-gradient"
                                x1="0"
                                y1="1"
                                x2="1"
                                y2="0">

                                <stop
                                    offset="0%"
                                    stop-color="#6E8F6B">
                                </stop>

                                <stop
                                    offset="15%"
                                    stop-color="#8EA88A">
                                </stop>

                                <stop
                                    offset="28%"
                                    stop-color="#5C7C59">
                                </stop>

                                <stop
                                    offset="50%"
                                    stop-color="#436340">
                                </stop>

                                <stop
                                    offset="72%"
                                    stop-color="#5C7C59">
                                </stop>

                                <stop
                                    offset="85%"
                                    stop-color="#8EA88A">
                                </stop>

                                <stop
                                    offset="100%"
                                    stop-color="#6E8F6B">
                                </stop>
                            </linearGradient>
                        </defs>

                        <path
                            d="
                                M2 4
                                C10 5.5, 15 5.5, 22 4
                                C29 2.5, 35 2.5, 42 4
                                C39 9, 45 17, 42 22
                                C34 20.5, 29 20.5, 22 22
                                C14 23.5, 8 23.5, 2 22
                                C5 17, -1 9, 2 4
                                Z
                            ">
                        </path>
                    </svg>

                    <span>\\(S\\)</span>
                </div>

                <div class="scene-label-row" data-geometry-key="purplePlane">
                    <span class="scene-swatch h1-swatch"></span>
                    <span>\\(H_1\\)</span>
                </div>

                <div class="scene-label-row" data-geometry-key="bluePlane">
                    <span class="scene-swatch h2-swatch"></span>
                    <span>\\(H_2\\)</span>
                </div>

                <div class="scene-label-row" data-geometry-key="purpleCubic">
                    <svg
                        class="curve-swatch"
                        viewBox="0 0 60 20"
                        aria-hidden="true">
                        <path
                            d="M2,12 C10,4 18,4 26,12 C34,20 42,20 58,6">
                        </path>
                    </svg>
                    <span id="purple-section-scene-label">\\(C_1=S\\cap H_1\\)</span>
                </div>

                <div
                    id="blue-section-scene-row"
                    class="scene-label-row"
                    data-geometry-key="blueCubic">
                    <svg
                        class="curve-swatch blue-curve-swatch"
                        viewBox="0 0 60 20"
                        aria-hidden="true">
                        <path
                            d="M2,12 C10,4 18,4 26,12 C34,20 42,20 58,6">
                        </path>
                    </svg>
                    <span id="blue-section-scene-label">\\(C_2=S\\cap H_2\\)</span>
                </div>

                <div class="scene-label-row" data-geometry-key="line">
                    <span class="scene-line"></span>
                    <span id="intersection-line-scene-label">\\(H_1\\cap H_2\\)</span>
                </div>

                <div class="scene-label-row" data-geometry-key="points">
                    <span class="point-swatch"></span>
                    <span id="intersection-points-scene-label">\\(S\\cap H_1\\cap H_2\\)</span>
                </div>
            </div>

            <div id="graph-overlay">
                <div
                    id="purple-card"
                    class="projection purple-projection mode-hidden">

                    <div
                        id="purple-projection"
                        class="projection-calculator">
                    </div>

                    <button
                        class="drag-dot purple-dot"
                        type="button"
                        aria-label="Drag purple projection">
                    </button>
                </div>

                <div
                    id="blue-card"
                    class="projection blue-projection mode-hidden">

                    <div
                        id="blue-projection"
                        class="projection-calculator">
                    </div>

                    <button
                        class="drag-dot blue-dot"
                        type="button"
                        aria-label="Drag blue projection">
                    </button>
                </div>
            </div>

        </div>
    `;

    warmup3D =
        registerCalculator(
            Desmos.Calculator3D(
                document.getElementById("warmup-calculator"),
                {
                    expressions: false,
                    settingsMenu: true,
                    keypad: false,
                    zoomButtons: true
                }
            )
        );

    setupWarmup3DControlReveal("warmup-calculator");

    purple2D =
        registerCalculator(
            Desmos.GraphingCalculator(
                document.getElementById("purple-projection"),
                {
                    expressions: false,
                    settingsMenu: false,
                    keypad: false,
                    zoomButtons: true
                }
            )
        );

    blue2D =
        registerCalculator(
            Desmos.GraphingCalculator(
                document.getElementById("blue-projection"),
                {
                    expressions: false,
                    settingsMenu: false,
                    keypad: false,
                    zoomButtons: true
                }
            )
        );

    const desmosEquationsToggle =
        document.getElementById(
            "desmos-equations-toggle"
        );

    desmosEquationsToggle?.addEventListener(
        "click",
        () => {
            if (
                !warmupDesmosEquationsVisible
                && !warmupEquationPanelCanOpen()
            ) {
                showWarmupUiHint(
                    desmosEquationsToggle,
                    "Equations can only be opened in the full-screen view."
                );
                updateWarmupDesmosToggleButton();
                return;
            }

            setWarmupDesmosEquationsVisible(
                !warmupDesmosEquationsVisible
            );
        }
    );

    setWarmupExpressions();
    requestAnimationFrame(setWarmupNativeAnimationPeriods);
    buildWarmupControls();
    setupWarmupSurfaceExpressionSync();
    setupWarmupDesmosParameterSync();
    setupWarmupNativePlaybackStateSync();
    setupWarmupVisibilitySync();
    buildWarmupInfo();

    makeProjectionDraggable("purple-card");
    makeProjectionDraggable("blue-card");
    setupProjectionControlReveal("purple-card");
    setupProjectionControlReveal("blue-card");
    setupWarmupProjectionStageObserver();
    setupWarmupEquationDrawerLayoutObserver();

    typeset(document.getElementById("scene-labels"));

    setWarmupMode("intro");
    requestAnimationFrame(positionWarmupProjectionCards);
    updateWarmupParameters();
}


/* ============================================================
   WARM-UP EXPRESSIONS
   ============================================================ */

/*
   Desmos receives the azimuth symbolically.  The HTML slider is
   quantized to half-degree steps, alpha = k*pi/360, and Desmos itself
   evaluates sin(alpha) and cos(alpha).  This avoids decimal trig
   coefficients such as 6.12e-17 in the exact axis cases.
*/
function warmupAngleIndex(angleCoefficient) {
    return Math.max(
        -WARMUP_ANGLE_STEPS_PER_PI,
        Math.min(
            WARMUP_ANGLE_STEPS_PER_PI,
            Math.round(
                Number(angleCoefficient)
                * WARMUP_ANGLE_STEPS_PER_PI
            )
        )
    );
}

function warmupAngleCoefficientFromIndex(index) {
    return index / WARMUP_ANGLE_STEPS_PER_PI;
}

function gcdWarmup(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);

    while (b) {
        [a, b] = [b, a % b];
    }

    return a || 1;
}

function warmupAlphaLatex(angleCoefficient) {
    /* Desmos owns alpha as the dimensionless coefficient of pi.
       Thus alpha in [-1,1] is a native slider, while the actual azimuth
       used by the geometry is alpha*pi.  Keeping the assignment rational
       preserves exact quarter-turn values such as alpha=-1/4. */
    const index = warmupAngleIndex(angleCoefficient);

    if (index === 0) {
        return String.raw`\alpha=0`;
    }

    const divisor = gcdWarmup(
        index,
        WARMUP_ANGLE_STEPS_PER_PI
    );

    const numerator = index / divisor;
    const denominator =
        WARMUP_ANGLE_STEPS_PER_PI / divisor;

    if (denominator === 1) {
        return String.raw`\alpha=${numerator}`;
    }

    if (numerator === 1) {
        return String.raw`\alpha=\frac{1}{${denominator}}`;
    }

    if (numerator === -1) {
        return String.raw`\alpha=-\frac{1}{${denominator}}`;
    }

    return String.raw`\alpha=\frac{${numerator}}{${denominator}}`;
}

/*
   The visible/native Desmos alpha row must be an actual slider.  Desmos
   does not reliably expose native slider playback when we repeatedly assign
   alpha using a fractional LaTeX expression such as -\frac{1}{4}.  Keep the
   website's readout exact, but give the native slider a decimal assignment.
   The value is still snapped to the 1/360 grid before it is written.
*/
function warmupAlphaNativeLatex(angleCoefficient) {
    const snapped = warmupAngleCoefficientFromIndex(
        warmupAngleIndex(angleCoefficient)
    );

    let text = snapped.toFixed(12)
        .replace(/0+$/, "")
        .replace(/\.$/, "");

    if (text === "-0" || text === "") {
        text = "0";
    }

    return String.raw`\alpha=${text}`;
}

/*
   Keep the geometry symbolic inside Desmos.  JavaScript no longer
   expands sin(alpha) and cos(alpha) into decimal coefficients.
   This makes quarter-turn and axis cases exact in the plotted equations.
*/
function warmupVisible3DGeometryLatex(
    angleCoefficient = warmupParameters.angle,
    p = warmupParameters.p,
    q = warmupParameters.q
) {
    const h1 =
        String.raw`z=-\sin(\alpha\pi)x+\cos(\alpha\pi)y+p`;

    const h2 =
        String.raw`z=-\cos(\alpha\pi)x-\sin(\alpha\pi)y+q`;

    /* Normalize the projected line before sending it to Desmos:

           cos((alpha+1/4)pi) x
         + cos((alpha-1/4)pi) y
         + (p-q)/sqrt(2) = 0.

       This is exactly (H1-H2)/sqrt(2), but it avoids subtracting two nearly
       equal trig values inside Desmos at odd quarter-turns.  The two xy
       coefficients have Euclidean norm 1 for every alpha. */
    const lineCondition = String.raw`\cos((\alpha+\frac{1}{4})\pi)x+\cos((\alpha-\frac{1}{4})\pi)y+\frac{p-q}{\sqrt{2}}=0`;

    /* Display L as an actual Desmos 3D slice, not a finite parametric curve.
       The snapshot renderer below precomputes these coefficients and makes
       the mathematically-zero quarter-turn coefficient literally 0, so this
       single restriction is stable without angle cases. */
    const line = String.raw`${h1}\{${lineCondition}\}`;

    return {
        h1,
        h2,
        purpleCurve: String.raw`0=f(x,y,z)\{${h1}\}`,
        blueCurve: String.raw`0=f(x,y,z)\{${h2}\}`,
        line,
        lineCondition
    };
}


/*
   Draw L with Desmos's native 3D segment primitive.  We do not choose an
   arbitrary parameter interval: because z(t)=t on our global line formula,
   the current z-bounds of the Desmos cube are already the exact parameter
   range containing every potentially visible point of L.  Desmos clips the
   resulting segment against the x/y faces of the cube in the normal render
   pipeline.

       x(t) = sp + cq - (s+c)t
       y(t) = -cp + sq + (c-s)t
       z(t) = t.

   Thus there are no angle cases, no tangent poles, no equality restriction,
   and no numerical coefficient snapping.
*/
function warmupInitialize3DLineBoundsIfNeeded() {
    if (
        Number.isFinite(warmup3DLineZMin)
        && Number.isFinite(warmup3DLineZMax)
        && warmup3DLineZMin < warmup3DLineZMax
    ) {
        return;
    }

    const limits = warmupCurrent3DViewportLimits();
    const zMin = Number.isFinite(Number(limits?.zmin))
        ? Number(limits.zmin)
        : -5;
    const zMax = Number.isFinite(Number(limits?.zmax))
        ? Number(limits.zmax)
        : 5;

    const center = (zMin + zMax) / 2;
    const halfSpan = Math.max((zMax - zMin) / 2, 1);

    /* Keep a generous envelope around the current cube.  The orange segment
       may extend beyond the cube; Desmos clips it naturally.  This means
       zooming inward and ordinary camera rotation require no expression
       rewrite at all. */
    const paddedHalfSpan = 1.75 * halfSpan;
    warmup3DLineZMin = center - paddedHalfSpan;
    warmup3DLineZMax = center + paddedHalfSpan;
}

function warmupSnapshot3DLineLatex(
    angleCoefficient,
    p,
    q
) {
    const {
        cosine: c,
        sine: s
    } = warmupTrig(angleCoefficient);

    warmupInitialize3DLineBoundsIfNeeded();

    const zMin = warmup3DLineZMin;
    const zMax = warmup3DLineZMax;

    const x0 = s * p + c * q - (s + c) * zMin;
    const y0 = -c * p + s * q + (c - s) * zMin;
    const x1 = s * p + c * q - (s + c) * zMax;
    const y1 = -c * p + s * q + (c - s) * zMax;

    return String.raw`\operatorname{segment}((${warmupLatexNumber(x0)},${warmupLatexNumber(y0)},${warmupLatexNumber(zMin)}),(${warmupLatexNumber(x1)},${warmupLatexNumber(y1)},${warmupLatexNumber(zMax)}))`;
}


function warmupVisible2DGeometryLatex() {
    const purpleCurve =
        String.raw`0=f(x,y,-\sin(\alpha\pi)x+\cos(\alpha\pi)y+p)`;

    const blueCurve =
        String.raw`0=f(x,y,-\cos(\alpha\pi)x-\sin(\alpha\pi)y+q)`;

    const projectedLine =
        String.raw`(\cos(\alpha\pi)-\sin(\alpha\pi))x+(\cos(\alpha\pi)+\sin(\alpha\pi))y+p-q=0`;

    return {
        purpleCurve,
        blueCurve,
        purpleLine: projectedLine,
        blueLine: projectedLine
    };
}


function warmupPlaybackSliderBounds() {
    return {
        min: "-6",
        max: "6",
        step: "0.01"
    };
}

function warmupAnglePlaybackSliderBounds() {
    return {
        min: "-1",
        max: "1",
        /* Give Desmos the exact rational step.  The HelperExpression is
           numeric, but the native slider itself remains on the 1/360 grid. */
        step: `1/${WARMUP_ANGLE_STEPS_PER_PI}`
    };
}

function warmupNativeSliderBounds(parameter) {
    return parameter === "angle"
        ? warmupAnglePlaybackSliderBounds()
        : warmupPlaybackSliderBounds();
}

/* Desmos exposes Play through the public API, but not animation speed.
   The embedded calculator itself supports the same action used by its
   Animation Properties UI.  Apply it once, and then leave native playback
   completely hands-off while it runs. */
function setWarmupNativeAnimationPeriod(parameter, periodMs = WARMUP_NATIVE_ANIMATION_PERIOD_MS) {
    const id = warmupDesmosExpressionId(parameter);
    const dispatch = warmup3D?.controller?.dispatch;

    if (typeof dispatch !== "function") {
        return false;
    }

    const numericPeriod = Number(periodMs);
    if (!Number.isFinite(numericPeriod) || numericPeriod <= 0) {
        return false;
    }

    try {
        dispatch.call(warmup3D.controller, {
            id,
            type: "set-slider-animationperiod",
            animationPeriod: numericPeriod
        });
        return true;
    } catch (error) {
        console.warn("Could not set Desmos slider animation period", parameter, error);
        return false;
    }
}

function setWarmupNativeAnimationPeriods() {
    ["angle", "p", "q"].forEach(parameter => {
        setWarmupNativeAnimationPeriod(parameter);
    });

    /* The azimuth represents a rotation, so reversing at ±π is visually
       unnatural.  Let the native Desmos slider wrap forward from +π back
       to -π and continue in the same direction.  Translation sliders keep
       their existing animation mode. */
    const dispatch = warmup3D?.controller?.dispatch;
    if (typeof dispatch === "function") {
        try {
            dispatch.call(warmup3D.controller, {
                id: warmupDesmosExpressionId("angle"),
                type: "set-slider-loopmode",
                loopMode: "LOOP_FORWARD"
            });
        } catch (error) {
            console.warn("Could not set angle slider loop mode", error);
        }
    }
}

function warmupDesmosExpressionId(parameter) {
    return parameter === "angle" ? "alpha" : parameter;
}

function warmupNativeModelValue(parameter) {
    return parameter === "angle"
        ? warmupParameters.angle
        : warmupParameters[parameter];
}

function warmupNativeExpressionLatex(parameter) {
    if (parameter === "angle") {
        return warmupAlphaNativeLatex(warmupParameters.angle);
    }

    return `${parameter}=${warmupParameters[parameter]}`;
}

function warmupSetFromNativeParameterValue(parameter, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return false;
    }

    if (parameter === "angle") {
        return warmupSetFromControlValue(
            "angle",
            numeric * WARMUP_ANGLE_STEPS_PER_PI
        );
    }

    return warmupSetFromControlValue(parameter, numeric);
}

function warmupClampNativePlaybackValue(parameter, value) {
    const numeric = Number(value);
    const fallback = warmupNativeModelValue(parameter);
    const finite = Number.isFinite(numeric) ? numeric : fallback;

    if (parameter === "angle") {
        return Math.max(-1, Math.min(1, finite));
    }

    return Math.max(-6, Math.min(6, finite));
}

function warmupDesmosSliderBounds(value, parameter = null) {
    const numeric = Number(value);
    const state = parameter ? warmupAnimations[parameter] : null;

    /* v4.71: playback always uses the pedagogical [-6,6] track.  Only a
       manually typed resting value is allowed to expand Desmos's slider.
       This prevents a tiny native-playback overshoot from turning [-6,6]
       into [-7,7], [-8,8], ... on subsequent synchronisation. */
    if (
        (parameter === "p" || parameter === "q")
        && state?.running
    ) {
        return warmupPlaybackSliderBounds();
    }

    if (!Number.isFinite(numeric)) {
        return warmupPlaybackSliderBounds();
    }

    /* Keep the ordinary translation controls genuinely identical:
       every resting value inside [-6,6] uses the same [-6,6] track in
       both Desmos and the left sidebar.  Only an explicitly entered value
       outside that interval expands the Desmos slider. */
    if (Math.abs(numeric) <= 6) {
        return warmupPlaybackSliderBounds();
    }

    const extent = Math.ceil(Math.abs(numeric)) + 1;

    return {
        min: String(-extent),
        max: String(extent),
        step: "0.01"
    };
}

function setWarmupExpressions() {
    const {
        angle,
        p,
        q
    } = warmupParameters;

    const alphaLatex =
        warmupAlphaLatex(angle);

    const alphaNativeLatex =
        warmupAlphaNativeLatex(angle);

    const visible3D =
        warmupVisible3DGeometryLatex(angle, p, q);

    warmup3D.setExpressions([
        {
            id: "note-parameters",
            type: "text",
            text: "Parameters"
        },
        {
            id: "alpha",
            latex: alphaNativeLatex,
            sliderBounds: warmupAnglePlaybackSliderBounds(),
            playing: false
        },
        {
            id: "p",
            latex: `p=${p}`,
            sliderBounds: warmupDesmosSliderBounds(p, "p"),
            playing: false
        },
        {
            id: "q",
            latex: `q=${q}`,
            sliderBounds: warmupDesmosSliderBounds(q, "q"),
            playing: false
        },
        {
            id: "note-surface",
            type: "text",
            text: warmupSurfaceNoteText()
        },
        {
            id: "f",
            latex: warmupSurface.definitionLatex
        },
        {
            id: "surface",
            latex: "0=f(x,y,z)",
            color: COLORS.surface,
            fillOpacity: 0.68
        },
        {
            id: "purple-plane",
            latex: visible3D.h1,
            color: COLORS.purplePlane
        },
        {
            id: "blue-plane",
            latex: visible3D.h2,
            color: COLORS.bluePlane
        },
        {
            id: "purple-cubic",
            latex: visible3D.purpleCurve,
            color: COLORS.purpleCurve
        },
        {
            id: "blue-cubic",
            latex: visible3D.blueCurve,
            color: COLORS.blueCurve,
            hidden: true
        },
        {
            id: "note-line",
            type: "text",
            text: "xy-projection condition for L = H1 ∩ H2. The 3D orange line is a viewport-covering segment; its cached z-range is extended only when the cube moves beyond it, with no angle cases."
        },
        {
            id: "line-condition",
            latex: visible3D.lineCondition,
            color: COLORS.intersection,
            hidden: true
        },
        {
            id: "intersection-line",
            latex: (() => {
                const latex = warmupSnapshot3DLineLatex(angle, p, q);
                warmupLast3DLineLatex = latex;
                return latex;
            })(),
            color: COLORS.intersection
        },
        {
            id: "note-points",
            type: "text",
            text: warmupIntersectionNoteText()
        }
    ]);

    warmupLastLineConditionLatex =
        visible3D.lineCondition;

    const visible2D =
        warmupVisible2DGeometryLatex();

    purple2D.setExpressions([
        {
            id: "alpha",
            latex: alphaLatex
        },
        {
            id: "p",
            latex: `p=${p}`
        },
        {
            id: "q",
            latex: `q=${q}`
        },
        {
            id: "f",
            latex: warmupSurface.definitionLatex
        },
        {
            id: "purple-cubic",
            latex: visible2D.purpleCurve,
            color: COLORS.purpleCurve
        },
        {
            id: "intersection-line",
            latex: visible2D.purpleLine,
            color: COLORS.intersection,
            pointSize: 5
        }
    ]);

    blue2D.setExpressions([
        {
            id: "alpha",
            latex: alphaLatex
        },
        {
            id: "p",
            latex: `p=${p}`
        },
        {
            id: "q",
            latex: `q=${q}`
        },
        {
            id: "f",
            latex: warmupSurface.definitionLatex
        },
        {
            id: "blue-cubic",
            latex: visible2D.blueCurve,
            color: COLORS.blueCurve
        },
        {
            id: "intersection-line",
            latex: visible2D.blueLine,
            color: COLORS.intersection,
            pointSize: 5
        }
    ]);

    purple2D.setMathBounds({
        left: -5,
        right: 5,
        bottom: -5,
        top: 5
    });

    blue2D.setMathBounds({
        left: -5,
        right: 5,
        bottom: -5,
        top: 5
    });
}


/* ============================================================
   WARM-UP CONTROLS
   ============================================================ */


let warmupControlUpdateFrame = null;
const warmupPendingControlParameters = new Set();

function scheduleWarmupParametersUpdate(parameter = null) {
    if (parameter) {
        warmupPendingControlParameters.add(parameter);
    }

    if (warmupControlUpdateFrame !== null) {
        return;
    }

    /* Manual slider/keyboard changes are coalesced into the browser's next
       paint, exactly like the smooth pre-throttling behaviour. */
    warmupControlUpdateFrame = requestAnimationFrame(() => {
        warmupControlUpdateFrame = null;
        const changed = [...warmupPendingControlParameters];
        warmupPendingControlParameters.clear();

        updateWarmupParameters({
            changedParameters: changed,
            guardViewport: false,
            updateIntersections: true
        });
    });
}

function updateWarmupGlobalStopButton() {
    if (!warmupGlobalStopButton) {
        return;
    }

    warmupGlobalStopButton.classList.toggle(
        "continue-mode",
        warmupGloballyPaused
    );

    warmupGlobalStopButton.innerHTML = `
        <span class="warmup-stop-icon" aria-hidden="true"></span>
        <span class="warmup-stop-text">${
            warmupGloballyPaused
                ? "Continue"
                : "Stop"
        }</span>
    `;

    warmupGlobalStopButton.title =
        warmupGloballyPaused
            ? "Continue the paused parameter animations"
            : "Pause all running parameter animations";
}

function clearWarmupGlobalPauseState() {
    warmupGloballyPaused = false;
    warmupGloballyPausedParameters = [];
    updateWarmupGlobalStopButton();
}

function warmupAnyCustomAnimationRunning() {
    return ["angle", "p", "q"].some(parameter => {
        const state = warmupAnimations[parameter];
        return state?.running && state.source !== "desmos";
    });
}

function warmupCancelMasterAnimationFrameIfIdle() {
    if (
        !warmupAnyCustomAnimationRunning()
        && warmupMasterAnimationFrame !== null
    ) {
        cancelAnimationFrame(warmupMasterAnimationFrame);
        warmupMasterAnimationFrame = null;
        warmupMasterAnimationLastTime = 0;
    }
}

/* alpha, p and q are all native Desmos sliders.  The left controls are
   mirrors/remotes for those same three values; there is no second animation
   engine for any warm-up parameter. */

function warmupNativeHelperValue(parameter) {
    const helper = parameter === "angle"
        ? warmupAlphaHelper
        : (parameter === "p" ? warmupPHelper : warmupQHelper);
    return Number(helper?.numericValue);
}

function warmupAnimationLimits(parameter) {
    const state = warmupAnimations[parameter];
    const slider = state?.slider
        || document.getElementById(`warmup-range-${parameter}`);

    return {
        min: Number.isFinite(Number(slider?.min)) ? Number(slider.min) : -6,
        max: Number.isFinite(Number(slider?.max)) ? Number(slider.max) : 6
    };
}

function warmupFreezeNativeParameters(parameters) {
    if (!warmup3D) {
        return;
    }

    const unique = [...new Set(
        parameters.filter(parameter =>
            ["angle", "p", "q"].includes(parameter)
        )
    )];

    if (!unique.length) {
        return;
    }

    /* Capture every moving native value before writing any of them back.
       The old global Stop path froze alpha, then p, then q serially.  Each
       write could make Desmos advance/recompute before the next HelperValue
       was read, producing a mixed-time (alpha,p,q) snapshot. */
    const captured = Object.fromEntries(
        unique.map(parameter => {
            const helperValue = warmupNativeHelperValue(parameter);
            const fallback = warmupNativeModelValue(parameter);
            const bounded = warmupClampNativePlaybackValue(
                parameter,
                Number.isFinite(helperValue)
                    ? helperValue
                    : fallback
            );

            return [parameter, bounded];
        })
    );

    unique.forEach(parameter => {
        warmupSetFromNativeParameterValue(
            parameter,
            captured[parameter]
        );
    });

    /* Stop/freeze all selected native sliders in one Desmos transaction,
       using exactly the values that were captured together above. */
    warmup3D.setExpressions(
        unique.map(parameter => ({
            id: warmupDesmosExpressionId(parameter),
            latex: warmupNativeExpressionLatex(parameter),
            sliderBounds: warmupNativeSliderBounds(parameter),
            playing: false
        }))
    );

    unique.forEach(parameter => {
        const state = warmupAnimations[parameter];
        if (state) {
            state.running = false;
            state.source = "desmos";
        }

        const slider = state?.slider
            || document.getElementById(`warmup-range-${parameter}`);
        if (slider) {
            slider.value = warmupControlValue(parameter);
        }

        renderWarmupValueDisplay(parameter);
    });
}

function warmupFreezeNativeParameter(parameter) {
    warmupFreezeNativeParameters([parameter]);
}

function clearWarmupHelperSyncTimer(parameter) {
    if (!warmupHelperSyncTimers[parameter]) {
        return;
    }

    clearTimeout(warmupHelperSyncTimers[parameter]);
    delete warmupHelperSyncTimers[parameter];
}

function setWarmupAnimationButtonRunning(parameter, running) {
    const state = warmupAnimations[parameter];
    const button =
        state?.button
        || document.getElementById(`warmup-play-${parameter}`);

    if (button) {
        button.textContent = running ? "❚❚" : "▶";
        button.classList.toggle("playing", Boolean(running));
    }

    if (parameter === "angle") {
        if (running) {
            setWarmupAngleReadoutVisible(false);
        } else {
            renderWarmupValueDisplay("angle");
            setWarmupAngleReadoutVisible(true);
        }
    }
}

function pauseWarmupAnimation(parameter) {
    clearWarmupHelperSyncTimer(parameter);

    const state = warmupAnimations[parameter];
    const nativePlaying = warmupDesmosNativePlaying(parameter);

    if ((!state || !state.running) && !nativePlaying) {
        return false;
    }

    if (state?.running && state.source !== "desmos") {
        /* Website-driven playback already owns the authoritative value.
           Do not read a delayed HelperExpression back over it when pausing. */
        state.running = false;
        state.source = "website";

        warmup3D?.setExpression({
            id: warmupDesmosExpressionId(parameter),
            latex: warmupNativeExpressionLatex(parameter),
            sliderBounds: warmupNativeSliderBounds(parameter),
            playing: false
        });

        const slider = state.slider
            || document.getElementById(`warmup-range-${parameter}`);
        if (slider) {
            slider.value = warmupControlValue(parameter);
        }

        renderWarmupValueDisplay(parameter);
        setWarmupAnimationButtonRunning(parameter, false);
        warmupCancelMasterAnimationFrameIfIdle();
        return true;
    }

    /* A direct click on a Desmos row may briefly start its native clock before
       the observer transfers ownership.  Freeze that value once, then future
       resume operations use the coherent website clock. */
    warmupFreezeNativeParameter(parameter);

    const nextState = state || {};
    nextState.running = false;
    nextState.source = "website";
    nextState.slider = nextState.slider
        || document.getElementById(`warmup-range-${parameter}`);
    nextState.button = nextState.button
        || document.getElementById(`warmup-play-${parameter}`);
    warmupAnimations[parameter] = nextState;

    setWarmupAnimationButtonRunning(parameter, false);
    warmupCancelMasterAnimationFrameIfIdle();
    return true;
}

function warmupEnsureMasterAnimationFrame() {
    if (warmupMasterAnimationFrame !== null) {
        return;
    }

    warmupMasterAnimationLastTime = performance.now();
    warmupMasterAnimationFrame = requestAnimationFrame(
        warmupMasterAnimationTick
    );
}

function resumeWarmupAnimation(parameter) {
    clearWarmupHelperSyncTimer(parameter);

    const state = warmupAnimations[parameter];

    if (!state || state.running) {
        return false;
    }

    state.running = true;
    state.source = "website";

    if (!Number.isFinite(state.speed)) {
        const limits = warmupAnimationLimits(parameter);
        const min = Number.isFinite(state.min) ? state.min : limits.min;
        const max = Number.isFinite(state.max) ? state.max : limits.max;
        state.min = min;
        state.max = max;
        state.speed = warmupWebsiteAnimationSpeed(parameter, min, max);
    }

    if (parameter === "angle") {
        state.direction = 1;
    } else if (state.direction !== -1 && state.direction !== 1) {
        state.direction = 1;
    }

    state.position = Number(warmupControlValue(parameter));

    setWarmupAnimationButtonRunning(parameter, true);

    warmup3D?.setExpression({
        id: warmupDesmosExpressionId(parameter),
        latex: warmupNativeExpressionLatex(parameter),
        sliderBounds: warmupNativeSliderBounds(parameter),
        playing: false
    });

    warmupMasterAnimationLastCommitTime = 0;
    warmupEnsureMasterAnimationFrame();
    return true;
}

function pauseAllWarmupAnimations() {
    const running = ["angle", "p", "q"].filter(parameter =>
        warmupDesmosNativePlaying(parameter)
        || warmupAnimations[parameter]?.running
    );

    if (!running.length) {
        return false;
    }

    warmupGloballyPausedParameters = [...new Set(running)];
    warmupGloballyPaused = true;

    /* Native row playback is only a transient state now (for example when a
       user clicks Play directly in the Desmos drawer). Capture those values
       before stopping them. Website-owned parameters already have exact model
       values and must not be replaced by delayed helper echoes. */
    const nativeRunning = warmupGloballyPausedParameters.filter(parameter =>
        warmupDesmosNativePlaying(parameter)
    );

    if (nativeRunning.length) {
        warmupFreezeNativeParameters(nativeRunning);
    }

    warmupGloballyPausedParameters.forEach(parameter => {
        const state = warmupAnimations[parameter] || {};
        state.running = false;
        state.source = "website";
        state.slider = state.slider
            || document.getElementById(`warmup-range-${parameter}`);
        state.button = state.button
            || document.getElementById(`warmup-play-${parameter}`);
        warmupAnimations[parameter] = state;
        setWarmupAnimationButtonRunning(parameter, false);
    });

    warmup3D?.setExpressions(
        warmupGloballyPausedParameters.map(parameter => ({
            id: warmupDesmosExpressionId(parameter),
            latex: warmupNativeExpressionLatex(parameter),
            sliderBounds: warmupNativeSliderBounds(parameter),
            playing: false
        }))
    );

    warmupCancelMasterAnimationFrameIfIdle();
    updateWarmupGlobalStopButton();
    return true;
}

function resumeAllWarmupAnimations() {
    if (!warmupGloballyPaused) {
        return false;
    }

    const paused = [...warmupGloballyPausedParameters];
    warmupGloballyPaused = false;
    warmupGloballyPausedParameters = [];

    paused.forEach(resumeWarmupAnimation);
    updateWarmupGlobalStopButton();
    return true;
}

function stopAllWarmupAnimations() {
    ["angle", "p", "q"].forEach(
        stopWarmupAnimation
    );
    clearWarmupGlobalPauseState();
}

function stopWarmupAnimation(parameter) {
    pauseWarmupAnimation(parameter);

    if (warmupGloballyPaused) {
        warmupGloballyPausedParameters =
            warmupGloballyPausedParameters.filter(
                item => item !== parameter
            );

        if (!warmupGloballyPausedParameters.length) {
            clearWarmupGlobalPauseState();
        }
    }
}

let warmupUiHintTimer = null;

function warmupEquationPanelCanOpen() {
    if (!workspaceScroll) {
        return true;
    }

    /* When the 3D + question workspace itself needs horizontal panning,
       Desmos's expression drawer would steal too much of the primary 3D
       view.  Keep it closed until the full-width layout fits. */
    return (
        workspaceScroll.scrollWidth
        <= workspaceScroll.clientWidth + 2
    );
}

function showWarmupUiHint(anchor, message) {
    document
        .querySelectorAll(".warmup-ui-hint")
        .forEach(element => element.remove());

    if (warmupUiHintTimer !== null) {
        clearTimeout(warmupUiHintTimer);
        warmupUiHintTimer = null;
    }

    const hint =
        document.createElement("div");

    hint.className = "warmup-ui-hint";
    hint.textContent = message;
    hint.setAttribute("role", "status");

    document.body.appendChild(hint);

    const anchorRect =
        anchor.getBoundingClientRect();

    const hintRect =
        hint.getBoundingClientRect();

    const gap = 7;
    const edge = 8;

    let left =
        anchorRect.left
        + (anchorRect.width - hintRect.width) / 2;

    left = Math.max(
        edge,
        Math.min(
            left,
            window.innerWidth
            - hintRect.width
            - edge
        )
    );

    let top = anchorRect.bottom + gap;

    if (
        top + hintRect.height
        > window.innerHeight - edge
    ) {
        top =
            anchorRect.top
            - hintRect.height
            - gap;
    }

    hint.style.left = `${Math.round(left)}px`;
    hint.style.top = `${Math.round(Math.max(edge, top))}px`;

    warmupUiHintTimer = setTimeout(() => {
        hint.remove();
        warmupUiHintTimer = null;
    }, 2600);
}

function updateWarmupDesmosToggleButton() {
    const toggle =
        document.getElementById(
            "desmos-equations-toggle"
        );

    if (!toggle) {
        return;
    }

    toggle.classList.toggle(
        "active",
        warmupDesmosEquationsVisible
    );

    toggle.textContent =
        warmupDesmosEquationsVisible
            ? "Hide equations"
            : "Show equations";

    const canOpen =
        warmupEquationPanelCanOpen();

    toggle.classList.toggle(
        "full-screen-required",
        !warmupDesmosEquationsVisible
        && !canOpen
    );

    toggle.title =
        warmupDesmosEquationsVisible
            ? "Hide Desmos equations"
            : canOpen
                ? "Show Desmos equations"
                : "Equations can only be opened in the full-screen view.";

    toggle.setAttribute(
        "aria-label",
        toggle.title
    );
}

function setWarmupDesmosEquationsVisible(
    visible,
    { keepReopenHandle = true } = {}
) {
    warmupDesmosEquationsVisible =
        Boolean(visible);

    if (warmup3D) {
        warmup3D.updateSettings({
            /* Once the user has opened the drawer, hiding it should collapse
               it rather than remove it.  Desmos then leaves its native right
               chevron visible so the drawer can be reopened directly. */
            expressions:
                warmupDesmosEquationsVisible
                || keepReopenHandle,
            expressionsCollapsed:
                !warmupDesmosEquationsVisible
        });
    }

    updateWarmupDesmosToggleButton();

    requestAnimationFrame(() => {
        if (warmup3D) {
            warmup3D.resize();
        }

        positionWarmupProjectionCards();
        observeWarmupExpressionPanelIfPresent();
        updateWarmupLayoutForEquationDrawer();
    });
}

function enforceWarmupEquationPanelAvailability(
    { keepReopenHandleWhenClosing = false } = {}
) {
    if (
        warmupDesmosEquationsVisible
        && !warmupEquationPanelCanOpen()
    ) {
        setWarmupDesmosEquationsVisible(
            false,
            {
                keepReopenHandle:
                    keepReopenHandleWhenClosing
            }
        );
        return;
    }

    updateWarmupDesmosToggleButton();
}

window.addEventListener(
    "resize",
    () => {
        requestAnimationFrame(
            enforceWarmupEquationPanelAvailability
        );
    }
);

function buildWarmupControls() {
    geometryControls.innerHTML = "";

    if (controlHeadingActions) {
        controlHeadingActions.innerHTML = "";
    }

    const resetButton =
        document.createElement("button");

    resetButton.type = "button";
    resetButton.className =
        "warmup-reset-button";
    resetButton.textContent = "↺ Reset";
    resetButton.title =
        "Reset the adjustment parameters";

    resetButton.addEventListener(
        "click",
        () => {
            stopAllWarmupAnimations();

            /* Reset is a genuinely new start, so forget any old playback
               direction that a local Stop/Play cycle would otherwise retain. */
            Object.keys(warmupAnimations).forEach(parameter => {
                delete warmupAnimations[parameter];
            });

            Object.assign(
                warmupParameters,
                warmupInitialParameters
            );

            syncWarmupControlValues();
            updateWarmupParameters();
        }
    );

    const stopButton =
        document.createElement("button");

    stopButton.type = "button";
    stopButton.className =
        "warmup-stop-button";
    warmupGlobalStopButton = stopButton;
    updateWarmupGlobalStopButton();

    stopButton.addEventListener(
        "click",
        () => {
            if (warmupGloballyPaused) {
                resumeAllWarmupAnimations();
                return;
            }

            if (pauseAllWarmupAnimations()) {
                syncWarmupControlValues();
                updateWarmupParameters({
                    guardViewport: false
                });
            }
        }
    );

    if (controlHeadingActions) {
        controlHeadingActions.appendChild(
            resetButton
        );
        controlHeadingActions.appendChild(
            stopButton
        );
    } else {
        geometryControls.appendChild(
            resetButton
        );
        geometryControls.appendChild(
            stopButton
        );
    }

    addWarmupSlider(
        "angle",
        "AZIMUTH OF H₁",
        -WARMUP_ANGLE_STEPS_PER_PI,
        WARMUP_ANGLE_STEPS_PER_PI,
        1,
        "angle"
    );

    addWarmupSlider(
        "p",
        "PURPLE TRANSLATION",
        -6,
        6,
        0.01,
        "purple"
    );

    addWarmupSlider(
        "q",
        "BLUE TRANSLATION",
        -6,
        6,
        0.01,
        "blue"
    );

    const completeToggle =
        document.createElement("button");

    completeToggle.id =
        "complete-controls-toggle";
    completeToggle.className =
        "complete-controls-toggle geometry-disclosure-toggle";
    completeToggle.type = "button";
    completeToggle.textContent =
        warmupCompleteControlsExpanded
            ? "⌃"
            : "⌄";
    completeToggle.title =
        "Show or hide Geometry";

    geometryControls.appendChild(
        completeToggle
    );

    const completePanel =
        document.createElement("div");

    completePanel.id =
        "complete-controls-panel";
    completePanel.className =
        "complete-controls-panel";
    completePanel.hidden =
        !warmupCompleteControlsExpanded;

    buildCompletePictureControls(
        completePanel
    );

    completeToggle.addEventListener(
        "click",
        () => {
            warmupCompleteControlsExpanded =
                !warmupCompleteControlsExpanded;

            syncWarmupLegendPanel();
        }
    );

    geometryControls.appendChild(
        completePanel
    );

    const desmosEquationsToggle =
        document.getElementById(
            "desmos-equations-toggle"
        );

    if (desmosEquationsToggle) {
        desmosEquationsToggle.classList.add(
            "sidebar-equations-toggle"
        );

        completePanel.appendChild(
            desmosEquationsToggle
        );

        updateWarmupDesmosToggleButton();
    }

    typeset(completePanel);
    syncWarmupLegendPanel();
}

function warmupControlValue(parameter) {
    if (parameter === "angle") {
        return warmupAngleIndex(
            warmupParameters.angle
        );
    }

    return warmupParameters[parameter];
}

function warmupSetFromControlValue(
    parameter,
    value
) {
    if (parameter === "angle") {
        const index = Math.max(
            -WARMUP_ANGLE_STEPS_PER_PI,
            Math.min(
                WARMUP_ANGLE_STEPS_PER_PI,
                Math.round(Number(value))
            )
        );

        warmupParameters.angle =
            warmupAngleCoefficientFromIndex(index);
        return true;
    }

    /* p and q are controlled in hundredths.  Keep the actual model state
       on that same grid instead of feeding Desmos long floating-point tails
       such as -1.2921230769230703.  This also makes the drawer, helper
       expressions, root calculation and rendered geometry agree exactly. */
    const numeric = Number(value);

    /* Never allow an asynchronous UI/Desmos transition to poison the
       authoritative model with NaN or Infinity. */
    if (!Number.isFinite(numeric)) {
        return false;
    }

    warmupParameters[parameter] =
        Math.round((numeric + Number.EPSILON) * 100) / 100;
    return true;
}

function formatWarmupDecimal(parameter) {
    return Number(
        Number(
            warmupParameters[parameter]
        ).toFixed(2)
    ).toString();
}

function splitWarmupDecimal(parameter) {
    const text =
        formatWarmupDecimal(parameter);

    const dot =
        text.indexOf(".");

    if (dot === -1) {
        return {
            major: text,
            minor: ""
        };
    }

    return {
        major: text.slice(0, dot),
        minor: text.slice(dot)
    };
}

function warmupAlphaFractionParts(angleCoefficient) {
    const index = warmupAngleIndex(angleCoefficient);

    if (index === 0) {
        return {
            sign: "",
            numerator: 0,
            denominator: 1,
            hasPi: false
        };
    }

    const divisor = gcdWarmup(
        index,
        WARMUP_ANGLE_STEPS_PER_PI
    );

    const reducedNumerator = index / divisor;
    const denominator =
        WARMUP_ANGLE_STEPS_PER_PI / divisor;

    return {
        sign: reducedNumerator < 0 ? "−" : "",
        numerator: Math.abs(reducedNumerator),
        denominator,
        hasPi: true
    };
}

function warmupAlphaDisplayHtml(angleCoefficient) {
    const {
        sign,
        numerator,
        denominator,
        hasPi
    } = warmupAlphaFractionParts(angleCoefficient);

    if (!hasPi) {
        return `<span class="warmup-angle-zero">0</span>`;
    }

    if (denominator === 1) {
        const coefficient =
            numerator === 1
                ? ""
                : String(numerator);

        return `
            <span class="warmup-angle-sign">${sign}</span>
            <span class="warmup-angle-integer">${coefficient}</span>
            <span class="warmup-angle-pi">π</span>
        `;
    }

    return `
        <span class="warmup-angle-sign">${sign}</span>
        <span class="warmup-angle-fraction" aria-hidden="true">
            <span class="warmup-angle-fraction-num">${numerator}</span>
            <span class="warmup-angle-fraction-den">${denominator}</span>
        </span>
        <span class="warmup-angle-pi">π</span>
    `;
}

function warmupAlphaInputText(angleCoefficient) {
    const {
        sign,
        numerator,
        denominator,
        hasPi
    } = warmupAlphaFractionParts(angleCoefficient);

    if (!hasPi) {
        return "0";
    }

    const asciiSign = sign ? "-" : "";

    if (denominator === 1) {
        if (numerator === 1) {
            return `${asciiSign}π`;
        }

        return `${asciiSign}${numerator}π`;
    }

    return `${asciiSign}${numerator}/${denominator}π`;
}

function parseWarmupAngleInput(rawValue) {
    let text = String(rawValue)
        .trim()
        .toLowerCase()
        .replaceAll("−", "-")
        .replaceAll("π", "pi")
        .replace(/\s+/g, "");

    if (!text) {
        return NaN;
    }

    let sign = 1;

    if (text.startsWith("+")) {
        text = text.slice(1);
    } else if (text.startsWith("-")) {
        sign = -1;
        text = text.slice(1);
    }

    const parseRatio = value => {
        if (!value) {
            return 1;
        }

        const parts = value.split("/");

        if (parts.length === 1) {
            return Number(parts[0]);
        }

        if (parts.length === 2) {
            const numerator = Number(parts[0]);
            const denominator = Number(parts[1]);

            if (!Number.isFinite(denominator) || denominator === 0) {
                return NaN;
            }

            return numerator / denominator;
        }

        return NaN;
    };

    let coefficient;

    if (text.includes("pi")) {
        const piIndex = text.indexOf("pi");
        const before = text.slice(0, piIndex);
        const after = text.slice(piIndex + 2);

        let beforeCoefficient = 1;

        if (before) {
            beforeCoefficient = parseRatio(before);
        }

        let afterDivisor = 1;

        if (after) {
            if (!after.startsWith("/")) {
                return NaN;
            }

            afterDivisor = Number(after.slice(1));

            if (!Number.isFinite(afterDivisor) || afterDivisor === 0) {
                return NaN;
            }
        }

        coefficient = beforeCoefficient / afterDivisor;
    } else {
        coefficient = parseRatio(text);
    }

    if (!Number.isFinite(coefficient)) {
        return NaN;
    }

    return sign * coefficient;
}

function setWarmupAngleReadoutVisible(visible) {
    const editorWrap =
        document.getElementById(
            "warmup-angle-number-editor"
        );

    if (editorWrap) {
        /* Keep the exact angle slot in layout even when the readout is
           temporarily suppressed during dragging, held arrow keys, or play.
           Removing the element with `hidden` changed the heading height and
           made the control jump. */
        editorWrap.hidden = false;
        editorWrap.classList.toggle(
            "warmup-angle-readout-hidden",
            !visible
        );
        editorWrap.setAttribute(
            "aria-hidden",
            visible ? "false" : "true"
        );
    }
}

function renderWarmupValueDisplay(parameter) {
    if (parameter === "angle") {
        const display =
            document.getElementById(
                "warmup-angle-value-display"
            );

        const editor =
            document.getElementById(
                "warmup-angle-value-input"
            );

        if (display) {
            display.innerHTML =
                warmupAlphaDisplayHtml(
                    warmupParameters.angle
                );

            display.classList.toggle(
                "warmup-angle-positive",
                warmupParameters.angle > 0
            );
            display.classList.toggle(
                "warmup-angle-negative",
                warmupParameters.angle < 0
            );
        }

        if (
            editor
            && document.activeElement !== editor
        ) {
            editor.value =
                warmupAlphaInputText(
                    warmupParameters.angle
                );
        }

        return;
    }

    const display =
        document.getElementById(
            `warmup-value-display-${parameter}`
        );

    const editor =
        document.getElementById(
            `warmup-value-${parameter}`
        );

    if (display) {
        const { major, minor } =
            splitWarmupDecimal(parameter);

        display.innerHTML =
            `<span class="warmup-value-major">${major}</span>`
            + (
                minor
                    ? `<span class="warmup-value-minor">${minor}</span>`
                    : ""
            );
    }

    if (
        editor
        && document.activeElement !== editor
    ) {
        editor.value =
            formatWarmupDecimal(parameter);
    }
}

function parseWarmupTypedValue(rawValue) {
    return Number(
        String(rawValue)
            .trim()
            .replace(",", ".")
    );
}

function warmupMasterAnimationTick(now) {
    warmupMasterAnimationFrame = null;

    const running = ["angle", "p", "q"].filter(parameter => {
        const state = warmupAnimations[parameter];
        return state?.running && state.source !== "desmos";
    });

    if (!running.length) {
        warmupMasterAnimationLastTime = 0;
        warmupMasterAnimationLastCommitTime = 0;
        return;
    }

    const previous = warmupMasterAnimationLastTime || now;
    const dt = Math.min(
        0.08,
        Math.max(0, (now - previous) / 1000)
    );
    warmupMasterAnimationLastTime = now;

    /* Advance only the private continuous positions on every RAF.  The
       authoritative warmupParameters and all three Desmos calculators move
       only on an atomic commit below.  There is therefore never a rendered
       frame in which curves belong to one tuple and L / S∩L to another. */
    running.forEach(parameter => {
        const state = warmupAnimations[parameter];

        if (!state?.running || state.source === "desmos") {
            return;
        }

        const { min, max, speed } = state;

        if (!Number.isFinite(speed)) {
            return;
        }

        let current = Number(state.position);

        if (!Number.isFinite(current)) {
            current = Number(warmupControlValue(parameter));
        }

        if (!Number.isFinite(current)) {
            current = 0;
        }

        let next;

        if (parameter === "angle") {
            next = current + state.direction * speed * dt;
            const span = max - min;

            while (next > max) {
                next -= span;
            }

            while (next < min) {
                next += span;
            }
        } else {
            current = Math.max(min, Math.min(max, current));

            if (current >= max && state.direction > 0) {
                state.direction = -1;
            } else if (current <= min && state.direction < 0) {
                state.direction = 1;
            }

            next = current + state.direction * speed * dt;

            if (next > max) {
                next = max - (next - max);
                state.direction = -1;
            } else if (next < min) {
                next = min + (min - next);
                state.direction = 1;
            }

            next = Math.max(min, Math.min(max, next));
        }

        state.position = next;
    });

    const degree = Number(warmupSurface?.degree ?? 3);
    let commitInterval = warmupInteractiveRenderInterval();

    if (degree > 20) {
        commitInterval = Math.max(commitInterval, 95);
    } else if (degree > 10) {
        commitInterval = Math.max(commitInterval, 75);
    } else if (degree > 5) {
        commitInterval = Math.max(commitInterval, 60);
    }

    const shouldCommit =
        warmupMasterAnimationLastCommitTime === 0
        || now - warmupMasterAnimationLastCommitTime >= commitInterval;

    if (shouldCommit) {
        const changed = [];

        running.forEach(parameter => {
            const state = warmupAnimations[parameter];

            if (!state?.running || state.source === "desmos") {
                return;
            }

            const before = warmupParameters[parameter];
            warmupSetFromControlValue(parameter, state.position);

            const isChanged = parameter === "angle"
                ? warmupAngleIndex(before)
                    !== warmupAngleIndex(warmupParameters[parameter])
                : Math.abs(before - warmupParameters[parameter]) > 1e-12;

            if (isChanged) {
                changed.push(parameter);
            }

            if (state.slider) {
                state.slider.value = warmupControlValue(parameter);
            }

            renderWarmupValueDisplay(parameter);
        });

        if (changed.length) {
            /* Root solving is synchronous.  We solve first from this frozen
               tuple and then commit alpha/p/q + L + points in the same JS
               turn.  For expensive high-degree surfaces we lower the commit
               cadence instead of letting points trail behind moving curves. */
            updateWarmupParameters({
                changedParameters: changed,
                guardViewport: false,
                updateIntersections: true
            });
        }

        warmupMasterAnimationLastCommitTime = now;
    }

    if (warmupAnyCustomAnimationRunning()) {
        warmupMasterAnimationFrame = requestAnimationFrame(
            warmupMasterAnimationTick
        );
    } else {
        warmupMasterAnimationLastTime = 0;
        warmupMasterAnimationLastCommitTime = 0;
    }
}

function warmupWebsiteAnimationSpeed(parameter, min, max) {
    const span = Math.abs(Number(max) - Number(min));
    const seconds = WARMUP_NATIVE_ANIMATION_PERIOD_MS / 1000;

    if (!Number.isFinite(span) || !Number.isFinite(seconds) || seconds <= 0) {
        return parameter === "angle" ? 1 : 0.01;
    }

    return span / seconds;
}

function startWarmupAnimation(
    parameter,
    slider,
    button,
    min,
    max
) {
    clearWarmupHelperSyncTimer(parameter);
    clearWarmupGlobalPauseState();

    const previous = warmupAnimations[parameter];

    /* Keep the same parameter and the same native Desmos slider, but do not
       let Desmos's private animation clock race the JavaScript geometry.
       Playback is advanced on the page's master RAF and each step is written
       back to the actual alpha/p/q slider.  This is what makes H1,H2,C1,C2,
       L and S\cap L share one authoritative frame. */
    if (parameter === "angle") {
        warmupSetFromNativeParameterValue(
            "angle",
            warmupClampNativePlaybackValue(
                "angle",
                warmupParameters.angle
            )
        );
    } else {
        warmupSetFromNativeParameterValue(
            parameter,
            warmupClampNativePlaybackValue(
                parameter,
                warmupParameters[parameter]
            )
        );
    }

    slider.value = warmupControlValue(parameter);
    renderWarmupValueDisplay(parameter);

    let direction = Number(previous?.direction);
    if (direction !== -1 && direction !== 1) {
        direction = 1;
    }

    if (parameter === "angle") {
        /* The azimuth loop is always forward. */
        direction = 1;
    } else {
        const current = Number(warmupControlValue(parameter));
        if (current >= max) {
            direction = -1;
        } else if (current <= min) {
            direction = 1;
        }
    }

    warmupAnimations[parameter] = {
        ...(previous || {}),
        running: true,
        source: "website",
        direction,
        position: Number(warmupControlValue(parameter)),
        speed: warmupWebsiteAnimationSpeed(parameter, min, max),
        min,
        max,
        slider,
        button
    };

    /* The native row is still the actual slider; only its autonomous Play
       clock is off.  The master tick below writes this same row every frame. */
    warmup3D?.setExpression({
        id: warmupDesmosExpressionId(parameter),
        latex: warmupNativeExpressionLatex(parameter),
        sliderBounds: warmupNativeSliderBounds(parameter),
        playing: false
    });

    setWarmupAnimationButtonRunning(parameter, true);
    warmupMasterAnimationLastCommitTime = 0;
    warmupEnsureMasterAnimationFrame();
}

function addWarmupSlider(
    parameter,
    headingText,
    min,
    max,
    step,
    colorClass
) {
    const wrapper =
        document.createElement("div");

    wrapper.className =
        `warmup-slider ${colorClass}`;

    const headingRow =
        document.createElement("div");

    headingRow.className =
        parameter === "angle"
            ? "warmup-parameter-heading-row warmup-angle-heading-row"
            : "warmup-parameter-heading-row";

    const heading =
        document.createElement("div");

    heading.className =
        `geometry-group ${colorClass}`;

    if (parameter === "angle") {
        heading.textContent = "AZIMUTH ANGLE";
    } else {
        heading.textContent = headingText;
    }

    const play =
        document.createElement("button");

    play.type = "button";
    play.className =
        "warmup-play-button";
    play.id = `warmup-play-${parameter}`;
    play.textContent = "▶";
    play.title =
        `Animate ${headingText.toLowerCase()}`;

    headingRow.appendChild(heading);

    const controlRow =
        document.createElement("div");

    controlRow.className =
        parameter === "angle"
            ? "warmup-slider-row warmup-angle-row"
            : "warmup-slider-row warmup-translation-row";

    const slider =
        document.createElement("input");

    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = Math.max(
        min,
        Math.min(
            max,
            warmupControlValue(parameter)
        )
    );
    slider.id =
        `warmup-range-${parameter}`;

    if (parameter === "angle") {
        const angleEditorWrap =
            document.createElement("span");

        angleEditorWrap.id =
            "warmup-angle-number-editor";
        angleEditorWrap.className =
            "warmup-number-editor warmup-angle-number-editor";

        const angleDisplay =
            document.createElement("button");

        angleDisplay.type = "button";
        angleDisplay.id =
            "warmup-angle-value-display";
        angleDisplay.className =
            "warmup-angle-value-display";
        angleDisplay.title =
            "Type an azimuth, e.g. 1/4 pi or pi/4";
        angleDisplay.innerHTML =
            warmupAlphaDisplayHtml(
                warmupParameters.angle
            );
        angleDisplay.classList.toggle(
            "warmup-angle-positive",
            warmupParameters.angle > 0
        );
        angleDisplay.classList.toggle(
            "warmup-angle-negative",
            warmupParameters.angle < 0
        );

        const angleEditor =
            document.createElement("input");

        angleEditor.type = "text";
        angleEditor.inputMode = "text";
        angleEditor.id =
            "warmup-angle-value-input";
        angleEditor.className =
            "warmup-slider-value warmup-angle-value-input";
        angleEditor.title =
            "Type an azimuth, e.g. 1/4 pi or pi/4";
        angleEditor.placeholder =
            "e.g. 1/4 pi";
        angleEditor.hidden = true;

        function closeAngleEditor(commit) {
            if (commit) {
                const coefficient =
                    parseWarmupAngleInput(
                        angleEditor.value
                    );

                if (Number.isFinite(coefficient)) {
                    stopWarmupAnimation("angle");

                    const angleIndex =
                        Math.round(
                            coefficient
                            * WARMUP_ANGLE_STEPS_PER_PI
                        );

                    warmupSetFromControlValue(
                        "angle",
                        angleIndex
                    );

                    slider.value =
                        warmupControlValue("angle");

                    /* Typing an angle changes only orientation.  It must not
                       invoke the translation viewport guard: for high-degree
                       surfaces a distant intersection of L can otherwise make
                       the whole scene jump to a huge scale even though the user
                       changed only the azimuth. */
                    updateWarmupParameters({
                        changedParameter: "angle",
                        guardViewport: false
                    });
                }
            }

            angleEditor.hidden = true;
            angleDisplay.hidden = false;
            renderWarmupValueDisplay("angle");
        }

        angleDisplay.addEventListener(
            "click",
            () => {
                stopWarmupAnimation("angle");
                angleDisplay.hidden = true;
                angleEditor.hidden = false;
                angleEditor.value =
                    warmupAlphaInputText(
                        warmupParameters.angle
                    );
                angleEditor.focus();
                angleEditor.select();
            }
        );

        angleEditor.addEventListener(
            "blur",
            () => closeAngleEditor(true)
        );

        angleEditor.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    closeAngleEditor(true);
                }

                if (event.key === "Escape") {
                    event.preventDefault();
                    closeAngleEditor(false);
                }
            }
        );

        angleEditorWrap.appendChild(
            angleDisplay
        );
        angleEditorWrap.appendChild(
            angleEditor
        );

        headingRow.appendChild(
            angleEditorWrap
        );

        const angleSuffix =
            document.createElement("div");

        angleSuffix.className =
            "geometry-group angle warmup-angle-heading-suffix";
        angleSuffix.innerHTML =
            'OF H<span class="warmup-control-subscript">1</span>';

        headingRow.appendChild(
            angleSuffix
        );

        const leftRange =
            document.createElement("span");

        leftRange.className =
            "warmup-angle-limit";
        leftRange.textContent =
            "−π";

        const rightRange =
            document.createElement("span");

        rightRange.className =
            "warmup-angle-limit";
        rightRange.textContent =
            "π";

        const angleTrack =
            document.createElement("div");

        angleTrack.className =
            "warmup-angle-track";

        angleTrack.appendChild(
            leftRange
        );
        angleTrack.appendChild(
            slider
        );
        angleTrack.appendChild(
            rightRange
        );

        controlRow.appendChild(
            angleTrack
        );
        controlRow.appendChild(
            play
        );
    } else {
        const editorWrap =
            document.createElement("span");

        editorWrap.className =
            "warmup-number-editor";

        const display =
            document.createElement("button");

        display.type = "button";
        display.className =
            "warmup-value-display";
        display.id =
            `warmup-value-display-${parameter}`;
        display.title =
            `Type any ${headingText.toLowerCase()} value`;

        const editor =
            document.createElement("input");

        editor.type = "text";
        editor.inputMode = "decimal";
        editor.className =
            "warmup-slider-value";
        editor.id =
            `warmup-value-${parameter}`;
        editor.hidden = true;

        function closeEditor(commit) {
            if (commit) {
                const typed =
                    parseWarmupTypedValue(
                        editor.value
                    );

                if (Number.isFinite(typed)) {
                    stopWarmupAnimation(
                        parameter
                    );

                    warmupSetFromControlValue(
                        parameter,
                        typed
                    );

                    slider.value = Math.max(
                        min,
                        Math.min(
                            max,
                            typed
                        )
                    );

                    updateWarmupParameters({
                        changedParameter: parameter,
                        guardViewport: true
                    });

                    /* v4.83A: keep the projection calculators independent
                       of the 3D camera/bounds. Their section equations are
                       implicit and unbounded; copying a very large 3D x/y
                       window here can visually compress/truncate C1/C2. */
                }
            }

            editor.hidden = true;
            display.hidden = false;
            renderWarmupValueDisplay(
                parameter
            );
        }

        display.addEventListener(
            "click",
            () => {
                display.hidden = true;
                editor.hidden = false;
                editor.value =
                    formatWarmupDecimal(
                        parameter
                    );
                editor.focus();
                editor.select();
            }
        );

        editor.addEventListener(
            "blur",
            () => closeEditor(true)
        );

        editor.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter") {
                    closeEditor(true);
                }

                if (event.key === "Escape") {
                    closeEditor(false);
                }
            }
        );

        editorWrap.appendChild(
            display
        );
        editorWrap.appendChild(
            editor
        );

        /* Keep the value beside the parameter name. The readout stays
           unboxed until the user clicks it to edit. */
        headingRow.appendChild(
            editorWrap
        );

        controlRow.appendChild(
            slider
        );
        controlRow.appendChild(
            play
        );
    }

    slider.addEventListener(
        "pointerdown",
        () => {
            stopWarmupAnimation(
                parameter
            );

            if (parameter === "angle") {
                setWarmupAngleReadoutVisible(false);

                /* `change` is not guaranteed to fire in every drag/release
                   path (for example if the pointer leaves the slider or the
                   final value is unchanged).  Listen for the matching global
                   pointer release once, so the exact angle readout always
                   comes back when the drag is finished. */
                const finishAnglePointerInteraction = () => {
                    if (!warmupAnimations.angle?.running) {
                        renderWarmupValueDisplay("angle");
                        setWarmupAngleReadoutVisible(true);
                    }
                };

                window.addEventListener(
                    "pointerup",
                    finishAnglePointerInteraction,
                    { once: true }
                );

                window.addEventListener(
                    "pointercancel",
                    finishAnglePointerInteraction,
                    { once: true }
                );
            }
        }
    );

    slider.addEventListener(
        "input",
        () => {
            if (parameter === "angle") {
                setWarmupAngleReadoutVisible(false);
            }

            warmupSetFromControlValue(
                parameter,
                Number(slider.value)
            );

            slider.value =
                warmupControlValue(parameter);

            renderWarmupValueDisplay(
                parameter
            );

            scheduleWarmupParametersUpdate(parameter);
        }
    );

    /* Force held arrow keys to redraw on every keyboard auto-repeat.
       Preventing the native step avoids the old one-step mismatch. */
    slider.addEventListener(
        "keydown",
        event => {
            if (
                event.key !== "ArrowLeft"
                && event.key !== "ArrowRight"
            ) {
                return;
            }

            event.preventDefault();
            stopWarmupAnimation(parameter);

            if (parameter === "angle") {
                setWarmupAngleReadoutVisible(false);
            }

            const direction =
                event.key === "ArrowRight"
                    ? 1
                    : -1;

            const stepSize =
                Number(slider.step) || 1;

            const current =
                warmupControlValue(parameter);

            const next =
                Math.max(
                    min,
                    Math.min(
                        max,
                        current
                        + direction * stepSize
                    )
                );

            warmupSetFromControlValue(
                parameter,
                next
            );

            slider.value =
                warmupControlValue(parameter);

            renderWarmupValueDisplay(
                parameter
            );

            scheduleWarmupParametersUpdate(parameter);
        }
    );

    slider.addEventListener(
        "keyup",
        event => {
            if (
                parameter === "angle"
                && (
                    event.key === "ArrowLeft"
                    || event.key === "ArrowRight"
                )
            ) {
                renderWarmupValueDisplay("angle");
                setWarmupAngleReadoutVisible(true);
            }
        }
    );

    slider.addEventListener(
        "blur",
        () => {
            if (
                parameter === "angle"
                && !warmupAnimations.angle?.running
            ) {
                renderWarmupValueDisplay("angle");
                setWarmupAngleReadoutVisible(true);
            }
        }
    );

    slider.addEventListener(
        "change",
        () => {
            updateWarmupParameters({
                changedParameter: parameter,
                guardViewport: false,
                updateIntersections: true
            });

            if (parameter === "angle") {
                renderWarmupValueDisplay("angle");
                setWarmupAngleReadoutVisible(true);
            }
        }
    );

    play.addEventListener(
        "click",
        () => {
            const state =
                warmupAnimations[parameter];

            if (state?.running) {
                stopWarmupAnimation(
                    parameter
                );
                updateWarmupParameters({
                    guardViewport: false
                });
                return;
            }

            /* A local Stop followed by Play is a pause/resume operation.
               Keep the exact direction in which the value was travelling
               instead of constructing a new state with direction = +1. */
            if (state) {
                clearWarmupGlobalPauseState();
                resumeWarmupAnimation(parameter);
                return;
            }

            startWarmupAnimation(
                parameter,
                slider,
                play,
                min,
                max
            );
        }
    );

    wrapper.appendChild(
        headingRow
    );
    wrapper.appendChild(
        controlRow
    );

    geometryControls.appendChild(
        wrapper
    );

    renderWarmupValueDisplay(
        parameter
    );
}

function syncWarmupControlValues() {
    ["angle", "p", "q"].forEach(parameter => {
        const slider =
            document.getElementById(
                `warmup-range-${parameter}`
            );

        if (slider) {
            const min = Number(slider.min);
            const max = Number(slider.max);

            slider.value = Math.max(
                min,
                Math.min(
                    max,
                    warmupControlValue(parameter)
                )
            );
        }

        renderWarmupValueDisplay(
            parameter
        );
    });
}

function warmupControlLabelHtml(text) {
    const labels = {
        "S": String.raw`\(S\)`,
        "H₁": String.raw`\(H_1\)`,
        "H₂": String.raw`\(H_2\)`,
        "C₁ = S ∩ H₁": String.raw`\(C_1=S\cap H_1\)`,
        "C₂ = S ∩ H₂": String.raw`\(C_2=S\cap H_2\)`,
        "L = H₁ ∩ H₂": String.raw`\(L=H_1\cap H_2\)`,
        "S ∩ H₁ ∩ H₂": String.raw`\(S\cap H_1\cap H_2\)`,
        "C₁ and L": String.raw`\(C_1\text{ and }L\)`,
        "C₂ and L": String.raw`\(C_2\text{ and }L\)`
    };

    return labels[text] ?? String(text);
}

function buildCompletePictureControls(panel) {
    const heading =
        document.createElement("div");

    heading.className =
        "complete-control-heading";
    heading.textContent = "GEOMETRY";

    panel.appendChild(heading);

    const rows = [
        ["surface", "surface", "S", "surface-mini"],
        ["purplePlane", "purple-plane", "H₁", "h1-mini"],
        ["bluePlane", "blue-plane", "H₂", "h2-mini"],
        ["purpleCubic", "purple-cubic", "C₁ = S ∩ H₁", "purple-curve-mini"],
        ["blueCubic", "blue-cubic", "C₂ = S ∩ H₂", "blue-curve-mini"],
        ["line", "intersection-line", "L = H₁ ∩ H₂", "line-mini"],
        ["points", "intersection-points", "S ∩ H₁ ∩ H₂", "point-mini"]
    ];

    rows.forEach(
        ([key, expressionId, text, swatchClass]) => {
            const label =
                document.createElement("label");

            label.className =
                "complete-control-row";

            const checkbox =
                document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.checked = true;
            checkbox.className =
                "complete-control-checkbox";
            checkbox.dataset.geometryKey = key;
            label.dataset.geometryKey = key;

            const checkmark =
                document.createElement("span");

            checkmark.className =
                "complete-control-check";

            let swatch;

            if (swatchClass === "surface-mini") {
                swatch = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "svg"
                );

                swatch.setAttribute(
                    "viewBox",
                    "0 0 44 26"
                );
                swatch.setAttribute(
                    "preserveAspectRatio",
                    "none"
                );
                swatch.classList.add(
                    "complete-mini-swatch",
                    "surface-mini"
                );

                swatch.innerHTML = `
                    <defs>
                        <linearGradient
                            id="complete-surface-gradient"
                            x1="0" y1="1" x2="1" y2="0">
                            <stop offset="0%" stop-color="#6E8F6B"></stop>
                            <stop offset="15%" stop-color="#8EA88A"></stop>
                            <stop offset="28%" stop-color="#5C7C59"></stop>
                            <stop offset="50%" stop-color="#436340"></stop>
                            <stop offset="72%" stop-color="#5C7C59"></stop>
                            <stop offset="85%" stop-color="#8EA88A"></stop>
                            <stop offset="100%" stop-color="#6E8F6B"></stop>
                        </linearGradient>
                    </defs>
                    <path
                        d="M2 4
                           C10 5.5, 15 5.5, 22 4
                           C29 2.5, 35 2.5, 42 4
                           C39 9, 45 17, 42 22
                           C34 20.5, 29 20.5, 22 22
                           C14 23.5, 8 23.5, 2 22
                           C5 17, -1 9, 2 4
                           Z">
                    </path>`;
            } else {
                swatch =
                    document.createElement("span");

                swatch.className =
                    `complete-mini-swatch ${swatchClass}`;
            }

            const caption =
                document.createElement("span");

            caption.className =
                "complete-control-label";
            caption.innerHTML =
                warmupControlLabelHtml(text);

            checkbox.addEventListener(
                "change",
                () => {
                    setWarmupGeometryVisibilityFromControl(
                        key,
                        checkbox.checked
                    );
                }
            );

            label.appendChild(checkbox);
            label.appendChild(checkmark);
            label.appendChild(swatch);
            label.appendChild(caption);
            panel.appendChild(label);
        }
    );

    const projectionHeading =
        document.createElement("div");

    projectionHeading.className =
        "complete-control-subheading";
    projectionHeading.textContent =
        "xy PROJECTION";

    panel.appendChild(
        projectionHeading
    );

    [
        ["purpleProjection", "purple-card", "C₁ and L", "purple-projection-label"],
        ["blueProjection", "blue-card", "C₂ and L", "blue-projection-label"]
    ].forEach(
        ([key, cardId, text, colorClass]) => {
            const label =
                document.createElement("label");

            label.className =
                "complete-control-row projection-control-row";

            const checkbox =
                document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.checked = true;
            checkbox.className =
                "complete-control-checkbox";
            checkbox.dataset.geometryKey = key;
            label.dataset.geometryKey = key;

            const checkmark =
                document.createElement("span");

            checkmark.className =
                "complete-control-check";

            const caption =
                document.createElement("span");

            caption.className =
                `complete-control-label ${colorClass}`;
            caption.innerHTML =
                warmupControlLabelHtml(text);

            checkbox.addEventListener(
                "change",
                () => {
                    setWarmupGeometryVisibilityFromControl(
                        key,
                        checkbox.checked
                    );
                }
            );

            label.appendChild(checkbox);
            label.appendChild(checkmark);
            label.appendChild(caption);
            panel.appendChild(label);
        }
    );
}

const warmup3DVisibilityExpressionMap = Object.freeze({
    surface: "surface",
    purplePlane: "purple-plane",
    bluePlane: "blue-plane",
    purpleCubic: "purple-cubic",
    blueCubic: "blue-cubic",
    line: "intersection-line",
    points: "intersection-points"
});

const warmupProjectionVisibilityMap = Object.freeze({
    purpleProjection: {
        calculator: () => purple2D,
        cardId: "purple-card",
        primaryExpressionId: "purple-cubic",
        expressionIds: [
            "purple-cubic",
            "intersection-line",
            "intersection-points-outline",
            "intersection-points"
        ]
    },
    blueProjection: {
        calculator: () => blue2D,
        cardId: "blue-card",
        primaryExpressionId: "blue-cubic",
        expressionIds: [
            "blue-cubic",
            "intersection-line",
            "intersection-points-outline",
            "intersection-points"
        ]
    }
});

function warmupExpressionIsVisible(calculator, expressionId, fallback = true) {
    if (!calculator?.getExpressions) {
        return fallback;
    }

    const expression = calculator
        .getExpressions()
        .find(item => item.id === expressionId);

    return expression
        ? expression.hidden !== true
        : fallback;
}

function warmupApplyProjectionCardPresentation(state) {
    Object.entries(warmupProjectionVisibilityMap)
        .forEach(([key, config]) => {
            document
                .getElementById(config.cardId)
                ?.classList.toggle(
                    "mode-hidden",
                    !state[key]
                );
        });
}

function warmupWriteVisibilityStateToDesmos(state) {
    Object.entries(warmup3DVisibilityExpressionMap)
        .forEach(([key, expressionId]) => {
            warmup3D?.setExpression({
                id: expressionId,
                hidden: !state[key]
            });
        });

    Object.entries(warmupProjectionVisibilityMap)
        .forEach(([key, config]) => {
            const calculator = config.calculator();
            if (!calculator) {
                return;
            }

            calculator.setExpressions(
                config.expressionIds.map(id => ({
                    id,
                    hidden: !state[key]
                }))
            );
        });

    warmupApplyProjectionCardPresentation(state);
}

function warmupSyncVisibilityFromDesmos() {
    if (!warmup3D || !purple2D || !blue2D) {
        return;
    }

    const state = warmupVisibilityForMode(currentWarmupMode);

    Object.entries(warmup3DVisibilityExpressionMap)
        .forEach(([key, expressionId]) => {
            state[key] = warmupExpressionIsVisible(
                warmup3D,
                expressionId,
                state[key]
            );
        });

    Object.entries(warmupProjectionVisibilityMap)
        .forEach(([key, config]) => {
            state[key] = warmupExpressionIsVisible(
                config.calculator(),
                config.primaryExpressionId,
                state[key]
            );
        });

    warmupApplyProjectionCardPresentation(state);
    syncWarmupGeometryPanel(currentWarmupMode);
    updateWarmupLegend(currentWarmupMode);
}

function scheduleWarmupVisibilitySync() {
    if (warmupVisibilitySyncTimer !== null) {
        return;
    }

    /* Desmos emits the same generic change event for camera motion and for
       expression visibility changes. A short throttle keeps camera rotation
       cheap while making visibility mirrors feel immediate. */
    warmupVisibilitySyncTimer = setTimeout(() => {
        warmupVisibilitySyncTimer = null;
        warmupSyncVisibilityFromDesmos();
    }, 60);
}

function setupWarmupVisibilitySync() {
    if (warmupVisibilityObserversInstalled) {
        return;
    }

    const calculators = [warmup3D, purple2D, blue2D]
        .filter(Boolean);

    if (!calculators.length) {
        return;
    }

    warmupVisibilityObserversInstalled = true;

    calculators.forEach(calculator => {
        if (typeof calculator.observeEvent === "function") {
            calculator.observeEvent(
                "change",
                scheduleWarmupVisibilitySync
            );
        }
    });
}

function setWarmupGeometryVisibilityFromControl(key, visible) {
    if (key in warmup3DVisibilityExpressionMap) {
        warmup3D?.setExpression({
            id: warmup3DVisibilityExpressionMap[key],
            hidden: !visible
        });
    } else if (key in warmupProjectionVisibilityMap) {
        const config = warmupProjectionVisibilityMap[key];
        const calculator = config.calculator();

        calculator?.setExpressions(
            config.expressionIds.map(id => ({
                id,
                hidden: !visible
            }))
        );
    } else {
        return;
    }

    /* Read back from Desmos immediately.  The sidebar never owns a second
       visibility value; it only requests a change and mirrors the result. */
    warmupSyncVisibilityFromDesmos();
}

function applyWarmupVisibility(mode = currentWarmupMode) {
    const state = warmupVisibilityForMode(mode);
    warmupWriteVisibilityStateToDesmos(state);
    warmupSyncVisibilityFromDesmos();
}

function syncWarmupGeometryPanel(mode = currentWarmupMode) {
    const panel =
        document.getElementById(
            "complete-controls-panel"
        );

    if (!panel) {
        return;
    }

    const state =
        warmupVisibilityForMode(mode);

    panel
        .querySelectorAll("[data-geometry-key]")
        .forEach(element => {
            const key =
                element.dataset.geometryKey;

            if (!(key in state)) {
                return;
            }

            if (
                element instanceof HTMLInputElement
                && element.type === "checkbox"
            ) {
                element.checked = Boolean(state[key]);
                element.disabled = false;
            }

            if (element.matches("label")) {
                element.classList.remove(
                    "mode-object-hidden",
                    "mode-readonly"
                );
            }
        });

    panel
        .querySelector(".complete-control-subheading")
        ?.classList.remove(
            "mode-object-hidden"
        );
}

function syncWarmupLegendPanel() {
    const sceneLabels =
        document.getElementById(
            "scene-labels"
        );

    const completePanel =
        document.getElementById(
            "complete-controls-panel"
        );

    const completeToggle =
        document.getElementById(
            "complete-controls-toggle"
        );

    if (completeToggle) {
        completeToggle.textContent =
            warmupCompleteControlsExpanded
                ? "⌃"
                : "⌄";
    }

    if (completePanel) {
        completePanel.hidden =
            !warmupCompleteControlsExpanded;
    }

    if (sceneLabels) {
        const showLegend =
            currentWarmupMode !== "complete"
            && !warmupCompleteControlsExpanded;

        sceneLabels.classList.toggle(
            "complete-hidden",
            !showLegend
        );

        /* In Restriction/Bézout, folding Geometry brings the floating
           legend back. Close the Desmos expression drawer at the same
           time so the two panels never overlap. Complete mode is the
           exception: its legend never returns, so the drawer may stay open. */
        if (
            showLegend
            && warmupDesmosEquationsVisible
        ) {
            setWarmupDesmosEquationsVisible(
                false
            );
        }
    }
}

function warmup2DParameterExpressionsForSnapshot(snapshot) {
    return [
        warmupParameterExpressionForValue("angle", snapshot.angle, false),
        warmupParameterExpressionForValue("p", snapshot.p, false),
        warmupParameterExpressionForValue("q", snapshot.q, false)
    ];
}

function warmupCommit2DSnapshot(
    snapshot,
    purplePointsLatex = "[]",
    bluePointsLatex = "[]"
) {
    if (!snapshot) {
        return;
    }

    const visibility = warmupVisibilityForMode(currentWarmupMode);
    const parameterExpressions =
        warmup2DParameterExpressionsForSnapshot(snapshot);

    purple2D?.setExpressions([
        ...parameterExpressions,
        {
            id: "intersection-points-outline",
            latex: purplePointsLatex,
            color: COLORS.intersectionBorder,
            pointSize: 9,
            hidden: !visibility.purpleProjection
        },
        {
            id: "intersection-points",
            latex: purplePointsLatex,
            color: COLORS.intersection,
            pointSize: 7,
            hidden: !visibility.purpleProjection
        }
    ]);

    blue2D?.setExpressions([
        ...parameterExpressions,
        {
            id: "intersection-points-outline",
            latex: bluePointsLatex,
            color: COLORS.intersectionBorder,
            pointSize: 9,
            hidden: !visibility.blueProjection
        },
        {
            id: "intersection-points",
            latex: bluePointsLatex,
            color: COLORS.intersection,
            pointSize: 7,
            hidden: !visibility.blueProjection
        }
    ]);
}

function warmupClearIntersectionPointExpressions() {
    if (warmup3D) {
        warmup3D.setExpression({
            id: "intersection-points",
            latex: "[]",
            color: COLORS.intersection,
            pointSize: 3
        });
    }

    [purple2D, blue2D].forEach(calculator => {
        if (!calculator) {
            return;
        }

        calculator.setExpressions([
            {
                id: "intersection-points-outline",
                latex: "[]",
                color: COLORS.intersectionBorder,
                pointSize: 9
            },
            {
                id: "intersection-points",
                latex: "[]",
                color: COLORS.intersection,
                pointSize: 7
            }
        ]);
    });
}

function warmupSetSurfaceDraftLatexOn2D(latex, clearPoints = false) {
    [purple2D, blue2D].forEach(calculator => {
        if (!calculator) {
            return;
        }

        const expressions = [{
            id: "f",
            latex
        }];

        if (clearPoints) {
            expressions.push(
                {
                    id: "intersection-points-outline",
                    latex: "[]",
                    color: COLORS.intersectionBorder,
                    pointSize: 9
                },
                {
                    id: "intersection-points",
                    latex: "[]",
                    color: COLORS.intersection,
                    pointSize: 7
                }
            );
        }

        calculator.setExpressions(expressions);
    });
}

function warmupApplySurfaceLatex(
    latex,
    options = {}
) {
    const definitionLatex = String(latex ?? "");
    warmupSurfaceDraftLatex = definitionLatex;
    warmupSurfacePendingLatex = definitionLatex;

    /* A newly applied f invalidates every previously accepted intersection
       point until this exact definition has been parsed and solved.  Update
       the 2D definition and clear its old points in one calculator commit. */
    warmupSetSurfaceDraftLatexOn2D(
        definitionLatex,
        true
    );

    try {
        const ast =
            warmupParsePolynomialAst(
                definitionLatex
            );

        warmupSurface =
            warmupCreateSurface(
                ast,
                definitionLatex
            );

        warmupSurfaceDraftValid = true;
        warmupSurfaceRevision += 1;
        warmupCancelWorkerIntersectionSolve();
        warmupResetIntersectionLifecycle();

        if (!options.fromDesmos) {
            warmup3D?.setExpression({
                id: "f",
                latex: definitionLatex
            });
        }

        warmup3D?.setExpression({
            id: "note-surface",
            type: "text",
            text: warmupSurfaceNoteText()
        });

        warmupLastIntersectionNoteText = null;

        /* The Desmos objects already reference f symbolically.  Refresh only
           the JavaScript-restricted intersection points and the 2D copies. */
        updateWarmupParameters({
            guardViewport: false,
            syncParameters: false,
            updateIntersections: true
        });

        return true;
    } catch (error) {
        warmupCancelWorkerIntersectionSolve();
        warmupResetIntersectionLifecycle();
        warmupWorkerIntersectionStatus = null;
        warmupSurfaceDraftValid = false;
        warmupLastIntersectionNoteText = null;

        warmup3D?.setExpression({
            id: "note-surface",
            type: "text",
            text: warmupSurfaceNoteText(
                error?.message
                || "Enter a polynomial in x, y, z."
            )
        });

        warmup3D?.setExpression({
            id: "note-points",
            type: "text",
            text: "Orange intersection points are paused until f is a valid polynomial."
        });

        warmupClearIntersectionPointExpressions();
        return false;
    }
}

function setupWarmupSurfaceExpressionSync() {
    if (
        !warmup3D
        || warmupSurfaceChangeObserverInstalled
        || typeof warmup3D.observeEvent !== "function"
        || typeof warmup3D.getExpressions !== "function"
    ) {
        return;
    }

    warmupSurfaceChangeObserverInstalled = true;
    warmupSurfacePendingLatex =
        warmupSurfaceDraftLatex;

    warmup3D.observeEvent(
        "change",
        () => {
            const expression =
                warmup3D
                    ?.getExpressions()
                    ?.find(item =>
                        item.id === "f"
                    );

            if (
                !expression
                || typeof expression.latex !== "string"
            ) {
                return;
            }

            const incoming =
                expression.latex.trim();
            const pending =
                String(
                    warmupSurfacePendingLatex
                ).trim();

            /* The calculator emits "change" for alpha/p/q animation too.
               Only a genuine change of the f-expression is allowed to
               restart this debounce.  Otherwise continuous playback can
               postpone the 2D surface copy forever until Play is stopped. */
            if (incoming === pending) {
                return;
            }

            warmupSurfacePendingLatex =
                expression.latex;

            /* The visible Desmos surface has already changed.  Invalidate any
               background result for the previous f immediately, rather than
               waiting for the 320 ms parse debounce; otherwise an old worker
               could finish inside that window and briefly repopulate stale
               orange points on the newly edited surface. */
            warmupCancelWorkerIntersectionSolve();
            /* The visible f has changed and the old points are cleared below,
               so no previous root set is still resident in the calculators. */
            warmupIntersectionCommittedState = null;
            warmupIntersectionFailedState = null;
            warmupWorkerIntersectionStatus = null;

            /* The 2D section equations reference f symbolically just like
               the 3D surface does, so mirror the edited definition at once.
               Parsing the polynomial and recomputing orange roots may remain
               debounced, but the two projection curves should never wait for
               playback to stop before following the visible 3D edit. */
            warmupSetSurfaceDraftLatexOn2D(
                expression.latex,
                true
            );

            /* f changed but the debounced polynomial parse/root solve has not
               finished yet.  Never leave orange points from the previous f
               attached to the newly edited surface. */
            warmup3D.setExpression({
                id: "intersection-points",
                latex: "[]",
                color: COLORS.intersection,
                pointSize: 3
            });

            const currentDraft =
                String(
                    warmupSurfaceDraftLatex
                ).trim();

            /* If an edit is undone back to the already-applied surface before
               the debounce expires, cancel the pending parse instead of
               scheduling a redundant refresh. */
            if (incoming === currentDraft) {
                if (warmupSurfaceSyncTimer) {
                    clearTimeout(
                        warmupSurfaceSyncTimer
                    );
                    warmupSurfaceSyncTimer = null;
                }

                /* The edit was undone back to the already parsed surface, but
                   we deliberately cleared its old points when the draft first
                   changed.  Recompute that current snapshot now instead of
                   leaving the restored equation with an empty point list. */
                updateWarmupParameters({
                    guardViewport: false,
                    syncParameters: false,
                    updateIntersections: true
                });
                return;
            }

            if (warmupSurfaceSyncTimer) {
                clearTimeout(
                    warmupSurfaceSyncTimer
                );
            }

            warmupSurfaceSyncTimer =
                setTimeout(() => {
                    warmupSurfaceSyncTimer = null;

                    warmupApplySurfaceLatex(
                        warmupSurfacePendingLatex,
                        { fromDesmos: true }
                    );
                }, 320);
        }
    );
}


function warmupPruneProgrammaticParameterWrites(parameter) {
    const now = performance.now();
    const history = warmupRecentProgrammaticParameterValues[parameter];

    if (!history) {
        return [];
    }

    warmupRecentProgrammaticParameterValues[parameter] =
        history.filter(item => item.expiresAt >= now);

    return warmupRecentProgrammaticParameterValues[parameter];
}

function warmupProgrammaticEchoValue(parameter, value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return NaN;
    }

    /* p and q genuinely live on the 0.01 grid.  The angle, however, lives
       on the much finer 1/360 grid.  Treating alpha like p/q here used to
       collapse several consecutive keyboard steps to the same hundredth.
       More importantly, alpha was not registered as a programmatic write at
       all, so delayed HelperExpression echoes from the previous key-repeat
       could overwrite the new angle and make the 3D picture tremble. */
    if (parameter === "angle") {
        return warmupAngleCoefficientFromIndex(
            warmupAngleIndex(numeric)
        );
    }

    return Math.round(numeric * 100) / 100;
}

function warmupRememberProgrammaticParameterWrite(parameter, value) {
    if (!(parameter in warmupRecentProgrammaticParameterValues)) {
        return;
    }

    const normalized = warmupProgrammaticEchoValue(parameter, value);
    if (!Number.isFinite(normalized)) {
        return;
    }

    const history = warmupPruneProgrammaticParameterWrites(parameter);
    history.push({
        value: normalized,
        expiresAt: performance.now() + 900
    });

    if (history.length > 80) {
        history.splice(0, history.length - 80);
    }
}

function warmupIsRecentProgrammaticParameterEcho(parameter, value) {
    const normalized = warmupProgrammaticEchoValue(parameter, value);
    if (!Number.isFinite(normalized)) {
        return false;
    }

    const tolerance = parameter === "angle" ? 1e-10 : 1e-9;
    return warmupPruneProgrammaticParameterWrites(parameter)
        .some(item => Math.abs(item.value - normalized) < tolerance);
}

function warmupDesmosExpression(parameter) {
    const expressionId = warmupDesmosExpressionId(parameter);
    return warmup3D
        ?.getExpressions?.()
        ?.find(item => item.id === expressionId)
        || null;
}

function warmupDesmosNativePlaying(parameter) {
    return Boolean(
        warmupDesmosExpression(parameter)?.playing
    );
}

function warmupAdoptNativePlayback(parameter) {
    if (!["angle", "p", "q"].includes(parameter)) {
        return;
    }

    const previous = warmupAnimations[parameter];
    const slider = document.getElementById(`warmup-range-${parameter}`);
    const button = document.getElementById(`warmup-play-${parameter}`);

    const helperValue = warmupNativeHelperValue(parameter);
    const bounded = warmupClampNativePlaybackValue(
        parameter,
        Number.isFinite(helperValue)
            ? helperValue
            : warmupNativeModelValue(parameter)
    );

    warmupSetFromNativeParameterValue(parameter, bounded);

    if (slider) {
        slider.value = warmupControlValue(parameter);
    }

    const limits = warmupAnimationLimits(parameter);
    let direction = Number(previous?.direction);
    if (direction !== -1 && direction !== 1) {
        direction = 1;
    }

    if (parameter === "angle") {
        direction = 1;
    } else {
        const current = Number(warmupControlValue(parameter));
        if (current >= limits.max) {
            direction = -1;
        } else if (current <= limits.min) {
            direction = 1;
        }
    }

    warmupAnimations[parameter] = {
        ...(previous || {}),
        running: true,
        source: "website",
        direction,
        position: Number(warmupControlValue(parameter)),
        speed: warmupWebsiteAnimationSpeed(
            parameter,
            limits.min,
            limits.max
        ),
        min: limits.min,
        max: limits.max,
        slider,
        button
    };

    /* A native Play click is treated as a request to animate this same native
       slider, but the private Desmos clock is stopped immediately. Otherwise
       H1/H2 would advance between JavaScript root snapshots and recreate the
       one-step error the user observed. */
    warmup3D?.setExpression({
        id: warmupDesmosExpressionId(parameter),
        latex: warmupNativeExpressionLatex(parameter),
        sliderBounds: warmupNativeSliderBounds(parameter),
        playing: false
    });

    clearWarmupGlobalPauseState();
    setWarmupAnimationButtonRunning(parameter, true);
    warmupMasterAnimationLastCommitTime = 0;
    warmupEnsureMasterAnimationFrame();
}

function warmupMarkNativePlaybackStopped(parameter) {
    const state = warmupAnimations[parameter];

    if (!state || state.source !== "desmos") {
        return;
    }

    state.running = false;
    setWarmupAnimationButtonRunning(parameter, false);

    const finalValue = warmupNativeHelperValue(parameter);

    if (Number.isFinite(finalValue)) {
        warmupSetFromNativeParameterValue(
            parameter,
            warmupClampNativePlaybackValue(parameter, finalValue)
        );
        warmup3D?.setExpression({
            id: warmupDesmosExpressionId(parameter),
            latex: warmupNativeExpressionLatex(parameter),
            sliderBounds: warmupNativeSliderBounds(parameter),
            playing: false
        });
        syncWarmupControlValues();
        updateWarmupParameters({
            changedParameter: parameter,
            skipWarmup3DParameters: true,
            guardViewport: false,
            updateIntersections: true
        });
    }
}

function scheduleWarmupNativeParameterValue(parameter, value) {
    if (!Number.isFinite(value)) {
        return;
    }

    warmupPendingNativeParameterValues.set(parameter, value);

    if (warmupNativeParameterSyncFrame !== null) {
        return;
    }

    /* HelperExpression callbacks from one Desmos update are normally emitted
       in the same JavaScript turn.  A microtask coalesces them without the
       extra full-frame delay of requestAnimationFrame, so snapshot geometry
       is committed before the next paint rather than visibly one step later. */
    const generation = ++warmupNativeParameterSyncGeneration;
    warmupNativeParameterSyncFrame = generation;

    const flush = () => {
        if (
            warmupNativeParameterSyncFrame !== generation
            || !warmup3D
        ) {
            return;
        }

        warmupNativeParameterSyncFrame = null;

        const pending = new Map(
            warmupPendingNativeParameterValues
        );
        warmupPendingNativeParameterValues.clear();

        /* A parameter is native-owned if it generated this callback or if
           its Desmos slider is actively playing.  Sample every native-owned
           helper together now.  Do not sample unrelated website-owned
           parameters: a delayed programmatic echo must never roll them back. */
        const nativeOwned = new Set(pending.keys());

        ["angle", "p", "q"].forEach(item => {
            const state = warmupAnimations[item];
            if (
                warmupDesmosNativePlaying(item)
                || (state?.running && state.source === "desmos")
            ) {
                nativeOwned.add(item);
            }
        });

        const changed = [];

        nativeOwned.forEach(item => {
            const helperValue = warmupNativeHelperValue(item);
            const fallback = pending.get(item);
            const numeric = Number.isFinite(helperValue)
                ? helperValue
                : fallback;

            if (!Number.isFinite(numeric)) {
                return;
            }

            const nativePlaying = warmupDesmosNativePlaying(item);

            /* During native playback the pedagogical interval is a hard
               invariant.  During an ordinary Desmos drag/edit, however,
               accept the actual finite value and mirror it immediately. */
            const next = nativePlaying
                ? warmupClampNativePlaybackValue(item, numeric)
                : numeric;

            if (
                nativePlaying
                && Math.abs(Number(numeric) - next) > 1e-9
            ) {
                warmupSetFromNativeParameterValue(item, next);
                warmupFreezeNativeParameter(item);
                setWarmupAnimationButtonRunning(item, false);
                changed.push(item);
                return;
            }

            const before = warmupParameters[item];

            if (!warmupSetFromNativeParameterValue(item, next)) {
                return;
            }

            if (
                item === "angle"
                    ? warmupAngleIndex(before) !== warmupAngleIndex(warmupParameters[item])
                    : Math.abs(before - warmupParameters[item]) > 1e-12
            ) {
                changed.push(item);
            }

            const state = warmupAnimations[item];
            const slider = state?.slider
                || document.getElementById(`warmup-range-${item}`);

            if (slider) {
                /* The left track intentionally stays [-6,6] for ordinary
                   interaction.  A typed out-of-range value may sit outside
                   that visual track, exactly as before. */
                slider.value = Math.max(
                    Number(slider.min),
                    Math.min(
                        Number(slider.max),
                        warmupControlValue(item)
                    )
                );
            }

            renderWarmupValueDisplay(item);
        });

        if (changed.length) {
            /* Desmos is the source of these values.  Never echo them back to
               the 3D calculator here; just commit one coherent sampled tuple
               to the snapshot-driven orange line/points and secondary views. */
            updateWarmupParameters({
                changedParameters: changed,
                skipWarmup3DParameters: true,
                guardViewport: false,
                updateIntersections: true
            });
        }
    };

    if (typeof queueMicrotask === "function") {
        queueMicrotask(flush);
    } else {
        Promise.resolve().then(flush);
    }
}

function setupWarmupNativePlaybackStateSync() {
    if (
        !warmup3D
        || warmupNativePlaybackObserverInstalled
        || typeof warmup3D.observeEvent !== "function"
        || typeof warmup3D.getExpressions !== "function"
    ) {
        return;
    }

    warmupNativePlaybackObserverInstalled = true;

    warmup3D.observeEvent("change", () => {
        if (warmupActiveAnimationCount() === 0) {
            scheduleWarmup3DLineBoundsCheck();
        }

        /* Detect ownership transfer immediately.  In particular, if the
           user presses Desmos Play while our left control is already moving,
           this runs before the next website animation frame can write
           playing:false and accidentally cancel the user's click. */
        ["angle", "p", "q"].forEach(parameter => {
            const playing =
                warmupDesmosNativePlaying(parameter);
            const state = warmupAnimations[parameter];

            if (playing) {
                if (!state?.running || state.source !== "desmos") {
                    warmupAdoptNativePlayback(parameter);
                }
                return;
            }

            if (state?.running && state.source === "desmos") {
                warmupMarkNativePlaybackStopped(parameter);
            }
        });
    });
}

function setupWarmupDesmosParameterSync() {
    if (!warmup3D) {
        return;
    }

    warmupAlphaHelper =
        warmup3D.HelperExpression({
            latex: String.raw`\alpha`
        });

    warmupPHelper =
        warmup3D.HelperExpression({
            latex: "p"
        });

    warmupQHelper =
        warmup3D.HelperExpression({
            latex: "q"
        });

    const connect = (helper, parameter) => {
        helper.observe(
            "numericValue",
            () => {
                const immediate = Number(helper.numericValue);

                if (!Number.isFinite(immediate)) {
                    return;
                }

                const nativePlaying = warmupDesmosNativePlaying(parameter);

                /* Native playback and manual Desmos dragging are both the
                   same underlying parameter.  The left control is therefore
                   only a mirror/remote-control surface, never a second value. */
                if (nativePlaying) {
                    const liveState = warmupAnimations[parameter];

                    if (
                        !liveState?.running
                        || liveState.source !== "desmos"
                    ) {
                        warmupAdoptNativePlayback(parameter);
                    }

                    scheduleWarmupNativeParameterValue(
                        parameter,
                        immediate
                    );
                    return;
                }

                const state = warmupAnimations[parameter];

                if (state?.running && state.source === "desmos") {
                    warmupMarkNativePlaybackStopped(parameter);
                }

                clearWarmupHelperSyncTimer(parameter);

                /* Ignore only values that we ourselves just wrote into
                   Desmos.  A genuine user drag in the Desmos drawer must be
                   mirrored even when Global Stop/Continue is in paused mode. */
                if (
                    warmupIsRecentProgrammaticParameterEcho(
                        parameter,
                        immediate
                    )
                    || Math.abs(
                        immediate - warmupParameters[parameter]
                    ) < 1e-10
                ) {
                    return;
                }

                scheduleWarmupNativeParameterValue(
                    parameter,
                    immediate
                );
            }
        );
    };

    connect(warmupAlphaHelper, "angle");
    connect(warmupPHelper, "p");
    connect(warmupQHelper, "q");
}


/* ============================================================
   WARM-UP PARAMETER SYNCHRONIZATION
   ============================================================ */

/*
   Important: the visible intersection points are computed here in
   ordinary JavaScript, not by reading Desmos' private POI cache.

   The old version read
       solver2D._calc.grapher.graphSketches["root-graph"]...
   immediately after changing the angle,p,q.  Desmos updates those POIs
   asynchronously, so the roots could still belong to the previous
   parameter values.  Mapping those stale t-values with the new
   the new parameters is exactly what caused points to leave the surface, freeze,
   or appear only after another interaction.

   Since H1 ∩ H2 is a line, restricting an arbitrary polynomial f of
   degree d to that line gives a one-variable polynomial of degree at
   most d.  Ordinary work is still solved synchronously from one frozen
   snapshot.  When the same algebra would be expensive, v10 sends the
   compact syntax tree to a cancellable Worker and never trusts Desmos'
   asynchronous POI cache or a stale parameter tuple.
*/

function warmupExactEighthTurnTrig(index) {
    /*
       The visible Desmos equations are symbolic, so at alpha = ±pi/4
       Desmos has cos(alpha)=sin(alpha) exactly.  Math.cos/Math.sin do
       not return bit-identical values there, which used to leave tiny
       coordinates such as -4.44e-16 in the JavaScript intersection
       points.  Use the same floating value for both occurrences at all
       multiples of pi/4 so the cancellations are exact in JavaScript too.
    */
    const eighthTurnStep =
        WARMUP_ANGLE_STEPS_PER_PI / 4;

    if (
        !Number.isInteger(eighthTurnStep)
        || index % eighthTurnStep !== 0
    ) {
        return null;
    }

    const eighthTurn =
        index / eighthTurnStep;

    const normalized =
        ((eighthTurn % 8) + 8) % 8;

    const h = Math.SQRT1_2;

    const exactValues = [
        [1, 0],
        [h, h],
        [0, 1],
        [-h, h],
        [-1, 0],
        [-h, -h],
        [0, -1],
        [h, -h]
    ];

    const [cosine, sine] =
        exactValues[normalized];

    return {
        cosine,
        sine
    };
}

function warmupTrig(angleCoefficient) {
    const index =
        warmupAngleIndex(angleCoefficient);

    /* At every multiple of pi/4 use one shared exact floating value
       for the algebraically equal quantities.  For example at pi/4,
       sin(alpha) and cos(alpha) are literally the same JS number, so
       cancellations such as c*(t-p)-s*(t-p) evaluate to exactly 0.
       No tolerance-based coordinate cleanup is needed. */
    const exactEighthTurn =
        warmupExactEighthTurnTrig(index);

    if (exactEighthTurn) {
        return exactEighthTurn;
    }

    const alpha =
        index * Math.PI
        / WARMUP_ANGLE_STEPS_PER_PI;

    return {
        cosine: Math.cos(alpha),
        sine: Math.sin(alpha)
    };
}

function warmupNormalizeExactZero(value) {
    return Object.is(value, -0)
        ? 0
        : value;
}

function warmupLinePoint(
    t,
    angleCoefficient,
    p,
    q
) {
    const {
        cosine: c,
        sine: r
    } = warmupTrig(
        angleCoefficient
    );

    const x =
        r * p + c * q
        - (r + c) * t;

    const y =
        -c * p + r * q
        + (c - r) * t;

    return [
        warmupNormalizeExactZero(x),
        warmupNormalizeExactZero(y),
        warmupNormalizeExactZero(t)
    ];
}

function warmupPurplePlanePoint(
    t,
    angleCoefficient,
    p,
    q
) {
    const [x, y] = warmupLinePoint(
        t,
        angleCoefficient,
        p,
        q
    );

    return [x, y];
}

function warmupBluePlanePoint(
    t,
    angleCoefficient,
    p,
    q
) {
    const [x, y] = warmupLinePoint(
        t,
        angleCoefficient,
        p,
        q
    );

    return [x, y];
}


function warmupMultiplyUnivariate(left, right) {
    const product =
        Array(
            left.length + right.length - 1
        ).fill(0);

    left.forEach((leftValue, i) => {
        right.forEach((rightValue, j) => {
            product[i + j] +=
                leftValue * rightValue;
        });
    });

    return product;
}

function warmupLinearPower(linear, exponent) {
    let result = [1];

    for (let power = 0; power < exponent; power += 1) {
        const next = Array(result.length + 1).fill(0);
        for (let index = 0; index < result.length; index += 1) {
            next[index] += result[index] * linear[0];
            next[index + 1] += result[index] * linear[1];
        }
        result = next;
    }

    return result;
}

/* Fast-lane restriction builder.  v4.83 cached every intermediate power
   1,x(t),...,x(t)^d and likewise for y, which has O(d^2) memory.  v10
   computes only the two powers needed by the current monomial and discards
   them immediately after accumulation.  Peak storage is therefore O(d).
   Large/complex surfaces never enter this synchronous lane at all; they use
   the cancellable compact-AST Worker below. */
function warmupRestrictedSurfacePolynomial(
    angleCoefficient,
    p,
    q
) {
    if (!Array.isArray(warmupSurface.terms)) {
        throw new WarmupResourceLimitError(
            "This surface is kept compact and must be solved in the background worker."
        );
    }

    const {
        cosine: c,
        sine: r
    } = warmupTrig(angleCoefficient);

    const x = [
        r * p + c * q,
        -(r + c)
    ];

    const y = [
        -c * p + r * q,
        c - r
    ];

    const result = Array(warmupSurface.degree + 1).fill(0);
    const resultCompensation = Array(warmupSurface.degree + 1).fill(0);
    const resultScale = Array(warmupSurface.degree + 1).fill(0);

    warmupSurface.terms.forEach(({
        coefficient,
        a,
        b,
        c: zExponent
    }) => {
        const xPower = warmupLinearPower(x, a);
        const yPower = warmupLinearPower(y, b);
        const xyTerm = warmupMultiplyUnivariate(xPower, yPower);

        for (let index = 0; index < xyTerm.length; index += 1) {
            const target = index + zExponent;
            const contribution = coefficient * xyTerm[index];
            const corrected = contribution - resultCompensation[target];
            const next = result[target] + corrected;

            resultCompensation[target] =
                (next - result[target]) - corrected;
            result[target] = next;
            resultScale[target] += Math.abs(contribution);
        }
    });

    const coefficientIsNumericalZero = index => {
        const value = Math.abs(result[index]);
        const scale = resultScale[index];

        if (value === 0) return true;

        return value <=
            256 * Number.EPSILON
            * Math.max(Number.MIN_VALUE, scale);
    };

    let last = result.length - 1;
    while (last >= 0 && coefficientIsNumericalZero(last)) {
        last -= 1;
    }

    if (last < 0) {
        return {
            coefficients: [],
            degree: -1,
            lineContained: true,
            zeroTolerance: 0
        };
    }

    return {
        coefficients: result.slice(0, last + 1),
        degree: last,
        lineContained: false,
        zeroTolerance: 0
    };
}


function warmupUniqueRealRoots(values) {
    const sorted = values
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    const unique = [];

    sorted.forEach(value => {
        const previous = unique.at(-1);
        const tolerance =
            1e-7 * Math.max(1, Math.abs(value));

        if (
            previous === undefined
            || Math.abs(value - previous) > tolerance
        ) {
            unique.push(value);
        }
    });

    return unique;
}

function warmupPolynomialValueAndScale1D(
    coefficients,
    x
) {
    let value = 0;
    let scale = 0;
    const absoluteX = Math.abs(x);

    for (
        let index = coefficients.length - 1;
        index >= 0;
        index -= 1
    ) {
        value = value * x + coefficients[index];
        scale =
            scale * absoluteX
            + Math.abs(coefficients[index]);
    }

    return {
        value,
        scale
    };
}

function warmupTrimUnivariateCoefficients(
    coefficients,
    zeroTolerance = 0
) {
    const result = [...coefficients];

    while (
        result.length > 0
        && Math.abs(result.at(-1)) <= zeroTolerance
    ) {
        result.pop();
    }

    return result;
}

/*
   A shifted high power is the hostile case for the old real-root solver.
   For example, (t+2)^30 has perfectly modest roots, but its middle
   coefficients are ~10^13.  The old Cauchy radius

       1 + max |a_i/a_n|

   therefore asked Horner evaluation to inspect |t| ~ 10^13.  Raising that
   scale to degree 30--45 overflows Number to Infinity, after which every
   sign-isolation interval is discarded and the point list can become [].

   Fujiwara's bound keeps the exponent that Cauchy's bound throws away:

       |root| <= 2 max_i |a_i/a_n|^(1/(n-i)).

   We compute it in log space so neither a huge coefficient ratio nor a tiny
   leading coefficient needs to overflow merely while forming the bound.
*/
function warmupFujiwaraRootBound(coefficients) {
    const degree = coefficients.length - 1;

    if (degree < 1) {
        return 0;
    }

    const leading = Math.abs(coefficients[degree]);

    if (!Number.isFinite(leading) || leading === 0) {
        return NaN;
    }

    const logLeading = Math.log(leading);
    let maxLogRootScale = -Infinity;

    for (let index = 0; index < degree; index += 1) {
        const absolute = Math.abs(coefficients[index]);

        if (absolute === 0) {
            continue;
        }

        if (!Number.isFinite(absolute)) {
            return NaN;
        }

        const candidate =
            (Math.log(absolute) - logLeading)
            / (degree - index);

        if (candidate > maxLogRootScale) {
            maxLogRootScale = candidate;
        }
    }

    if (maxLogRootScale === -Infinity) {
        return 1;
    }

    const maxLogNumber = Math.log(Number.MAX_VALUE);

    if (maxLogRootScale >= maxLogNumber - Math.log(2)) {
        return Number.MAX_VALUE;
    }

    const bound = 2 * Math.exp(maxLogRootScale);

    if (!Number.isFinite(bound) || bound <= 0) {
        return NaN;
    }

    /* Never make the scaled coordinate larger than the original one when all
       roots already lie in the unit interval.  The tiny safety factor keeps
       a root whose theoretical bound is attained away from u=+-1 exactly. */
    return Math.max(1, bound) * (1 + 32 * Number.EPSILON);
}

/* Build q(u)=p(Ru)/(a_n R^n).  Its leading coefficient is exactly 1 and,
   with R chosen by Fujiwara, every real root of p is in -1 <= u <= 1.
   Forming the coefficients from logarithms avoids both R^n overflow and the
   catastrophic huge-radius evaluations that caused the disappearing points.
*/
function warmupScalePolynomialToUnitRootInterval(
    coefficients,
    radius
) {
    const degree = coefficients.length - 1;
    const leading = coefficients[degree];
    const logRadius = Math.log(radius);
    const logLeading = Math.log(Math.abs(leading));
    const leadingSign = Math.sign(leading) || 1;
    const scaled = Array(degree + 1).fill(0);

    scaled[degree] = 1;

    for (let index = 0; index < degree; index += 1) {
        const coefficient = coefficients[index];

        if (coefficient === 0) {
            continue;
        }

        const logMagnitude =
            Math.log(Math.abs(coefficient))
            - logLeading
            - (degree - index) * logRadius;

        /* Values this far below the leading scale cannot affect a double-
           precision sign decision on [-1,1].  Let them underflow to zero
           explicitly rather than manufacture a subnormal tail. */
        if (logMagnitude < Math.log(Number.MIN_VALUE)) {
            scaled[index] = 0;
            continue;
        }

        const magnitude = Math.exp(logMagnitude);
        scaled[index] =
            Math.sign(coefficient)
            * leadingSign
            * magnitude;
    }

    return scaled;
}

function warmupPolynomialDerivative(coefficients) {
    return coefficients
        .slice(1)
        .map((coefficient, index) =>
            coefficient * (index + 1)
        );
}

function warmupRootResidualAccepted(
    coefficients,
    x,
    multiplier = 64
) {
    const {
        value,
        scale
    } = warmupPolynomialValueAndScale1D(
        coefficients,
        x
    );

    if (!Number.isFinite(value) || !Number.isFinite(scale)) {
        return false;
    }

    if (value === 0) {
        return true;
    }

    const tolerance =
        multiplier
        * Number.EPSILON
        * Math.max(Number.MIN_VALUE, scale)
        * Math.max(1, coefficients.length);

    return Math.abs(value) <= tolerance;
}

function warmupPolishPolynomialRoot(
    coefficients,
    derivative,
    initial,
    min = -1,
    max = 1
) {
    let x = initial;

    for (let iteration = 0; iteration < 10; iteration += 1) {
        const value =
            warmupPolynomialValueAndScale1D(
                coefficients,
                x
            ).value;

        const derivativeEvaluation =
            warmupPolynomialValueAndScale1D(
                derivative,
                x
            );
        const derivativeValue = derivativeEvaluation.value;

        if (
            !Number.isFinite(value)
            || !Number.isFinite(derivativeValue)
            || Math.abs(derivativeValue) <=
                128 * Number.EPSILON
                * Math.max(Number.MIN_VALUE, derivativeEvaluation.scale)
        ) {
            break;
        }

        const next = x - value / derivativeValue;

        if (
            !Number.isFinite(next)
            || next < min
            || next > max
        ) {
            break;
        }

        x = next;
    }

    return x;
}

/*
   Isolate all real roots of a polynomial whose complex roots are known to
   lie in the closed unit disk.  Rolle's theorem gives the recursion: between
   consecutive real roots of p' the polynomial p is monotone, hence has at
   most one sign-changing root.  Real critical points are also tested
   directly so even-multiplicity roots are retained.

   The important difference from the previous implementation is that this
   recursion never invents a new enormous search radius at each derivative.
   Every level stays on [-1,1], where Horner evaluation remains finite.
*/
function warmupRealRootsOnUnitInterval(coefficients) {
    const degree = coefficients.length - 1;

    if (degree < 1) {
        return [];
    }

    if (degree === 1) {
        const root = -coefficients[0] / coefficients[1];
        const edgeTolerance = 256 * Number.EPSILON;

        return (
            Number.isFinite(root)
            && root >= -1 - edgeTolerance
            && root <= 1 + edgeTolerance
        )
            ? [Math.max(-1, Math.min(1, root))]
            : [];
    }

    const derivative =
        warmupPolynomialDerivative(coefficients);

    const criticalRoots =
        warmupUniqueRealRoots(
            warmupRealRootsOnUnitInterval(derivative)
        )
            .filter(root => root > -1 && root < 1);

    const roots = [];

    /* A repeated root of p is a root of p'.  The derivative recursion gives
       its location directly, so test all critical points before looking for
       sign changes. */
    criticalRoots.forEach(root => {
        const polished = warmupPolishPolynomialRoot(
            coefficients,
            derivative,
            root
        );

        if (
            warmupRootResidualAccepted(
                coefficients,
                polished,
                4096
            )
        ) {
            roots.push(polished);
        }
    });

    const boundaries = [
        -1,
        ...criticalRoots,
        1
    ];

    /* Roots can lie exactly at the enclosing bound. */
    [-1, 1].forEach(edge => {
        if (
            warmupRootResidualAccepted(
                coefficients,
                edge,
                4096
            )
        ) {
            roots.push(edge);
        }
    });

    for (
        let interval = 0;
        interval < boundaries.length - 1;
        interval += 1
    ) {
        let left = boundaries[interval];
        let right = boundaries[interval + 1];

        let leftValue =
            warmupPolynomialValueAndScale1D(
                coefficients,
                left
            ).value;

        let rightValue =
            warmupPolynomialValueAndScale1D(
                coefficients,
                right
            ).value;

        if (
            !Number.isFinite(leftValue)
            || !Number.isFinite(rightValue)
            || leftValue === 0
            || rightValue === 0
            || Math.sign(leftValue) === Math.sign(rightValue)
        ) {
            continue;
        }

        for (let iteration = 0; iteration < 80; iteration += 1) {
            const middle = (left + right) / 2;
            const middleValue =
                warmupPolynomialValueAndScale1D(
                    coefficients,
                    middle
                ).value;

            if (!Number.isFinite(middleValue)) {
                break;
            }

            if (
                middleValue === 0
                || Math.abs(right - left)
                    <= 64 * Number.EPSILON
                    * Math.max(1, Math.abs(middle))
            ) {
                left = middle;
                right = middle;
                break;
            }

            if (Math.sign(leftValue) === Math.sign(middleValue)) {
                left = middle;
                leftValue = middleValue;
            } else {
                right = middle;
                rightValue = middleValue;
            }
        }

        const isolated = (left + right) / 2;
        const polished = warmupPolishPolynomialRoot(
            coefficients,
            derivative,
            isolated,
            boundaries[interval],
            boundaries[interval + 1]
        );

        roots.push(polished);
    }

    return warmupUniqueRealRoots(roots);
}

function warmupSignChangeRootsOnUnitInterval(
    coefficients,
    sampleCount
) {
    const roots = [];
    const count = Math.max(64, Math.floor(sampleCount));
    let left = -1;
    let leftEvaluation =
        warmupPolynomialValueAndScale1D(
            coefficients,
            left
        );

    for (let step = 1; step <= count; step += 1) {
        const right = -1 + 2 * step / count;
        const rightEvaluation =
            warmupPolynomialValueAndScale1D(
                coefficients,
                right
            );

        if (
            Number.isFinite(leftEvaluation.value)
            && Number.isFinite(rightEvaluation.value)
        ) {
            if (
                warmupRootResidualAccepted(
                    coefficients,
                    left,
                    4096
                )
            ) {
                roots.push(left);
            }

            if (
                leftEvaluation.value !== 0
                && rightEvaluation.value !== 0
                && Math.sign(leftEvaluation.value)
                    !== Math.sign(rightEvaluation.value)
            ) {
                let a = left;
                let b = right;
                let fa = leftEvaluation.value;

                for (let iteration = 0; iteration < 80; iteration += 1) {
                    const middle = (a + b) / 2;
                    const fm =
                        warmupPolynomialValueAndScale1D(
                            coefficients,
                            middle
                        ).value;

                    if (!Number.isFinite(fm)) {
                        break;
                    }

                    if (
                        fm === 0
                        || Math.abs(b - a)
                            <= 64 * Number.EPSILON
                                * Math.max(1, Math.abs(middle))
                    ) {
                        a = middle;
                        b = middle;
                        break;
                    }

                    if (Math.sign(fa) === Math.sign(fm)) {
                        a = middle;
                        fa = fm;
                    } else {
                        b = middle;
                    }
                }

                roots.push((a + b) / 2);
            }
        }

        left = right;
        leftEvaluation = rightEvaluation;
    }

    if (
        warmupRootResidualAccepted(
            coefficients,
            1,
            4096
        )
    ) {
        roots.push(1);
    }

    return warmupUniqueRealRoots(roots);
}

function warmupRealPolynomialRootsGeneric(
    coefficients,
    zeroTolerance = 1e-12
) {
    const trimmed =
        warmupTrimUnivariateCoefficients(
            coefficients,
            zeroTolerance
        );

    const degree = trimmed.length - 1;

    if (degree < 1) {
        return [];
    }

    if (degree === 1) {
        return [-trimmed[0] / trimmed[1]]
            .filter(Number.isFinite);
    }

    const radius =
        warmupFujiwaraRootBound(trimmed);

    if (!Number.isFinite(radius) || radius <= 0) {
        return [];
    }

    const scaled =
        warmupScalePolynomialToUnitRootInterval(
            trimmed,
            radius
        );

    const rootsRecursive =
        warmupRealRootsOnUnitInterval(scaled);

    /* The derivative recursion handles repeated roots.  Merge a cheap direct
       sign scan as an independent path for simple roots; this also guarantees
       that an odd-degree restriction cannot silently collapse to [] because
       one recursive numerical decision went bad. */
    const rootsScanned =
        warmupSignChangeRootsOnUnitInterval(
            scaled,
            Math.max(256, degree * 24)
        );

    const rootsU =
        warmupUniqueRealRoots([
            ...rootsRecursive,
            ...rootsScanned
        ]);

    const derivativeOriginal =
        warmupPolynomialDerivative(trimmed);

    /* Map back to the original line parameter and do a final Newton polish
       there.  The independent 3D f-residual check still runs afterwards, so
       this solver is never trusted blindly. */
    const rootsT = rootsU.map(rootU => {
        let t = rootU * radius;

        for (let iteration = 0; iteration < 8; iteration += 1) {
            const {
                value,
                scale
            } = warmupPolynomialValueAndScale1D(
                trimmed,
                t
            );

            const derivativeEvaluation =
                warmupPolynomialValueAndScale1D(
                    derivativeOriginal,
                    t
                );
            const derivativeValue = derivativeEvaluation.value;

            if (
                !Number.isFinite(value)
                || !Number.isFinite(scale)
                || !Number.isFinite(derivativeValue)
                || Math.abs(derivativeValue)
                    <= 256 * Number.EPSILON
                    * Math.max(Number.MIN_VALUE, derivativeEvaluation.scale)
            ) {
                break;
            }

            const next = t - value / derivativeValue;

            if (!Number.isFinite(next)) {
                break;
            }

            t = next;
        }

        return t;
    });

    return warmupUniqueRealRoots(rootsT);
}


function warmupParameterExpression(parameter, for3D = false) {
    return warmupParameterExpressionForValue(
        parameter,
        warmupParameters[parameter],
        for3D
    );
}

function warmupParameterExpressionForValue(
    parameter,
    value,
    for3D = false
) {
    if (parameter === "angle") {
        const expression = {
            id: "alpha",
            latex: for3D
                ? warmupAlphaNativeLatex(value)
                : warmupAlphaLatex(value)
        };

        if (for3D) {
            expression.sliderBounds = warmupAnglePlaybackSliderBounds();
            const state = warmupAnimations.angle;
            expression.playing = Boolean(
                state?.running
                && state.source === "desmos"
            );
        }

        return expression;
    }

    const expression = {
        id: parameter,
        latex: `${parameter}=${value}`
    };

    if (for3D) {
        expression.sliderBounds =
            warmupDesmosSliderBounds(value, parameter);
        const state = warmupAnimations[parameter];
        expression.playing = Boolean(
            state?.running
            && state.source === "desmos"
        );
    }

    return expression;
}

function syncWarmupLineConditionIfNeeded(force = false) {
    if (!warmup3D) {
        return;
    }

    const visible3D =
        warmupVisible3DGeometryLatex(
            warmupParameters.angle,
            warmupParameters.p,
            warmupParameters.q
        );

    if (
        !force
        && visible3D.lineCondition
            === warmupLastLineConditionLatex
    ) {
        return;
    }

    warmupLastLineConditionLatex =
        visible3D.lineCondition;

    warmup3D.setExpression({
        id: "line-condition",
        latex: visible3D.lineCondition
    });
}

function updateWarmupParameters(options = {}) {
    if (
        !warmup3D
        || !purple2D
        || !blue2D
    ) {
        return;
    }

    /* Viewport resizing is strictly opt-in.  Geometry updates caused by
       sliders, autoplay, Play/Stop/Continue, Reset, keyboard input, or
       Desmos helper echoes must never move the camera. */
    const guardViewport =
        options.guardViewport === true;
    const updateIntersections =
        options.updateIntersections !== false;
    const syncParameters =
        options.syncParameters !== false;
    const changedParameters = Array.isArray(options.changedParameters)
        ? [...new Set(options.changedParameters)].filter(
            parameter => ["angle", "p", "q"].includes(parameter)
        )
        : (
            ["angle", "p", "q"].includes(options.changedParameter)
                ? [options.changedParameter]
                : []
        );
    const skipWarmup3DParameters =
        Boolean(options.skipWarmup3DParameters);
    const sync2DParameters =
        options.sync2DParameters !== false;
    const syncAll2DParameters =
        Boolean(options.syncAll2DParameters);
    const update2DIntersections =
        options.update2DIntersections !== false;

    /* Freeze one authoritative state for this entire refresh.  In particular,
       the explicit 3D line and the JavaScript intersection roots below must
       never read alpha,p,q at different moments. */
    const snapshot = {
        angle: warmupParameters.angle,
        p: warmupParameters.p,
        q: warmupParameters.q
    };

    const warmup3DBatch = [];

    if (syncParameters) {
        const parameters =
            changedParameters.length
                ? changedParameters
                : ["angle", "p", "q"];

        if (!skipWarmup3DParameters) {
            /* Register every website-originated parameter write, including
               alpha.  Held arrow keys can advance alpha again before Desmos's
               HelperExpression has echoed the preceding value.  Remembering
               those writes prevents a stale echo from stepping the model
               backwards for one frame (the visible angle-only trembling). */
            parameters.forEach(parameter => {
                warmupRememberProgrammaticParameterWrite(
                    parameter,
                    warmupParameters[parameter]
                );
            });

            warmup3DBatch.push(
                ...parameters.map(parameter =>
                    warmupParameterExpression(
                        parameter,
                        true
                    )
                )
            );
        }

        if (sync2DParameters && !update2DIntersections) {
            /* Only use a parameter-only 2D commit when this refresh explicitly
               excludes orange points.  Normal interaction commits alpha,p,q
               together with the corresponding orange points from one frozen
               snapshot in updateWarmupIntersectionPoints(). */
            const parameters2D =
                syncAll2DParameters
                    ? ["angle", "p", "q"]
                    : parameters;
            const visibility =
                warmupVisibilityForMode(currentWarmupMode);

            if (visibility.purpleProjection) {
                purple2D.setExpressions(
                    parameters2D.map(parameter =>
                        warmupParameterExpression(
                            parameter,
                            false
                        )
                    )
                );
            }

            if (visibility.blueProjection) {
                blue2D.setExpressions(
                    parameters2D.map(parameter =>
                        warmupParameterExpression(
                            parameter,
                            false
                        )
                    )
                );
            }
        }
    }

    /* H1, H2, C1 and C2 already depend on alpha,p,q symbolically inside
       Desmos.  The xy-projection condition now has one global formula too,
       so after its initial installation this check is normally a no-op. */
    if (
        !changedParameters.length
        || changedParameters.includes("angle")
    ) {
        syncWarmupLineConditionIfNeeded(false);
    }

    /* Keep the orange 3D line on the same frozen (alpha,p,q) snapshot as
       the point solver.  Its cached z-interval always covers the current
       viewport and is enlarged only when necessary; Desmos clips the excess. */
    const lineLatex = warmupSnapshot3DLineLatex(
        snapshot.angle,
        snapshot.p,
        snapshot.q
    );
    warmupLast3DLineLatex = lineLatex;
    warmup3DBatch.push({
        id: "intersection-line",
        latex: lineLatex
    });

    if (updateIntersections) {
        if (
            warmupSurfaceDraftValid
            && warmupUseSynchronousIntersectionSolver()
        ) {
            /* Fast lane: the compact surface has a small guarded sparse form
               and the actual restriction/root work fits the same-frame budget.
               Preserve the strict snapshot invariant by solving before the
               3D/2D calculator commits. */
            warmupCancelWorkerIntersectionSolve();
            warmupWorkerIntersectionStatus = null;

            updateWarmupIntersectionPoints({
                guardViewport,
                update3D: true,
                update2D: update2DIntersections,
                snapshot,
                defer3DExpressions: warmup3DBatch
            });
        } else if (warmupSurfaceDraftValid) {
            /* Protected lane.  Start a worker only for a genuinely new
               (surface,alpha,p,q) state.  Duplicate UI/helper callbacks for
               the same state leave an accepted result visible and leave an
               identical pending worker alone. */
            const startedNewJob =
                warmupScheduleWorkerIntersectionSolve(snapshot);

            if (startedNewJob) {
                /* A genuinely new geometry snapshot invalidates the previous
                   roots. Clear them once, atomically with the new 2D/3D
                   parameter state. */
                warmupCommit2DSnapshot(snapshot, "[]", "[]");
                warmup3DBatch.push({
                    id: "intersection-points",
                    latex: "[]",
                    color: COLORS.intersection,
                    pointSize: 3,
                    hidden: !warmupVisibilityForMode(currentWarmupMode).points
                });
            }
        } else {
            warmupCancelWorkerIntersectionSolve();
            warmupCommit2DSnapshot(snapshot, "[]", "[]");
            warmup3DBatch.push({
                id: "intersection-points",
                latex: "[]",
                color: COLORS.intersection,
                pointSize: 3
            });
        }
    }

    /* alpha/p/q, L and the accepted 3D orange points are one Desmos
       transaction. H1,H2,C1,C2 depend on those same alpha/p/q rows, so there
       is no intermediate frame in which native geometry has advanced but the
       JavaScript geometry still belongs to the previous state. */
    if (warmup3DBatch.length) {
        warmup3D.setExpressions(warmup3DBatch);
    }
}


/* ============================================================
   WARM-UP INTERSECTION POINTS
   ============================================================ */

/*
   The orange line L is infinite, but the part relevant to this scene is
   the finite segment spanning its real affine intersections with the
   current polynomial surface.  Since x(t), y(t), z(t) are affine along L, the largest
   absolute coordinate on that segment occurs at one of those
   intersection points.

   The guard is deliberately one-way: it reads the *current* Desmos 3D
   bounds and changes them only when the relevant part of L no longer
   fits with the larger of: a one-unit margin, or enough room for the
   outermost relevant point to sit at 61.8% of the viewport radius.  It
   never shrinks the viewport when L later moves inward, and it changes
   axis limits only (not 3D rotation).
*/
function warmup3DRelevantLineExtent(points3D) {
    let extent = 0;

    points3D.forEach(point => {
        point.forEach(coordinate => {
            const numeric = Number(coordinate);

            if (Number.isFinite(numeric)) {
                extent = Math.max(
                    extent,
                    Math.abs(numeric)
                );
            }
        });
    });

    return extent;
}

function warmupFind3DViewportLimits(value, seen = new Set()) {
    if (
        !value
        || typeof value !== "object"
        || seen.has(value)
    ) {
        return null;
    }

    seen.add(value);

    const keys = [
        "xmin",
        "xmax",
        "ymin",
        "ymax",
        "zmin",
        "zmax"
    ];

    if (
        keys.every(key =>
            Number.isFinite(Number(value[key]))
        )
    ) {
        return Object.fromEntries(
            keys.map(key => [
                key,
                Number(value[key])
            ])
        );
    }

    for (const child of Object.values(value)) {
        const limits =
            warmupFind3DViewportLimits(
                child,
                seen
            );

        if (limits) {
            return limits;
        }
    }

    return null;
}

function warmupCurrent3DViewportLimits() {
    if (
        !warmup3D
        || typeof warmup3D.getState !== "function"
    ) {
        return null;
    }

    return warmupFind3DViewportLimits(
        warmup3D.getState()
    );
}

function scheduleWarmup3DLineBoundsCheck() {
    if (warmup3DLineBoundsTimer !== null) {
        clearTimeout(warmup3DLineBoundsTimer);
    }

    /* A camera gesture emits many calculator change events.  Do not call
       setExpression during that gesture: doing so makes Desmos restart its
       adaptive 3D rendering repeatedly.  Check once after the camera settles. */
    warmup3DLineBoundsTimer = setTimeout(() => {
        warmup3DLineBoundsTimer = null;
        syncWarmup3DLineToBoundsIfNeeded();
    }, 180);
}

function syncWarmup3DLineToBoundsIfNeeded() {
    if (!warmup3D) {
        return;
    }

    const limits = warmupCurrent3DViewportLimits();

    if (!limits) {
        return;
    }

    warmupInitialize3DLineBoundsIfNeeded();

    const zMin = Number(limits.zmin);
    const zMax = Number(limits.zmax);

    if (
        !Number.isFinite(zMin)
        || !Number.isFinite(zMax)
        || zMin >= zMax
    ) {
        return;
    }

    /* The existing orange segment already covers the viewport: leave the
       expression untouched.  This is the common case for rotation, zoom-in,
       and small camera changes. */
    if (
        zMin >= warmup3DLineZMin
        && zMax <= warmup3DLineZMax
    ) {
        return;
    }

    /* The viewport escaped the cached segment only because the user zoomed or
       panned farther out.  Extend the cache with 75% headroom, so subsequent
       nearby zoom steps do not trigger another Desmos expression rewrite. */
    const center = (zMin + zMax) / 2;
    const halfSpan = Math.max((zMax - zMin) / 2, 1);
    const paddedHalfSpan = 1.75 * halfSpan;

    warmup3DLineZMin = Math.min(
        warmup3DLineZMin,
        center - paddedHalfSpan
    );
    warmup3DLineZMax = Math.max(
        warmup3DLineZMax,
        center + paddedHalfSpan
    );

    const latex = warmupSnapshot3DLineLatex(
        warmupParameters.angle,
        warmupParameters.p,
        warmupParameters.q
    );

    if (latex === warmupLast3DLineLatex) {
        return;
    }

    warmupLast3DLineLatex = latex;
    warmup3D.setExpression({
        id: "intersection-line",
        latex
    });
}


function warmupCurrent3DBound() {
    const limits =
        warmupCurrent3DViewportLimits();

    if (!limits) {
        return null;
    }

    /* B is the symmetric radius that is actually available on every
       side of every coordinate axis. */
    return Math.min(
        Math.abs(limits.xmin),
        Math.abs(limits.xmax),
        Math.abs(limits.ymin),
        Math.abs(limits.ymax),
        Math.abs(limits.zmin),
        Math.abs(limits.zmax)
    );
}

/* v4.83A: the two projection calculators deliberately keep their own
   2D viewports.  Their implicit C1/C2 equations are unbounded, and 3D
   camera/bounds changes must not rescale or clip those projection views. */

function warmupSet3DBound(bound) {
    const dispatch =
        warmup3D?.controller?.dispatch;

    if (typeof dispatch !== "function") {
        return false;
    }

    const target = Number(bound);

    if (
        !Number.isFinite(target)
        || target <= 0
    ) {
        return false;
    }

    const changes = [
        ["xmin", -target],
        ["xmax", target],
        ["ymin", -target],
        ["ymax", target],
        ["zmin", -target],
        ["zmax", target]
    ];

    const apply = () => {
        changes.forEach(([limit, value]) => {
            dispatch.call(
                warmup3D.controller,
                {
                    type: "set-axis-limit-latex",
                    limit,
                    latex: String(value),
                    updateYZAlso: false
                }
            );
        });
    };

    if (
        typeof warmup3D.withHistoryReplacement
        === "function"
    ) {
        warmup3D.withHistoryReplacement(apply);
    } else {
        apply();
    }

    return true;
}

function guardWarmup3DViewport(points3D) {
    const lineExtent =
        warmup3DRelevantLineExtent(points3D);

    /* Keep the outermost relevant point comfortably inside the cube:
       M should occupy at most 61.8% of the available radius B.
       Retain the earlier one-unit minimum margin as well. */
    const goldenViewportPortion = 0.618;
    const requiredBound = Math.max(
        lineExtent + 1,
        lineExtent / goldenViewportPortion
    );
    const currentBound = warmupCurrent3DBound();

    if (
        !Number.isFinite(currentBound)
        || requiredBound <= currentBound + 1e-9
    ) {
        return;
    }

    warmupSet3DBound(requiredBound);
}

const WARMUP_DEBUG_INTERSECTION_RESIDUALS = false;

function warmupLatexNumber(value) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return String(numeric);
    }

    /* Coordinates produced by high-degree restrictions can legitimately be
       extremely small.  JavaScript then serializes them as e.g. 8e-7, but
       Desmos does not reliably interpret JavaScript scientific notation
       inside a LaTeX point list.  Normalize numerical dust and translate any
       remaining exponent notation into actual Desmos LaTeX. */
    if (Math.abs(numeric) < 1e-12) {
        return "0";
    }

    const compact = Number(numeric.toPrecision(12));

    if (Object.is(compact, -0) || compact === 0) {
        return "0";
    }

    const text = String(compact);
    const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))[eE]([+-]?\d+)$/);

    if (!match) {
        return text;
    }

    const mantissa = match[1];
    const exponent = Number(match[2]);

    return `${mantissa}\\cdot10^{${exponent}}`;
}

function warmupCommitIntersectionRoots(
    roots,
    restriction,
    snapshot,
    options = {}
) {
    if (!warmup3D || !purple2D || !blue2D) return;

    const guardViewport = options.guardViewport === true;
    const update3D = options.update3D !== false;
    const update2D = options.update2D !== false;
    const deferred3DExpressions =
        Array.isArray(options.defer3DExpressions)
            ? options.defer3DExpressions
            : null;

    const { angle, p, q } = snapshot;

    /* A committed root set belongs to this exact authoritative snapshot.
       Remember it before touching the calculators so any synchronous Desmos
       change callbacks caused by the commit recognize the state as already
       resolved instead of clearing and rescheduling it. */
    warmupIntersectionCommittedState =
        warmupIntersectionState(snapshot, warmupSurfaceRevision);
    warmupIntersectionPendingState = null;
    warmupIntersectionFailedState = null;

    const points3D = update3D
        ? roots.map(t => warmupLinePoint(t, angle, p, q))
        : [];
    const purplePoints2D = update2D
        ? roots.map(t => warmupPurplePlanePoint(t, angle, p, q))
        : [];
    const bluePoints2D = update2D
        ? roots.map(t => warmupBluePlanePoint(t, angle, p, q))
        : [];

    if (guardViewport && update3D) {
        guardWarmup3DViewport(points3D);
    }

    if (update3D && WARMUP_DEBUG_INTERSECTION_RESIDUALS) {
        points3D.forEach(([x, y, z]) => {
            const residual = Math.abs(warmupSurfaceValue(x, y, z));
            if (residual > 1e-5) {
                console.warn(
                    "Warm-up intersection residual:",
                    residual,
                    { x, y, z, angle, p, q }
                );
            }
        });
    }

    if (update3D) {
        const noteText = warmupIntersectionNoteText(
            restriction.degree,
            restriction.lineContained
        );

        if (noteText !== warmupLastIntersectionNoteText) {
            warmupLastIntersectionNoteText = noteText;
            const noteExpression = {
                id: "note-points",
                type: "text",
                text: noteText
            };
            if (deferred3DExpressions) {
                deferred3DExpressions.push(noteExpression);
            } else {
                warmup3D.setExpression(noteExpression);
            }
        }
    }

    const latex3D = update3D
        ? `[${points3D.map(([x, y, z]) =>
            `(${warmupLatexNumber(x)},${warmupLatexNumber(y)},${warmupLatexNumber(z)})`
        ).join(",")}]`
        : "[]";

    const purpleLatex2D =
        `[${purplePoints2D.map(([x, y]) =>
            `(${warmupLatexNumber(x)},${warmupLatexNumber(y)})`
        ).join(",")}]`;
    const blueLatex2D =
        `[${bluePoints2D.map(([x, y]) =>
            `(${warmupLatexNumber(x)},${warmupLatexNumber(y)})`
        ).join(",")}]`;

    if (update3D) {
        const pointsHidden =
            !warmupVisibilityForMode(currentWarmupMode).points;
        const expression = {
            id: "intersection-points",
            latex: latex3D,
            color: COLORS.intersection,
            pointSize: 3,
            hidden: pointsHidden
        };
        if (deferred3DExpressions) {
            deferred3DExpressions.push(expression);
        } else {
            warmup3D.setExpression(expression);
        }
    }

    if (update2D) {
        warmupCommit2DSnapshot(
            { angle, p, q },
            purpleLatex2D,
            blueLatex2D
        );
    }
}

function updateWarmupIntersectionPoints(options = {}) {
    if (!warmup3D || !purple2D || !blue2D) return;

    const guardViewport = options.guardViewport === true;
    const update3D = options.update3D !== false;
    const update2D = options.update2D !== false;
    const deferred3DExpressions =
        Array.isArray(options.defer3DExpressions)
            ? options.defer3DExpressions
            : null;

    if (!warmupSurfaceDraftValid) {
        warmupClearIntersectionPointExpressions();
        return;
    }

    warmupWorkerIntersectionStatus = null;

    const snapshot = options.snapshot || {
        angle: warmupParameters.angle,
        p: warmupParameters.p,
        q: warmupParameters.q
    };
    const { angle, p, q } = snapshot;

    const restriction = warmupRestrictedSurfacePolynomial(angle, p, q);
    const rawRoots = restriction.lineContained
        ? []
        : warmupRealPolynomialRootsGeneric(
            restriction.coefficients,
            restriction.zeroTolerance
        );

    const roots = restriction.lineContained
        ? []
        : warmupValidatedIntersectionRoots(
            rawRoots,
            angle,
            p,
            q
        );

    warmupCommitIntersectionRoots(
        roots,
        restriction,
        snapshot,
        {
            guardViewport,
            update3D,
            update2D,
            defer3DExpressions: deferred3DExpressions
        }
    );
}


/* ============================================================
   WARM-UP RIGHT PANEL
   ============================================================ */

function buildWarmupInfo() {
    infoPanel.innerHTML = String.raw`
        <button
            id="proof-panel-toggle"
            class="proof-panel-toggle"
            type="button"
            title="Show proof panel"
            hidden>
            «
        </button>

        <div class="warmup-info proof-info">
            <h2>Degree of a surface</h2>

            <div class="surface-type">
                WARM-UP
            </div>

            <p class="warmup-intro proof-intro">
                Let \(S\subset\mathbb P^3\) be a surface of degree \(d\).
            </p>

            <div class="proof-question">
                <div class="proof-question-title">
                    Why is
                </div>

                \[
                    {\mathcal O}_S(1)^2=d?
                \]
            </div>

            <div class="proof-tabs">
                <button
                    id="restriction-button"
                    class="proof-tab"
                    type="button">
                    Restriction
                </button>

                <button
                    id="bezout-button"
                    class="proof-tab"
                    type="button">
                    Bézout picture
                </button>
            </div>

            <div
                id="restriction-proof"
                class="proof-answer">

                <div class="theorem-name">
                    Explanation by Restriction
                </div>

                <p>
                    Let \(f\) be the homogeneous polynomial defining
                    \(S\). Then \(\deg f=d\) and \(S=V(f)\).
                </p>

                <p>
                    Take two hyperplanes
                    \(H_1,H_2\in|\mathcal O_{\mathbb P^3}(1)|\).
                    Then
                </p>

                \[
                    \begin{aligned}
                    {\mathcal O}_S(1)^2
                    &=(H_1|_S,H_2|_S)_S\\
                    &=V(f)\cap H_1\cap H_2.
                    \end{aligned}
                \]

                <p>
                    Restricting \(f\) to
                    \(H_1\simeq\mathbb P^2\) gives the plane curve
                    \(C_1=S\cap H_1\) of degree \(d\).
                </p>

                <p>
                    Restricting once more to
                    \(H_1\cap H_2\simeq\mathbb P^1\) gives a
                    homogeneous polynomial of degree \(d\), hence
                    \(d\) zeros counted with multiplicity over
                    \(\mathbf C\).<sup>*</sup>
                </p>

                <div class="proof-note">
                    <sup>*</sup>
                    Since the picture is drawn in a real affine chart,
                    fewer than \(d\) intersection points may be visible:
                    some may be non-real, lie at infinity, or occur with
                    multiplicity.
                </div>
            </div>

            <div
                id="bezout-proof"
                class="proof-answer">

                <div class="theorem-name">
                    Explanation by Bézout
                </div>

                <p>
                    We can also visualize the intersection inside
                    <span class="keep-together">\(H_1 \simeq \mathbb P^2\):</span>
                </p>

                \[
                    S\cap H_1\cap H_2
                    =(S\cap H_1)\cap(H_1\cap H_2).
                \]

                <p>
                    The plane curve
                    \(C_1=S\cap H_1\) has degree \(d\).
                </p>

                <p>
                    The intersection \(H_1\cap H_2\) is a line.
                    Hence, by Bézout,
                </p>

                \[
                    C_1\cdot(H_1\cap H_2)=d.
                \]
            </div>

            <div
                id="complete-picture-wrap"
                class="complete-picture-wrap"
                hidden>

                <button
                    id="complete-button"
                    class="complete-picture-button"
                    type="button">
                    Show complete picture
                </button>
            </div>
        </div>
    `;

    typeset(infoPanel);

    document
        .getElementById("restriction-button")
        .addEventListener(
            "click",
            () => setWarmupMode("restriction")
        );

    document
        .getElementById("bezout-button")
        .addEventListener(
            "click",
            () => setWarmupMode("bezout")
        );

    document
        .getElementById("complete-button")
        .addEventListener(
            "click",
            () => {
                if (currentWarmupMode === "complete") {
                    setWarmupMode(
                        currentWarmupProof || "restriction"
                    );
                } else {
                    setWarmupMode("complete");
                }
            }
        );

    document
        .getElementById("proof-panel-toggle")
        .addEventListener(
            "click",
            () => {
                /* A manual proof-panel choice takes precedence over the
                   automatic equation-drawer layout helper. */
                warmupProofAutoCollapsedForDrawer = false;
                setWarmupProofPanelCollapsed(
                    !warmupProofCollapsed
                );
            }
        );
}

function warmupExpressionPanelElement() {
    const root =
        document.getElementById("warmup-calculator");

    if (!root) {
        return null;
    }

    return (
        root.querySelector(".dcg-exppanel")
        || root.querySelector(".dcg-exppanel-outer")
        || root.querySelector(".dcg-expressions")
    );
}

function updateWarmupLayoutForEquationDrawer() {
    const panel = warmupExpressionPanelElement();

    if (!panel) {
        return;
    }

    const drawerWidth =
        panel.getBoundingClientRect().width;

    /* The question panel is useful while the equation drawer is modest.
       Once the user drags the drawer very wide, however, the remaining 3D
       viewport becomes too narrow to read.  Collapse only the proof column;
       the existing « handle remains available.  The absolute threshold is
       intentionally independent of the proof-column width, so collapsing the
       proof cannot immediately trigger an expand/collapse feedback loop. */
    const drawerIsVeryWide = drawerWidth >= 520;

    if (
        drawerIsVeryWide
        && !warmupProofCollapsed
    ) {
        warmupProofAutoCollapsedForDrawer = true;
        setWarmupProofPanelCollapsed(true);
        return;
    }

    if (
        !drawerIsVeryWide
        && warmupProofAutoCollapsedForDrawer
    ) {
        warmupProofAutoCollapsedForDrawer = false;
        setWarmupProofPanelCollapsed(false);
    }
}

function observeWarmupExpressionPanelIfPresent() {
    const panel = warmupExpressionPanelElement();

    if (
        !panel
        || panel === warmupObservedExpressionPanel
    ) {
        return;
    }

    warmupEquationDrawerResizeObserver?.disconnect();
    warmupObservedExpressionPanel = panel;

    warmupEquationDrawerResizeObserver =
        new ResizeObserver(() => {
            updateWarmupLayoutForEquationDrawer();
        });

    warmupEquationDrawerResizeObserver.observe(panel);
    updateWarmupLayoutForEquationDrawer();
}

function setupWarmupEquationDrawerLayoutObserver() {
    const root =
        document.getElementById("warmup-calculator");

    if (!root) {
        return;
    }

    observeWarmupExpressionPanelIfPresent();

    warmupEquationDrawerMutationObserver?.disconnect();
    warmupEquationDrawerMutationObserver =
        new MutationObserver(() => {
            observeWarmupExpressionPanelIfPresent();
        });

    warmupEquationDrawerMutationObserver.observe(
        root,
        { childList: true, subtree: true }
    );
}

function resizeWarmupCalculators() {
    requestAnimationFrame(() => {
        warmup3D?.resize?.();
        purple2D?.resize?.();
        blue2D?.resize?.();
    });
}

function setWarmupProofPanelCollapsed(collapsed) {
    warmupProofCollapsed = collapsed;

    const toggle =
        document.getElementById(
            "proof-panel-toggle"
        );

    appShell?.classList.toggle(
        "warmup-proof-collapsed",
        collapsed
    );

    rightPanel?.classList.toggle(
        "warmup-proof-collapsed",
        collapsed
    );

    if (toggle) {
        toggle.textContent =
            collapsed ? "«" : "»";

        toggle.title =
            collapsed
                ? "Show proof panel"
                : "Hide proof panel";
    }

    requestAnimationFrame(() => {
        /* In a horizontally scrollable workspace, the collapsed
           complete-picture layout should begin with the 3D scene,
           not with a previously viewed part of the question column. */
        if (collapsed) {
            workspaceScroll?.scrollTo?.({
                left: 0,
                behavior: "auto"
            });
        }

        enforceWarmupEquationPanelAvailability({
            /* When the user reopens the question/proof column and that
               leaves too little room for the Desmos expression drawer,
               collapse the drawer but preserve Desmos's native » handle.
               This makes the equation panel immediately reopenable. */
            keepReopenHandleWhenClosing: !collapsed
        });
    });

    setTimeout(() => {
        positionWarmupProjectionCards();
        resizeWarmupCalculators();
        enforceWarmupEquationPanelAvailability({
            keepReopenHandleWhenClosing: !collapsed
        });
    }, 230);
}

/* ============================================================
   WARM-UP MODES
   ============================================================ */

function updateWarmupLegend(mode) {
    const sceneLabels =
        document.getElementById("scene-labels");

    if (!sceneLabels) {
        return;
    }

    const purpleLabel =
        document.getElementById(
            "purple-section-scene-label"
        );

    const blueRow =
        document.getElementById(
            "blue-section-scene-row"
        );

    const blueLabel =
        document.getElementById(
            "blue-section-scene-label"
        );

    const lineLabel =
        document.getElementById(
            "intersection-line-scene-label"
        );

    const pointsLabel =
        document.getElementById(
            "intersection-points-scene-label"
        );

    if (
        window.MathJax
        && MathJax.typesetClear
    ) {
        MathJax.typesetClear([
            sceneLabels
        ]);
    }

    if (purpleLabel) {
        purpleLabel.innerHTML =
            "\\(C_1=S\\cap H_1\\)";
    }

    if (blueLabel) {
        blueLabel.innerHTML =
            "\\(C_2=S\\cap H_2\\)";
    }

    if (lineLabel) {
        lineLabel.innerHTML =
            "\\(H_1\\cap H_2\\)";
    }

    if (pointsLabel) {
        pointsLabel.innerHTML =
            mode === "bezout"
                ? "\\(C_1\\cap(H_1\\cap H_2)\\)"
                : "\\(S\\cap H_1\\cap H_2\\)";
    }

    const state =
        warmupVisibilityForMode(mode);

    sceneLabels
        .querySelectorAll("[data-geometry-key]")
        .forEach(row => {
            const key =
                row.dataset.geometryKey;

            row.hidden =
                key in state
                    ? !state[key]
                    : false;
        });

    typeset(sceneLabels);
}


function setWarmupMode(mode) {
    currentWarmupMode = mode;

    if (
        mode === "restriction"
        || mode === "bezout"
    ) {
        currentWarmupProof = mode;
    }

    const restriction =
        mode === "restriction";

    const bezout =
        mode === "bezout";

    const complete =
        mode === "complete";

    const restrictionButton =
        document.getElementById(
            "restriction-button"
        );

    const bezoutButton =
        document.getElementById(
            "bezout-button"
        );

    const completeButton =
        document.getElementById(
            "complete-button"
        );

    const completeWrap =
        document.getElementById(
            "complete-picture-wrap"
        );

    const sceneLabels =
        document.getElementById(
            "scene-labels"
        );

    const completeToggle =
        document.getElementById(
            "complete-controls-toggle"
        );

    const completePanel =
        document.getElementById(
            "complete-controls-panel"
        );

    const proofPanelToggle =
        document.getElementById(
            "proof-panel-toggle"
        );

    restrictionButton
        ?.classList.toggle(
            "active",
            currentWarmupProof === "restriction"
        );

    bezoutButton
        ?.classList.toggle(
            "active",
            currentWarmupProof === "bezout"
        );

    completeButton
        ?.classList.toggle(
            "active",
            complete
        );

    if (completeButton) {
        completeButton.textContent =
            complete
                ? "Return to proof picture"
                : "Show complete picture";
    }

    /* The explanations appear only after their own button is
       pressed.  Complete picture preserves the chosen proof. */
    document
        .getElementById("restriction-proof")
        ?.classList.toggle(
            "active",
            currentWarmupProof === "restriction"
        );

    document
        .getElementById("bezout-proof")
        ?.classList.toggle(
            "active",
            currentWarmupProof === "bezout"
        );

    if (completeWrap) {
        completeWrap.hidden =
            currentWarmupProof === null;
    }

    /* --------------------------------------------------------
       COMPLETE-PICTURE UI
       -------------------------------------------------------- */

    if (complete) {
        /* Complete picture has no floating legend, so open Geometry. */
        warmupCompleteControlsExpanded = true;
    }

    if (completeToggle) {
        completeToggle.hidden = false;
    }

    syncWarmupLegendPanel();

    appShell?.classList.toggle(
        "complete-picture-layout",
        complete
    );

    rightPanel?.classList.toggle(
        "complete-picture-mode",
        complete
    );

    if (proofPanelToggle) {
        proofPanelToggle.hidden =
            !complete;
    }

    if (complete) {
        /* Enter complete picture with the proof column tucked away. */
        setWarmupProofPanelCollapsed(true);
    } else {
        setWarmupProofPanelCollapsed(false);
    }

    /* --------------------------------------------------------
       VISUALIZATION

       intro/restriction : no 2D cards, no blue section
       Bézout            : purple 2D only, no blue section
       complete          : full picture, controlled from the left
       -------------------------------------------------------- */

    applyWarmupVisibility(mode);

    syncWarmupGeometryPanel(mode);
    updateWarmupLegend(mode);

    requestAnimationFrame(() => {
        positionWarmupProjectionCards();
        resizeWarmupCalculators();
    });
}

/* ============================================================
   RESPONSIVE POSITIONS FOR THE 2D CARDS

   The cards follow the visible 3D picture rather than the browser
   edges or a fixed centre offset.  We model the 3D picture as the
   largest centred square that fits inside the actual Desmos stage.
   In the complete picture, the purple card sits just outside the left
   edge of that square and the blue card just outside the right edge.

   When the proof panel makes the stage too narrow, those ideal
   positions are clamped to the stage edges.  This gives the compact
   layout when the proof is open, but moves the cards farther outward
   when the proof is closed so they do not crowd the 3D surface.

   A hand-dragged card stores its displacement from this responsive
   default anchor.  Thus a user adjustment survives later stage
   resizes without reverting to the old centre-offset problem.
   ============================================================ */

function scheduleWarmupProjectionLayout() {
    if (!warmup3D) {
        return;
    }

    if (warmupProjectionLayoutFrame !== null) {
        return;
    }

    warmupProjectionLayoutFrame =
        requestAnimationFrame(() => {
            warmupProjectionLayoutFrame = null;
            positionWarmupProjectionCards();
            resizeWarmupCalculators();
        });
}

function setupWarmupProjectionStageObserver() {
    if (warmupProjectionResizeObserver) {
        warmupProjectionResizeObserver.disconnect();
        warmupProjectionResizeObserver = null;
    }

    const overlay =
        document.getElementById(
            "graph-overlay"
        );

    if (
        !overlay
        || typeof ResizeObserver === "undefined"
    ) {
        return;
    }

    warmupProjectionResizeObserver =
        new ResizeObserver(() => {
            scheduleWarmupProjectionLayout();
        });

    /* The overlay has exactly the same box as the 3D viewport.  During
       the proof-panel grid animation its size changes on several
       frames; observing it is more reliable than guessing a timeout. */
    warmupProjectionResizeObserver.observe(
        overlay
    );
}

function positionWarmupProjectionCards() {
    const overlay =
        document.getElementById(
            "graph-overlay"
        );

    const purpleCard =
        document.getElementById(
            "purple-card"
        );

    const blueCard =
        document.getElementById(
            "blue-card"
        );

    const sceneLabels =
        document.getElementById(
            "scene-labels"
        );

    if (
        !overlay
        || !purpleCard
        || !blueCard
    ) {
        return;
    }

    const width =
        overlay.clientWidth;

    const height =
        overlay.clientHeight;

    if (!width || !height) {
        return;
    }

    /* Integer pixel dimensions plus calculator.resize() avoid
       the slightly soft canvas produced by fractional CSS sizes. */
    const cardSize =
        Math.round(
            Math.max(
                170,
                Math.min(
                    230,
                    Math.min(
                        width * 0.22,
                        height * 0.28
                    )
                )
            )
        );

    [purpleCard, blueCard]
        .forEach(card => {
            card.style.width =
                `${cardSize}px`;
            card.style.height =
                `${cardSize}px`;
        });

    const wide =
        width >= height;

    const centerX = width / 2;
    const centerY = height / 2;
    const halfCard = cardSize / 2;

    const stageMargin = 18;

    function clampedPosition(
        left,
        top
    ) {
        return {
            left: Math.max(
                stageMargin,
                Math.min(
                    left,
                    Math.max(
                        stageMargin,
                        width
                        - cardSize
                        - stageMargin
                    )
                )
            ),
            top: Math.max(
                stageMargin,
                Math.min(
                    top,
                    Math.max(
                        stageMargin,
                        height
                        - cardSize
                        - stageMargin
                    )
                )
            )
        };
    }

    function place(
        card,
        defaultLeft,
        defaultTop
    ) {
        /* Store the *effective* responsive anchor after clamping.  A
           manual drag is measured from this point, not from a raw
           off-screen ideal position. */
        const base =
            clampedPosition(
                defaultLeft,
                defaultTop
            );

        card.dataset.layoutDefaultLeft =
            String(base.left);
        card.dataset.layoutDefaultTop =
            String(base.top);

        let left = base.left;
        let top = base.top;

        if (
            card.dataset.userMoved
            === "true"
        ) {
            const deltaX = Number(
                card.dataset.anchorDeltaX
            );

            const deltaY = Number(
                card.dataset.anchorDeltaY
            );

            if (Number.isFinite(deltaX)) {
                left += deltaX;
            }

            if (Number.isFinite(deltaY)) {
                top += deltaY;
            }
        }

        const clamped =
            clampedPosition(
                left,
                top
            );

        card.style.left =
            `${Math.round(clamped.left)}px`;
        card.style.right = "auto";
        card.style.top =
            `${Math.round(clamped.top)}px`;
    }

    if (
        currentWarmupMode === "complete"
        && wide
    ) {
        /* Approximate the rendered 3D scene by the largest centred
           square inside the stage.  Put each 2D card fully outside
           that square with a small visual gap.  If there is not enough
           side gutter (proof panel open), clamping naturally moves the
           cards to the stage edges instead. */
        const sceneHalf =
            Math.min(width, height) / 2;

        const sceneGap = 14;

        const top =
            centerY - halfCard;

        place(
            purpleCard,
            centerX
            - sceneHalf
            - sceneGap
            - cardSize,
            top
        );

        place(
            blueCard,
            centerX
            + sceneHalf
            + sceneGap,
            top
        );
    } else if (wide) {
        const top =
            Math.max(
                stageMargin,
                (height - cardSize) / 2
            );

        /* Preserve the earlier layout outside the complete picture. */
        place(
            purpleCard,
            stageMargin,
            top
        );

        place(
            blueCard,
            width
            - cardSize
            - stageMargin,
            top
        );
    } else {
        const overlayRect =
            overlay.getBoundingClientRect();

        let legendRight = stageMargin;

        if (
            sceneLabels
            && !sceneLabels.classList.contains(
                "complete-hidden"
            )
        ) {
            const legendRect =
                sceneLabels.getBoundingClientRect();

            legendRight =
                legendRect.right
                - overlayRect.left
                + 16;
        }

        let purpleLeft =
            Math.max(
                stageMargin,
                legendRight
            );

        const blueLeft =
            width
            - cardSize
            - stageMargin;

        if (
            purpleLeft + cardSize + 24
            > blueLeft
        ) {
            purpleLeft =
                Math.max(
                    stageMargin,
                    blueLeft
                    - cardSize
                    - 24
                );
        }

        /* Tall screen: both cards form a top row. */
        place(
            purpleCard,
            purpleLeft,
            stageMargin
        );

        place(
            blueCard,
            blueLeft,
            stageMargin
        );
    }
}

function setWarmup3DNativeControlsVisible(root, visible) {
    if (!root) {
        return;
    }

    /* Keep the warm-up 3D canvas visually clean in the same spirit as the
       small projection cards.  The native settings / view / zoom pillboxes
       remain fully available, but only while the pointer is in their corner. */
    const selectors = [
        '.dcg-right-pillbox-elements',
        '.dcg-zoom-container',
        '.dcg-zoom-buttons-container',
        '.dcg-settings-pillbox',
        '.dcg-settings-container'
    ];

    const elements = Array.from(
        root.querySelectorAll(selectors.join(','))
    );

    elements.forEach(element => {
        element.style.setProperty(
            'opacity',
            visible ? '1' : '0',
            'important'
        );
        element.style.setProperty(
            'visibility',
            visible ? 'visible' : 'hidden',
            'important'
        );
        element.style.setProperty(
            'pointer-events',
            visible ? 'auto' : 'none',
            'important'
        );
        element.style.setProperty(
            'transition',
            'opacity 0.12s ease',
            'important'
        );
    });

    const interactiveSelector = [
        '.dcg-right-pillbox-elements button',
        '.dcg-right-pillbox-elements [role="button"]',
        '.dcg-right-pillbox-elements .dcg-btn',
        '.dcg-zoom-container button',
        '.dcg-zoom-container [role="button"]',
        '.dcg-zoom-container .dcg-btn',
        '.dcg-zoom-buttons-container button',
        '.dcg-zoom-buttons-container [role="button"]',
        '.dcg-zoom-buttons-container .dcg-btn',
        '.dcg-settings-pillbox button',
        '.dcg-settings-pillbox [role="button"]',
        '.dcg-settings-pillbox .dcg-btn'
    ].join(',');

    root.querySelectorAll(interactiveSelector)
        .forEach(element => {
            element.style.setProperty(
                'pointer-events',
                visible ? 'auto' : 'none',
                'important'
            );
        });
}

function setupWarmup3DControlReveal(rootId) {
    const root = document.getElementById(rootId);

    if (!root) {
        return;
    }

    let controlsVisible = false;

    const setVisible = visible => {
        controlsVisible = Boolean(visible);
        root.classList.toggle(
            'warmup-3d-controls-visible',
            controlsVisible
        );
        setWarmup3DNativeControlsVisible(
            root,
            controlsVisible
        );
    };

    const updateReveal = event => {
        /* Once the pointer reaches a native Desmos control, keep the toolbar
           alive while the user clicks or moves between its buttons. */
        const nativeControl =
            event.target?.closest?.(
                '.dcg-right-pillbox-elements, '
                + '.dcg-zoom-container, '
                + '.dcg-zoom-buttons-container, '
                + '.dcg-settings-pillbox, '
                + '.dcg-settings-container'
            );

        if (nativeControl) {
            setVisible(true);
            return;
        }

        const rect = root.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        /* Match the 2D cards: reveal only near the upper-right toolbar. */
        const inControlCorner =
            x >= rect.width - 150
            && y >= 0
            && y <= 155;

        setVisible(inControlCorner);
    };

    root.addEventListener('pointermove', updateReveal);
    root.addEventListener('mouseleave', () => setVisible(false));

    setVisible(false);
    requestAnimationFrame(() => setVisible(false));

    const observer = new MutationObserver(() => {
        setWarmup3DNativeControlsVisible(
            root,
            controlsVisible
        );
    });

    observer.observe(root, {
        childList: true,
        subtree: true
    });
}

function setProjectionNativeControlsVisible(card, visible) {
    if (!card) {
        return;
    }

    /* Desmos has changed the internal nesting of the + / - / home controls
       across API releases.  Do not choose between the outer pillbox and the
       inner zoom containers: update both, and explicitly restore pointer
       events on their button descendants when the controls are visible. */
    const rightPillbox =
        card.querySelector('.dcg-right-pillbox-elements');

    const zoomContainers =
        Array.from(
            card.querySelectorAll(
                '.dcg-zoom-container, .dcg-zoom-buttons-container'
            )
        );

    const containers = [];

    if (rightPillbox) {
        containers.push(rightPillbox);
    }

    zoomContainers.forEach(element => {
        if (!containers.includes(element)) {
            containers.push(element);
        }
    });

    containers.forEach(element => {
        element.style.setProperty(
            'opacity',
            visible ? '1' : '0',
            'important'
        );
        element.style.setProperty(
            'visibility',
            visible ? 'visible' : 'hidden',
            'important'
        );
        element.style.setProperty(
            'pointer-events',
            visible ? 'auto' : 'none',
            'important'
        );
        element.style.setProperty(
            'z-index',
            '80',
            'important'
        );
        element.style.setProperty(
            'transition',
            'opacity 0.12s ease',
            'important'
        );
    });

    /* Scale only the outermost control wrapper.  Scaling both an outer
       pillbox and a nested zoom container compounds the transform and also
       makes the clickable region disagree with the visible buttons. */
    if (rightPillbox) {
        rightPillbox.style.setProperty(
            'transform',
            'scale(0.72)',
            'important'
        );
        rightPillbox.style.setProperty(
            'transform-origin',
            'top right',
            'important'
        );

        zoomContainers.forEach(element => {
            element.style.setProperty(
                'transform',
                'none',
                'important'
            );
        });
    } else {
        zoomContainers.forEach(element => {
            element.style.setProperty(
                'transform',
                'scale(0.72)',
                'important'
            );
            element.style.setProperty(
                'transform-origin',
                'top right',
                'important'
            );
        });
    }

    const interactiveSelector = [
        '.dcg-right-pillbox-elements button',
        '.dcg-right-pillbox-elements [role="button"]',
        '.dcg-right-pillbox-elements .dcg-btn',
        '.dcg-zoom-container button',
        '.dcg-zoom-container [role="button"]',
        '.dcg-zoom-container .dcg-btn',
        '.dcg-zoom-buttons-container button',
        '.dcg-zoom-buttons-container [role="button"]',
        '.dcg-zoom-buttons-container .dcg-btn'
    ].join(',');

    card.querySelectorAll(interactiveSelector)
        .forEach(element => {
            element.style.setProperty(
                'pointer-events',
                visible ? 'auto' : 'none',
                'important'
            );
        });
}

function setupProjectionControlReveal(cardId) {
    const card =
        document.getElementById(cardId);

    if (!card) {
        return;
    }

    let controlsVisible = false;

    const setVisible = visible => {
        controlsVisible = Boolean(visible);
        card.classList.toggle(
            'projection-controls-visible',
            controlsVisible
        );
        setProjectionNativeControlsVisible(
            card,
            controlsVisible
        );
    };

    const updateReveal = event => {
        /* Once the pointer is actually over a native Desmos control, keep the
           controls alive regardless of the transformed visual coordinates.
           Otherwise a move from the reveal hotspot onto the scaled button can
           disable pointer events between pointerdown and pointerup. */
        const nativeControl =
            event.target?.closest?.(
                '.dcg-right-pillbox-elements, '
                + '.dcg-zoom-container, '
                + '.dcg-zoom-buttons-container'
            );

        if (nativeControl) {
            setVisible(true);
            return;
        }

        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        /* A small but forgiving upper-right reveal zone. */
        const inControlCorner =
            x >= rect.width - 62
            && y >= 0
            && y <= 108;

        setVisible(inControlCorner);
    };

    card.addEventListener(
        'pointermove',
        updateReveal
    );

    card.addEventListener(
        'mouseleave',
        () => setVisible(false)
    );

    /* Desmos may finish constructing the native pillbox one frame after
       the calculator object exists.  Hide it both now and after DOM
       insertions so it never flashes permanently visible. */
    setVisible(false);
    requestAnimationFrame(() => setVisible(false));

    const observer = new MutationObserver(() => {
        setProjectionNativeControlsVisible(
            card,
            controlsVisible
        );
    });

    observer.observe(card, {
        childList: true,
        subtree: true
    });
}


function makeProjectionDraggable(cardId) {
    const card =
        document.getElementById(cardId);

    if (!card) {
        return;
    }

    const dot =
        card.querySelector(".drag-dot");

    const overlay =
        document.getElementById(
            "graph-overlay"
        );

    if (
        !dot
        || !overlay
    ) {
        return;
    }

    dot.addEventListener(
        "pointerdown",
        event => {
            event.preventDefault();
            event.stopPropagation();

            card.dataset.userMoved =
                "true";

            dot.setPointerCapture(
                event.pointerId
            );

            const cardRect =
                card.getBoundingClientRect();

            const shiftX =
                event.clientX
                - cardRect.left;

            const shiftY =
                event.clientY
                - cardRect.top;

            function move(event) {
                const overlayRect =
                    overlay.getBoundingClientRect();

                let left =
                    event.clientX
                    - overlayRect.left
                    - shiftX;

                let top =
                    event.clientY
                    - overlayRect.top
                    - shiftY;

                left =
                    Math.max(
                        0,
                        Math.min(
                            left,
                            overlayRect.width
                            - card.offsetWidth
                        )
                    );

                top =
                    Math.max(
                        0,
                        Math.min(
                            top,
                            overlayRect.height
                            - card.offsetHeight
                        )
                    );

                card.style.left =
                    `${Math.round(left)}px`;

                card.style.top =
                    `${Math.round(top)}px`;

                card.style.right =
                    "auto";

                /* Store the drag as a displacement from the current
                   responsive scene-edge anchor.  On later resizes the
                   anchor moves with the 3D picture and this adjustment
                   is carried along with it. */
                const defaultLeft = Number(
                    card.dataset.layoutDefaultLeft
                );

                const defaultTop = Number(
                    card.dataset.layoutDefaultTop
                );

                card.dataset.anchorDeltaX =
                    String(
                        left
                        - (Number.isFinite(defaultLeft)
                            ? defaultLeft
                            : left)
                    );

                card.dataset.anchorDeltaY =
                    String(
                        top
                        - (Number.isFinite(defaultTop)
                            ? defaultTop
                            : top)
                    );
            }

            function stop(event) {
                if (
                    dot.hasPointerCapture(
                        event.pointerId
                    )
                ) {
                    dot.releasePointerCapture(
                        event.pointerId
                    );
                }

                dot.removeEventListener(
                    "pointermove",
                    move
                );

                dot.removeEventListener(
                    "pointerup",
                    stop
                );

                dot.removeEventListener(
                    "pointercancel",
                    stop
                );
            }

            dot.addEventListener(
                "pointermove",
                move
            );

            dot.addEventListener(
                "pointerup",
                stop
            );

            dot.addEventListener(
                "pointercancel",
                stop
            );
        }
    );
}


/* Clebsch page data, view construction, diagnostics, and controls are
   implemented in clebsch-page-v10.js. */


/* ============================================================
   PAGE LOADER
   ============================================================ */

function loadPage(pageName) {
    destroyCalculators();

    if (controlHeadingActions) {
        controlHeadingActions.innerHTML = "";
    }

    if (controlSectionHeading) {
        controlSectionHeading.textContent =
            pageName === "warmup"
                ? "ADJUSTMENT"
                : "GEOMETRY";
    }

    if (pageName === "warmup") {
        buildWarmupView();
    }

    if (pageName === "clebsch" || pageName === "bitangents") {
        clebschPage.buildView();
        if (pageName === "bitangents") {
            // Full chapter rather than a decorative heading: activate
            // the original Remark proof, 27 line-conic pairs and 28 bitangents.
            clebschPage.showBitangentsChapter();
        }
    }

    document
        .querySelectorAll(".surface-button")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.surface === pageName
            );
        });

    window.v12MovingP?.onPageLoad(
        pageName === "bitangents" ? "clebsch" : pageName
    );
}


/* ============================================================
   NAVIGATION
   ============================================================ */

document
    .querySelectorAll(".surface-button")
    .forEach(button => {
        button.addEventListener(
            "click",
            () => {
                loadPage(
                    button.dataset.surface
                );
            }
        );
    });


/* ============================================================
   RESPONSIVE WARM-UP CARD LAYOUT
   ============================================================ */

window.addEventListener(
    "resize",
    () => {
        if (warmup3D) {
            positionWarmupProjectionCards();
            resizeWarmupCalculators();
        }
    }
);


window.addEventListener("beforeunload", () => {
    warmupCancelWorkerIntersectionSolve();
    if (warmupIntersectionWorkerUrl) {
        URL.revokeObjectURL(warmupIntersectionWorkerUrl);
        warmupIntersectionWorkerUrl = null;
    }
});

/* ============================================================
   INITIAL PAGE
   ============================================================ */

initializeSiteTheme();
loadPage("warmup");