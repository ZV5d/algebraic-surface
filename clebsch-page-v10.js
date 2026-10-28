/* ============================================================
   CLEBSCH PAGE — PAGE DATA, VIEW, STATE, AND CONTROLS
   Loaded before the shared application shell. The module is created now,
   but its methods use shell globals only after the shell is initialized.
   ============================================================ */

const clebschPage = (() => {
    const DOUBLE_SIX_ORANGE_NUMBERS = clebschGeometry.doubleSixOrangeNumbers;
    const DOUBLE_SIX_BLUE_NUMBERS = clebschGeometry.doubleSixBlueNumbers;
    const BITANGENT_LINE_PLANES = clebschGeometry.linePlanePairs;
    const PROJECTION_POINT = clebschGeometry.projectionPoint;
    const DOUBLE_SIX_ORANGE_IDS = new Set(
        DOUBLE_SIX_ORANGE_NUMBERS.map(number => `clebsch-line-${number}`)
    );
    const DOUBLE_SIX_BLUE_IDS = new Set(
        DOUBLE_SIX_BLUE_NUMBERS.map(number => `clebsch-line-${number}`)
    );
    const SCHLAFLI_FAMILY_COLORS = {
        E: "#FFAB00",
        L: "#009FE3",
        C: "#FC767A"
    };
    const SCHLAFLI_FAMILY_PLANE_COLORS = {
        E: "#F0D4A0",
        L: "#A5BAC5",
        C: "#E9B7B9"
    };
    let schlafliLabelsByLine = [];
    let schlafliLineByLabel = new Map();

    let doubleSixHighlighted = false;
    let currentClebschInfoMode = "intro";
    let activateClebschInfoTab = null;
    let currentClebschRemarkMode = "line-conic";
    let currentClebschEquationStep = 1;
    let clebschProofPanelCollapsed = false;
    let tangentProjection2D = null;
    let complexContactPreviewOpen = false;
    let complexSheetsMode = false;
    let tangentProjectionDragCleanup = null;
    let targetProjectionViewportSyncTimer = null;
    let targetProjectionLastViewportSignature = null;
    let targetContactFitSelectionKey = null;
    let targetContactFitFrame = null;
    let sliceProjection2D = null;
    let clebschEquationsVisible = false;

    /* A genuine plane slice through P:
       Π : 2x-y+z=79/84.
       In local plane coordinates (u,v),
       (x,y,z)=P+(u,v,-2u+v). */
    const PROJECTION_SLICE_INITIAL_ANGLE = 20;
    const PROJECTION_SLICE_RAMIFICATION_ANGLES = [
        -50.02336447054219,
        -30.8140118873858,
        64.5084299204044,
        74.05434216173805
    ];
    const PROJECTION_SLICE_RAMIFICATION_POINTS = [
        [-0.31170240172023006, 0.3717802435945046],
        [-0.23617144473219207, 0.14086472898521354],
        [-0.22256351849978318, -0.4667908541015582],
        [0.03628042850930808, 0.12697930214478]
    ];
    let projectionSliceAngle =
        PROJECTION_SLICE_INITIAL_ANGLE;

    /* The 3D projection line is constrained to the displayed plane slice. */
    const PROJECTION_LINE_INITIAL = {
        azimuth: 20,
        elevation: -56.95746436427127
    };
    const projectionLineState = { ...PROJECTION_LINE_INITIAL };
    let projectionLineControlRefs = null;
    let nativeControlsCleanup = null;
    let calculatorRevealFrame = null;

    /* Page 1 synchronization lesson carried over deliberately:
       controls, 3D line, residual points, glow states, and the target point
       all read one frozen (azimuth,elevation) state. Playback is page-owned
       and committed through one RAF stream; there is no second animation
       clock that can leave geometry one frame behind. */
    const projectionLineAnimations = {};
    let projectionLineAnimationFrame = null;
    let projectionLineAnimationLastTime = 0;
    let projectionLineAnimationLastCommitTime = 0;
    let projectionLinePendingCommitFrame = null;
    let projectionLineBoundsTimer = null;
    let projectionLineLastLatex = null;
    let projectionLineParameterExtent = null;
    let projectionLineKeyboardRamificationKey = null;
    let projectionLineTransientShineActive = false;
    let projectionLineTransientShineTimer = null;
    let projectionLineGloballyPaused = false;
    let projectionLinePausedKeys = [];
    let projectionLineGlobalStopButton = null;
    let projectionLineNonstopButton = null;
    let projectionLineNonstop = false;
    let projectionLineNonstopVisitedRamificationPoints = [];
    let projectionLineNonstopVisitedTargetPoints = [];
    let projectionBlowupActive = false;
    let projectionBlowupDirectionDegrees = 64;
    let projectionBlowupSavedLineState = null;
    let projectionBlowupSlider = null;
    let projectionBlowupSelectedPoint = null;
    let projectionBlowupSelectedLabel = null;
    let projectionBlowupDirectionRay = null;
    let projectionBlowupPlayButton = null;
    let projectionBlowupValueLabel = null;
    let projectionBlowupAnimationFrame = null;
    let projectionBlowupAnimationLastTime = 0;
    let projectionBlowupPlaying = false;
    let projectionBlowupNextStopDegrees = null;
    let projectionBlowupCorrespondenceUpdater = null;
    let projectionBlowupComplementaryVisible = false;
    let projectionLineAutoStopArmed = true;
    let projectionRamificationLocked = false;
    const PROJECTION_LINE_ANIMATION_PERIOD_MS = 13000;
    const PROJECTION_LINE_COMMIT_INTERVAL_MS = 36;
    const PROJECTION_BLOWUP_ANIMATION_PERIOD_MS = 12000;

    const PROJECTION_RESIDUAL_COLOR = "#73B9BE";
    const PROJECTION_RESIDUAL_POINT_SIZE = 3;
    const PROJECTION_LINE_COLOR = "#A71912";
    const RAMIFICATION_GLOW_COLOR = "#F18AEC";
    const BRANCH_GLOW_COLOR = "#A6D99F";
    const RAMIFICATION_EVENT_ZERO_TOLERANCE = 1e-10;
    const RAMIFICATION_REARM_TOLERANCE = 1e-5;
    const PROJECTION_NONSTOP_VISITED_RELATIVE_TOLERANCE = 1e-4;
    const PROJECTION_BLOWUP_NEAR_P_DISTANCE = 0.28;
    const PROJECTION_BLOWUP_TANGENT_DIRECTIONS = Object.freeze([
        63.93837243838745,
        152.4025405413349
    ]);

    /* Canonical Page 2 target equations.
       Keep exact geometry here so the equation view, blow-up view, and
       remark view cannot drift apart after later UI edits. */
    const PROJECTION_BRANCH_QUARTIC_LATEX =
        "4024161x^4+10068948x^3y-4693572x^3-2496906x^2y^2-9500652x^2y+1935414x^2-10856268xy^3+3741876xy^2+2666556xy-342948x+4782321y^4+1068444y^3-608634y^2-163236y+24721=0";
    const PROJECTION_EXCEPTIONAL_BITANGENT_LATEX =
        "7818x-5169y-2999=0";
    const PROJECTION_EXCEPTIONAL_TANGENCY_LATEX =
        Object.freeze([
            "\\left(\\frac{15430676-6892\\sqrt{1610821}}{18042717},\\frac{12870365-10424\\sqrt{1610821}}{18042717}\\right)",
            "\\left(\\frac{15430676+6892\\sqrt{1610821}}{18042717},\\frac{12870365+10424\\sqrt{1610821}}{18042717}\\right)"
        ]);

    const PROJECTION_EXCEPTIONAL_TANGENCY_POINTS =
        Object.freeze(
            [-1, 1].map(sign => {
                const root =
                    Math.sqrt(1610821);
                return Object.freeze({
                    x:
                        (15430676
                            + sign * 6892 * root)
                        / 18042717,
                    y:
                        (12870365
                            + sign * 10424 * root)
                        / 18042717
                });
            })
        );

    function projectionBranchQuarticValue(
        x,
        y
    ) {
        return (
            4024161 * x ** 4
            + 10068948 * x ** 3 * y
            - 4693572 * x ** 3
            - 2496906 * x ** 2 * y ** 2
            - 9500652 * x ** 2 * y
            + 1935414 * x ** 2
            - 10856268 * x * y ** 3
            + 3741876 * x * y ** 2
            + 2666556 * x * y
            - 342948 * x
            + 4782321 * y ** 4
            + 1068444 * y ** 3
            - 608634 * y ** 2
            - 163236 * y
            + 24721
        );
    }

    const TARGET_PROJECTION_BOUNDS = Object.freeze({
        left: -0.75,
        right: 1.55,
        bottom: -0.65,
        top: 1.75
    });

    /* The old 0.14-unit inset was about 6% of the initial target window.
       Keep that same visual inset after zoom/pan instead of freezing it in
       affine coordinates. */
    const TARGET_PROJECTION_EDGE_MARGIN_FRACTION = 0.06;

    function projectionLineNumber(value) {
        const clean = Math.abs(value) < 1e-12 ? 0 : value;
        return Number(clean.toPrecision(12)).toString();
    }

    function pointCoordinateLatex(value) {
        const text = projectionLineNumber(value);
        const match = text.match(/^(.+?)e([+-]?\d+)$/i);
        return match
            ? `${match[1]}\\cdot10^{${Number(match[2])}}`
            : text;
    }

    function projectionSliceDirection(angleDegrees) {
        const theta = angleDegrees * Math.PI / 180;
        const u = Math.cos(theta);
        const v = Math.sin(theta);
        const w = -2 * u + v;
        const scale = Math.hypot(u, v, w);

        return {
            x: u / scale,
            y: v / scale,
            z: w / scale
        };
    }

    function setProjectionSliceAngle(angleDegrees) {
        projectionSliceAngle = Math.max(
            -90,
            Math.min(90, angleDegrees)
        );

        const direction =
            projectionSliceDirection(
                projectionSliceAngle
            );

        projectionLineState.azimuth =
            Math.atan2(
                direction.y,
                direction.x
            ) * 180 / Math.PI;

        projectionLineState.elevation =
            Math.atan2(
                direction.z,
                Math.hypot(
                    direction.x,
                    direction.y
                )
            ) * 180 / Math.PI;
    }

    function projectionSliceAngleDistance(
        first,
        second
    ) {
        const difference =
            Math.abs(first - second) % 180;

        return Math.min(
            difference,
            180 - difference
        );
    }

    function nearestProjectionSliceRamificationAngle(
        angleDegrees
    ) {
        return PROJECTION_SLICE_RAMIFICATION_ANGLES
            .reduce((nearest, candidate) => (
                projectionSliceAngleDistance(
                    angleDegrees,
                    candidate
                )
                < projectionSliceAngleDistance(
                    angleDegrees,
                    nearest
                )
                    ? candidate
                    : nearest
            ));
    }

    function clebschSurfaceValue(x, y, z) {
        return 81 * (x ** 3 + y ** 3 + z ** 3)
            - 189 * (
                x * x * y + x * x * z + y * y * x
                + y * y * z + z * z * x + z * z * y
            )
            + 54 * x * y * z
            + 126 * (x * y + y * z + z * x)
            - 9 * (x * x + y * y + z * z)
            - 9 * (x + y + z)
            + 1;
    }

    function projectionLineDirectionFromAngles(
        azimuthDegrees,
        elevationDegrees
    ) {
        const azimuth =
            azimuthDegrees * Math.PI / 180;
        const elevation =
            elevationDegrees * Math.PI / 180;

        return {
            x:
                Math.cos(elevation)
                * Math.cos(azimuth),
            y:
                Math.cos(elevation)
                * Math.sin(azimuth),
            z:
                Math.sin(elevation)
        };
    }

    function projectionLineDirection() {
        return projectionLineDirectionFromAngles(
            projectionLineState.azimuth,
            projectionLineState.elevation
        );
    }

    function projectionResidualData(
        direction = projectionLineDirection()
    ) {
        const valueAt = t => clebschSurfaceValue(
            PROJECTION_POINT.x + t * direction.x,
            PROJECTION_POINT.y + t * direction.y,
            PROJECTION_POINT.z + t * direction.z
        );
        const f0 = valueAt(0);
        const f1 = valueAt(1) - f0;
        const fMinus1 = valueAt(-1) - f0;
        const f2 = valueAt(2) - f0;
        const quadraticCoefficient =
            (f1 + fMinus1) / 2;
        const oddAtOne =
            (f1 - fMinus1) / 2;
        const cubicCoefficient = (
            f2
            - 2 * oddAtOne
            - 4 * quadraticCoefficient
        ) / 6;
        const linearCoefficient =
            oddAtOne - cubicCoefficient;
        const scale = Math.max(
            1,
            Math.abs(cubicCoefficient),
            Math.abs(quadraticCoefficient),
            Math.abs(linearCoefficient)
        );
        const tolerance =
            1e-11 * scale;
        const discriminant =
            quadraticCoefficient ** 2
            - 4
            * cubicCoefficient
            * linearCoefficient;

        return {
            cubicCoefficient,
            quadraticCoefficient,
            linearCoefficient,
            scale,
            tolerance,
            discriminant
        };
    }

    function projectionResidualParameters() {
        const {
            cubicCoefficient,
            quadraticCoefficient,
            linearCoefficient,
            tolerance,
            discriminant
        } = projectionResidualData();

        let roots = [];

        /* At an auto-stop / explicit snap we have already refined the line to
           a ramification direction. Render the merged point ourselves from the
           double root instead of asking Desmos to display a boundary case. */
        if (
            projectionRamificationLocked
            && Math.abs(cubicCoefficient) > tolerance
        ) {
            const doubleRoot =
                -quadraticCoefficient
                / (2 * cubicCoefficient);

            return Number.isFinite(doubleRoot)
                && Math.abs(doubleRoot) > 1e-8
                    ? [doubleRoot]
                    : [];
        }

        /* F(P+t d)=t(c_3 t^2+c_2 t+c_1), because P lies on S_3. */
        if (Math.abs(cubicCoefficient) <= tolerance) {
            if (Math.abs(quadraticCoefficient) > tolerance) {
                roots = [
                    -linearCoefficient
                    / quadraticCoefficient
                ];
            }
        } else if (discriminant >= -tolerance) {
            const squareRoot =
                Math.sqrt(
                    Math.max(0, discriminant)
                );

            if (squareRoot <= tolerance) {
                roots = [
                    -quadraticCoefficient
                    / (2 * cubicCoefficient)
                ];
            } else {
                const q = -0.5 * (
                    quadraticCoefficient
                    + Math.sign(
                        quadraticCoefficient || 1
                    ) * squareRoot
                );

                roots = [
                    q / cubicCoefficient,
                    linearCoefficient / q
                ];
            }
        }

        return roots
            .filter(Number.isFinite)
            .filter(t => Math.abs(t) > 1e-8)
            .sort((first, second) => first - second)
            .filter((t, index, values) => (
                index === 0
                || Math.abs(
                    t - values[index - 1]
                ) > 1e-8
            ))
            .slice(0, 2);
    }

    function projectionRamificationDiscriminant(
        azimuthDegrees,
        elevationDegrees
    ) {
        const data =
            projectionResidualData(
                projectionLineDirectionFromAngles(
                    azimuthDegrees,
                    elevationDegrees
                )
            );

        return data.discriminant
            / (data.scale * data.scale);
    }

    function projectionRamificationState() {
        return {
            azimuth:
                projectionLineState.azimuth,
            elevation:
                projectionLineState.elevation
        };
    }

    function projectionRamificationValue(
        state
    ) {
        return projectionRamificationDiscriminant(
            state.azimuth,
            state.elevation
        );
    }

    function projectionNormalizeAzimuth(
        value
    ) {
        let result = value;

        while (result > 180) {
            result -= 360;
        }

        while (result < -180) {
            result += 360;
        }

        return result;
    }

    function projectionUnwrappedAzimuthDelta(
        from,
        to
    ) {
        let delta = to - from;

        if (delta > 180) {
            delta -= 360;
        } else if (delta < -180) {
            delta += 360;
        }

        return delta;
    }

    function projectionInterpolateRamificationState(
        start,
        end,
        t
    ) {
        const azimuthDelta =
            projectionUnwrappedAzimuthDelta(
                start.azimuth,
                end.azimuth
            );

        return {
            azimuth:
                projectionNormalizeAzimuth(
                    start.azimuth
                    + t * azimuthDelta
                ),
            elevation:
                start.elevation
                + t
                * (
                    end.elevation
                    - start.elevation
                )
        };
    }

    function projectionRefineRamificationBracket(
        leftState,
        rightState
    ) {
        let left = leftState;
        let right = rightState;
        let leftValue =
            projectionRamificationValue(left);
        let rightValue =
            projectionRamificationValue(right);

        if (
            !Number.isFinite(leftValue)
            || !Number.isFinite(rightValue)
        ) {
            return null;
        }

        if (
            Math.abs(leftValue)
            <= RAMIFICATION_EVENT_ZERO_TOLERANCE
        ) {
            return left;
        }

        if (
            Math.abs(rightValue)
            <= RAMIFICATION_EVENT_ZERO_TOLERANCE
        ) {
            return right;
        }

        if (leftValue * rightValue > 0) {
            return null;
        }

        for (
            let iteration = 0;
            iteration < 60;
            iteration += 1
        ) {
            const middle =
                projectionInterpolateRamificationState(
                    left,
                    right,
                    0.5
                );
            const middleValue =
                projectionRamificationValue(
                    middle
                );

            if (!Number.isFinite(middleValue)) {
                return null;
            }

            if (
                Math.abs(middleValue)
                <= RAMIFICATION_EVENT_ZERO_TOLERANCE
            ) {
                return middle;
            }

            if (leftValue * middleValue <= 0) {
                right = middle;
                rightValue = middleValue;
            } else {
                left = middle;
                leftValue = middleValue;
            }
        }

        return projectionInterpolateRamificationState(
            left,
            right,
            0.5
        );
    }

    function projectionRamificationEventBetween(
        start,
        end
    ) {
        const sampleCount = 8;
        let previousState = start;
        let previousValue =
            projectionRamificationValue(
                previousState
            );

        if (!Number.isFinite(previousValue)) {
            return null;
        }

        for (
            let index = 1;
            index <= sampleCount;
            index += 1
        ) {
            const currentState =
                projectionInterpolateRamificationState(
                    start,
                    end,
                    index / sampleCount
                );
            const currentValue =
                projectionRamificationValue(
                    currentState
                );

            if (!Number.isFinite(currentValue)) {
                previousState =
                    currentState;
                previousValue =
                    currentValue;
                continue;
            }

            if (
                Math.abs(currentValue)
                <= RAMIFICATION_EVENT_ZERO_TOLERANCE
            ) {
                return currentState;
            }

            if (
                Number.isFinite(previousValue)
                && previousValue
                    * currentValue
                    < 0
            ) {
                return projectionRefineRamificationBracket(
                    previousState,
                    currentState
                );
            }

            previousState =
                currentState;
            previousValue =
                currentValue;
        }

        return null;
    }

    function projectionRamificationPointFromState(
        state
    ) {
        const direction =
            projectionLineDirectionFromAngles(
                state.azimuth,
                state.elevation
            );
        const data =
            projectionResidualData(
                direction
            );

        if (
            !Number.isFinite(
                data.cubicCoefficient
            )
            || Math.abs(
                data.cubicCoefficient
            ) <= data.tolerance
        ) {
            return null;
        }

        const t =
            -data.quadraticCoefficient
            / (2 * data.cubicCoefficient);

        if (
            !Number.isFinite(t)
            || Math.abs(t) <= 1e-8
        ) {
            return null;
        }

        const point = {
            x:
                PROJECTION_POINT.x
                + t * direction.x,
            y:
                PROJECTION_POINT.y
                + t * direction.y,
            z:
                PROJECTION_POINT.z
                + t * direction.z
        };

        return (
            Number.isFinite(point.x)
            && Number.isFinite(point.y)
            && Number.isFinite(point.z)
        )
            ? point
            : null;
    }

    function projectionTargetPointFromState(
        state
    ) {
        const direction =
            projectionLineDirectionFromAngles(
                state.azimuth,
                state.elevation
            );

        if (Math.abs(direction.z) <= 1e-12) {
            return null;
        }

        const parameter =
            -PROJECTION_POINT.z
            / direction.z;
        const point = {
            x:
                PROJECTION_POINT.x
                + parameter * direction.x,
            y:
                PROJECTION_POINT.y
                + parameter * direction.y
        };

        return (
            Number.isFinite(point.x)
            && Number.isFinite(point.y)
        )
            ? point
            : null;
    }

    function projectionNonstopRamificationAlreadyVisited(
        point
    ) {
        const pointScale =
            Math.max(
                1,
                Math.hypot(
                    point.x,
                    point.y,
                    point.z
                )
            );

        return projectionLineNonstopVisitedRamificationPoints
            .some(existing => {
                const existingScale =
                    Math.max(
                        1,
                        Math.hypot(
                            existing.x,
                            existing.y,
                            existing.z
                        )
                    );
                const tolerance =
                    PROJECTION_NONSTOP_VISITED_RELATIVE_TOLERANCE
                    * Math.max(
                        pointScale,
                        existingScale
                    );
                const distance =
                    Math.hypot(
                        point.x - existing.x,
                        point.y - existing.y,
                        point.z - existing.z
                    );

                return distance <= tolerance;
            });
    }

    function recordProjectionNonstopRamificationPoint(
        state
    ) {
        const point =
            projectionRamificationPointFromState(
                state
            );

        if (
            !point
            || projectionNonstopRamificationAlreadyVisited(
                point
            )
        ) {
            return false;
        }

        projectionLineNonstopVisitedRamificationPoints
            .push(point);

        const targetPoint =
            projectionTargetPointFromState(
                state
            );

        if (targetPoint) {
            projectionLineNonstopVisitedTargetPoints
                .push(targetPoint);
        }

        return true;
    }

    function projectionNonstopVisitedRamificationExpression() {
        const points =
            projectionLineNonstopVisitedRamificationPoints;

        return {
            id:
                "projection-nonstop-visited-ramification",
            latex:
                points.length
                    ? `[${points
                        .map(point =>
                            `(${pointCoordinateLatex(
                                point.x
                            )},${pointCoordinateLatex(
                                point.y
                            )},${pointCoordinateLatex(
                                point.z
                            )})`
                        )
                        .join(",")}]`
                    : "[]",
            color:
                PROJECTION_RESIDUAL_COLOR,
            pointSize:
                PROJECTION_RESIDUAL_POINT_SIZE,
            pointOpacity: 1,
            hidden:
                !projectionLineNonstop
                || currentClebschEquationStep < 3
                || points.length === 0
        };
    }

    function projectionBlowupDirection(
        degrees = projectionBlowupDirectionDegrees
    ) {
        const angle =
            degrees * Math.PI / 180;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const raw = {
            x: 2153 * cosine,
            y: 2153 * sine,
            z:
                -2606 * cosine
                + 1723 * sine
        };
        const norm =
            Math.hypot(
                raw.x,
                raw.y,
                raw.z
            );

        return {
            x: raw.x / norm,
            y: raw.y / norm,
            z: raw.z / norm
        };
    }

    function projectionTangentPlaneBasis() {
        const basisX =
            projectionBlowupDirection(0);
        const seedY =
            projectionBlowupDirection(90);
        const seedDot =
            basisX.x * seedY.x
            + basisX.y * seedY.y
            + basisX.z * seedY.z;
        const rawY = {
            x: seedY.x - seedDot * basisX.x,
            y: seedY.y - seedDot * basisX.y,
            z: seedY.z - seedDot * basisX.z
        };
        const rawYNorm =
            Math.hypot(
                rawY.x,
                rawY.y,
                rawY.z
            ) || 1;

        return {
            x: basisX,
            y: {
                x: rawY.x / rawYNorm,
                y: rawY.y / rawYNorm,
                z: rawY.z / rawYNorm
            }
        };
    }

    function projectionTangentPlaneDirection(
        angle
    ) {
        const basis =
            projectionTangentPlaneBasis();
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);

        return {
            x:
                cosine * basis.x.x
                + sine * basis.y.x,
            y:
                cosine * basis.x.y
                + sine * basis.y.y,
            z:
                cosine * basis.x.z
                + sine * basis.y.z
        };
    }

    function projectionBlowupTrueAngle(
        degrees
    ) {
        const direction =
            projectionBlowupDirection(degrees);
        const basis =
            projectionTangentPlaneBasis();
        let angle =
            Math.atan2(
                direction.x * basis.y.x
                    + direction.y * basis.y.y
                    + direction.z * basis.y.z,
                direction.x * basis.x.x
                    + direction.y * basis.x.y
                    + direction.z * basis.x.z
            );

        while (angle < 0) angle += Math.PI;
        while (angle >= Math.PI) angle -= Math.PI;

        return angle;
    }

    function projectionBlowupProjectiveDisplayAngle(
        degrees
    ) {
        /* E = P(T_P S_3): V and -V are the same point.
           Doubling the true angle in an orthonormal tangent-plane basis
           gives a circle model of RP^1. */
        return 2 * projectionBlowupTrueAngle(
            degrees
        );
    }

    function projectionTangentPlaneSectionRadius(
        angle
    ) {
        const direction =
            projectionTangentPlaneDirection(
                angle
            );
        const data =
            projectionResidualData(direction);

        if (
            Math.abs(data.cubicCoefficient)
                <= data.tolerance
        ) {
            return null;
        }

        /* In the tangent plane the linear coefficient vanishes:
           F(P+tV)=t^2(q_2(V)+t q_3(V)).
           The non-P point is therefore t=-q_2/q_3. */
        const radius =
            -data.quadraticCoefficient
            / data.cubicCoefficient;

        return Number.isFinite(radius)
            ? radius
            : null;
    }

    function projectionAppendSvgPoint(
        state,
        x,
        y,
        jumpLimit = Infinity
    ) {
        if (
            state.last
            && Math.hypot(
                x - state.last.x,
                y - state.last.y
            ) > jumpLimit
        ) {
            state.drawing = false;
        }

        state.path +=
            (state.drawing ? " L " : " M ")
            + x.toFixed(2)
            + " "
            + y.toFixed(2);
        state.drawing = true;
        state.last = { x, y };
    }

    function projectionRenderActualBlowupGeometry() {
        const sourcePath =
            document.getElementById(
                "clebsch-blowup-actual-curve"
            );
        const strictTransform =
            document.getElementById(
                "clebsch-blowup-actual-strict-transform"
            );

        if (!sourcePath || !strictTransform) {
            return;
        }

        const source = {
            path: "",
            drawing: false,
            last: null
        };
        const sourceCx = 250;
        const sourceCy = 430;
        const sourceScale = 76;
        const sourceRadius = 1.45;
        const sampleCount = 1200;

        for (
            let index = 0;
            index <= sampleCount;
            index += 1
        ) {
            const angle =
                Math.PI * index / sampleCount;
            const radius =
                projectionTangentPlaneSectionRadius(
                    angle
                );

            if (
                radius === null
                || Math.abs(radius) > sourceRadius
            ) {
                source.drawing = false;
                source.last = null;
                continue;
            }

            const x =
                sourceCx
                + sourceScale
                * radius
                * Math.cos(angle);
            const y =
                sourceCy
                - sourceScale
                * radius
                * Math.sin(angle);

            projectionAppendSvgPoint(
                source,
                x,
                y,
                18
            );
        }

        sourcePath.setAttribute(
            "d",
            source.path
        );

        const tangentAngles =
            PROJECTION_BLOWUP_TANGENT_DIRECTIONS
                .map(
                    projectionBlowupTrueAngle
                )
                .sort(
                    (first, second) =>
                        first - second
                );

        tangentAngles.forEach(
            (angle, index) => {
                const line =
                    document.getElementById(
                        `clebsch-blowup-tangent-${index + 1}`
                    );
                const label =
                    document.getElementById(
                        `clebsch-blowup-tangent-label-${index + 1}`
                    );
                const forwardLength = 104;
                const backwardLength = 96;
                const cosine =
                    Math.cos(angle);
                const sine =
                    Math.sin(angle);
                const x1 =
                    sourceCx
                    - backwardLength * cosine;
                const y1 =
                    sourceCy
                    + backwardLength * sine;
                const x2 =
                    sourceCx
                    + forwardLength * cosine;
                const y2 =
                    sourceCy
                    - forwardLength * sine;

                line?.setAttribute(
                    "x1",
                    String(x1)
                );
                line?.setAttribute(
                    "y1",
                    String(y1)
                );
                line?.setAttribute(
                    "x2",
                    String(x2)
                );
                line?.setAttribute(
                    "y2",
                    String(y2)
                );
                label?.setAttribute(
                    "x",
                    String(
                        x2 + 10 * cosine
                    )
                );
                label?.setAttribute(
                    "y",
                    String(
                        y2 - 10 * sine
                    )
                );
            }
        );

        /* Natural affine chart of the real blow-up.
           Use the tangent-plane coordinates
             P + s A + t B,
             A=(2153,0,-2606), B=(0,2153,1723),
           and the standard blow-up chart
             t = s u.
           Therefore E={s=0} and u=t/s is the actual projective
           direction coordinate. No display rotation is introduced.

           This chart misses the direction s=0. To make the global
           connectedness of the strict transform visible without drawing
           an invented continuation, render the same computed curve in a
           small complementary chart
             s = t v,
           where v=s/t=1/u on the overlap. */
        const exceptionalX = 540;
        const chartCenterY = 166;
        const radialScale = 120000;
        const slopeScale = 35;
        const maxS = 0.00072;
        const maxU = 2.75;
        const blown = {
            path: "",
            drawing: false,
            last: null
        };

        const complementaryStrictTransform =
            document.getElementById(
                "clebsch-blowup-complementary-strict-transform"
            );
        const complementary = {
            path: "",
            drawing: false,
            last: null
        };
        const complementaryLeft = 294;
        const complementaryWidth = 146;
        const complementaryTop = 116;
        const complementaryBottom = 252;
        const complementaryVMin = -2.5;
        const complementaryVMax = 0.8;
        const complementaryVScale =
            (
                complementaryBottom
                - complementaryTop
            )
            / (
                complementaryVMax
                - complementaryVMin
            );
        const complementaryCenterY =
            complementaryTop
            + complementaryVMax
            * complementaryVScale;
        const complementaryTMin = -0.00018;
        const complementaryTMax = 0.00030;
        const complementaryTScale =
            complementaryWidth
            / (
                complementaryTMax
                - complementaryTMin
            );
        const complementaryExceptionalX =
            complementaryLeft
            + (
                -complementaryTMin
            )
            * complementaryTScale;

        const blowupCoordinates = theta => {
            const cosine = Math.cos(theta);
            const sine = Math.sin(theta);
            const raw = {
                x: 2153 * cosine,
                y: 2153 * sine,
                z:
                    -2606 * cosine
                    + 1723 * sine
            };
            const rawNorm =
                Math.hypot(
                    raw.x,
                    raw.y,
                    raw.z
                );
            const direction = {
                x: raw.x / rawNorm,
                y: raw.y / rawNorm,
                z: raw.z / rawNorm
            };
            const data =
                projectionResidualData(direction);

            if (
                Math.abs(data.cubicCoefficient)
                    <= data.tolerance
            ) {
                return null;
            }

            const radius =
                -data.quadraticCoefficient
                / data.cubicCoefficient;
            const coefficientScale =
                radius / rawNorm;
            const s =
                coefficientScale * cosine;
            const t =
                coefficientScale * sine;

            return {
                s,
                t,
                u:
                    Math.abs(cosine) >= 1e-5
                        ? sine / cosine
                        : null,
                v:
                    Math.abs(sine) >= 1e-5
                        ? cosine / sine
                        : null
            };
        };

        const complementaryPoint = coordinates => ({
            x:
                complementaryLeft
                + (
                    coordinates.t
                    - complementaryTMin
                )
                * complementaryTScale,
            y:
                complementaryCenterY
                - complementaryVScale
                * coordinates.v
        });

        const blowupSamples = 1800;

        for (
            let index = 0;
            index <= blowupSamples;
            index += 1
        ) {
            const theta =
                Math.PI * index
                / blowupSamples;
            const coordinates =
                blowupCoordinates(theta);

            if (!coordinates) {
                blown.drawing = false;
                blown.last = null;
                complementary.drawing = false;
                complementary.last = null;
                continue;
            }

            if (
                coordinates.u !== null
                && Number.isFinite(coordinates.s)
                && Number.isFinite(coordinates.u)
                && Math.abs(coordinates.s) <= maxS
                && Math.abs(coordinates.u) <= maxU
            ) {
                const x =
                    exceptionalX
                    + radialScale
                    * coordinates.s;
                const y =
                    chartCenterY
                    - slopeScale
                    * coordinates.u;

                projectionAppendSvgPoint(
                    blown,
                    x,
                    y,
                    24
                );
            } else {
                blown.drawing = false;
                blown.last = null;
            }

            if (
                coordinates.v !== null
                && Number.isFinite(coordinates.t)
                && Number.isFinite(coordinates.v)
                && coordinates.v
                    >= complementaryVMin
                && coordinates.v
                    <= complementaryVMax
                && coordinates.t
                    >= complementaryTMin
                && coordinates.t
                    <= complementaryTMax
            ) {
                const point =
                    complementaryPoint(
                        coordinates
                    );

                projectionAppendSvgPoint(
                    complementary,
                    point.x,
                    point.y,
                    18
                );
            } else {
                complementary.drawing = false;
                complementary.last = null;
            }
        }

        strictTransform.setAttribute(
            "d",
            blown.path
        );
        complementaryStrictTransform?.setAttribute(
            "d",
            complementary.path
        );

        const staticCorrespondenceLayer =
            document.getElementById(
                "clebsch-blowup-static-correspondences"
            );
        const staticCorrespondenceDegrees =
            Object.freeze([
                55.5,
                143.5,
                150.5,
                157.5
            ]);

        if (staticCorrespondenceLayer) {
            staticCorrespondenceLayer.innerHTML =
                staticCorrespondenceDegrees
                    .map(degrees => {
                        const theta =
                            degrees * Math.PI / 180;
                        const coordinates =
                            blowupCoordinates(theta);

                        if (
                            !coordinates
                            || coordinates.u === null
                            || coordinates.v === null
                            || Math.abs(coordinates.s) > maxS
                            || Math.abs(coordinates.u) > maxU
                            || coordinates.v
                                < complementaryVMin
                            || coordinates.v
                                > complementaryVMax
                            || coordinates.t
                                < complementaryTMin
                            || coordinates.t
                                > complementaryTMax
                        ) {
                            return "";
                        }

                        const mainPoint = {
                            x:
                                exceptionalX
                                + radialScale
                                * coordinates.s,
                            y:
                                chartCenterY
                                - slopeScale
                                * coordinates.u
                        };
                        const otherPoint =
                            complementaryPoint(
                                coordinates
                            );

                        return `
                            <path
                                class="clebsch-blowup-static-correspondence"
                                d="M ${mainPoint.x.toFixed(2)} ${mainPoint.y.toFixed(2)}
                                   L ${otherPoint.x.toFixed(2)} ${otherPoint.y.toFixed(2)}" />
                            <circle
                                class="clebsch-blowup-static-correspondence-point"
                                cx="${mainPoint.x.toFixed(2)}"
                                cy="${mainPoint.y.toFixed(2)}"
                                r="2.1" />
                            <circle
                                class="clebsch-blowup-static-correspondence-point"
                                cx="${otherPoint.x.toFixed(2)}"
                                cy="${otherPoint.y.toFixed(2)}"
                                r="2.1" />
                        `;
                    })
                    .join("");
        }

        PROJECTION_BLOWUP_TANGENT_DIRECTIONS
            .forEach((degrees, index) => {
                const theta =
                    degrees * Math.PI / 180;
                const u =
                    Math.tan(theta);
                const v =
                    1 / u;
                const y =
                    chartCenterY
                    - slopeScale * u;
                const point =
                    document.getElementById(
                        `clebsch-blowup-exceptional-point-${index + 1}`
                    );
                const label =
                    document.getElementById(
                        `clebsch-blowup-e-label-${index + 1}`
                    );
                const complementaryPointElement =
                    document.getElementById(
                        `clebsch-blowup-complementary-point-${index + 1}`
                    );
                const complementaryLabel =
                    document.getElementById(
                        `clebsch-blowup-complementary-label-${index + 1}`
                    );
                const complementaryY =
                    complementaryCenterY
                    - complementaryVScale
                    * v;

                point?.setAttribute(
                    "cy",
                    String(y)
                );
                label?.setAttribute(
                    "y",
                    String(
                        y
                        + (index === 0 ? -9 : 19)
                    )
                );
                complementaryPointElement?.setAttribute(
                    "cx",
                    String(
                        complementaryExceptionalX
                    )
                );
                complementaryPointElement?.setAttribute(
                    "cy",
                    String(
                        complementaryY
                    )
                );
                complementaryLabel?.setAttribute(
                    "x",
                    String(
                        complementaryExceptionalX
                        + 9
                    )
                );
                complementaryLabel?.setAttribute(
                    "y",
                    String(
                        complementaryY
                        + (index === 0 ? 5 : -5)
                    )
                );
            });

        projectionBlowupCorrespondenceUpdater =
            degrees => {
                const theta =
                    degrees * Math.PI / 180;
                const cosine =
                    Math.cos(theta);
                const sine =
                    Math.sin(theta);
                const directionU =
                    Math.abs(cosine) >= 1e-5
                        ? sine / cosine
                        : null;
                const directionV =
                    Math.abs(sine) >= 1e-5
                        ? cosine / sine
                        : null;
                const coordinates =
                    blowupCoordinates(theta);
                const trueAngle =
                    projectionBlowupTrueAngle(
                        degrees
                    );
                const sourceRadiusValue =
                    projectionTangentPlaneSectionRadius(
                        trueAngle
                    );
                const sourceMovingLine =
                    document.getElementById(
                        "clebsch-blowup-moving-source-line"
                    );
                const sourceMovingLineLabel =
                    document.getElementById(
                        "clebsch-blowup-moving-source-line-label"
                    );
                const sourceMovingPoint =
                    document.getElementById(
                        "clebsch-blowup-moving-source"
                    );
                const sourceMovingPointLabel =
                    document.getElementById(
                        "clebsch-blowup-moving-source-label"
                    );
                const mainMovingPoint =
                    document.getElementById(
                        "clebsch-blowup-moving-main"
                    );
                const complementaryMovingPoint =
                    document.getElementById(
                        "clebsch-blowup-moving-complementary"
                    );
                const mainExceptionalPoint =
                    document.getElementById(
                        "clebsch-blowup-moving-exceptional-main"
                    );
                const complementaryExceptionalPoint =
                    document.getElementById(
                        "clebsch-blowup-moving-exceptional-complementary"
                    );
                const movingGuide =
                    document.getElementById(
                        "clebsch-blowup-moving-correspondence"
                    );
                const targetMovingPoint =
                    document.getElementById(
                        "clebsch-blowup-target-moving"
                    );
                const targetMovingLabel =
                    document.getElementById(
                        "clebsch-blowup-target-moving-label"
                    );

                const setVisibility = (
                    element,
                    visible
                ) => {
                    if (!element) return;
                    element.style.display =
                        visible ? "" : "none";
                };

                const lineHalfLength = 118;
                const lineCosine =
                    Math.cos(trueAngle);
                const lineSine =
                    Math.sin(trueAngle);
                const lineX1 =
                    sourceCx
                    - lineHalfLength
                    * lineCosine;
                const lineY1 =
                    sourceCy
                    + lineHalfLength
                    * lineSine;
                const lineX2 =
                    sourceCx
                    + lineHalfLength
                    * lineCosine;
                const lineY2 =
                    sourceCy
                    - lineHalfLength
                    * lineSine;

                sourceMovingLine?.setAttribute(
                    "x1",
                    String(lineX1)
                );
                sourceMovingLine?.setAttribute(
                    "y1",
                    String(lineY1)
                );
                sourceMovingLine?.setAttribute(
                    "x2",
                    String(lineX2)
                );
                sourceMovingLine?.setAttribute(
                    "y2",
                    String(lineY2)
                );
                sourceMovingLineLabel?.setAttribute(
                    "x",
                    String(
                        lineX2
                        + 8 * lineCosine
                    )
                );
                sourceMovingLineLabel?.setAttribute(
                    "y",
                    String(
                        lineY2
                        - 8 * lineSine
                    )
                );
                setVisibility(
                    sourceMovingLine,
                    true
                );
                setVisibility(
                    sourceMovingLineLabel,
                    true
                );

                const sourceVisible =
                    sourceRadiusValue !== null
                    && Number.isFinite(
                        sourceRadiusValue
                    )
                    && Math.abs(
                        sourceRadiusValue
                    ) <= sourceRadius;

                if (
                    sourceVisible
                    && sourceMovingPoint
                ) {
                    const sourcePointX =
                        sourceCx
                        + sourceScale
                        * sourceRadiusValue
                        * lineCosine;
                    const sourcePointY =
                        sourceCy
                        - sourceScale
                        * sourceRadiusValue
                        * lineSine;

                    sourceMovingPoint.setAttribute(
                        "cx",
                        String(sourcePointX)
                    );
                    sourceMovingPoint.setAttribute(
                        "cy",
                        String(sourcePointY)
                    );
                    sourceMovingPointLabel?.setAttribute(
                        "x",
                        String(sourcePointX + 8)
                    );
                    sourceMovingPointLabel?.setAttribute(
                        "y",
                        String(sourcePointY - 7)
                    );
                }
                setVisibility(
                    sourceMovingPoint,
                    sourceVisible
                );
                setVisibility(
                    sourceMovingPointLabel,
                    sourceVisible
                );

                const mainExceptionalVisible =
                    directionU !== null
                    && Number.isFinite(directionU)
                    && Math.abs(directionU) <= maxU;

                if (
                    mainExceptionalVisible
                    && mainExceptionalPoint
                ) {
                    mainExceptionalPoint.setAttribute(
                        "cx",
                        String(exceptionalX)
                    );
                    mainExceptionalPoint.setAttribute(
                        "cy",
                        String(
                            chartCenterY
                            - slopeScale
                            * directionU
                        )
                    );
                }
                setVisibility(
                    mainExceptionalPoint,
                    mainExceptionalVisible
                );

                const complementaryExceptionalVisible =
                    directionV !== null
                    && Number.isFinite(directionV)
                    && directionV
                        >= complementaryVMin
                    && directionV
                        <= complementaryVMax;

                if (
                    complementaryExceptionalVisible
                    && complementaryExceptionalPoint
                ) {
                    complementaryExceptionalPoint
                        .setAttribute(
                            "cx",
                            String(
                                complementaryExceptionalX
                            )
                        );
                    complementaryExceptionalPoint
                        .setAttribute(
                            "cy",
                            String(
                                complementaryCenterY
                                - complementaryVScale
                                * directionV
                            )
                        );
                }
                setVisibility(
                    complementaryExceptionalPoint,
                    complementaryExceptionalVisible
                );

                const mainVisible =
                    coordinates
                    && coordinates.u !== null
                    && Number.isFinite(
                        coordinates.s
                    )
                    && Number.isFinite(
                        coordinates.u
                    )
                    && Math.abs(
                        coordinates.s
                    ) <= maxS
                    && Math.abs(
                        coordinates.u
                    ) <= maxU;

                let mainPoint = null;
                if (
                    mainVisible
                    && mainMovingPoint
                ) {
                    mainPoint = {
                        x:
                            exceptionalX
                            + radialScale
                            * coordinates.s,
                        y:
                            chartCenterY
                            - slopeScale
                            * coordinates.u
                    };
                    mainMovingPoint.setAttribute(
                        "cx",
                        String(mainPoint.x)
                    );
                    mainMovingPoint.setAttribute(
                        "cy",
                        String(mainPoint.y)
                    );
                }
                setVisibility(
                    mainMovingPoint,
                    mainVisible
                );

                const complementaryVisible =
                    coordinates
                    && coordinates.v !== null
                    && Number.isFinite(
                        coordinates.t
                    )
                    && Number.isFinite(
                        coordinates.v
                    )
                    && coordinates.v
                        >= complementaryVMin
                    && coordinates.v
                        <= complementaryVMax
                    && coordinates.t
                        >= complementaryTMin
                    && coordinates.t
                        <= complementaryTMax;

                let otherPoint = null;
                if (
                    complementaryVisible
                    && complementaryMovingPoint
                ) {
                    otherPoint =
                        complementaryPoint(
                            coordinates
                        );
                    complementaryMovingPoint
                        .setAttribute(
                            "cx",
                            String(otherPoint.x)
                        );
                    complementaryMovingPoint
                        .setAttribute(
                            "cy",
                            String(otherPoint.y)
                        );
                }
                setVisibility(
                    complementaryMovingPoint,
                    complementaryVisible
                );

                if (
                    movingGuide
                    && projectionBlowupComplementaryVisible
                    && mainVisible
                    && complementaryVisible
                    && mainPoint
                    && otherPoint
                ) {
                    movingGuide.setAttribute(
                        "d",
                        `M ${mainPoint.x.toFixed(2)} ${mainPoint.y.toFixed(2)}
                         L ${otherPoint.x.toFixed(2)} ${otherPoint.y.toFixed(2)}`
                    );
                    setVisibility(
                        movingGuide,
                        true
                    );
                } else {
                    setVisibility(
                        movingGuide,
                        false
                    );
                }

                const targetDirection =
                    projectionBlowupDirection(
                        degrees
                    );
                const targetState =
                    projectionAnglesFromDirection(
                        targetDirection
                    );
                const targetPoint =
                    projectionTargetPointFromState(
                        targetState
                    );
                const targetVisible =
                    targetPoint
                    && targetPoint.x >= -0.75
                    && targetPoint.x <= 1.55
                    && targetPoint.y >= -0.65
                    && targetPoint.y <= 1.75;

                if (
                    targetVisible
                    && targetMovingPoint
                ) {
                    const targetX =
                        710
                        + 300
                        * (targetPoint.x + 0.75)
                        / 2.30;
                    const targetY =
                        350
                        + 220
                        * (1.75 - targetPoint.y)
                        / 2.40;

                    targetMovingPoint.setAttribute(
                        "cx",
                        String(targetX)
                    );
                    targetMovingPoint.setAttribute(
                        "cy",
                        String(targetY)
                    );
                    targetMovingLabel?.setAttribute(
                        "x",
                        String(targetX + 9)
                    );
                    targetMovingLabel?.setAttribute(
                        "y",
                        String(targetY - 8)
                    );
                }
                setVisibility(
                    targetMovingPoint,
                    Boolean(targetVisible)
                );
                setVisibility(
                    targetMovingLabel,
                    Boolean(targetVisible)
                );
            };

        projectionBlowupCorrespondenceUpdater(
            projectionBlowupDirectionDegrees
        );

        const branchPath =
            document.getElementById(
                "clebsch-blowup-target-branch"
            );
        const bitangentPath =
            document.getElementById(
                "clebsch-blowup-target-bitangent"
            );

        if (!branchPath || !bitangentPath) {
            return;
        }

        const targetBox = {
            left: -0.75,
            right: 1.55,
            bottom: -0.65,
            top: 1.75,
            x: 710,
            y: 350,
            width: 300,
            height: 220
        };
        const targetSvgPoint = point => ({
            x:
                targetBox.x
                + targetBox.width
                * (point.x - targetBox.left)
                / (targetBox.right - targetBox.left),
            y:
                targetBox.y
                + targetBox.height
                * (targetBox.top - point.y)
                / (targetBox.top - targetBox.bottom)
        });
        const gridX = 76;
        const gridY = 76;
        const values =
            Array.from(
                { length: gridY + 1 },
                (_, row) =>
                    Array.from(
                        { length: gridX + 1 },
                        (_, column) => {
                            const x =
                                targetBox.left
                                + (
                                    targetBox.right
                                    - targetBox.left
                                )
                                * column / gridX;
                            const y =
                                targetBox.bottom
                                + (
                                    targetBox.top
                                    - targetBox.bottom
                                )
                                * row / gridY;
                            return {
                                x,
                                y,
                                value:
                                    projectionBranchQuarticValue(
                                        x,
                                        y
                                    )
                            };
                        }
                    )
            );
        let quarticPath = "";

        const edgeCrossing = (
            first,
            second
        ) => {
            if (
                !Number.isFinite(first.value)
                || !Number.isFinite(second.value)
                || first.value === second.value
                || (
                    first.value > 0
                    && second.value > 0
                )
                || (
                    first.value < 0
                    && second.value < 0
                )
            ) {
                return null;
            }

            const t =
                first.value
                / (first.value - second.value);

            if (t < 0 || t > 1) return null;

            return {
                x:
                    first.x
                    + t * (second.x - first.x),
                y:
                    first.y
                    + t * (second.y - first.y)
            };
        };

        for (
            let row = 0;
            row < gridY;
            row += 1
        ) {
            for (
                let column = 0;
                column < gridX;
                column += 1
            ) {
                const bottomLeft =
                    values[row][column];
                const bottomRight =
                    values[row][column + 1];
                const topRight =
                    values[row + 1][column + 1];
                const topLeft =
                    values[row + 1][column];
                const crossings = [
                    edgeCrossing(
                        bottomLeft,
                        bottomRight
                    ),
                    edgeCrossing(
                        bottomRight,
                        topRight
                    ),
                    edgeCrossing(
                        topRight,
                        topLeft
                    ),
                    edgeCrossing(
                        topLeft,
                        bottomLeft
                    )
                ].filter(Boolean);

                if (
                    crossings.length < 2
                ) {
                    continue;
                }

                const pairs =
                    crossings.length === 4
                        ? [
                            [crossings[0], crossings[1]],
                            [crossings[2], crossings[3]]
                        ]
                        : [[
                            crossings[0],
                            crossings[1]
                        ]];

                pairs.forEach(pair => {
                    const first =
                        targetSvgPoint(pair[0]);
                    const second =
                        targetSvgPoint(pair[1]);
                    quarticPath +=
                        ` M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
                        + ` L ${second.x.toFixed(2)} ${second.y.toFixed(2)}`;
                });
            }
        }

        branchPath.setAttribute(
            "d",
            quarticPath
        );

        const lineY = x =>
            (7818 * x - 2999)
            / 5169;
        const lineCandidates = [
            {
                x: targetBox.left,
                y: lineY(targetBox.left)
            },
            {
                x: targetBox.right,
                y: lineY(targetBox.right)
            }
        ].filter(point =>
            point.y >= targetBox.bottom
            && point.y <= targetBox.top
        );

        [
            targetBox.bottom,
            targetBox.top
        ].forEach(y => {
            const x =
                (5169 * y + 2999)
                / 7818;

            if (
                x >= targetBox.left
                && x <= targetBox.right
            ) {
                lineCandidates.push({
                    x,
                    y
                });
            }
        });

        if (lineCandidates.length >= 2) {
            const first =
                targetSvgPoint(
                    lineCandidates[0]
                );
            const second =
                targetSvgPoint(
                    lineCandidates[1]
                );

            bitangentPath.setAttribute(
                "d",
                `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} L ${second.x.toFixed(2)} ${second.y.toFixed(2)}`
            );
        }

        PROJECTION_EXCEPTIONAL_TANGENCY_POINTS
            .forEach((point, index) => {
                const svgPoint =
                    targetSvgPoint(point);
                const dot =
                    document.getElementById(
                        `clebsch-blowup-target-point-${index + 1}`
                    );
                const label =
                    document.getElementById(
                        `clebsch-blowup-target-label-${index + 1}`
                    );

                dot?.setAttribute(
                    "cx",
                    String(svgPoint.x)
                );
                dot?.setAttribute(
                    "cy",
                    String(svgPoint.y)
                );
                label?.setAttribute(
                    "x",
                    String(svgPoint.x + 9)
                );
                label?.setAttribute(
                    "y",
                    String(
                        svgPoint.y
                        + (index === 0 ? -7 : 15)
                    )
                );
            });
    }

    function projectionAnglesFromDirection(
        direction
    ) {
        return {
            azimuth:
                Math.atan2(
                    direction.y,
                    direction.x
                ) * 180 / Math.PI,
            elevation:
                Math.asin(
                    Math.max(
                        -1,
                        Math.min(
                            1,
                            direction.z
                        )
                    )
                ) * 180 / Math.PI
        };
    }

    function projectionBlowupCurrentTargetPoint() {
        const direction =
            projectionBlowupDirection();
        const state =
            projectionAnglesFromDirection(
                direction
            );
        const point =
            projectionTargetPointFromState(
                state
            );

        if (point) {
            const lineResidual =
                7818 * point.x
                - 5169 * point.y
                - 2999;

            if (Math.abs(lineResidual) > 1e-6) {
                console.warn(
                    "Blow-up target point left the special bitangent",
                    {
                        point,
                        lineResidual
                    }
                );
            }
        }

        return point;
    }

    function projectionNearestResidualDistanceToP() {
        const data =
            projectionResidualData();

        if (
            Math.abs(
                data.linearCoefficient
            ) <= 1e-8 * data.scale
        ) {
            return 0;
        }

        const roots =
            projectionResidualParameters();

        return roots.length
            ? Math.min(
                ...roots.map(Math.abs)
            )
            : Infinity;
    }

    function updateProjectionBlowupPrompt() {
        const prompt =
            document.getElementById(
                "clebsch-blowup-prompt"
            );

        if (!prompt) return;

        const relevant =
            !projectionBlowupActive
            && currentClebschInfoMode
                === "equation"
            && currentClebschEquationStep
                === 4
            && projectionNearestResidualDistanceToP()
                <= PROJECTION_BLOWUP_NEAR_P_DISTANCE;

        prompt.hidden = !relevant;
    }

    function setProjectionBlowupComplementaryVisible(
        visible
    ) {
        projectionBlowupComplementaryVisible =
            Boolean(visible);

        const complementaryStage =
            document.getElementById(
                "clebsch-blowup-complementary-stage"
            );
        const staticCorrespondences =
            document.getElementById(
                "clebsch-blowup-static-correspondences"
            );
        const movingCorrespondence =
            document.getElementById(
                "clebsch-blowup-moving-correspondence"
            );
        const toggle =
            document.getElementById(
                "clebsch-blowup-complementary-toggle"
            );

        if (complementaryStage) {
            complementaryStage.style.display =
                projectionBlowupComplementaryVisible
                    ? ""
                    : "none";
        }
        if (staticCorrespondences) {
            staticCorrespondences.style.display =
                projectionBlowupComplementaryVisible
                    ? ""
                    : "none";
        }
        if (
            movingCorrespondence
            && !projectionBlowupComplementaryVisible
        ) {
            movingCorrespondence.style.display =
                "none";
        }
        if (toggle) {
            const verb =
                document.getElementById(
                    "clebsch-blowup-complementary-toggle-verb"
                );
            const verbText =
                projectionBlowupComplementaryVisible
                    ? "hide"
                    : "show";

            if (verb) {
                verb.textContent = verbText;
            }
            toggle.setAttribute(
                "aria-label",
                `${verbText} U_b`
            );
            toggle.setAttribute(
                "aria-expanded",
                String(
                    projectionBlowupComplementaryVisible
                )
            );
        }

        projectionBlowupCorrespondenceUpdater?.(
            projectionBlowupDirectionDegrees
        );
    }

    function updateProjectionBlowupSchematic() {
        if (!projectionBlowupActive) {
            return;
        }

        const schematicAngle =
            projectionBlowupProjectiveDisplayAngle(
                projectionBlowupDirectionDegrees
            );
        const cx = 75;
        const cy = 67;
        const radius = 43;
        const x =
            cx + radius
                * Math.cos(schematicAngle);
        const y =
            cy - radius
                * Math.sin(schematicAngle);

        if (projectionBlowupSelectedPoint) {
            projectionBlowupSelectedPoint
                .setAttribute("cx", String(x));
            projectionBlowupSelectedPoint
                .setAttribute("cy", String(y));
        }

        if (projectionBlowupSelectedLabel) {
            const dx = x - cx;
            const dy = y - cy;
            const length =
                Math.hypot(dx, dy) || 1;
            projectionBlowupSelectedLabel
                .setAttribute(
                    "x",
                    String(
                        x + 15 * dx / length
                    )
                );
            projectionBlowupSelectedLabel
                .setAttribute(
                    "y",
                    String(
                        y + 15 * dy / length
                    )
                );
        }

        if (projectionBlowupDirectionRay) {
            projectionBlowupDirectionRay
                .setAttribute("x2", String(x));
            projectionBlowupDirectionRay
                .setAttribute("y2", String(y));
        }

        if (projectionBlowupSlider) {
            projectionBlowupSlider.value =
                String(
                    projectionBlowupDirectionDegrees
                );
        }

        if (projectionBlowupValueLabel) {
            projectionBlowupValueLabel.value =
                `${projectionBlowupDirectionDegrees.toFixed(1)}°`;
            projectionBlowupValueLabel.textContent =
                projectionBlowupValueLabel.value;
        }

        projectionBlowupCorrespondenceUpdater?.(
            projectionBlowupDirectionDegrees
        );

        const direction =
            projectionBlowupDirection();
        const angles =
            projectionAnglesFromDirection(
                direction
            );

        projectionLineState.azimuth =
            angles.azimuth;
        projectionLineState.elevation =
            angles.elevation;

        renderProjectionLineControls();

        const legacyBlowupSlider =
            document.getElementById(
                "clebsch-blowup-direction"
            );
        if (
            legacyBlowupSlider
            && legacyBlowupSlider
                !== projectionBlowupSlider
        ) {
            legacyBlowupSlider.value =
                String(
                    projectionBlowupDirectionDegrees
                );
        }

        projectionBlowupCurrentTargetPoint();
        updateTargetProjectionCard(
            currentClebschRemarkMode
        );
    }

    function clearProjectionBlowupRamificationCue() {
        document
            .querySelectorAll(
                ".clebsch-blowup-ramification-pulse"
            )
            .forEach(element => {
                element.classList.remove(
                    "clebsch-blowup-ramification-pulse"
                );
            });

        const cue =
            document.getElementById(
                "clebsch-blowup-ramification-cue"
            );

        if (!cue) {
            return;
        }

        cue.classList.remove("active");
        cue.innerHTML = "";
    }

    function triggerProjectionBlowupRamificationCue(
        specialIndex
    ) {
        const index = Number(specialIndex);
        if (
            index !== 0
            && index !== 1
        ) {
            return;
        }

        /* Only animate the two moving preimages that actually
           collapse together at e_i. Do not pulse any other
           marker elsewhere in the diagram. */
        const pulseIds = [
            "clebsch-blowup-moving-main",
            "clebsch-blowup-moving-exceptional-main"
        ];

        pulseIds.forEach(id => {
            const element =
                document.getElementById(id);
            if (!element) return;

            element.classList.remove(
                "clebsch-blowup-ramification-pulse"
            );
            void element.getBoundingClientRect();
            element.classList.add(
                "clebsch-blowup-ramification-pulse"
            );
        });

        const cue =
            document.getElementById(
                "clebsch-blowup-ramification-cue"
            );

        if (cue) {
            cue.innerHTML =
                "Ramification at e<sub>"
                + (index + 1)
                + "</sub>: the two preimages coincide in tangent direction V<sub>"
                + (index + 1)
                + "</sub>.";

            cue.classList.remove("active");
            void cue.getBoundingClientRect();
            cue.classList.add("active");
        }
    }

    function setProjectionBlowupPlaying(
        playing
    ) {
        const shouldPlay =
            Boolean(playing)
            && projectionBlowupActive;

        if (!shouldPlay) {
            projectionBlowupPlaying = false;
            projectionBlowupNextStopDegrees = null;

            if (
                projectionBlowupAnimationFrame
                !== null
            ) {
                cancelAnimationFrame(
                    projectionBlowupAnimationFrame
                );
                projectionBlowupAnimationFrame =
                    null;
            }
            projectionBlowupAnimationLastTime = 0;

            if (projectionBlowupPlayButton) {
                projectionBlowupPlayButton
                    .classList.remove("playing");
                projectionBlowupPlayButton
                    .setAttribute(
                        "aria-pressed",
                        "false"
                    );
                projectionBlowupPlayButton
                    .textContent = "▶";
            }
            return;
        }

        if (projectionBlowupPlaying) {
            return;
        }

        clearProjectionBlowupRamificationCue();
        projectionBlowupPlaying = true;
        projectionBlowupNextStopDegrees =
            PROJECTION_BLOWUP_TANGENT_DIRECTIONS
                .map(degrees => ({
                    degrees,
                    distance:
                        (
                            degrees
                            - projectionBlowupDirectionDegrees
                            + 180
                        ) % 180
                }))
                .filter(
                    candidate =>
                        candidate.distance > 1e-6
                )
                .sort(
                    (first, second) =>
                        first.distance
                        - second.distance
                )[0]?.degrees ?? null;

        if (projectionBlowupPlayButton) {
            projectionBlowupPlayButton
                .classList.add("playing");
            projectionBlowupPlayButton
                .setAttribute(
                    "aria-pressed",
                    "true"
                );
            projectionBlowupPlayButton
                .textContent = "❚❚";
        }

        projectionBlowupAnimationLastTime = 0;

        const step = timestamp => {
            projectionBlowupAnimationFrame = null;

            if (
                !projectionBlowupActive
                || !projectionBlowupPlaying
            ) {
                setProjectionBlowupPlaying(false);
                return;
            }

            if (
                projectionBlowupAnimationLastTime
                === 0
            ) {
                projectionBlowupAnimationLastTime =
                    timestamp;
            }

            const elapsed =
                timestamp
                - projectionBlowupAnimationLastTime;

            if (
                elapsed
                >= PROJECTION_LINE_COMMIT_INTERVAL_MS
            ) {
                const previousDegrees =
                    projectionBlowupDirectionDegrees;
                const forwardDelta =
                    180
                    * elapsed
                    / PROJECTION_BLOWUP_ANIMATION_PERIOD_MS;
                const stopDistance =
                    projectionBlowupNextStopDegrees
                        === null
                        ? Infinity
                        : (
                            projectionBlowupNextStopDegrees
                            - previousDegrees
                            + 180
                        ) % 180;

                if (
                    stopDistance > 1e-7
                    && stopDistance
                        <= forwardDelta + 1e-7
                ) {
                    projectionBlowupDirectionDegrees =
                        projectionBlowupNextStopDegrees;
                    projectionBlowupAnimationLastTime =
                        timestamp;

                    const specialIndex =
                        PROJECTION_BLOWUP_TANGENT_DIRECTIONS
                            .findIndex(
                                degrees =>
                                    Math.abs(
                                        degrees
                                        - projectionBlowupNextStopDegrees
                                    ) < 1e-8
                            );

                    updateProjectionBlowupSchematic();
                    triggerProjectionBlowupRamificationCue(
                        specialIndex
                    );
                    setProjectionBlowupPlaying(false);
                    return;
                }

                projectionBlowupDirectionDegrees =
                    (
                        previousDegrees
                        + forwardDelta
                    ) % 180;

                projectionBlowupAnimationLastTime =
                    timestamp;
                updateProjectionBlowupSchematic();
            }

            if (projectionBlowupPlaying) {
                projectionBlowupAnimationFrame =
                    requestAnimationFrame(step);
            }
        };

        projectionBlowupAnimationFrame =
            requestAnimationFrame(step);
    }


    function setProjectionBlowupActive(
        active
    ) {
        const next = Boolean(active);
        const view =
            document.getElementById(
                "clebsch-blowup-view"
            );
        const prompt =
            document.getElementById(
                "clebsch-blowup-prompt"
            );
        const targetCard =
            document.getElementById(
                "clebsch-tangent-projection-card"
            );
        const exceptionalInset =
            document.getElementById(
                "clebsch-exceptional-inset"
            );
        const mapDivider =
            document.getElementById(
                "clebsch-exceptional-map-divider"
            );
        const targetLegend =
            document.getElementById(
                "clebsch-target-special-legend"
            );

        if (next === projectionBlowupActive) {
            return;
        }

        if (next) {
            projectionBlowupSavedLineState = {
                azimuth:
                    projectionLineState.azimuth,
                elevation:
                    projectionLineState.elevation
            };

            const currentAngle =
                Math.atan2(
                    projectionLineDirection().y,
                    projectionLineDirection().x
                ) * 180 / Math.PI;
            projectionBlowupDirectionDegrees =
                ((currentAngle % 180) + 180)
                % 180;

            pauseAllProjectionLineAnimations();
            projectionBlowupActive = true;
            setProjectionBlowupComplementaryVisible(
                false
            );

            if (view) view.hidden = false;
            if (prompt) prompt.hidden = true;
            targetCard?.classList.add(
                "clebsch-target-card-blowup"
            );
            if (exceptionalInset) {
                exceptionalInset.hidden = false;
            }
            if (mapDivider) {
                mapDivider.hidden = false;
            }
            if (targetLegend) {
                targetLegend.hidden = false;
            }

            updateProjectionBlowupSchematic();

            requestAnimationFrame(() => {
                tangentProjection2D?.resize?.();
                scheduleTargetProjectionViewportSync();
            });
            return;
        }

        setProjectionBlowupPlaying(false);
        clearProjectionBlowupRamificationCue();
        projectionBlowupActive = false;

        if (view) view.hidden = true;
        targetCard?.classList.remove(
            "clebsch-target-card-blowup"
        );
        if (exceptionalInset) {
            exceptionalInset.hidden = true;
        }
        if (mapDivider) {
            mapDivider.hidden = true;
        }
        if (targetLegend) {
            targetLegend.hidden = true;
        }

        if (projectionBlowupSavedLineState) {
            projectionLineState.azimuth =
                projectionBlowupSavedLineState.azimuth;
            projectionLineState.elevation =
                projectionBlowupSavedLineState.elevation;
        }

        projectionBlowupSavedLineState = null;
        renderProjectionLineControls();
        commitProjectionLine();
        updateProjectionBlowupPrompt();

        requestAnimationFrame(() => {
            tangentProjection2D?.resize?.();
            scheduleTargetProjectionViewportSync();
        });
    }

    function setupProjectionBlowupView() {
        const prompt =
            document.getElementById(
                "clebsch-blowup-prompt"
            );
        const view =
            document.getElementById(
                "clebsch-blowup-view"
            );
        const back =
            document.getElementById(
                "clebsch-blowup-back"
            );

        projectionBlowupSlider =
            document.getElementById(
                "clebsch-blowup-inline-direction"
            );
        projectionBlowupSelectedPoint =
            document.getElementById(
                "clebsch-blowup-inline-selected"
            );
        projectionBlowupSelectedLabel =
            document.getElementById(
                "clebsch-blowup-inline-selected-label"
            );
        projectionBlowupDirectionRay =
            document.getElementById(
                "clebsch-blowup-inline-ray"
            );
        projectionBlowupPlayButton =
            document.getElementById(
                "clebsch-blowup-inline-play"
            );
        projectionBlowupValueLabel =
            document.getElementById(
                "clebsch-blowup-inline-value"
            );

        projectionRenderActualBlowupGeometry();
        setProjectionBlowupComplementaryVisible(
            false
        );

        const complementaryToggle =
            document.getElementById(
                "clebsch-blowup-complementary-toggle"
            );
        const mainStrictTransform =
            document.getElementById(
                "clebsch-blowup-actual-strict-transform"
            );

        const revealComplementaryChart = () => {
            if (
                !projectionBlowupComplementaryVisible
            ) {
                setProjectionBlowupComplementaryVisible(
                    true
                );
            }
        };

        complementaryToggle?.addEventListener(
            "click",
            () => {
                setProjectionBlowupComplementaryVisible(
                    !projectionBlowupComplementaryVisible
                );
            }
        );

        complementaryToggle?.addEventListener(
            "keydown",
            event => {
                if (
                    event.key !== "Enter"
                    && event.key !== " "
                ) {
                    return;
                }
                event.preventDefault();
                setProjectionBlowupComplementaryVisible(
                    !projectionBlowupComplementaryVisible
                );
            }
        );

        mainStrictTransform?.addEventListener(
            "click",
            revealComplementaryChart
        );

        prompt?.addEventListener(
            "click",
            () => {
                setProjectionBlowupActive(
                    true
                );
            }
        );

        back?.addEventListener(
            "click",
            () => {
                setProjectionBlowupActive(
                    false
                );
            }
        );

        projectionBlowupPlayButton?.addEventListener(
            "click",
            () => {
                setProjectionBlowupPlaying(
                    !projectionBlowupPlaying
                );
            }
        );

        projectionBlowupSlider?.addEventListener(
            "input",
            event => {
                setProjectionBlowupPlaying(false);
                clearProjectionBlowupRamificationCue();
                projectionBlowupDirectionDegrees =
                    Number(
                        event.target.value
                    );
                updateProjectionBlowupSchematic();
            }
        );

        const specialLayer =
            document.querySelector(
                "[data-blowup-inline-special-points]"
            );

        if (specialLayer) {
            specialLayer.innerHTML =
                PROJECTION_BLOWUP_TANGENT_DIRECTIONS
                    .map((degrees, index) => {
                        const angle =
                            projectionBlowupProjectiveDisplayAngle(
                                degrees
                            );
                        const x =
                            75
                            + 43
                            * Math.cos(angle);
                        const y =
                            67
                            - 43
                            * Math.sin(angle);

                        const dx =
                            x - 75;
                        const dy =
                            y - 67;
                        const length =
                            Math.hypot(dx, dy) || 1;
                        const ux =
                            dx / length;
                        const uy =
                            dy / length;
                        const labelX =
                            x + 12 * ux;
                        const labelY =
                            y + 12 * uy;

                        return `
                            <circle
                                class="clebsch-exceptional-special-point"
                                cx="${x}"
                                cy="${y}"
                                r="3.5">
                                <title>
                                    e${index + 1} = [V${index + 1}]
                                </title>
                            </circle>
                            <text
                                class="clebsch-blowup-special-label"
                                x="${labelX}"
                                y="${labelY}"
                                text-anchor="middle">
                                <tspan>e</tspan><tspan class="clebsch-svg-sub">${index + 1}</tspan>
                            </text>
                        `;
                    })
                    .join("");
        }

        updateProjectionBlowupPrompt();
    }

    function projectionRamificationDisplayActive() {
        return projectionRamificationLocked
            || projectionLineTransientShineActive;
    }

    function updateProjectionLineNonstopButton() {
        if (!projectionLineNonstopButton) {
            return;
        }

        projectionLineNonstopButton
            .classList.toggle(
                "active",
                projectionLineNonstop
            );
        projectionLineNonstopButton
            .setAttribute(
                "aria-pressed",
                String(
                    projectionLineNonstop
                )
            );
        projectionLineNonstopButton.title =
            projectionLineNonstop
                ? "Restore auto-stop at ramification"
                : "Do not stop at ramification";
        projectionLineNonstopButton.setAttribute(
            "aria-label",
            projectionLineNonstop
                ? "Restore auto-stop at ramification"
                : "Do not stop at ramification"
        );
    }

    function triggerProjectionLineTransientShine() {
        projectionLineTransientShineActive = true;

        if (
            projectionLineTransientShineTimer
            !== null
        ) {
            clearTimeout(
                projectionLineTransientShineTimer
            );
        }

        projectionLineTransientShineTimer =
            setTimeout(() => {
                projectionLineTransientShineTimer =
                    null;
                projectionLineTransientShineActive =
                    false;

                /* Only the glow state changes here. The current line,
                   residual points, and target point remain at whatever
                   authoritative drag position is current when the shine
                   ends. */
                commitProjectionLine();
            }, 180);
    }

    function nearestProjectionRamificationElevation(
        azimuthDegrees,
        elevationDegrees
    ) {
        const min = -89.5;
        const max = 89.5;
        const step = 0.5;
        const roots = [];
        const samples = [];

        for (
            let angle = min;
            angle <= max + 1e-9;
            angle += step
        ) {
            const value =
                projectionRamificationDiscriminant(
                    azimuthDegrees,
                    angle
                );

            samples.push({
                angle,
                value
            });
        }

        const addRoot = value => {
            if (!Number.isFinite(value)) return;

            const normalized =
                Math.max(
                    min,
                    Math.min(max, value)
                );

            if (
                roots.every(
                    root =>
                        Math.abs(
                            root - normalized
                        ) > 0.05
                )
            ) {
                roots.push(normalized);
            }
        };

        samples.forEach(sample => {
            if (
                Math.abs(sample.value)
                < 1e-7
            ) {
                addRoot(sample.angle);
            }
        });

        for (
            let index = 1;
            index < samples.length;
            index += 1
        ) {
            const leftSample =
                samples[index - 1];
            const rightSample =
                samples[index];

            if (
                !Number.isFinite(
                    leftSample.value
                )
                || !Number.isFinite(
                    rightSample.value
                )
                || leftSample.value
                    * rightSample.value
                    > 0
            ) {
                continue;
            }

            let left =
                leftSample.angle;
            let right =
                rightSample.angle;
            let leftValue =
                leftSample.value;

            for (
                let iteration = 0;
                iteration < 45;
                iteration += 1
            ) {
                const middle =
                    (left + right) / 2;
                const middleValue =
                    projectionRamificationDiscriminant(
                        azimuthDegrees,
                        middle
                    );

                if (
                    Math.abs(middleValue)
                    < 1e-12
                ) {
                    left = middle;
                    right = middle;
                    break;
                }

                if (
                    leftValue
                    * middleValue
                    <= 0
                ) {
                    right = middle;
                } else {
                    left = middle;
                    leftValue =
                        middleValue;
                }
            }

            addRoot(
                (left + right) / 2
            );
        }

        if (!roots.length) {
            const nearestSample =
                samples.reduce(
                    (best, sample) =>
                        Math.abs(sample.value)
                        < Math.abs(best.value)
                            ? sample
                            : best
                );

            return nearestSample.angle;
        }

        return roots.reduce(
            (nearest, candidate) =>
                Math.abs(
                    candidate
                    - elevationDegrees
                )
                < Math.abs(
                    nearest
                    - elevationDegrees
                )
                    ? candidate
                    : nearest
        );
    }

    function projectionResidualExpressions() {
        const direction = projectionLineDirection();
        const roots = projectionResidualParameters();
        return [0, 1].map(index => {
            const t = roots[index];
            if (t === undefined) {
                return {
                    id: `projection-residual-${index + 1}`,
                    latex: "(0,0,0)",
                    color: PROJECTION_RESIDUAL_COLOR,
                    pointSize: PROJECTION_RESIDUAL_POINT_SIZE,
                    hidden: true
                };
            }
            const point = {
                x: PROJECTION_POINT.x + t * direction.x,
                y: PROJECTION_POINT.y + t * direction.y,
                z: PROJECTION_POINT.z + t * direction.z
            };
            const residual = Math.abs(
                clebschSurfaceValue(point.x, point.y, point.z)
            );
            if (residual > 1e-6 * (1 + Math.abs(t) ** 3)) {
                console.warn("Unverified residual line-surface intersection", {
                    t,
                    point,
                    residual
                });
            }
            return {
                id: `projection-residual-${index + 1}`,
                latex: `(${pointCoordinateLatex(point.x)},${pointCoordinateLatex(point.y)},${pointCoordinateLatex(point.z)})`,
                color: PROJECTION_RESIDUAL_COLOR,
                pointSize: PROJECTION_RESIDUAL_POINT_SIZE,
                hidden: currentClebschEquationStep < 2
            };
        });
    }

    function projectionLineSceneExpressions() {
        return [
            projectionLineExpression(),
            ...projectionResidualExpressions(),
            projectionNonstopVisitedRamificationExpression()
        ];
    }

    function projectionLineLinearLatex(terms) {
        let latex = "";
        terms.forEach(({ coefficient, variable }) => {
            if (Math.abs(coefficient) < 1e-12) return;
            const magnitude = projectionLineNumber(Math.abs(coefficient));
            const sign = coefficient < 0 ? "-" : "+";
            const term = `${magnitude}\\left(${variable}\\right)`;
            latex += latex ? `${sign}${term}` : (coefficient < 0 ? `-${term}` : term);
        });
        return latex || "0";
    }

    function projectionFind3DViewportLimits(
        value,
        seen = new Set()
    ) {
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
                projectionFind3DViewportLimits(
                    child,
                    seen
                );
            if (limits) return limits;
        }

        return null;
    }

    function projectionCurrent3DViewportLimits() {
        if (
            !mainCalculator
            || typeof mainCalculator.getState
                !== "function"
        ) {
            return null;
        }

        return projectionFind3DViewportLimits(
            mainCalculator.getState()
        );
    }

    function projectionRequiredLineParameterExtent(
        limits = projectionCurrent3DViewportLimits()
    ) {
        if (!limits) return null;

        const xExtent = Math.max(
            Math.abs(
                Number(limits.xmin)
                - PROJECTION_POINT.x
            ),
            Math.abs(
                Number(limits.xmax)
                - PROJECTION_POINT.x
            )
        );
        const yExtent = Math.max(
            Math.abs(
                Number(limits.ymin)
                - PROJECTION_POINT.y
            ),
            Math.abs(
                Number(limits.ymax)
                - PROJECTION_POINT.y
            )
        );
        const zExtent = Math.max(
            Math.abs(
                Number(limits.zmin)
                - PROJECTION_POINT.z
            ),
            Math.abs(
                Number(limits.zmax)
                - PROJECTION_POINT.z
            )
        );

        if (
            !Number.isFinite(xExtent)
            || !Number.isFinite(yExtent)
            || !Number.isFinite(zExtent)
        ) {
            return null;
        }

        /* projectionLineDirection() is a unit vector, so |t| is Euclidean
           distance from P. The farthest corner of the current Desmos cube
           therefore gives one direction-independent t-envelope that covers
           every visible piece of every line through P. */
        return Math.hypot(
            xExtent,
            yExtent,
            zExtent
        );
    }

    function projectionInitializeLineParameterExtentIfNeeded() {
        if (
            Number.isFinite(
                projectionLineParameterExtent
            )
            && projectionLineParameterExtent > 0
        ) {
            return;
        }

        const required =
            projectionRequiredLineParameterExtent();

        /* Match Page 1's cached viewport envelope: start with generous
           headroom, then only grow it when a later camera position escapes.
           The fallback is used only before the 3D calculator exposes limits. */
        projectionLineParameterExtent =
            Number.isFinite(required)
                ? Math.max(
                    18,
                    1.75 * required
                )
                : 18;
    }

    function projectionEnsureLineParameterExtentCoversViewport() {
        const previous =
            projectionLineParameterExtent;

        projectionInitializeLineParameterExtentIfNeeded();

        const required =
            projectionRequiredLineParameterExtent();

        if (
            Number.isFinite(required)
            && required
                > projectionLineParameterExtent
        ) {
            projectionLineParameterExtent =
                Math.max(
                    projectionLineParameterExtent,
                    1.75 * required
                );
        }

        return previous
            !== projectionLineParameterExtent;
    }

    function projectionVisibleLineParameterRange() {
        /* During parameter motion we are rewriting the line anyway, so fold
           any newly needed viewport growth into that same atomic expression.
           Camera-only changes still use the debounced sync below. */
        projectionEnsureLineParameterExtentCoversViewport();

        return {
            min: -projectionLineParameterExtent,
            max: projectionLineParameterExtent
        };
    }

    function projectionLineExpression() {
        const direction =
            projectionLineDirection();

        /* Same fix as Page 1: render the line as a native 3D segment rather
           than an equality restriction. The segment is deliberately longer
           than the visible cube and Desmos clips it. This eliminates the old
           disappearing-line / unsupported-restriction family of bugs. */
        const range =
            projectionVisibleLineParameterRange();
        const first = {
            x:
                PROJECTION_POINT.x
                + range.min * direction.x,
            y:
                PROJECTION_POINT.y
                + range.min * direction.y,
            z:
                PROJECTION_POINT.z
                + range.min * direction.z
        };
        const second = {
            x:
                PROJECTION_POINT.x
                + range.max * direction.x,
            y:
                PROJECTION_POINT.y
                + range.max * direction.y,
            z:
                PROJECTION_POINT.z
                + range.max * direction.z
        };

        return {
            id: "projection-line",
            latex:
                `\\operatorname{segment}((${pointCoordinateLatex(first.x)},`
                + `${pointCoordinateLatex(first.y)},${pointCoordinateLatex(first.z)}),`
                + `(${pointCoordinateLatex(second.x)},${pointCoordinateLatex(second.y)},`
                + `${pointCoordinateLatex(second.z)}))`,
            color: PROJECTION_LINE_COLOR,
            lineWidth: 1
        };
    }

    function normalizedPlane(plane) {
        const scale = Math.hypot(...plane);
        return plane.map(coefficient => coefficient / scale);
    }

    function determinant4(rows) {
        const matrix = rows.map(row => [...row]);
        let determinant = 1;
        for (let column = 0; column < 4; column += 1) {
            let pivot = column;
            for (let row = column + 1; row < 4; row += 1) {
                if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) {
                    pivot = row;
                }
            }
            if (Math.abs(matrix[pivot][column]) < 1e-12) return 0;
            if (pivot !== column) {
                [matrix[pivot], matrix[column]] = [matrix[column], matrix[pivot]];
                determinant *= -1;
            }
            const pivotValue = matrix[column][column];
            determinant *= pivotValue;
            for (let row = column + 1; row < 4; row += 1) {
                const factor = matrix[row][column] / pivotValue;
                for (let entry = column + 1; entry < 4; entry += 1) {
                    matrix[row][entry] -= factor * matrix[column][entry];
                }
            }
        }
        return determinant;
    }

    function projectiveLinesMeet(firstNumber, secondNumber) {
        const rows = [
            ...BITANGENT_LINE_PLANES[firstNumber - 1],
            ...BITANGENT_LINE_PLANES[secondNumber - 1]
        ].map(normalizedPlane);
        return Math.abs(determinant4(rows)) < 1e-8;
    }

    function buildSchlafliLabels() {
        const labels = Array(27);
        const byLabel = new Map();
        const setLabel = (lineNumber, family, indices) => {
            const sortedIndices = [...indices].sort((first, second) => first - second);
            const key = `${family}${sortedIndices.join("")}`;
            const label = { family, indices: sortedIndices, key, lineNumber };
            labels[lineNumber - 1] = label;
            byLabel.set(key, lineNumber);
        };

        DOUBLE_SIX_ORANGE_NUMBERS.forEach((lineNumber, index) => {
            setLabel(lineNumber, "E", [index + 1]);
        });
        DOUBLE_SIX_BLUE_NUMBERS.forEach((lineNumber, index) => {
            setLabel(lineNumber, "C", [index + 1]);
        });

        for (let lineNumber = 1; lineNumber <= 15; lineNumber += 1) {
            const eIndices = DOUBLE_SIX_ORANGE_NUMBERS
                .map((eLine, index) => projectiveLinesMeet(lineNumber, eLine) ? index + 1 : null)
                .filter(Boolean);
            const cIndices = DOUBLE_SIX_BLUE_NUMBERS
                .map((cLine, index) => projectiveLinesMeet(lineNumber, cLine) ? index + 1 : null)
                .filter(Boolean);
            if (eIndices.length !== 2 || cIndices.join(",") !== eIndices.join(",")) {
                throw new Error(`Invalid Schläfli incidence for line ${lineNumber}`);
            }
            setLabel(lineNumber, "L", eIndices);
        }

        for (let i = 0; i < 6; i += 1) {
            for (let j = 0; j < 6; j += 1) {
                const expected = i !== j;
                if (projectiveLinesMeet(
                    DOUBLE_SIX_ORANGE_NUMBERS[i],
                    DOUBLE_SIX_BLUE_NUMBERS[j]
                ) !== expected) {
                    throw new Error(`Invalid double-six incidence E${i + 1}, C${j + 1}`);
                }
            }
        }
        if (byLabel.size !== 27 || labels.some(label => !label)) {
            throw new Error("Incomplete Schläfli labeling of the 27 lines");
        }
        schlafliLabelsByLine = labels;
        schlafliLineByLabel = byLabel;
    }

    let selectedBitangentLine = 6;
    let bitangentExpressionCache = [];
    let all28BitangentsVisible = false;
    let all28BitangentsOnTarget = false;

    function polyAddTerm(poly, i, j, value) {
        const key = `${i},${j}`;
        poly.set(key, (poly.get(key) || 0) + value);
    }

    function polyMultiply(first, second) {
        const result = new Map();
        first.forEach((a, firstKey) => {
            const [i, j] = firstKey.split(",").map(Number);
            second.forEach((b, secondKey) => {
                const [k, l] = secondKey.split(",").map(Number);
                polyAddTerm(result, i + k, j + l, a * b);
            });
        });
        return result;
    }

    function polyPower(poly, exponent) {
        let result = new Map([["0,0", 1]]);
        for (let index = 0; index < exponent; index += 1) {
            result = polyMultiply(result, poly);
        }
        return result;
    }

    function restrictedClebschPolynomial(plane, remaining, eliminated) {
        const eliminatedPoly = new Map([
            ["1,0", -plane[remaining[0]] / plane[eliminated]],
            ["0,1", -plane[remaining[1]] / plane[eliminated]],
            ["0,0", -plane[3] / plane[eliminated]]
        ]);
        const coordinates = [null, null, null];
        coordinates[remaining[0]] = new Map([["1,0", 1]]);
        coordinates[remaining[1]] = new Map([["0,1", 1]]);
        coordinates[eliminated] = eliminatedPoly;
        const terms = [
            [81,3,0,0],[81,0,3,0],[81,0,0,3],
            [-189,2,1,0],[-189,2,0,1],[-189,1,2,0],
            [-189,0,2,1],[-189,1,0,2],[-189,0,1,2],
            [54,1,1,1],[126,1,1,0],[126,0,1,1],[126,1,0,1],
            [-9,2,0,0],[-9,0,2,0],[-9,0,0,2],
            [-9,1,0,0],[-9,0,1,0],[-9,0,0,1],[1,0,0,0]
        ];
        const result = new Map();
        terms.forEach(([coefficient, xPower, yPower, zPower]) => {
            let term = new Map([["0,0", coefficient]]);
            [xPower, yPower, zPower].forEach((power, coordinate) => {
                term = polyMultiply(term, polyPower(coordinates[coordinate], power));
            });
            term.forEach((value, key) => {
                const [i, j] = key.split(",").map(Number);
                polyAddTerm(result, i, j, value);
            });
        });
        return result;
    }

    function divideByLine(polynomial, line) {
        const swap = Math.abs(line[1]) > Math.abs(line[0]);
        const orient = key => {
            const [i, j] = key.split(",").map(Number);
            return swap ? [j, i] : [i, j];
        };
        const work = new Map();
        polynomial.forEach((value, key) => {
            const [i, j] = orient(key);
            polyAddTerm(work, i, j, value);
        });
        const leading = swap ? line[1] : line[0];
        const other = swap ? line[0] : line[1];
        const scale = Math.max(1, ...[...work.values()].map(Math.abs));
        const tolerance = 1e-9 * scale;
        const quotient = new Map();
        for (let step = 0; step < 40; step += 1) {
            const divisible = [...work.entries()]
                .map(([key, value]) => ({ key, value, powers: key.split(",").map(Number) }))
                .filter(term => term.powers[0] > 0 && Math.abs(term.value) > tolerance)
                .sort((a, b) => b.powers[0] - a.powers[0] || b.powers[1] - a.powers[1]);
            if (divisible.length === 0) break;
            const { value, powers: [i, j] } = divisible[0];
            const coefficient = value / leading;
            polyAddTerm(quotient, i - 1, j, coefficient);
            polyAddTerm(work, i, j, -coefficient * leading);
            polyAddTerm(work, i - 1, j + 1, -coefficient * other);
            polyAddTerm(work, i - 1, j, -coefficient * line[2]);
        }
        const remainder = Math.max(0, ...[...work.values()].map(Math.abs));
        if (remainder > 2e-7 * scale) {
            throw new Error(`Line-conic factorization remainder ${remainder}`);
        }
        if (!swap) return quotient;
        const restored = new Map();
        quotient.forEach((value, key) => {
            const [i, j] = key.split(",").map(Number);
            polyAddTerm(restored, j, i, value);
        });
        return restored;
    }

    function linearLatex(coefficients, variables) {
        const parts = coefficients.map((coefficient, index) => {
            if (Math.abs(coefficient) < 1e-10) return null;
            const variable = index < variables.length ? variables[index] : "";
            const magnitude = Math.abs(coefficient);
            const number = Math.abs(magnitude - 1) < 1e-10 && variable
                ? ""
                : pointCoordinateLatex(magnitude);
            return { negative: coefficient < 0, text: `${number}${variable}` };
        }).filter(Boolean);
        return parts.map((part, index) => (
            `${index === 0 ? (part.negative ? "-" : "") : (part.negative ? "-" : "+")}${part.text}`
        )).join("") || "0";
    }

    function quadraticLatex(polynomial, variables) {
        const entries = [...polynomial.entries()]
            .map(([key, coefficient]) => ({
                powers: key.split(",").map(Number), coefficient
            }))
            .filter(term => Math.abs(term.coefficient) > 1e-9)
            .sort((a, b) => (
                (b.powers[0] + b.powers[1]) - (a.powers[0] + a.powers[1])
                || b.powers[0] - a.powers[0]
            ));
        const scale = Math.max(...entries.map(term => Math.abs(term.coefficient)));
        return linearLatex(entries.map(term => term.coefficient / scale), entries.map(term => {
            const [i, j] = term.powers;
            return `${i ? variables[0] + (i > 1 ? `^${i}` : "") : ""}${j ? variables[1] + (j > 1 ? `^${j}` : "") : ""}`;
        }));
    }

    const TARGET_BRANCH_TERMS = [
        [4024161,4,0],
        [10068948,3,1],
        [-4693572,3,0],
        [-2496906,2,2],
        [-9500652,2,1],
        [1935414,2,0],
        [-10856268,1,3],
        [3741876,1,2],
        [2666556,1,1],
        [-342948,1,0],
        [4782321,0,4],
        [1068444,0,3],
        [-608634,0,2],
        [-163236,0,1],
        [24721,0,0]
    ];

    function targetDisplayColor(color) {
        if (
            typeof siteDarkMode === "undefined"
            || !siteDarkMode
            || !/^#[0-9a-f]{6}$/i.test(color)
        ) {
            return color;
        }

        const value = Number.parseInt(
            color.slice(1),
            16
        );

        const red = 255 - ((value >> 16) & 255);
        const green = 255 - ((value >> 8) & 255);
        const blue = 255 - (value & 255);

        return "#"
            + [red, green, blue]
                .map(component => component
                    .toString(16)
                    .padStart(2, "0"))
                .join("");
    }

    function binomialSmall(n, k) {
        if (k < 0 || k > n) return 0;
        if (n === 0) return 1;
        if (n === 1) return 1;
        if (n === 2) return [1,2,1][k];
        if (n === 3) return [1,3,3,1][k];
        return [1,4,6,4,1][k];
    }

    function targetBitangentTangencyPoints(lineCoefficients) {
        const [A, B, C] = lineCoefficients;
        const coefficients = [0,0,0,0,0];
        let parameterToPoint;

        if (Math.abs(B) >= Math.abs(A) && Math.abs(B) > 1e-12) {
            const slope = -A / B;
            const offset = -C / B;
            parameterToPoint = value => ({
                x: value,
                y: slope * value + offset
            });

            TARGET_BRANCH_TERMS.forEach(([coefficient, i, j]) => {
                for (let r = 0; r <= j; r += 1) {
                    coefficients[i + r] +=
                        coefficient
                        * binomialSmall(j, r)
                        * slope ** r
                        * offset ** (j - r);
                }
            });
        } else if (Math.abs(A) > 1e-12) {
            const slope = -B / A;
            const offset = -C / A;
            parameterToPoint = value => ({
                x: slope * value + offset,
                y: value
            });

            TARGET_BRANCH_TERMS.forEach(([coefficient, i, j]) => {
                for (let r = 0; r <= i; r += 1) {
                    coefficients[r + j] +=
                        coefficient
                        * binomialSmall(i, r)
                        * slope ** r
                        * offset ** (i - r);
                }
            });
        } else {
            return [];
        }

        const scale = Math.max(
            1,
            ...coefficients.map(Math.abs)
        );
        const tolerance = 1e-8 * scale;
        const sign =
            Math.abs(coefficients[4]) > tolerance
                ? Math.sign(coefficients[4])
                : (
                    Math.abs(coefficients[2]) > tolerance
                        ? Math.sign(coefficients[2])
                        : 1
                );
        const normalized =
            coefficients.map(value => value * sign);
        let roots = [];

        if (normalized[4] > tolerance) {
            const q2 = Math.sqrt(normalized[4]);
            const q1 = normalized[3] / (2 * q2);
            const q0 =
                (normalized[2] - q1 * q1)
                / (2 * q2);
            const discriminant =
                q1 * q1 - 4 * q2 * q0;

            if (discriminant >= -tolerance) {
                const rootPart =
                    Math.sqrt(Math.max(0, discriminant));
                roots = [
                    (-q1 - rootPart) / (2 * q2),
                    (-q1 + rootPart) / (2 * q2)
                ];
            }
        } else if (
            normalized[4] <= tolerance
            && normalized[2] > tolerance
        ) {
            const q1 = Math.sqrt(normalized[2]);
            const q0 = normalized[1] / (2 * q1);
            roots = [-q0 / q1];
        }

        return roots
            .filter(Number.isFinite)
            .map(parameterToPoint)
            .filter(point => (
                Number.isFinite(point.x)
                && Number.isFinite(point.y)
            ));
    }
    /* Optional non-real contact data in an affine complex line parameter. */
    function complexBitangentParameter(lineCoefficients) {
        const [A, B, C] = lineCoefficients;
        const c = [0,0,0,0,0];
        let axis;
        if (Math.abs(B) >= Math.abs(A) && Math.abs(B) > 1e-12) {
            axis = "x";
            const slope = -A/B, offset = -C/B;
            TARGET_BRANCH_TERMS.forEach(([a,i,j]) => {
                for (let r=0; r<=j; r+=1) {
                    c[i+r] += a * binomialSmall(j,r)
                        * slope ** r * offset ** (j-r);
                }
            });
        } else if (Math.abs(A) > 1e-12) {
            axis = "y";
            const slope = -B/A, offset = -C/A;
            TARGET_BRANCH_TERMS.forEach(([a,i,j]) => {
                for (let r=0; r<=i; r+=1) {
                    c[r+j] += a * binomialSmall(i,r)
                        * slope ** r * offset ** (i-r);
                }
            });
        } else {
            return null;
        }
        const scale = Math.max(1,...c.map(Math.abs));
        const tolerance = 1e-8 * scale;
        const sign = Math.abs(c[4]) > tolerance
            ? Math.sign(c[4])
            : Math.abs(c[2]) > tolerance ? Math.sign(c[2]) : 1;
        const v = c.map(value=>value*sign);
        if (v[4] <= tolerance) return null;
        const q2=Math.sqrt(v[4]), q1=v[3]/(2*q2);
        const q0=(v[2]-q1*q1)/(2*q2);
        const discriminant=q1*q1-4*q2*q0;
        if (discriminant>=-tolerance) return null;
        const real=-q1/(2*q2);
        const imag=Math.sqrt(-discriminant)/(2*q2);
        return Number.isFinite(real)&&Number.isFinite(imag)
            ? {axis,real,imag} : null;
    }




    function selectedBitangentExpressions(number, displayedLine) {
        const definingPlanes = BITANGENT_LINE_PLANES[number - 1];
        const valuesAtP = definingPlanes.map(plane => (
            plane[0] * PROJECTION_POINT.x + plane[1] * PROJECTION_POINT.y
            + plane[2] * PROJECTION_POINT.z + plane[3]
        ));
        const plane = definingPlanes[0].map((coefficient, index) => (
            valuesAtP[1] * coefficient - valuesAtP[0] * definingPlanes[1][index]
        ));
        const eliminated = [0,1,2].sort((a, b) => Math.abs(plane[b]) - Math.abs(plane[a]))[0];
        const remaining = [0,1,2].filter(index => index !== eliminated);
        const substituteLine = source => [
            source[remaining[0]] - source[eliminated] * plane[remaining[0]] / plane[eliminated],
            source[remaining[1]] - source[eliminated] * plane[remaining[1]] / plane[eliminated],
            source[3] - source[eliminated] * plane[3] / plane[eliminated]
        ];
        const candidateLines = definingPlanes.map(substituteLine);
        const line = candidateLines.sort((a, b) => (
            Math.hypot(b[0], b[1]) - Math.hypot(a[0], a[1])
        ))[0];
        const conic = divideByLine(
            restrictedClebschPolynomial(plane, remaining, eliminated),
            line
        );
        const variables = ["x", "y", "z"];
        const planeScale = Math.max(...plane.slice(0, 3).map(Math.abs));
        const planeLatex = linearLatex(
            plane.map(value => value / planeScale),
            ["x", "y", "z"]
        );
        const conicLatex = quadraticLatex(conic, remaining.map(index => variables[index]));
        const pCoordinates = [PROJECTION_POINT.x, PROJECTION_POINT.y, PROJECTION_POINT.z];
        const conicAtP = [...conic.entries()].reduce((sum, [key, coefficient]) => {
            const [i, j] = key.split(",").map(Number);
            return sum + coefficient
                * pCoordinates[remaining[0]] ** i
                * pCoordinates[remaining[1]] ** j;
        }, 0);
        if (Math.abs(conicAtP) > 1e-6) {
            throw new Error(`Residual conic ${number} does not contain P`);
        }

        const selectedFamily =
            schlafliLabelsByLine[number - 1]?.family;
        const selectedFamilyColor =
            SCHLAFLI_FAMILY_COLORS[selectedFamily]
            || COLORS.intersection;
        const selectedFamilyPlaneColor =
            SCHLAFLI_FAMILY_PLANE_COLORS[selectedFamily]
            || COLORS.bluePlane;
        const targetLineScale = Math.max(
            1e-12,
            Math.abs(plane[0]),
            Math.abs(plane[1]),
            Math.abs(plane[3])
        );
        const targetLineCoefficients = [
            plane[0],
            plane[1],
            plane[3]
        ];
        const targetLineLatex = linearLatex(
            [
                plane[0] / targetLineScale,
                plane[1] / targetLineScale,
                plane[3] / targetLineScale
            ],
            ["x", "y"]
        );
        const targetTangencyPoints =
            targetBitangentTangencyPoints(
                targetLineCoefficients
            );
        const complexParameter =
            complexBitangentParameter(targetLineCoefficients);

        return {
            pair: [
                { ...displayedLine, id: "projection-bitangent-line-selected", color: selectedFamilyColor, lineWidth: 1 },
                {
                    id: "projection-bitangent-conic-selected",
                    latex: `${conicLatex}=0\\left\\{${planeLatex}=0\\right\\}`,
                    color: COLORS.purpleCurve,
                    lineWidth: 1
                }
            ],
            plane: [{
                id: "projection-bitangent-plane-selected",
                latex: `${planeLatex}=0`,
                color: selectedFamilyPlaneColor
            }],
            target: {
                id: "clebsch-target-bitangent",
                latex: `${targetLineLatex}=0`,
                color: selectedFamilyColor,
                lineWidth: 2.2
            },
            targetPoints: targetTangencyPoints,
            complexParameter
        };
    }

    function createData() {
        const complementaryColor = COLORS.clebschLine15;
        const doubleSixColor = COLORS.clebschLine12;
        const lines = clebschGeometry.createLineExpressions({
            complementaryColor,
            doubleSixColor
        });

        /* The chosen double-six fixes the standard blow-up notation:
           its orange row is E_i, its paired blue row is C_i, and each of the
           complementary 15 is L_ij, determined by the two E-lines it meets.
           buildSchlafliLabels verifies the complete projective incidence
           pattern directly from the exact line-plane coefficients. */
        buildSchlafliLabels();

        /* Generate every pair now, not only on first selection. Each call
           verifies by polynomial division that F|Pi is divisible by the
           chosen line and verifies by substitution that the residual conic
           contains P. This also keeps selector changes purely presentational. */
        bitangentExpressionCache = lines.map((line, index) => (
            selectedBitangentExpressions(index + 1, line)
        ));
        const selectedBitangent = bitangentExpressionCache[selectedBitangentLine - 1];

        return {
            title: "Clebsch cubic",
            info: String.raw`
                <button
                    id="clebsch-proof-panel-toggle"
                    class="proof-panel-toggle clebsch-proof-panel-toggle"
                    type="button"
                    title="Hide proof panel">
                    »
                </button>

                <div class="clebsch-info proof-info">
                    <h2>Projection from a point</h2>
                    <div class="surface-type">CLEBSCH CUBIC</div>

                    <p class="clebsch-reading-intro proof-intro">
                        Let \(S_3\subset\mathbb P^3\) be a smooth cubic surface and
                        let \(P\in S_3\) lie on none of the \(27\) lines.<button
                            type="button" id="clebsch-special-cases-open"
                            class="clebsch-special-cases-open"
                            title="Explore projection when P is on a line or outside S₃"
                            aria-label="Explore the special cases of projection from P">*</button>
                        Projection from \(P\) sends \(Q\ne P\) to
                        \(\overline{PQ}\), and blowing up \(P\) resolves the map.
                    </p>

                    <div class="theorem clebsch-question proof-question">
                        <div class="theorem-name proof-question-title">Question</div>
                        \[
                            \phi:\operatorname{Bl}_P S_3\longrightarrow\mathbb P^2
                            =\{\text{lines through }P\}.
                        \]
                        <p>What is the map \(\phi\) induced by the projection?</p>
                    </div>

                    <div class="proof-tabs clebsch-proof-tabs" role="tablist" aria-label="Projection answers">
                        <button class="proof-tab" type="button"
                            data-clebsch-tab="algebra" role="tab" aria-selected="false">
                            1. Algebraic
                        </button>
                        <button class="proof-tab" type="button"
                            data-clebsch-tab="equation" role="tab" aria-selected="false">
                            2. Geometry + equation
                        </button>
                    </div>
                    <div class="proof-answer" data-clebsch-panel="algebra" role="tabpanel">
                        <div class="theorem-name">Answer by algebraic computation</div>

                        <p>
                            Write \(H=-K_{S_3}\) for the hyperplane section and
                            \(E\) for the exceptional divisor over \(P\).
                            The map is given by the linear system \(|H-E|=|-K_X|\),
                            where \(X=\operatorname{Bl}_P S_3\). If \(h\) is the
                            class of a line in the target \(\mathbb P^2\), then
                        </p>
                        \[
                            (H-E)^2=\deg(\phi)\,h^2,\qquad
                            3-1=2,\qquad h^2=1,
                        \]
                        <p>so \(\deg\phi=2\).</p>

                        <p>
                            Let \(R\) be the ramification divisor and
                            \(B=\phi(R)\) the branch divisor. For every component
                            of \(B\), ramification gives \(e_i\ge2\), while
                            \(\deg\phi=2\) gives \(e_i\le2\). Hence \(e_i=2\)
                            for every component and
                        </p>
                        \[
                            \phi^*B=2R.
                        \]

                        <p>
                            Hurwitz gives
                            \(K_X\sim\phi^*K_{\mathbb P^2}+R
                            \sim-3\phi^*h+R\), while
                            \(-K_X\sim\phi^*h\).
                            Writing \(B\sim dh\), we obtain
                        </p>
                        \[
                            -\phi^*h
                            \sim -3\phi^*h+\frac12\phi^*B
                            \sim -3\phi^*h+\frac d2\phi^*h.
                        \]
                        <p>
                            Intersecting with \(\phi^*h\), whose square is \(2\),
                            gives
                        </p>
                        \[
                            -2=-6+d,
                        \]
                        <p>
                            hence \(d=4\). The branch locus is therefore a plane
                            quartic curve.
                        </p>
                    </div>

                    <div class="proof-answer" data-clebsch-panel="equation" role="tabpanel">
                        <div class="theorem-name">Answer by geometry and equation</div>

                        <div class="clebsch-equation-stepper" aria-label="Geometry and equation steps">
                            <button type="button" class="clebsch-equation-step active" data-clebsch-equation-step="1">1 · Line</button>
                            <button type="button" class="clebsch-equation-step" data-clebsch-equation-step="2">2 · Residual points</button>
                            <button type="button" class="clebsch-equation-step" data-clebsch-equation-step="3">3 · Ramification curve</button>
                            <button type="button" class="clebsch-equation-step" data-clebsch-equation-step="4">4 · Branch quartic</button>
                        </div>

                        <div class="clebsch-equation-step-nav">
                            <button type="button" data-clebsch-equation-prev>‹ Prev</button>
                            <span data-clebsch-equation-progress>Step 1 of 4</span>
                            <button type="button" data-clebsch-equation-next>Next ›</button>
                        </div>

                        <div class="clebsch-equation-step-panel active" data-clebsch-equation-step-panel="1">
                            <p>
                                Write a line through \(P\) as \(U=P+tV\), where
                                \(V\) gives its direction and \(t\) parametrizes
                                points on that fixed line. Since \(F(P)=0\),
                            </p>
                            \[
                                F(P+tV)=tL_P(V)+t^2Q_P(V)+t^3C(V).
                            \]
                        </div>

                        <div class="clebsch-equation-step-panel" data-clebsch-equation-step-panel="2">
                            <p>
                                Removing the fixed root \(t=0\) at \(P\), the two
                                residual intersection points are the roots of
                            </p>
                            \[
                                L_P(V)+tQ_P(V)+t^2C(V)=0.
                            \]

                            <p>
                                For a general direction, the residual quadratic has two distinct roots over \\(\\mathbb C\\); in the real visualization, the two residual points are visible only when those roots are real.
                            </p>
                        </div>

                        <div class="clebsch-equation-step-panel" data-clebsch-equation-step-panel="3">
                            <p>
                                Ramification occurs exactly when the two residual points
                                become one, equivalently when the residual quadratic has
                                a double root:
                            </p>
                            \[
                                \Delta(V)=Q_P(V)^2-4C(V)L_P(V)=0.
                            \]

                            <p>
                                Let \(Q\) be this double residual point. Then
                                \(\overline{PQ}\) has intersection multiplicity at
                                least \(2\) with \(S_3\) at \(Q\), so
                                \(\overline{PQ}\subset T_QS_3\). Since this line
                                contains \(P\), this is equivalent to
                                \(P\in T_QS_3\). Hence
                            </p>
                            \[
                                R=\{Q\in S_3:P\in T_QS_3\}.
                            \]

                            <p>
                                For the Clebsch cubic, substituting the fixed point
                                \(P\) into the tangent-plane equation gives the polar
                                quadric
                            </p>
                            \[
                                \begin{aligned}
                                \mathcal Q_P:\;&
                                1005x^2-282xy+126xz-399y^2+1530yz-807z^2\\
                                &-398x+70y+206z+9=0.
                                \end{aligned}
                            \]
                            <p>Therefore</p>
                            \[
                                R=S_3\cap\mathcal Q_P.
                            \]
                        </div>

                        <div class="clebsch-equation-step-panel clebsch-reading-step" data-clebsch-equation-step-panel="4">
                            <p class="clebsch-reading-prose">
                                Finally \(\Delta\) is homogeneous of degree \(4\)
                                in \(V\), with
                                \(\Delta(\lambda V)=\lambda^4\Delta(V)\). Thus its
                                zero set is a quartic in the target plane of directions,
                                namely the branch curve
                            </p>
                            \[
                                B=\phi(R).
                            \]

                            <div class="proof-note">
                                The left controls show the same story geometrically:
                                a generic line through \(P\) has two residual points;
                                “Snap to nearest ramification” chooses a tangent direction where
                                the two points merge into one point of \(R\).
                            </div>
                        </div>
                    </div>
                    <div class="proof-answer" data-clebsch-panel="remark" role="region" aria-label="27 lines and 28 bitangents">
                        <div class="theorem-name">The 28 bitangents</div>

                        <p>
                            The source geometry produces \(27+1=28\) pairs of exceptional
                            curves; these map to \(28\) lines in the target.
                        </p>

                        <div class="clebsch-remark-modes" role="group"
                            aria-label="Bitangent source geometry">
                            <button class="clebsch-remark-mode active" type="button"
                                data-clebsch-remark-mode="line-conic"
                                aria-pressed="true">
                                27 line–conic pairs
                            </button>
                            <button class="clebsch-remark-mode" type="button"
                                data-clebsch-remark-mode="tangent"
                                aria-pressed="false">
                                Tangent-plane pair
                            </button>
                        </div>
                        <p>
                            One pair is the exceptional curve \(E\) of the blow-up
                            together with the strict transform of the singular
                            tangent-plane cubic \(T_PS_3\cap S_3\).
                            For each of the \(27\) lines \(L\subset S_3\), the plane
                            \(\Pi=\langle P,L\rangle\) cuts
                        </p>
                        \[
                            \Pi\cap S_3=L+C_L,
                        \]
                        <p>
                            where \(C_L\) is a conic through \(P\); after blowing up,
                            \(\widetilde L+\widetilde C_L\) is the corresponding pair.
                        </p>

                        <p>
                            These \(28\) target lines are distinct. Two different
                            surface lines cannot determine the same plane through
                            \(P\), because then the residual third line in that plane
                            cubic would pass through \(P\). Likewise no surface line
                            lies in \(T_PS_3\), for otherwise the residual conic would
                            be singular at \(P\) and hence contain a line through
                            \(P\).
                        </p>

                        <p>
                            For any one of the \(28\) lines \(\ell\), write
                            \(\phi^*\ell=D_1+D_2\). Since \(D_i^2=-1\),
                        </p>
                        \[
                            2=(\phi^*\ell)^2
                            =(D_1+D_2)^2
                            =-2+2D_1D_2,
                        \]
                        <p>
                            so \(D_1D_2=2\). The two sheets meet exactly on the
                            ramification locus; write their intersection as
                            \(\{p,q\}\), allowing \(p=q\).
                            Since \(\phi_*D_i=\ell\), the projection formula gives
                        </p>
                        \[
                            \begin{aligned}
                            (R,D_i)_X
                            &=\frac12\deg(\phi^*B\cdot D_i)\\
                            &=\frac12\deg\phi_*(\phi^*B\cdot D_i)\\
                            &=\frac12\deg(B\cdot\phi_*D_i)\\
                            &=\frac12(B,\ell)_{\mathbb P^2}=2.
                            \end{aligned}
                        \]
                        <p>
                            Therefore
                            \(B\cap\ell=2\phi(p)+2\phi(q)\).
                            If \(p\ne q\), \(\ell\) is a bitangent; if \(p=q\),
                            it is a hyperflex.
                        </p>

                        <p>
                            Finally the branch quartic is smooth. On a chart where
                            \(C(V)\ne0\), completing the square in the residual
                            quadratic gives
                        </p>
                        \[
                            \bigl(2tC(V)+Q_P(V)\bigr)^2=\Delta(V).
                        \]
                        <p>
                            With \(z=2tC(V)+Q_P(V)\), the double cover is locally
                            \(z^2=\Delta\). If \(B=(\Delta=0)\) were singular, then
                            \(\Delta=\Delta_x=\Delta_y=0\); at the point above it,
                            \(z=0\), so all first derivatives of
                            \(z^2-\Delta(x,y)\) vanish. This would make
                            \(X=\operatorname{Bl}_P S_3\) singular, a contradiction.
                            <sup>*</sup>
                        </p>

                        <p>
                            By the classical theorem that a smooth plane quartic has
                            exactly \(28\) bitangents, these are all the bitangents.
                        </p>

                        <div class="proof-note">
                            <sup>*</sup>
                            If \(C(V)=0\) on the branch locus, then
                            \(\Delta(V)=0\) gives \(Q_P(V)=0\).
                            We cannot also have \(L_P(V)=0\), because then
                            \(F(P+tV)=0\) for every \(t\), so the whole line through
                            \(P\) in direction \(V\) would lie in \(S_3\), contrary
                            to the hypothesis on \(P\). Thus \(L_P(V)\ne0\).
                            Using \(s=1/t\), the residual equation becomes
                            \(L_P(V)s^2+Q_P(V)s+C(V)=0\), and the same
                            completing-the-square argument gives \(z^2=\Delta\).
                        </div>
                    </div>
                </div>
            `,
            features: {
                surface: {
                    label: "Surface",
                    checked: true,
                    group: "main",
                    expressions: [{
                        id: "clebsch-surface",
                        latex: `
                            81(x^3+y^3+z^3)
                            -189(x^2y+x^2z+y^2x+y^2z+z^2x+z^2y)
                            +54xyz
                            +126(xy+yz+zx)
                            -9(x^2+y^2+z^2)
                            -9(x+y+z)
                            +1=0`,
                        color: COLORS.surface
                    }]
                },
                projectionNode: {
                    label: "Point P",
                    checked: true,
                    control: true,
                    group: "setup",
                    expressions: [{
                        id: "projection-node",
                        latex: "(4/7,-1/8,-55/168)",
                        color: COLORS.purpleCurve
                    }]
                },
                projectionSlicePlane: {
                    label: "Plane slice Π",
                    checked: false,
                    control: true,
                    group: "equation",
                    expressions: [{
                        id: "projection-slice-plane",
                        latex: "2x-y+z=79/84",
                        color: COLORS.bluePlane
                    }]
                },
                polarQuadric: {
                    label: "Polar quadric",
                    checked: false,
                    control: true,
                    group: "equation",
                    expressions: [{
                        id: "projection-polar-quadric",
                        latex: "1005x^2-282xy+126xz-399y^2+1530yz-807z^2-398x+70y+206z+9=0",
                        color: COLORS.purplePlane
                    }]
                },
                ramificationCurve: {
                    label: "Ramification curve R",
                    checked: false,
                    control: true,
                    group: "equation",
                    expressions: [
                        {
                            id: "projection-ramification-curve",
                            latex: "1005x^2-282xy+126xz-399y^2+1530yz-807z^2-398x+70y+206z+9=0\\left\\{81(x^3+y^3+z^3)-189(x^2y+x^2z+y^2x+y^2z+z^2x+z^2y)+54xyz+126(xy+yz+zx)-9(x^2+y^2+z^2)-9(x+y+z)+1=0\\right\\}",
                            color: COLORS.purpleCurve,
                            lineWidth: 1
                        },
                        {
                            id: "projection-ramification-curve-glow",
                            latex: "1005x^2-282xy+126xz-399y^2+1530yz-807z^2-398x+70y+206z+9=0\\left\\{81(x^3+y^3+z^3)-189(x^2y+x^2z+y^2x+y^2z+z^2x+z^2y)+54xyz+126(xy+yz+zx)-9(x^2+y^2+z^2)-9(x+y+z)+1=0\\right\\}",
                            color: RAMIFICATION_GLOW_COLOR,
                            lineWidth: 1,
                            hidden: true
                        }
                    ]
                },
                projectionLine: {
                    label: "Moving line",
                    checked: false,
                    control: true,
                    group: "equation",
                    expressions: projectionLineSceneExpressions()
                },
                lines27: {
                    label: "All 27 lines",
                    checked: false,
                    control: true,
                    group: "remark-27",
                    expressions: lines
                },
                /* For every displayed line l, the generated plane is the
                   exact linear combination of its two defining planes that
                   vanishes at P. Restricting F to that plane and dividing by
                   l is checked for negligible remainder; the resulting
                   quadratic is also checked at P before it is displayed. */
                selectedBitangentPair: {
                    label: "Line–conic pair (27)",
                    checked: false,
                    control: true,
                    group: "remark-27",
                    expressions: selectedBitangent.pair
                },
                selectedBitangentPlane: {
                    label: "Plane through P and L",
                    checked: false,
                    control: true,
                    group: "remark-27",
                    expressions: selectedBitangent.plane
                },
                /* Fixed projection-stage tangent geometry: the old BLUE
                   example, now in the warm-up page's purple family. */
                projectionPlane: {
                    label: "Tangent plane at P",
                    checked: false,
                    control: true,
                    group: "remark-extra",
                    expressions: [{
                        id: "projection-plane",
                        latex: "54726x-36183y+45213z=20993",
                        color: COLORS.purplePlane
                    }]
                },
                projectionCubic: {
                    label: "Tangent-plane cubic (paired with E)",
                    checked: false,
                    control: true,
                    group: "remark-extra",
                    expressions: [
                        {
                            id: "projection-A",
                            latex: String.raw`
                                A(t)=156747819375\cos(t)^2
                                +223203473536\cos(t)\sin(t)
                                -146652576768\sin(t)^2`
                        },
                        {
                            id: "projection-B",
                            latex: String.raw`
                                B(t)=245672178570\cos(t)^3
                                +69749701224\cos(t)^2\sin(t)
                                -309863737344\cos(t)\sin(t)^2
                                +332183494656\sin(t)^3`
                        },
                        { id: "projection-g", latex: "g(t)=-A(t)/B(t)" },
                        {
                            id: "projection-cubic",
                            latex: String.raw`
                                (
                                4/7+g(t)\cos(t),
                                -1/8+g(t)\sin(t),
                                -55/168
                                -(2606/2153)g(t)\cos(t)
                                +(1723/2153)g(t)\sin(t)
                                )`,
                            color: COLORS.purpleCurve,
                            parametricDomain: { min: 0, max: Math.PI }
                        }
                    ]
                },
            }
        };
    }

    function ramificationGlowExpression() {
        return {
            id:
                "projection-ramification-curve-glow",
            latex:
                "1005x^2-282xy+126xz-399y^2+1530yz-807z^2-398x+70y+206z+9=0\\left\\{81(x^3+y^3+z^3)-189(x^2y+x^2z+y^2x+y^2z+z^2x+z^2y)+54xyz+126(xy+yz+zx)-9(x^2+y^2+z^2)-9(x+y+z)+1=0\\right\\}",
            color:
                RAMIFICATION_GLOW_COLOR,
            lineWidth: 1,
            hidden:
                !projectionRamificationDisplayActive()
        };
    }

    function commitProjectionLine() {
        const expressions =
            projectionLineSceneExpressions();
        projectionLineLastLatex =
            expressions[0]?.latex || null;
        const glow =
            ramificationGlowExpression();

        pages.clebsch.features
            .projectionLine.expressions =
                expressions;

        const ramificationExpressions =
            pages.clebsch.features
                .ramificationCurve.expressions;

        if (
            ramificationExpressions
            && ramificationExpressions[1]
        ) {
            ramificationExpressions[1] =
                glow;
        }

        /* Atomic main-calculator batch: this is the same invariant that fixed
           Page 1's old line/point one-step-behind bug. */
        if (mainCalculator) {
            const batch = [];

            if (
                activeExpressionIds.includes(
                    "projection-line"
                )
            ) {
                batch.push(
                    ...expressions
                );
            }

            if (
                activeExpressionIds.includes(
                    "projection-ramification-curve-glow"
                )
            ) {
                batch.push(glow);
            }

            if (batch.length) {
                mainCalculator.setExpressions(
                    batch
                );
            }
        }

        updateSliceProjection2D();
        updateProjectionBlowupPrompt();

        /* Same JS turn, same frozen angle tuple: no extra RAF between 3D and
           target 2D, avoiding the previous visible one-frame lag. */
        if (
            currentClebschInfoMode === "equation"
            && currentClebschEquationStep === 4
        ) {
            updateTargetProjectionCard(
                currentClebschRemarkMode
            );
        }
    }

    function syncProjectionLineToViewport() {
        if (!mainCalculator) return;

        /* Page 1 pattern: do nothing while the current cached segment still
           covers the cube; otherwise enlarge the cache once with headroom. */
        if (
            !projectionEnsureLineParameterExtentCoversViewport()
        ) {
            return;
        }

        const expression =
            projectionLineExpression();

        projectionLineLastLatex =
            expression.latex;
        pages.clebsch.features
            .projectionLine.expressions[0] =
                expression;

        if (
            activeExpressionIds.includes(
                "projection-line"
            )
        ) {
            mainCalculator.setExpression(
                expression
            );
        }
    }

    function scheduleProjectionLineBoundsCheck() {
        if (
            projectionLineBoundsTimer
            !== null
        ) {
            clearTimeout(
                projectionLineBoundsTimer
            );
        }

        projectionLineBoundsTimer =
            setTimeout(() => {
                projectionLineBoundsTimer =
                    null;

                if (
                    !projectionLineAnimationRunning()
                ) {
                    syncProjectionLineToViewport();
                }
            }, 180);
    }

    function scheduleProjectionLineCommit() {
        if (
            projectionLinePendingCommitFrame
            !== null
        ) {
            return;
        }

        projectionLinePendingCommitFrame =
            requestAnimationFrame(() => {
                projectionLinePendingCommitFrame =
                    null;
                commitProjectionLine();
            });
    }

    function projectionLineAnimationRunning() {
        return ["azimuth", "elevation"]
            .some(key =>
                projectionLineAnimations[key]
                    ?.running
            );
    }

    function updateProjectionLinePlayButton(
        key
    ) {
        const state =
            projectionLineAnimations[key];
        const button =
            projectionLineControlRefs?.[key]
                ?.play;

        if (!button) return;

        const running =
            Boolean(state?.running);

        button.textContent =
            running ? "❚❚" : "▶";
        button.classList.toggle(
            "playing",
            running
        );
        button.title =
            running
                ? `Pause ${key}`
                : `Animate ${key}`;
    }

    function stopProjectionLineAnimation(
        key
    ) {
        const state =
            projectionLineAnimations[key];

        if (state) {
            state.running = false;
            state.position =
                projectionLineState[key];
        }

        updateProjectionLinePlayButton(
            key
        );

        if (
            !projectionLineAnimationRunning()
            && projectionLineAnimationFrame
                !== null
        ) {
            cancelAnimationFrame(
                projectionLineAnimationFrame
            );
            projectionLineAnimationFrame =
                null;
            projectionLineAnimationLastTime =
                0;
            projectionLineAnimationLastCommitTime =
                0;
        }
    }

    function stopAllProjectionLineAnimations() {
        ["azimuth", "elevation"]
            .forEach(
                stopProjectionLineAnimation
            );
    }

    function nearestProjectionRamificationAzimuth(
        elevationDegrees,
        azimuthDegrees
    ) {
        const min = -180;
        const max = 180;
        const step = 1;
        const samples = [];
        const roots = [];

        for (
            let angle = min;
            angle <= max + 1e-9;
            angle += step
        ) {
            samples.push({
                angle,
                value:
                    projectionRamificationDiscriminant(
                        angle,
                        elevationDegrees
                    )
            });
        }

        const addRoot = root => {
            if (!Number.isFinite(root)) return;

            const wrapped =
                ((root + 180) % 360 + 360) % 360
                - 180;

            if (
                roots.every(existing =>
                    Math.abs(
                        ((wrapped - existing + 180) % 360 + 360) % 360
                        - 180
                    ) > 0.08
                )
            ) {
                roots.push(wrapped);
            }
        };

        for (
            let index = 1;
            index < samples.length;
            index += 1
        ) {
            const first =
                samples[index - 1];
            const second =
                samples[index];

            if (
                !Number.isFinite(first.value)
                || !Number.isFinite(second.value)
            ) {
                continue;
            }

            if (
                Math.abs(first.value) < 1e-7
            ) {
                addRoot(first.angle);
            }

            if (
                first.value * second.value > 0
            ) {
                continue;
            }

            let left = first.angle;
            let right = second.angle;
            let leftValue = first.value;

            for (
                let iteration = 0;
                iteration < 45;
                iteration += 1
            ) {
                const middle =
                    (left + right) / 2;
                const middleValue =
                    projectionRamificationDiscriminant(
                        middle,
                        elevationDegrees
                    );

                if (
                    Math.abs(middleValue) < 1e-12
                ) {
                    left = middle;
                    right = middle;
                    break;
                }

                if (
                    leftValue * middleValue <= 0
                ) {
                    right = middle;
                } else {
                    left = middle;
                    leftValue =
                        middleValue;
                }
            }

            addRoot(
                (left + right) / 2
            );
        }

        if (!roots.length) {
            const best =
                samples.reduce(
                    (currentBest, sample) =>
                        Math.abs(sample.value)
                        < Math.abs(currentBest.value)
                            ? sample
                            : currentBest
                );

            return best.angle;
        }

        const angularDistance =
            (first, second) =>
                Math.abs(
                    ((first - second + 180) % 360 + 360) % 360
                    - 180
                );

        return roots.reduce(
            (nearest, candidate) =>
                angularDistance(
                    candidate,
                    azimuthDegrees
                )
                < angularDistance(
                    nearest,
                    azimuthDegrees
                )
                    ? candidate
                    : nearest
        );
    }

    function updateProjectionLineGlobalStopButton() {
        if (!projectionLineGlobalStopButton) {
            return;
        }

        projectionLineGlobalStopButton
            .classList.toggle(
                "continue-mode",
                projectionLineGloballyPaused
            );

        projectionLineGlobalStopButton.innerHTML =
            `<span class="warmup-stop-icon" aria-hidden="true"></span>`
            + `<span class="warmup-stop-text">${projectionLineGloballyPaused ? "Continue" : "Stop"}</span>`;

        projectionLineGlobalStopButton.title =
            projectionLineGloballyPaused
                ? "Continue the paused line animation"
                : "Pause the running line animation";
    }

    function clearProjectionLineGlobalPauseState() {
        projectionLineGloballyPaused = false;
        projectionLinePausedKeys = [];
        projectionRamificationLocked = false;
        projectionLineAutoStopArmed = true;
        updateProjectionLineGlobalStopButton();
    }

    function pauseAllProjectionLineAnimations() {
        const running =
            ["azimuth", "elevation"]
                .filter(key =>
                    projectionLineAnimations[key]
                        ?.running
                );

        if (!running.length) {
            return false;
        }

        projectionLinePausedKeys = [
            ...running
        ];
        projectionLineGloballyPaused = true;

        running.forEach(
            stopProjectionLineAnimation
        );

        updateProjectionLineGlobalStopButton();
        return true;
    }

    function prepareProjectionLinePlayback() {
        const leavingRamification =
            projectionRamificationLocked;

        projectionLineGloballyPaused = false;
        projectionLinePausedKeys = [];
        projectionRamificationLocked = false;

        /* This is the key state-machine rule:
           - ordinary resume/play: event detection stays armed;
           - resume/play from an auto-stopped ramification: disarm only until
             the trajectory has moved safely away, then the animation tick
             rearms it automatically. */
        projectionLineAutoStopArmed =
            !leavingRamification;

        updateProjectionLineGlobalStopButton();

        /* Remove the shine immediately when playback resumes, while keeping
           every dependent object on the same frozen angle tuple. */
        commitProjectionLine();

        return leavingRamification;
    }

    function resumeAllProjectionLineAnimations() {
        if (!projectionLineGloballyPaused) {
            return false;
        }

        const paused =
            [...projectionLinePausedKeys];

        prepareProjectionLinePlayback();

        paused.forEach(key => {
            const state =
                projectionLineAnimations[key];

            if (!state) return;

            startProjectionLineAnimation(
                key,
                state.min,
                state.max
            );
        });

        return true;
    }

    function projectionLineAnimationSpeed(
        min,
        max
    ) {
        return Math.abs(max - min)
            / (
                PROJECTION_LINE_ANIMATION_PERIOD_MS
                / 1000
            );
    }

    function ensureProjectionLineAnimationFrame() {
        if (
            projectionLineAnimationFrame
            !== null
        ) {
            return;
        }

        projectionLineAnimationLastTime =
            performance.now();
        projectionLineAnimationFrame =
            requestAnimationFrame(
                projectionLineAnimationTick
            );
    }

    function startProjectionLineAnimation(
        key,
        min,
        max
    ) {
        const previous =
            projectionLineAnimations[key]
            || {};

        let direction =
            previous.direction;

        if (
            direction !== -1
            && direction !== 1
        ) {
            direction = 1;
        }

        if (key === "azimuth") {
            direction = 1;
        } else if (
            projectionLineState[key]
            >= max
        ) {
            direction = -1;
        } else if (
            projectionLineState[key]
            <= min
        ) {
            direction = 1;
        }

        projectionLineAnimations[key] = {
            ...previous,
            running: true,
            direction,
            position:
                projectionLineState[key],
            speed:
                projectionLineAnimationSpeed(
                    min,
                    max
                ),
            min,
            max
        };

        updateProjectionLinePlayButton(
            key
        );
        projectionLineAnimationLastCommitTime =
            0;
        ensureProjectionLineAnimationFrame();
    }

    function projectionLineAnimationTick(now) {
        projectionLineAnimationFrame =
            null;

        const running =
            ["azimuth", "elevation"]
                .filter(key =>
                    projectionLineAnimations[key]
                        ?.running
                );

        if (!running.length) {
            projectionLineAnimationLastTime =
                0;
            projectionLineAnimationLastCommitTime =
                0;
            return;
        }

        const previousTime =
            projectionLineAnimationLastTime
            || now;
        const dt = Math.min(
            0.08,
            Math.max(
                0,
                (now - previousTime) / 1000
            )
        );
        projectionLineAnimationLastTime =
            now;

        running.forEach(key => {
            const state =
                projectionLineAnimations[key];
            let next =
                state.position
                + state.direction
                * state.speed
                * dt;

            if (key === "azimuth") {
                const span =
                    state.max - state.min;

                while (next > state.max) {
                    next -= span;
                }

                while (next < state.min) {
                    next += span;
                }
            } else {
                if (next > state.max) {
                    next =
                        state.max
                        - (next - state.max);
                    state.direction = -1;
                } else if (
                    next < state.min
                ) {
                    next =
                        state.min
                        + (state.min - next);
                    state.direction = 1;
                }
            }

            state.position =
                Math.max(
                    state.min,
                    Math.min(
                        state.max,
                        next
                    )
                );
        });

        const shouldCommit =
            projectionLineAnimationLastCommitTime
                === 0
            || now
                - projectionLineAnimationLastCommitTime
                >= PROJECTION_LINE_COMMIT_INTERVAL_MS;

        if (shouldCommit) {
            const previousState =
                projectionRamificationState();

            const candidateState = {
                azimuth:
                    projectionLineAnimations
                        .azimuth?.running
                        ? projectionLineAnimations
                            .azimuth.position
                        : projectionLineState.azimuth,
                elevation:
                    projectionLineAnimations
                        .elevation?.running
                        ? projectionLineAnimations
                            .elevation.position
                        : projectionLineState.elevation
            };

            const shouldDetectEvent =
                currentClebschInfoMode
                    === "equation"
                && currentClebschEquationStep
                    >= 3
                && projectionLineAutoStopArmed;

            const eventState =
                shouldDetectEvent
                    ? projectionRamificationEventBetween(
                        previousState,
                        candidateState
                    )
                    : null;

            if (
                eventState
                && projectionLineNonstop
            ) {
                /* Coverage experiment for nonstop mode:
                   - refine the exact ramification event as before;
                   - permanently mark a genuinely new ramification point;
                   - flash only on the first visit to that point;
                   - keep the candidate animation state and continue moving. */
                const newlyVisited =
                    recordProjectionNonstopRamificationPoint(
                        eventState
                    );

                projectionRamificationLocked =
                    false;

                projectionLineState.azimuth =
                    Math.round(
                        candidateState.azimuth
                        * 10
                    ) / 10;
                projectionLineState.elevation =
                    Math.round(
                        candidateState.elevation
                        * 10
                    ) / 10;

                if (newlyVisited) {
                    triggerProjectionLineTransientShine();
                }

                renderProjectionLineControls();
                commitProjectionLine();
            } else if (eventState) {
                projectionLineState.azimuth =
                    eventState.azimuth;
                projectionLineState.elevation =
                    eventState.elevation;

                ["azimuth", "elevation"]
                    .forEach(key => {
                        const state =
                            projectionLineAnimations[key];

                        if (state) {
                            state.position =
                                projectionLineState[key];
                        }
                    });

                projectionRamificationLocked =
                    true;
                projectionLineAutoStopArmed =
                    false;

                renderProjectionLineControls();
                commitProjectionLine();
                pauseAllProjectionLineAnimations();
            } else {
                projectionRamificationLocked =
                    false;

                projectionLineState.azimuth =
                    Math.round(
                        candidateState.azimuth
                        * 10
                    ) / 10;
                projectionLineState.elevation =
                    Math.round(
                        candidateState.elevation
                        * 10
                    ) / 10;

                renderProjectionLineControls();
                commitProjectionLine();

                if (
                    !projectionLineAutoStopArmed
                ) {
                    const value =
                        Math.abs(
                            projectionRamificationValue(
                                projectionRamificationState()
                            )
                        );

                    if (
                        Number.isFinite(value)
                        && value
                            >= RAMIFICATION_REARM_TOLERANCE
                    ) {
                        projectionLineAutoStopArmed =
                            true;
                    }
                }
            }

            projectionLineAnimationLastCommitTime =
                now;
        }

        if (
            projectionLineAnimationRunning()
        ) {
            projectionLineAnimationFrame =
                requestAnimationFrame(
                    projectionLineAnimationTick
                );
        }
    }

    function formatProjectionLineAngle(
        value
    ) {
        const rounded =
            Math.round(value * 10) / 10;

        return `${rounded}°`;
    }

    function renderProjectionLineControls() {
        if (!projectionLineControlRefs) return;

        ["azimuth", "elevation"]
            .forEach(key => {
                const refs =
                    projectionLineControlRefs[key];

                if (!refs) return;

                refs.slider.value =
                    String(
                        projectionLineState[key]
                    );

                if (
                    !refs.editor
                    || refs.editor.hidden
                ) {
                    refs.value.textContent =
                        formatProjectionLineAngle(
                            projectionLineState[key]
                        );
                }

                updateProjectionLinePlayButton(
                    key
                );
            });
    }

    function setProjectionLineControlsEnabled(
        enabled
    ) {
        if (!projectionLineControlRefs) return;

        ["azimuth", "elevation"]
            .forEach(key => {
                const refs =
                    projectionLineControlRefs[key];

                if (!refs) return;

                refs.slider.disabled =
                    !enabled;
                refs.play.disabled =
                    !enabled;
                refs.value.disabled =
                    !enabled;
                refs.editor.disabled =
                    !enabled;
            });

        if (!enabled) {
            stopAllProjectionLineAnimations();
        }

        if (
            projectionLineControlRefs
                .ramificationExample
        ) {
            projectionLineControlRefs
                .ramificationExample
                .disabled = !enabled;
        }

        projectionLineControlRefs
            .container
            .classList.toggle(
                "disabled",
                !enabled
            );
    }

    function buildProjectionLineControls(
        checkbox
    ) {
        const container =
            document.createElement("div");
        container.className =
            "clebsch-line-controls";
        projectionLineControlRefs = {
            container
        };

        const buildAngleControl = ({
            key,
            labelText,
            minValue,
            maxValue,
            ariaLabel
        }) => {
            const control =
                document.createElement("div");
            control.className =
                "clebsch-line-angle";

            const header =
                document.createElement("div");
            header.className =
                "clebsch-line-angle-header";

            const label =
                document.createElement("span");
            label.textContent =
                labelText;

            const editorWrap =
                document.createElement("span");
            editorWrap.className =
                "clebsch-line-number-editor";

            const value =
                document.createElement("button");
            value.type = "button";
            value.className =
                "clebsch-line-angle-value";
            value.title =
                `Type a ${labelText.toLowerCase()} in degrees`;

            const editor =
                document.createElement("input");
            editor.type = "text";
            editor.inputMode = "decimal";
            editor.className =
                "clebsch-line-angle-input";
            editor.hidden = true;
            editor.title =
                `Type a ${labelText.toLowerCase()} in degrees`;

            editorWrap.append(
                value,
                editor
            );
            header.append(
                label,
                editorWrap
            );

            const row =
                document.createElement("div");
            row.className =
                "clebsch-line-angle-row";

            const min =
                document.createElement("span");
            min.textContent =
                `${minValue < 0 ? "−" : ""}${Math.abs(minValue)}°`;

            const slider =
                document.createElement("input");
            slider.type = "range";
            slider.min =
                String(minValue);
            slider.max =
                String(maxValue);
            slider.step = "0.1";
            slider.value =
                String(
                    projectionLineState[key]
                );
            slider.setAttribute(
                "aria-label",
                ariaLabel
            );

            const max =
                document.createElement("span");
            max.textContent =
                `${maxValue}°`;

            const play =
                document.createElement("button");
            play.type = "button";
            play.className =
                "clebsch-line-play";
            play.textContent = "▶";
            play.title =
                `Animate ${key}`;

            const setValue = (
                rawValue,
                immediate = false
            ) => {
                const numeric =
                    Number(rawValue);

                if (!Number.isFinite(numeric)) {
                    return;
                }

                const angle =
                    Math.round(
                        Math.max(
                            minValue,
                            Math.min(
                                maxValue,
                                numeric
                            )
                        ) * 10
                    ) / 10;

                projectionLineState[key] =
                    angle;
                slider.value =
                    String(angle);
                renderProjectionLineControls();

                if (immediate) {
                    if (
                        projectionLinePendingCommitFrame
                        !== null
                    ) {
                        cancelAnimationFrame(
                            projectionLinePendingCommitFrame
                        );
                        projectionLinePendingCommitFrame =
                            null;
                    }

                    commitProjectionLine();
                } else {
                    scheduleProjectionLineCommit();
                }
            };

            const closeEditor =
                commit => {
                    if (commit) {
                        const typed =
                            Number(
                                String(
                                    editor.value
                                )
                                    .trim()
                                    .replace(",", ".")
                                    .replace(/°/g, "")
                            );

                        if (
                            Number.isFinite(typed)
                        ) {
                            stopProjectionLineAnimation(
                                key
                            );
                            setValue(
                                typed,
                                true
                            );
                        }
                    }

                    editor.hidden = true;
                    value.hidden = false;
                    renderProjectionLineControls();
                };

            value.addEventListener(
                "click",
                () => {
                    stopProjectionLineAnimation(
                        key
                    );
                    clearProjectionLineGlobalPauseState();
                    value.hidden = true;
                    editor.hidden = false;
                    editor.value =
                        String(
                            Math.round(
                                projectionLineState[key]
                                * 10
                            ) / 10
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
                    if (
                        event.key === "Enter"
                    ) {
                        event.preventDefault();
                        closeEditor(true);
                    } else if (
                        event.key === "Escape"
                    ) {
                        event.preventDefault();
                        closeEditor(false);
                    }
                }
            );

            slider.addEventListener(
                "input",
                () => {
                    stopProjectionLineAnimation(
                        key
                    );
                    clearProjectionLineGlobalPauseState();

                    const numeric =
                        Number(slider.value);

                    if (!Number.isFinite(numeric)) {
                        return;
                    }

                    const candidateAngle =
                        Math.round(
                            Math.max(
                                minValue,
                                Math.min(
                                    maxValue,
                                    numeric
                                )
                            ) * 10
                        ) / 10;
                    const startState =
                        projectionRamificationState();
                    const candidateState = {
                        ...startState,
                        [key]: candidateAngle
                    };
                    const shouldDetectEvent =
                        currentClebschInfoMode
                            === "equation"
                        && currentClebschEquationStep
                            >= 3
                        && projectionLineAutoStopArmed;
                    const eventState =
                        shouldDetectEvent
                            ? projectionRamificationEventBetween(
                                startState,
                                candidateState
                            )
                            : null;

                    /* Dragging should stay continuous. Crossing a tangent
                       direction only flashes R (and B in Step 4); unlike
                       keyboard/playback, it does not snap, merge the residual
                       points, or hold the slider at the ramification state. */
                    if (eventState) {
                        triggerProjectionLineTransientShine();
                    }

                    setValue(
                        candidateAngle,
                        false
                    );
                }
            );

            /* Held arrow keys are page-owned, just as on Page 1. Preventing
               the native step removes the old one-step-behind/trembling path. */
            slider.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key
                            !== "ArrowLeft"
                        && event.key
                            !== "ArrowRight"
                    ) {
                        return;
                    }

                    event.preventDefault();

                    /* If a held arrow has just crossed a ramification
                       direction, keep the exact refined tangent state until
                       the user releases the key. Otherwise key-repeat would
                       immediately step past the event on the next keydown. */
                    if (
                        projectionLineKeyboardRamificationKey
                            === key
                    ) {
                        return;
                    }

                    stopProjectionLineAnimation(
                        key
                    );

                    /* A fresh key press after a locked ramification is the
                       keyboard analogue of Continue: clear the glow/merged
                       state first, then move away from the exact event. */
                    if (projectionRamificationLocked) {
                        prepareProjectionLinePlayback();
                    } else {
                        clearProjectionLineGlobalPauseState();
                    }

                    const direction =
                        event.key
                            === "ArrowRight"
                            ? 1
                            : -1;
                    const stepSize =
                        Number(slider.step)
                        || 0.1;

                    /* Always advance from the authoritative geometry state,
                       not from the range element. The range may quantize an
                       exact refined ramification angle to its 0.1° step. */
                    const current =
                        projectionLineState[key];
                    const candidateAngle =
                        Math.round(
                            Math.max(
                                minValue,
                                Math.min(
                                    maxValue,
                                    current
                                        + direction
                                        * stepSize
                                )
                            ) * 10
                        ) / 10;
                    const startState =
                        projectionRamificationState();
                    const candidateState = {
                        ...startState,
                        [key]: candidateAngle
                    };
                    const shouldDetectEvent =
                        currentClebschInfoMode
                            === "equation"
                        && currentClebschEquationStep
                            >= 3
                        && projectionLineAutoStopArmed;
                    const eventState =
                        shouldDetectEvent
                            ? projectionRamificationEventBetween(
                                startState,
                                candidateState
                            )
                            : null;

                    if (eventState) {
                        projectionLineState.azimuth =
                            eventState.azimuth;
                        projectionLineState.elevation =
                            eventState.elevation;

                        ["azimuth", "elevation"]
                            .forEach(stateKey => {
                                const state =
                                    projectionLineAnimations[
                                        stateKey
                                    ];

                                if (state) {
                                    state.position =
                                        projectionLineState[
                                            stateKey
                                        ];
                                }
                            });

                        projectionRamificationLocked =
                            true;
                        projectionLineAutoStopArmed =
                            false;
                        projectionLineKeyboardRamificationKey =
                            key;

                        if (
                            projectionLinePendingCommitFrame
                                !== null
                        ) {
                            cancelAnimationFrame(
                                projectionLinePendingCommitFrame
                            );
                            projectionLinePendingCommitFrame =
                                null;
                        }

                        renderProjectionLineControls();
                        commitProjectionLine();
                        return;
                    }

                    setValue(
                        candidateAngle,
                        false
                    );

                    /* After the first keyboard step away from a locked event,
                       rearm crossing detection once the discriminant is
                       safely nonzero, matching playback's rearm rule. */
                    if (
                        !projectionLineAutoStopArmed
                        && !projectionRamificationLocked
                    ) {
                        const value =
                            Math.abs(
                                projectionRamificationValue(
                                    projectionRamificationState()
                                )
                            );

                        if (
                            Number.isFinite(value)
                            && value
                                >= RAMIFICATION_REARM_TOLERANCE
                        ) {
                            projectionLineAutoStopArmed =
                                true;
                        }
                    }
                }
            );

            /* Native range dragging, matching Page 1.
               Do not preventDefault here: the slider must keep keyboard focus.
               All geometry still commits through scheduleProjectionLineCommit(). */
            slider.addEventListener(
                "pointerdown",
                () => {
                    stopProjectionLineAnimation(
                        key
                    );
                    clearProjectionLineGlobalPauseState();

                    try {
                        slider.focus({
                            preventScroll: true
                        });
                    } catch (error) {
                        slider.focus();
                    }
                }
            );

            slider.addEventListener(
                "keyup",
                event => {
                    if (
                        event.key !== "ArrowLeft"
                        && event.key !== "ArrowRight"
                    ) {
                        return;
                    }

                    const stoppedAtRamification =
                        projectionLineKeyboardRamificationKey
                            === key;

                    if (stoppedAtRamification) {
                        projectionLineKeyboardRamificationKey =
                            null;
                        /* The exact event was already committed in keydown.
                           Do not issue a second Desmos write on keyup. */
                        return;
                    }

                    if (
                        projectionLinePendingCommitFrame
                        !== null
                    ) {
                        cancelAnimationFrame(
                            projectionLinePendingCommitFrame
                        );
                        projectionLinePendingCommitFrame =
                            null;
                    }

                    commitProjectionLine();
                }
            );

            slider.addEventListener(
                "blur",
                () => {
                    if (
                        projectionLineKeyboardRamificationKey
                            === key
                    ) {
                        projectionLineKeyboardRamificationKey =
                            null;
                    }
                }
            );

            play.addEventListener(
                "click",
                () => {
                    const state =
                        projectionLineAnimations[key];

                    if (state?.running) {
                        stopProjectionLineAnimation(
                            key
                        );
                        commitProjectionLine();
                    } else {
                        if (
                            projectionLineGloballyPaused
                            || projectionRamificationLocked
                        ) {
                            prepareProjectionLinePlayback();
                        } else {
                            clearProjectionLineGlobalPauseState();
                        }

                        startProjectionLineAnimation(
                            key,
                            minValue,
                            maxValue
                        );
                    }
                }
            );

            row.append(
                min,
                slider,
                max,
                play
            );
            control.append(
                header,
                row
            );
            container.appendChild(
                control
            );

            projectionLineControlRefs[key] = {
                slider,
                value,
                editor,
                play
            };
        };

        buildAngleControl({
            key: "azimuth",
            labelText: "Azimuth α",
            minValue: -180,
            maxValue: 180,
            ariaLabel:
                "Azimuth of the vertical plane through P"
        });

        buildAngleControl({
            key: "elevation",
            labelText: "Elevation β",
            minValue: -90,
            maxValue: 90,
            ariaLabel:
                "Elevation of the line through P inside the vertical plane"
        });

        const ramificationExample =
            document.createElement("button");
        ramificationExample.type = "button";
        ramificationExample.className =
            "clebsch-ramification-example";
        ramificationExample.textContent =
            "Snap to nearest ramification";
        ramificationExample.title =
            "Keep the azimuth fixed and move the elevation to the nearest ramification direction";

        ramificationExample.addEventListener(
            "click",
            () => {
                stopProjectionLineAnimation(
                    "elevation"
                );
                clearProjectionLineGlobalPauseState();

                projectionLineState.elevation =
                    nearestProjectionRamificationElevation(
                        projectionLineState.azimuth,
                        projectionLineState.elevation
                    );

                const elevationState =
                    projectionLineAnimations
                        .elevation;

                if (elevationState) {
                    elevationState.position =
                        projectionLineState.elevation;
                }

                projectionRamificationLocked = true;
                projectionLineAutoStopArmed = false;

                renderProjectionLineControls();
                commitProjectionLine();
            }
        );

        container.appendChild(
            ramificationExample
        );

        projectionLineControlRefs
            .ramificationExample =
                ramificationExample;

        renderProjectionLineControls();
        setProjectionLineControlsEnabled(
            checkbox.checked
        );

        return container;
    }

    function lineExpressionsForCurrentPalette() {
        const lines = pages.clebsch.features.lines27.expressions;
        return lines.map(expression => {
            const inOrangeRow = DOUBLE_SIX_ORANGE_IDS.has(expression.id);
            const inBlueRow = DOUBLE_SIX_BLUE_IDS.has(expression.id);
            const inDoubleSix = inOrangeRow || inBlueRow;
            let color = expression.color;
            if (doubleSixHighlighted) {
                if (inOrangeRow) color = COLORS.intersection;
                else if (inBlueRow) color = COLORS.blueCurve;
            }
            return {
                ...expression,
                color,
                /* Explicit false reliably unhides these expressions when the
                   full 27-line view is restored. */
                hidden: doubleSixHighlighted && !inDoubleSix
            };
        });
    }

    function applyLinePalette() {
        const lineExpressions = lineExpressionsForCurrentPalette();
        if (mainCalculator) {
            mainCalculator.setExpressions(lineExpressions);
        }
    }

    function diagnoseExpressions(expectedExpressions) {
        if (!mainCalculator) return;
        const expectedIds = new Set(expectedExpressions.map(expression => expression.id));
        const actualIds = new Set(
            mainCalculator.getExpressions().map(expression => expression.id)
        );
        const missing = [...expectedIds].filter(id => !actualIds.has(id));
        if (missing.length > 0) {
            console.warn("Clebsch expressions missing after batch insertion:", missing);
        }
        setTimeout(() => {
            if (!mainCalculator) return;
            const analysis = mainCalculator.expressionAnalysis || {};
            const errors = [...expectedIds]
                .filter(id => analysis[id] && analysis[id].isError)
                .map(id => ({ id, error: analysis[id].errorMessage }));
            if (errors.length > 0) {
                console.warn("Clebsch Desmos expression errors:", errors);
            }
        }, 120);
    }

    function showFeature(feature) {
        const expressions = feature === pages.clebsch.features.lines27
            ? lineExpressionsForCurrentPalette()
            : feature.expressions;
        mainCalculator.setExpressions(expressions);
        expressions.forEach(expression => {
            if (!activeExpressionIds.includes(expression.id)) {
                activeExpressionIds.push(expression.id);
            }
        });
        if (feature === pages.clebsch.features.lines27) {
            diagnoseExpressions(expressions);
        }
    }

    function hideFeature(feature) {
        const removals = feature.expressions.map(expression => ({ id: expression.id }));
        mainCalculator.removeExpressions(removals);
        const removedIds = new Set(removals.map(expression => expression.id));
        activeExpressionIds = activeExpressionIds.filter(id => !removedIds.has(id));
    }

    function selectBitangentLine(number) {
        selectedBitangentLine = number;
        const page = pages.clebsch;
        const generated = bitangentExpressionCache[number - 1]
            || selectedBitangentExpressions(
                number,
                page.features.lines27.expressions[number - 1]
            );
        page.features.selectedBitangentPair.expressions = generated.pair;
        page.features.selectedBitangentPlane.expressions = generated.plane;
        if (activeExpressionIds.includes("projection-bitangent-line-selected")) {
            mainCalculator.setExpressions(generated.pair);
        }
        if (activeExpressionIds.includes("projection-bitangent-plane-selected")) {
            mainCalculator.setExpressions(generated.plane);
        }
        if (
            currentClebschInfoMode === "remark"
            && currentClebschRemarkMode === "line-conic"
        ) {
            updateTargetProjectionCard("line-conic");
        }
    }

    function buildBitangentSelector(checkbox) {
        const picker = document.createElement("div");
        picker.className = "geometry-control clebsch-schlafli-selector";
        picker.setAttribute("aria-label", "Choose a surface line in Schläfli notation");

        const initial = schlafliLabelsByLine[selectedBitangentLine - 1];
        let family = initial.family;
        let indices = [...initial.indices];
        const familyButtons = new Map();
        const indexButtons = [];

        const playbackKeys = [
            ...Array.from({length: 6}, (_, i) => `E${i + 1}`),
            ...Array.from({length: 6}, (_, i) =>
                Array.from({length: 5 - i}, (_, j) =>
                    `L${i + 1}${i + j + 2}`
                )
            ).flat(),
            ...Array.from({length: 6}, (_, i) => `C${i + 1}`)
        ];
        const playbackLines = playbackKeys.map(key =>
            schlafliLineByLabel.get(key)
        );
        if (playbackLines.length !== 27
            || playbackLines.some(number => !number)
            || new Set(playbackLines).size !== 27) {
            throw new Error("Incomplete Schläfli playback order");
        }
        const playButton = document.createElement("button");
        playButton.type = "button";
        playButton.className = "clebsch-schlafli-play";
        playButton.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true"
                 class="clebsch-schlafli-play-icon">
                <path class="clebsch-schlafli-play-glyph"
                      d="M8 5.5 L18 12 L8 18.5 Z"/>
                <g class="clebsch-schlafli-pause-glyph">
                    <rect x="7" y="5.5" width="3.3" height="13" rx="0.7"/>
                    <rect x="13.7" y="5.5" width="3.3" height="13" rx="0.7"/>
                </g>
            </svg>
        `;
        const playbackStepMs = 1400;
        let playbackTimer = null;
        let playbackPlaying = false;
        const syncPlayButton = () => {
            playButton.classList.toggle("playing", playbackPlaying);
            playButton.setAttribute("aria-pressed", String(playbackPlaying));
            playButton.setAttribute("aria-label", playbackPlaying
                ? "Pause the 27-line sequence"
                : "Play the 27 lines from the current selection");
            playButton.title = playbackPlaying
                ? "Pause" : "Play the 27 lines from the current selection";
        };
        const pausePlayback = () => {
            if (playbackTimer !== null) {
                clearTimeout(playbackTimer);
                playbackTimer = null;
            }
            playbackPlaying = false;
            syncPlayButton();
        };
        const advancePlayback = () => {
            playbackTimer = null;
            if (!playbackPlaying) return;
            if (!checkbox.checked
                || currentClebschInfoMode !== "remark"
                || currentClebschRemarkMode !== "line-conic") {
                pausePlayback();
                return;
            }
            const index = playbackLines.indexOf(selectedBitangentLine);
            const nextNumber = playbackLines[(index + 1) % 27];
            const nextLabel = schlafliLabelsByLine[nextNumber - 1];
            family = nextLabel.family;
            indices = [...nextLabel.indices];
            selectBitangentLine(nextNumber);
            render();
            playbackTimer = setTimeout(advancePlayback, playbackStepMs);
        };
        playButton.addEventListener("click", () => {
            if (!checkbox.checked) return;
            if (playbackPlaying) {
                pausePlayback();
                return;
            }
            // Start by displaying the already-selected line for one interval.
            const shownLabel = schlafliLabelsByLine[selectedBitangentLine - 1];
            family = shownLabel.family;
            indices = [...shownLabel.indices];
            render();
            playbackPlaying = true;
            syncPlayButton();
            playbackTimer = setTimeout(advancePlayback, playbackStepMs);
        });

        const core = document.createElement("div");
        core.className = "clebsch-schlafli-core";
        const notation = document.createElement("div");
        notation.className = "clebsch-schlafli-notation";
        notation.setAttribute("aria-live", "polite");
        const familyRow = document.createElement("div");
        familyRow.className = "clebsch-schlafli-families";
        familyRow.setAttribute("role", "group");
        familyRow.setAttribute("aria-label", "Choose Schläfli family");

        const commitSelection = () => {
            if (family === "L" && indices.length !== 2) return;
            const key = `${family}${[...indices].sort((a, b) => a - b).join("")}`;
            const lineNumber = schlafliLineByLabel.get(key);
            if (!lineNumber) throw new Error(`Unknown Schläfli label ${key}`);
            selectBitangentLine(lineNumber);
        };

        const render = () => {
            const color = SCHLAFLI_FAMILY_COLORS[family];
            picker.dataset.family = family;
            picker.style.setProperty("--schlafli-color", color);
            notation.replaceChildren();
            const symbol = document.createElement("span");
            symbol.textContent = family;
            const subscript = document.createElement("sub");
            const shownIndices = family === "L"
                ? [indices[0] || "?", indices[1] || "?"]
                : [indices[0] || "?"];
            subscript.textContent = shownIndices.join("");
            notation.append(symbol, subscript);
            familyButtons.forEach((button, name) => {
                button.classList.toggle("active", name === family);
                button.setAttribute("aria-pressed", String(name === family));
                button.disabled = !checkbox.checked;
            });
            indexButtons.forEach((button, index) => {
                const active = indices.includes(index + 1);
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
                button.disabled = !checkbox.checked;
            });            playButton.disabled = !checkbox.checked;
            if (!checkbox.checked && playbackPlaying) pausePlayback();

            picker.classList.toggle("disabled", !checkbox.checked);
        };

        ["E", "L", "C"].forEach(name => {
            const button = document.createElement("button");
            button.type = "button";
            button.className =
                `clebsch-schlafli-family-button family-${name}`;

            const heart = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );
            heart.classList.add("clebsch-schlafli-family-heart");
            heart.setAttribute("viewBox", "0 0 44 42");
            heart.setAttribute("aria-hidden", "true");

            const heartShape = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
            );
            heartShape.classList.add(
                "clebsch-schlafli-family-heart-shape"
            );
            heartShape.setAttribute(
                "d",
                "M22 39 C18 34 4 26 4 13 C4 4 15 1 22 10 C29 1 40 4 40 13 C40 26 26 34 22 39 Z"
            );
            heart.appendChild(heartShape);

            const label = document.createElement("span");
            label.textContent = name;
            button.append(heart, label);
            button.setAttribute("aria-label", `Choose ${name} family`);
            button.addEventListener("click", () => {
                if (!checkbox.checked) return;
                pausePlayback();
                if (family === name) return;
                const first = indices[0] || 1;
                family = name;
                indices = name === "L"
                    ? [first, first === 1 ? 2 : 1].sort((a, b) => a - b)
                    : [first];
                commitSelection();
                render();
            });
            familyButtons.set(name, button);
            familyRow.appendChild(button);
        });
        core.append(notation, playButton);
        picker.append(familyRow, core);

        for (let index = 1; index <= 6; index += 1) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `clebsch-schlafli-index index-${index}`;
            button.textContent = String(index);
            button.setAttribute("aria-label", `Choose subscript ${index}`);
            button.addEventListener("click", () => {
                if (!checkbox.checked) return;
                pausePlayback();
                if (family !== "L") {
                    indices = [index];
                    commitSelection();
                } else if (indices.includes(index)) {
                    indices = indices.filter(value => value !== index);
                } else if (indices.length < 2) {
                    indices = [...indices, index].sort((a, b) => a - b);
                    commitSelection();
                } else {
                    indices = [index];
                }
                render();
            });
            indexButtons.push(button);
            picker.appendChild(button);
        }

        checkbox.addEventListener("change", render);
        picker.syncSchlafliState = render;
        picker.stopSchlafliPlayback = pausePlayback;
        render();
        return picker;
    }

    function buildControls(page) {
        geometryControls.innerHTML = "";

        const headingActions =
            document.getElementById(
                "control-heading-actions"
            );

        if (headingActions) {
            headingActions.innerHTML = "";

            const stopButton =
                document.createElement(
                    "button"
                );
            stopButton.type = "button";
            stopButton.className =
                "warmup-stop-button";
            projectionLineGlobalStopButton =
                stopButton;

            updateProjectionLineGlobalStopButton();

            stopButton.addEventListener(
                "click",
                () => {
                    if (
                        projectionLineGloballyPaused
                    ) {
                        resumeAllProjectionLineAnimations();
                    } else {
                        pauseAllProjectionLineAnimations();
                    }
                }
            );

            headingActions.appendChild(
                stopButton
            );

            const nonstopButton =
                document.createElement(
                    "button"
                );
            nonstopButton.type = "button";
            nonstopButton.className =
                "clebsch-nonstop-button";
            nonstopButton.setAttribute(
                "aria-pressed",
                "false"
            );
            nonstopButton.innerHTML = `
                <svg
                    class="clebsch-nonstop-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false">
                    <rect
                        class="nonstop-icon-stop"
                        x="8"
                        y="8"
                        width="8"
                        height="8"
                        rx="0.7" />
                    <line
                        class="nonstop-icon-slash"
                        x1="5.5"
                        y1="18.5"
                        x2="18.5"
                        y2="5.5" />
                </svg>
            `;
            projectionLineNonstopButton =
                nonstopButton;

            updateProjectionLineNonstopButton();

            nonstopButton.addEventListener(
                "click",
                () => {
                    projectionLineNonstop =
                        !projectionLineNonstop;

                    if (!projectionLineNonstop) {
                        projectionLineNonstopVisitedRamificationPoints =
                            [];
                        projectionLineNonstopVisitedTargetPoints =
                            [];
                        projectionLineTransientShineActive =
                            false;

                        if (
                            projectionLineTransientShineTimer
                            !== null
                        ) {
                            clearTimeout(
                                projectionLineTransientShineTimer
                            );
                            projectionLineTransientShineTimer =
                                null;
                        }
                    }

                    updateProjectionLineNonstopButton();
                    commitProjectionLine();
                }
            );

            headingActions.appendChild(
                nonstopButton
            );
        }

        let currentGroup = null;
        Object.entries(page.features).forEach(([featureKey, feature]) => {
            if (feature.control === false) return;
            if (feature.group
                && feature.group !== "main"
                && feature.group !== currentGroup) {
                currentGroup = feature.group;
                const heading = document.createElement("div");
                heading.className = `geometry-group ${feature.group}`;
                heading.dataset.featureGroup = feature.group;
                const sectionNames = {
                    setup: "PROJECTION",
                    equation: "2. GEOMETRY · EQUATION",
                    "remark-27": "27 LINE–CONIC PAIRS",
                    "remark-extra": "TANGENT-PLANE PAIR"
                };
                heading.textContent = sectionNames[feature.group]
                    || feature.group.toUpperCase();
                geometryControls.appendChild(heading);
            }

            const label = document.createElement("label");
            label.className = "geometry-control";
            label.dataset.featureGroup = feature.group || "main";
            label.dataset.featureKey = featureKey;
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = feature.checked;
            checkbox.dataset.featureKey = featureKey;
            const text = document.createElement("span");
            text.textContent = feature.label;
            if (feature.group === "blue") text.style.color = COLORS.blueCurve;
            if (featureKey.startsWith("projection")) {
                text.style.color = COLORS.purpleCurve;
            }
            if (featureKey === "projectionLine") {
                text.style.color = PROJECTION_LINE_COLOR;
            }
            label.append(checkbox, text);
            geometryControls.appendChild(label);

            if (featureKey === "selectedBitangentPair") {
                const selector = buildBitangentSelector(checkbox);
                selector.dataset.featureGroup = feature.group || "main";
                selector.dataset.featureKey = featureKey;
                geometryControls.appendChild(selector);
            }
            if (featureKey === "projectionLine") {
                const projectionControls = buildProjectionLineControls(checkbox);
                projectionControls.dataset.featureGroup = feature.group || "main";
                projectionControls.dataset.featureKey = featureKey;
                geometryControls.appendChild(projectionControls);
            }

            let doubleSixButton = null;
            if (featureKey === "lines27") {
                doubleSixButton = document.createElement("button");
                doubleSixButton.id = "clebsch-double-six-toggle";
                doubleSixButton.className = "clebsch-subbutton";
                doubleSixButton.dataset.featureGroup = feature.group || "main";
                doubleSixButton.dataset.featureKey = featureKey;
                doubleSixButton.type = "button";
                doubleSixButton.textContent = doubleSixHighlighted
                    ? "Show all 27 lines"
                    : "Show double-six";
                doubleSixButton.disabled = !checkbox.checked;
                doubleSixButton.hidden = !checkbox.checked;
                doubleSixButton.setAttribute("aria-pressed", String(doubleSixHighlighted));
                doubleSixButton.classList.toggle("active", doubleSixHighlighted);
                doubleSixButton.addEventListener("click", () => {
                    if (!checkbox.checked) return;
                    doubleSixHighlighted = !doubleSixHighlighted;
                    applyLinePalette();
                    doubleSixButton.textContent = doubleSixHighlighted
                        ? "Show all 27 lines"
                        : "Show double-six";
                    doubleSixButton.setAttribute(
                        "aria-pressed",
                        String(doubleSixHighlighted)
                    );
                    doubleSixButton.classList.toggle("active", doubleSixHighlighted);
                });
                geometryControls.appendChild(doubleSixButton);
            }

            if (featureKey === "lines27") {
                const all28Label = document.createElement("label");
                all28Label.className = "geometry-control";
                all28Label.dataset.featureGroup = "remark-27";
                all28Label.dataset.featureKey = "all28Bitangents";

                const all28Checkbox = document.createElement("input");
                all28Checkbox.type = "checkbox";
                all28Checkbox.checked = all28BitangentsVisible;
                all28Checkbox.id = "clebsch-all-28-bitangents";
                all28Checkbox.setAttribute(
                    "aria-label",
                    "Show all 28 bitangents in the 2D target"
                );
                const caption = document.createElement("span");
                caption.textContent = "All 28 bitangents";
                all28Label.title =
                    "Show the 28 target lines in the greens of the 3D lines";
                all28Label.append(all28Checkbox, caption);
                geometryControls.appendChild(all28Label);

                all28Checkbox.addEventListener("change", () => {
                    all28BitangentsVisible = all28Checkbox.checked;
                    if (
                        tangentProjection2D
                        && currentClebschInfoMode === "remark"
                    ) {
                        updateTargetProjectionCard(
                            currentClebschRemarkMode
                        );
                    }
                });
            }

            checkbox.addEventListener("change", () => {
                if (checkbox.checked) showFeature(feature);
                else hideFeature(feature);
                if (doubleSixButton) {
                    doubleSixButton.disabled = !checkbox.checked;
                    doubleSixButton.hidden = !checkbox.checked;
                }
                if (featureKey === "projectionLine") {
                    setProjectionLineControlsEnabled(checkbox.checked);
                }
            });
        });
    }

    function targetProjectionFindViewportBounds(
        value,
        seen = new Set()
    ) {
        if (
            !value
            || typeof value !== "object"
            || seen.has(value)
        ) {
            return null;
        }

        seen.add(value);

        if (
            Number.isFinite(Number(value.xmin))
            && Number.isFinite(Number(value.xmax))
            && Number.isFinite(Number(value.ymin))
            && Number.isFinite(Number(value.ymax))
            && Number(value.xmin) < Number(value.xmax)
            && Number(value.ymin) < Number(value.ymax)
        ) {
            return {
                left: Number(value.xmin),
                right: Number(value.xmax),
                bottom: Number(value.ymin),
                top: Number(value.ymax)
            };
        }

        if (
            Number.isFinite(Number(value.left))
            && Number.isFinite(Number(value.right))
            && Number.isFinite(Number(value.bottom))
            && Number.isFinite(Number(value.top))
            && Number(value.left) < Number(value.right)
            && Number(value.bottom) < Number(value.top)
        ) {
            return {
                left: Number(value.left),
                right: Number(value.right),
                bottom: Number(value.bottom),
                top: Number(value.top)
            };
        }

        for (const child of Object.values(value)) {
            const bounds =
                targetProjectionFindViewportBounds(
                    child,
                    seen
                );

            if (bounds) return bounds;
        }

        return null;
    }

    function targetProjectionCurrentBounds() {
        if (!tangentProjection2D) {
            return TARGET_PROJECTION_BOUNDS;
        }

        /* Desmos exposes the rendered graphpaper bounds directly on current
           builds. Prefer those because they already include card resizing and
           interactive zoom/pan. Fall back to getState() for compatibility. */
        const direct =
            tangentProjection2D
                .graphpaperBounds
                ?.mathCoordinates;
        const directBounds =
            targetProjectionFindViewportBounds(
                direct
            );

        if (directBounds) {
            return directBounds;
        }

        if (
            typeof tangentProjection2D.getState
                === "function"
        ) {
            const stateBounds =
                targetProjectionFindViewportBounds(
                    tangentProjection2D.getState()
                );

            if (stateBounds) {
                return stateBounds;
            }
        }

        return TARGET_PROJECTION_BOUNDS;
    }

    function targetProjectionViewportSignature(
        bounds
    ) {
        return [
            bounds.left,
            bounds.right,
            bounds.bottom,
            bounds.top
        ]
            .map(value =>
                Number(value).toPrecision(10)
            )
            .join("|");
    }

    function syncTargetProjectionIndicatorToViewport() {
        if (
            !tangentProjection2D
            || currentClebschInfoMode
                !== "equation"
            || currentClebschEquationStep
                !== 4
        ) {
            return;
        }

        const bounds =
            targetProjectionCurrentBounds();
        const signature =
            targetProjectionViewportSignature(
                bounds
            );

        if (
            signature
            === targetProjectionLastViewportSignature
        ) {
            return;
        }

        /* Record the viewport before writing the point expression. The Desmos
           write itself may emit another change event; that callback then sees
           the same signature and becomes a no-op. */
        targetProjectionLastViewportSignature =
            signature;

        const point =
            branchProjectionExpressions()
                .find(expression =>
                    expression.id
                    === "clebsch-target-projection-point"
                );

        if (point) {
            tangentProjection2D.setExpression(
                point
            );
        }
    }

    function scheduleTargetProjectionViewportSync() {
        if (
            targetProjectionViewportSyncTimer
            !== null
        ) {
            clearTimeout(
                targetProjectionViewportSyncTimer
            );
        }

        /* Zooming/panning can emit many Desmos changes. Let the gesture settle
           briefly, then reposition just the edge marker against the new live
           bounds. Source geometry is untouched. */
        targetProjectionViewportSyncTimer =
            setTimeout(() => {
                targetProjectionViewportSyncTimer =
                    null;
                syncTargetProjectionIndicatorToViewport();
                if (currentClebschInfoMode === "remark") {
                    updateRemarkTangencySubtitle(currentClebschRemarkMode);
                }
            }, 60);
    }

    function targetProjectionDisplayState() {
        const direction =
            projectionLineDirection();
        const parameter =
            Math.abs(direction.z) > 1e-12
                ? -PROJECTION_POINT.z
                    / direction.z
                : null;

        if (parameter === null) {
            return {
                visible: false,
                actualX: null,
                actualY: null,
                shownX: 0,
                shownY: 0,
                inside: false,
                edgeArrow: "",
                label: "",
                labelOrientation:
                    Desmos.LabelOrientations.DEFAULT
            };
        }

        const actualX =
            PROJECTION_POINT.x
            + parameter * direction.x;
        const actualY =
            PROJECTION_POINT.y
            + parameter * direction.y;

        const {
            left,
            right,
            bottom,
            top
        } = targetProjectionCurrentBounds();
        const marginX =
            (right - left)
            * TARGET_PROJECTION_EDGE_MARGIN_FRACTION;
        const marginY =
            (top - bottom)
            * TARGET_PROJECTION_EDGE_MARGIN_FRACTION;

        const minX = left + marginX;
        const maxX = right - marginX;
        const minY = bottom + marginY;
        const maxY = top - marginY;

        const inside =
            actualX >= minX
            && actualX <= maxX
            && actualY >= minY
            && actualY <= maxY;

        let shownX = actualX;
        let shownY = actualY;
        let edgeArrow = "";
        let labelOrientation =
            Desmos.LabelOrientations.DEFAULT;

        if (!inside) {
            const anchorX =
                PROJECTION_POINT.x;
            const anchorY =
                PROJECTION_POINT.y;
            const deltaX =
                actualX - anchorX;
            const deltaY =
                actualY - anchorY;
            const candidates = [];

            if (Math.abs(deltaX) > 1e-12) {
                const xBoundary =
                    deltaX > 0
                        ? maxX
                        : minX;
                const tx =
                    (xBoundary - anchorX)
                    / deltaX;

                if (tx > 0) {
                    candidates.push({
                        t: tx,
                        arrow:
                            deltaX > 0
                                ? "→"
                                : "←"
                    });
                }
            }

            if (Math.abs(deltaY) > 1e-12) {
                const yBoundary =
                    deltaY > 0
                        ? maxY
                        : minY;
                const ty =
                    (yBoundary - anchorY)
                    / deltaY;

                if (ty > 0) {
                    candidates.push({
                        t: ty,
                        arrow:
                            deltaY > 0
                                ? "↑"
                                : "↓"
                    });
                }
            }

            const edge =
                candidates
                    .filter(candidate =>
                        candidate.t <= 1
                    )
                    .sort(
                        (first, second) =>
                            first.t - second.t
                    )[0];

            if (edge) {
                shownX =
                    anchorX
                    + edge.t * deltaX;
                shownY =
                    anchorY
                    + edge.t * deltaY;
                edgeArrow =
                    edge.arrow;
            } else {
                shownX =
                    Math.max(
                        minX,
                        Math.min(
                            maxX,
                            actualX
                        )
                    );
                shownY =
                    Math.max(
                        minY,
                        Math.min(
                            maxY,
                            actualY
                        )
                    );

                const horizontalOverflow =
                    Math.max(
                        minX - actualX,
                        actualX - maxX,
                        0
                    );
                const verticalOverflow =
                    Math.max(
                        minY - actualY,
                        actualY - maxY,
                        0
                    );

                if (
                    horizontalOverflow
                    >= verticalOverflow
                ) {
                    edgeArrow =
                        actualX >= maxX
                            ? "→"
                            : "←";
                } else {
                    edgeArrow =
                        actualY >= maxY
                            ? "↑"
                            : "↓";
                }
            }

            /* Fix the label on the inward side of the same displayed point.
               This overrides Desmos's automatic collision-driven placement,
               which otherwise makes the label appear to move at a different
               pace from the marker near a graph boundary. */
            if (edgeArrow === "→") {
                labelOrientation =
                    Desmos.LabelOrientations.LEFT;
            } else if (edgeArrow === "←") {
                labelOrientation =
                    Desmos.LabelOrientations.RIGHT;
            } else if (edgeArrow === "↑") {
                labelOrientation =
                    Desmos.LabelOrientations.BELOW;
            } else if (edgeArrow === "↓") {
                labelOrientation =
                    Desmos.LabelOrientations.ABOVE;
            }
        }

        return {
            visible: true,
            actualX,
            actualY,
            shownX,
            shownY,
            inside,
            edgeArrow,
            label:
                inside
                    ? (
                        projectionBlowupActive
                            ? "φ(e)"
                            : "φ(ℓ)"
                    )
                    : `${
                        projectionBlowupActive
                            ? "φ(e)"
                            : "φ(ℓ)"
                    } ${edgeArrow}`,
            labelOrientation
        };
    }

    function projectionNonstopVisitedTargetExpression() {
        const points =
            projectionLineNonstopVisitedTargetPoints;

        return {
            id:
                "clebsch-target-nonstop-visited-ramification",
            latex:
                points.length
                    ? `[${points
                        .map(point =>
                            `(${pointCoordinateLatex(
                                point.x
                            )},${pointCoordinateLatex(
                                point.y
                            )})`
                        )
                        .join(",")}]`
                    : "[]",
            color: targetDisplayColor(
                COLORS.purpleCurve
            ),
            pointSize: 7,
            pointOpacity: 1,
            hidden:
                !projectionLineNonstop
                || points.length === 0
        };
    }

    function exceptionalBitangentExpression(
        hidden = false
    ) {
        return hidden
            ? {
                id: "clebsch-target-bitangent",
                latex: "0=1",
                hidden: true
            }
            : {
                id: "clebsch-target-bitangent",
                latex:
                    PROJECTION_EXCEPTIONAL_BITANGENT_LATEX,
                color: targetDisplayColor(
                    COLORS.purpleCurve
                ),
                hidden: false
            };
    }

    function exceptionalTangencyExpression(
        index,
        {
            hidden = false,
            pointSize = 7,
            showLabel = false,
            labelOrientation =
                Desmos.LabelOrientations.DEFAULT
        } = {}
    ) {
        const id =
            `clebsch-target-tangency-${index + 1}`;

        if (hidden) {
            return {
                id,
                latex: "(0,0)",
                hidden: true
            };
        }

        const expression = {
            id,
            latex:
                PROJECTION_EXCEPTIONAL_TANGENCY_LATEX[
                    index
                ],
            color: targetDisplayColor(
                COLORS.intersection
            ),
            pointSize,
            pointOpacity: 1,
            hidden: false
        };

        if (showLabel) {
            expression.pointOpacity = 1;
            expression.showLabel = true;
            expression.label =
                `φ(e${index === 0 ? "₁" : "₂"})`;
            expression.labelOrientation =
                labelOrientation;
        }

        return expression;
    }

    function blowupTargetExpressions() {
        if (!projectionBlowupActive) {
            return [
                exceptionalBitangentExpression(true),
                exceptionalTangencyExpression(
                    0,
                    { hidden: true }
                ),
                exceptionalTangencyExpression(
                    1,
                    { hidden: true }
                )
            ];
        }

        return [
            exceptionalBitangentExpression(),
            exceptionalTangencyExpression(
                0,
                { pointSize: 7 }
            ),
            exceptionalTangencyExpression(
                1,
                { pointSize: 7 }
            )
        ];
    }

    function branchProjectionExpressions() {
        const display =
            targetProjectionDisplayState();

        const targetPoint =
            display.visible
                ? {
                    id:
                        "clebsch-target-projection-point",
                    latex:
                        `(${pointCoordinateLatex(
                            display.shownX
                        )},${pointCoordinateLatex(
                            display.shownY
                        )})`,
                    color: targetDisplayColor(
                        COLORS.purpleCurve
                    ),
                    pointSize: 7,
                    pointOpacity: 1,
                    hidden: false,
                    showLabel: true,
                    label: display.label,
                    labelOrientation:
                        display.labelOrientation
                }
                : {
                    id:
                        "clebsch-target-projection-point",
                    latex: "(0,0)",
                    pointSize: 7,
                    pointOpacity: 1,
                    hidden: true,
                    showLabel: false
                };

        return [
            {
                id:
                    "clebsch-target-branch-quartic",
                latex: PROJECTION_BRANCH_QUARTIC_LATEX,
                color: targetDisplayColor(
                    COLORS.surface
                ),
                hidden: false
            },
            {
                id:
                    "clebsch-target-branch-quartic-glow",
                latex: PROJECTION_BRANCH_QUARTIC_LATEX,
                color: targetDisplayColor(
                    BRANCH_GLOW_COLOR
                ),
                lineWidth: 1,
                hidden:
                    !projectionRamificationDisplayActive()
            },
            projectionNonstopVisitedTargetExpression(),
            targetPoint,
            ...blowupTargetExpressions()
        ];
    }

    /* Draw all 28 bitangents in the target, without adding any
       expressions to the 3D calculator. The 27 line–conic pairs
       inherit their corresponding 3D greens. The selected line is
       separately highlighted with its existing Schläfli family color. */
    function allTargetBitangentExpressions(
        visible = false,
        selectedLine = -1
    ) {
        const sourceLines =
            pages.clebsch.features.lines27.expressions;
        const background = bitangentExpressionCache.map(
            (generated, index) => ({
                id:
                    `clebsch-target-all-bitangent-${index + 1}`,
                latex: generated.target.latex,
                color: targetDisplayColor(
                    sourceLines[index]?.color
                    || COLORS.clebschLine15
                ),
                /* Background only: preserve the green palette, but let
                   the highlighted pair and B remain legible. */
                lineWidth: 0.75,
                lineOpacity: 0.36,
                hidden: !visible || index + 1 === selectedLine
            })
        );

        background.push({
            id: "clebsch-target-all-bitangent-28",
            latex: PROJECTION_EXCEPTIONAL_BITANGENT_LATEX,
            color: targetDisplayColor(
                COLORS.clebschLine12
            ),
            /* Background only: preserve the green palette, but let
                   the highlighted pair and B remain legible. */
                lineWidth: 0.75,
                lineOpacity: 0.36,
            hidden: !visible
        });
        return background;
    }

    function targetProjectionExpressions(
        remarkMode = currentClebschRemarkMode
    ) {
        const branch = {
            id: "clebsch-target-branch-quartic",
            latex: PROJECTION_BRANCH_QUARTIC_LATEX,
            color: targetDisplayColor(
                COLORS.surface
            ),
            hidden: false
        };
        const branchGlow = {
            id:
                "clebsch-target-branch-quartic-glow",
            latex: PROJECTION_BRANCH_QUARTIC_LATEX,
            color: targetDisplayColor(
                BRANCH_GLOW_COLOR
            ),
            lineWidth: 1,
            hidden: true
        };

        if (remarkMode === "line-conic") {
            const generated =
                bitangentExpressionCache[
                    selectedBitangentLine - 1
                ];
            const targetLine =
                generated?.target
                    ? {
                        ...generated.target,
                        color: targetDisplayColor(
                            generated.target.color
                        )
                    }
                    : {
                        id: "clebsch-target-bitangent",
                        latex: "0=1",
                        hidden: true
                    };
            const points =
                generated?.targetPoints || [];

            return [
                ...allTargetBitangentExpressions(
                    all28BitangentsVisible
                        && currentClebschInfoMode === "remark",
                    selectedBitangentLine
                ),
                branch,
                branchGlow,
                targetLine,
                ...[0,1].map(index => {
                    const point = points[index];

                    if (!point) {
                        return {
                            id:
                                `clebsch-target-tangency-${index + 1}`,
                            latex: "(0,0)",
                            hidden: true
                        };
                    }

                    return {
                        id:
                            `clebsch-target-tangency-${index + 1}`,
                        latex:
                            `(${projectionLineNumber(point.x)},`
                            + `${projectionLineNumber(point.y)})`,
                        color: targetDisplayColor(
                            COLORS.intersection
                        ),
                        pointSize: 7,
                        hidden: false
                    };
                })
            ];
        }

        return [
            ...allTargetBitangentExpressions(false),
            branch,
            branchGlow,
            exceptionalBitangentExpression(),
            exceptionalTangencyExpression(
                0,
                {
                    pointSize: 7,
                    hidden: false
                }
            ),
            exceptionalTangencyExpression(
                1,
                {
                    pointSize: 7,
                    hidden: false
                }
            )
        ];
    }



    /* Frame the real contact pair on selection, never during a manual
       zoom or pan. Every viewport includes the original branch-chart
       region and a comfortable margin around both distant contacts. */
    function targetProjectionContactFitBounds(points) {
        const xs = points.map(point => point.x);
        const ys = points.map(point => point.y);
        const minX = Math.min(TARGET_PROJECTION_BOUNDS.left, ...xs);
        const maxX = Math.max(TARGET_PROJECTION_BOUNDS.right, ...xs);
        const minY = Math.min(TARGET_PROJECTION_BOUNDS.bottom, ...ys);
        const maxY = Math.max(TARGET_PROJECTION_BOUNDS.top, ...ys);
        const paddingX = 0.17 * (maxX - minX);
        const paddingY = 0.17 * (maxY - minY);
        return {
            left: minX - paddingX,
            right: maxX + paddingX,
            bottom: minY - paddingY,
            top: maxY + paddingY
        };
    }

    function requestTargetProjectionContactFit(
        remarkMode = currentClebschRemarkMode
    ) {
        if (
            !tangentProjection2D
            || currentClebschInfoMode !== "remark"
        ) return;

        const key = remarkMode === "line-conic"
            ? `line-conic:${selectedBitangentLine}`
            : "tangent-plane";
        if (targetContactFitSelectionKey === key) return;
        targetContactFitSelectionKey = key;

        if (targetContactFitFrame !== null) {
            cancelAnimationFrame(targetContactFitFrame);
        }
        /* The card schedules its resize on the previous animation
           frame. A new selection cancels a pending, obsolete fit. */
        targetContactFitFrame = requestAnimationFrame(() => {
            targetContactFitFrame = null;
            if (
                !tangentProjection2D
                || currentClebschInfoMode !== "remark"
                || currentClebschRemarkMode !== remarkMode
                || targetContactFitSelectionKey !== key
            ) return;

            const points = remarkMode === "line-conic"
                ? bitangentExpressionCache[
                    selectedBitangentLine - 1
                ]?.targetPoints || []
                : PROJECTION_EXCEPTIONAL_TANGENCY_POINTS;
            if (
                points.length !== 2
                || points.some(point =>
                    !Number.isFinite(point.x)
                    || !Number.isFinite(point.y)
                )
            ) {
                /* Conjugate non-real contacts cannot be plotted here. */
                return;
            }

            const desired =
                targetProjectionContactFitBounds(points);
            const current = targetProjectionCurrentBounds();
            const insetX = 0.10 * (
                current.right - current.left
            );
            const insetY = 0.10 * (
                current.top - current.bottom
            );
            const comfortablyVisible = points.every(point =>
                point.x >= current.left + insetX
                && point.x <= current.right - insetX
                && point.y >= current.bottom + insetY
                && point.y <= current.top - insetY
            );
            /* After showing a remote bitangent, zoom back in when
               ordinary contacts would otherwise appear microscopic.
               If already comfortably framed, preserve existing zoom. */
            const overlyWide =
                current.right - current.left
                    > 2.8 * (desired.right - desired.left)
                || current.top - current.bottom
                    > 2.8 * (desired.top - desired.bottom);

            if (comfortablyVisible && !overlyWide) return;

            tangentProjection2D.setMathBounds(desired);
            scheduleTargetProjectionViewportSync();
        });
    }

    function updateRemarkTangencySubtitle(
        remarkMode = currentClebschRemarkMode
    ) {
        const subtitle = document.querySelector(
            ".clebsch-target-card-subtitle"
        );
        if (!subtitle) return;

        const points = remarkMode === "line-conic"
            ? bitangentExpressionCache[
                selectedBitangentLine - 1
            ]?.targetPoints || []
            : PROJECTION_EXCEPTIONAL_TANGENCY_POINTS;

        if (!points.length) {
            subtitle.textContent =
                "Two non-real tangencies · no real points to mark";
            return;
        }

        const bounds = targetProjectionCurrentBounds();
        const outsideCount = points.filter(point =>
            point.x < bounds.left
            || point.x > bounds.right
            || point.y < bounds.bottom
            || point.y > bounds.top
        ).length;

        if (outsideCount) {
            subtitle.textContent =
                (outsideCount === points.length
                    ? "Real tangencies outside view"
                    : "One real tangency outside view")
                + " · zoom out";
            return;
        }

        subtitle.textContent = remarkMode === "line-conic"
            ? "the line and conic have the same image"
            : "the two exceptional curves have the same image";
    }
    /* Experimental panel remains separate from the real Desmos target.
       For each conjugate pair a±bi, the two complex curves are represented
       schematically by fixed-scale surfaces z=±1.25|(t-a)^2+b^2|.
       Their intersections are exactly at t=a±bi.
       This is NOT an embedding of X(C) into R^3. */
    function drawUpstairsComplexSheets(panel, data) {
        const svg=panel.querySelector(
            "[data-complex-sheets-svg]"
        );
        if (!svg || !data || !(data.imag>0)) return;
        const steps=16;

        /* The ORIGINAL t-mode has one fixed window and height scale
           shared by all four bitangents: no fit-to-roots rescaling. */
        const sheetPoint=(u,v,sign)=>{
            const du=u-data.real;
            const q=Math.hypot(
                du*du-v*v+data.imag*data.imag,
                2*du*v
            );
            const z=sign*1.25*q;
            return [
                160+60*(u-0.25)/0.49-49*v/0.35,
                124+24*(u-0.25)/0.49+20*v/0.35-48*z
            ];
        };
        const point=(i,j,sign)=>{
            const u=-0.24+0.98*i/steps;
            const v=-0.35+0.70*j/steps;
            return sheetPoint(u,v,sign);
        };
        const coords=([x,y])=>
            x.toFixed(2)+","+y.toFixed(2);
        const path=pts=>"M"+pts.map(coords).join("L");
        const family=schlafliLabelsByLine[
            selectedBitangentLine-1
        ]?.family;
        const firstColor=
            SCHLAFLI_FAMILY_COLORS[family]||"#009FE3";
        const secondColor=COLORS.purpleCurve;
        const shapes=[];
        for(const [sign,color] of [
            [-1,secondColor],[1,firstColor]
        ]) {
            for(let j=0;j<steps;j++){
                const lower=Array.from(
                    {length:steps+1},
                    (_,i)=>point(i,j,sign)
                );
                const upper=Array.from(
                    {length:steps+1},
                    (_,i)=>point(steps-i,j+1,sign)
                );
                shapes.push(
                    '<path d="'+path([...lower,...upper])+
                    'Z" fill="'+color+
                    '" fill-opacity="0.23"/>'
                );
            }
            for(let j=0;j<=steps;j+=2){
                shapes.push(
                    '<path d="'+path(Array.from(
                        {length:steps+1},
                        (_,i)=>point(i,j,sign)
                    ))+'" stroke="'+color+
                    '" stroke-opacity="0.7" stroke-width="0.9" fill="none"/>'
                );
            }
            for(let i=0;i<=steps;i+=2){
                shapes.push(
                    '<path d="'+path(Array.from(
                        {length:steps+1},
                        (_,j)=>point(i,j,sign)
                    ))+'" stroke="'+color+
                    '" stroke-opacity="0.7" stroke-width="0.9" fill="none"/>'
                );
            }
        }
        const contact=v=>{
            const [x,y]=sheetPoint(data.real,v*data.imag,0);
            return '<circle cx="'+x+'" cy="'+y+
                '" r="4.6" fill="#FFAB00" stroke="#A16600"'+
                ' stroke-width="1.3"/>';
        };
        svg.innerHTML=shapes.join("")+contact(1)+contact(-1);
        const legend=panel.querySelector(
            "[data-complex-sheets-first]"
        );
        if(legend)legend.style.color=firstColor;
        const caption = panel.querySelector(
            "[data-complex-sheets-caption]"
        );
        if (caption) {
            const lineLabel = schlafliLabelsByLine[
                selectedBitangentLine - 1
            ]?.key || "selected line";
            const number = value =>
                Number(value.toPrecision(4)).toString();
            const a = number(data.real);
            const b = number(data.imag);
            const introduction =
                lineLabel + " · t = " + data.axis
                + " · contacts t ≈ " + a + " ± " + b + "i.";
            caption.textContent = introduction
                + " Fixed Re(t) ∈ [−0.24, 0.74],"
                + " Im(t) ∈ [−0.35, 0.35]."
                + " Common height z = ±1.25|(t−a)²+b²|."
                + " Schematic, not an embedding of X(ℂ) in ℝ³.";
        }
    }


    function updateComplexContactPreview(
        remarkMode = currentClebschRemarkMode
    ) {
        const button = document.getElementById(
            "clebsch-complex-contacts-toggle"
        );
        const panel = document.getElementById(
            "clebsch-complex-contact-card"
        );
        if (!button || !panel) return;
        const data = currentClebschInfoMode === "remark"
            && remarkMode === "line-conic"
                ? bitangentExpressionCache[
                    selectedBitangentLine - 1
                ]?.complexParameter : null;
        button.hidden = !data;
        button.setAttribute("aria-pressed",
            String(Boolean(data && complexContactPreviewOpen)));
        button.title = complexContactPreviewOpen
            ? "Hide complex contacts" : "Show complex contacts";
        panel.hidden = !data || !complexContactPreviewOpen;
        if (panel.hidden) return;
        panel.classList.toggle("clebsch-complex-show-sheets",complexSheetsMode);
        const sheetView=panel.querySelector("[data-complex-sheets-view]");
        if(sheetView)sheetView.hidden=!complexSheetsMode;
        const plane=panel.querySelector(".clebsch-complex-svg");
        if(plane)plane.hidden=complexSheetsMode;
        const choice=panel.querySelector("#clebsch-complex-sheets-toggle");
        if(choice) {
            choice.textContent=complexSheetsMode?"t-plane":"Sheets";
            choice.setAttribute("aria-pressed",String(complexSheetsMode));
        }
        const title=panel.querySelector("[data-complex-view-title]");
        if(title)title.textContent=complexSheetsMode
            ? "Upstairs · two curves" : "Complex t-plane";
        if(complexSheetsMode)drawUpstairsComplexSheets(panel,data);
        const scaling = 35 / Math.max(0.01,Math.abs(data.real),data.imag);
        const x = 72 + scaling*data.real;
        for (const [selector,sign] of [
            ["[data-complex-positive]",-1],
            ["[data-complex-negative]",1]
        ]) {
            const circle = panel.querySelector(selector);
            circle?.setAttribute("cx",String(x));
            circle?.setAttribute("cy",String(
                57 + sign*scaling*data.imag
            ));
        }
        const roots=panel.querySelector("[data-complex-roots]");
        const footnote=panel.querySelector("[data-complex-parameter]");
        const format=v=>Number(v.toPrecision(3)).toString();
        if (roots) roots.textContent=
            "t ≈ "+format(data.real)+" ± "+format(data.imag)+"i";
        if (footnote) footnote.textContent=
            "t = "+data.axis+" on ℓ · not real-plane points";
    }

    function setupComplexContactPreview() {
        document.getElementById(
            "clebsch-complex-sheets-toggle"
        )?.addEventListener("click",event=>{
            event.stopPropagation();
            complexSheetsMode=!complexSheetsMode;
            updateComplexContactPreview();
        });
        document.getElementById(
            "clebsch-complex-contacts-toggle"
        )?.addEventListener("click",event=>{
            event.stopPropagation();
            complexContactPreviewOpen = !complexContactPreviewOpen;
            updateComplexContactPreview();
        });
        document.getElementById(
            "clebsch-complex-close"
        )?.addEventListener("click",event=>{
            event.stopPropagation();
            complexContactPreviewOpen=false;
            complexSheetsMode=false;
            updateComplexContactPreview();
        });
    }



    function updateTargetProjectionCard(
        remarkMode = currentClebschRemarkMode
    ) {
        if (!tangentProjection2D) return;

        const branchMode =
            currentClebschInfoMode === "equation"
            && currentClebschEquationStep === 4;

        if (branchMode) {
            if (all28BitangentsOnTarget) {
                tangentProjection2D.setExpressions(
                    allTargetBitangentExpressions(false)
                );
                all28BitangentsOnTarget = false;
            }
        } else {
            all28BitangentsOnTarget =
                all28BitangentsVisible
                && currentClebschInfoMode === "remark"
                && remarkMode === "line-conic";
        }

        tangentProjection2D.setExpressions(
            branchMode
                ? branchProjectionExpressions()
                : targetProjectionExpressions(remarkMode)
        );
        if (!branchMode) {
            requestTargetProjectionContactFit(remarkMode);
        }
        updateComplexContactPreview(remarkMode);

        const subtitle = document.querySelector(
            ".clebsch-target-card-subtitle"
        );
        const meaning = document.querySelector(
            ".clebsch-target-card-meaning"
        );
        const title = document.querySelector(
            ".clebsch-target-card-title"
        );

        if (branchMode) {
            if (title) {
                title.textContent =
                    projectionBlowupActive
                        ? "Exceptional curve → Target P²"
                        : "Target P² = {z = 0}";
            }
            if (subtitle) {
                subtitle.textContent =
                    projectionBlowupActive
                        ? "direction model (left) · actual z = 0 coordinates (right)"
                        : "projection from P onto the xOy plane";
            }
            if (meaning) {
                meaning.textContent =
                    projectionBlowupActive
                        ? "e=[V] ↦ φ(e) ∈ ℓ_E   ·   e₁,e₂ ↦ tangency points"
                        : "B = φ(R)   ·   φ(ℓ) = ℓ ∩ {z = 0}";
            }
            return;
        }

        if (title) {
            title.textContent = "Target P² = {z = 0}";
        }

        updateRemarkTangencySubtitle(remarkMode);

        if (meaning) {
            const sourceMeaning =
                remarkMode === "line-conic"
                    ? "φ(L) = φ(C_L) = ℓ"
                    : "both curves map to the same bitangent ℓ";
            meaning.textContent =
                sourceMeaning + "   ·   B = φ(R)";
        }


    }

    function makeTangentProjectionDraggable() {
        const card = document.getElementById("clebsch-tangent-projection-card");
        const handle = card?.querySelector(".clebsch-target-card-header");
        if (!card || !handle) return;

        tangentProjectionDragCleanup?.();

        const onPointerDown = event => {
            if (
                event.button !== 0
                || event.target.closest("button")
            ) {
                return;
            }
            event.preventDefault();

            const stageRect = visualStage.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            const startX = event.clientX;
            const startY = event.clientY;
            const startLeft = cardRect.left - stageRect.left;
            const startTop = cardRect.top - stageRect.top;

            document.body.classList.add("clebsch-dragging-target-card");

            const move = moveEvent => {
                const left = Math.max(
                    8,
                    Math.min(
                        visualStage.clientWidth - card.offsetWidth - 8,
                        startLeft + moveEvent.clientX - startX
                    )
                );
                const top = Math.max(
                    8,
                    Math.min(
                        visualStage.clientHeight - card.offsetHeight - 8,
                        startTop + moveEvent.clientY - startY
                    )
                );

                card.style.left = Math.round(left) + "px";
                card.style.top = Math.round(top) + "px";
                card.style.right = "auto";
                card.style.bottom = "auto";
            };

            const stop = () => {
                document.body.classList.remove("clebsch-dragging-target-card");
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", stop);
                window.removeEventListener("pointercancel", stop);
            };

            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", stop);
            window.addEventListener("pointercancel", stop);
        };

        handle.addEventListener("pointerdown", onPointerDown);
        tangentProjectionDragCleanup = () => {
            handle.removeEventListener("pointerdown", onPointerDown);
        };
    }

    function sliceProjectionExpressions() {
        const direction =
            projectionLineDirection();
        const roots =
            projectionResidualParameters();

        const theta =
            projectionSliceAngle
            * Math.PI / 180;

        const lineA =
            Math.sin(theta);
        const lineB =
            -Math.cos(theta);

        const expressions = [
            {
                id: "clebsch-slice-cubic",
                latex: "30870x^3-15876x^2y+17325x^2-10584xy^2-84xy+1700x+7056y^3-2268y^2-430y=0",
                color: COLORS.surface
            },
            {
                id: "clebsch-slice-polar-conic",
                latex: "17325x^2-84xy+3400x-2268y^2-860y=0",
                color: COLORS.purplePlane,
                hidden: currentClebschEquationStep < 4
            },
            {
                id: "clebsch-slice-line",
                latex:
                    `${projectionLineNumber(lineA)}x+`
                    + `${projectionLineNumber(lineB)}y=0`,
                color: COLORS.purpleCurve
            },
            {
                id: "clebsch-slice-P",
                latex: "(0,0)",
                color: COLORS.purpleCurve,
                pointSize: 6
            }
        ];

        PROJECTION_SLICE_RAMIFICATION_POINTS
            .forEach((point, index) => {
                expressions.push({
                    id:
                        `clebsch-slice-ramification-${index + 1}`,
                    latex:
                        `(${pointCoordinateLatex(point[0])},`
                        + `${pointCoordinateLatex(point[1])})`,
                    color: COLORS.intersection,
                    pointSize: 7,
                    hidden: currentClebschEquationStep < 3
                });
            });

        [0, 1].forEach(index => {
            const t = roots[index];

            if (t === undefined) {
                expressions.push({
                    id:
                        `clebsch-slice-residual-${index + 1}`,
                    latex: "(0,0)",
                    hidden: true
                });
                return;
            }

            expressions.push({
                id:
                    `clebsch-slice-residual-${index + 1}`,
                latex:
                    `(${pointCoordinateLatex(t * direction.x)},`
                    + `${pointCoordinateLatex(t * direction.y)})`,
                color: PROJECTION_RESIDUAL_COLOR,
                pointSize: 7
            });
        });

        return expressions;
    }

    function updateSliceProjection2D() {
        if (!sliceProjection2D) return;

        sliceProjection2D.setExpressions(
            sliceProjectionExpressions()
        );
    }

    function setupSliceProjectionCard() {
        const root =
            document.getElementById(
                "clebsch-slice-projection"
            );

        if (!root) return;

        sliceProjection2D = registerCalculator(
            Desmos.GraphingCalculator(
                root,
                {
                    expressions: false,
                    settingsMenu: false,
                    keypad: false,
                    zoomButtons: true
                }
            )
        );

        updateSliceProjection2D();

        sliceProjection2D.setMathBounds({
            left: -0.72,
            right: 0.32,
            bottom: -0.62,
            top: 0.58
        });

        setupWarmup3DControlReveal(
            "clebsch-slice-projection"
        );
    }

    function setSliceProjectionVisible(visible) {
        const card =
            document.getElementById(
                "clebsch-slice-card"
            );

        if (!card) return;

        card.hidden = !visible;

        if (visible) {
            updateSliceProjection2D();

            requestAnimationFrame(() => {
                sliceProjection2D?.resize?.();
            });
        }
    }

    function setupTangentProjectionCard() {
        const root = document.getElementById("clebsch-tangent-projection");
        if (!root) return;

        tangentProjection2D = registerCalculator(
            Desmos.GraphingCalculator(root, {
                expressions: false,
                settingsMenu: false,
                keypad: false,
                zoomButtons: true
            })
        );

        tangentProjection2D.setExpressions(targetProjectionExpressions());
        tangentProjection2D.setMathBounds(
            TARGET_PROJECTION_BOUNDS
        );

        targetProjectionLastViewportSignature =
            null;

        if (
            typeof tangentProjection2D.observeEvent
                === "function"
        ) {
            tangentProjection2D.observeEvent(
                "change",
                scheduleTargetProjectionViewportSync
            );
        }

        setupWarmup3DControlReveal("clebsch-tangent-projection");
        makeTangentProjectionDraggable();
    }

    function setTangentProjectionVisible(visible) {
        const card = document.getElementById("clebsch-tangent-projection-card");
        if (!card) return;
        card.hidden = !visible;
        if (visible) {
            requestAnimationFrame(() => {
                tangentProjection2D?.resize?.();
                scheduleTargetProjectionViewportSync();
            });
        }
    }

    function setClebschFeature(featureKey, visible) {
        const feature =
            pages.clebsch.features[
                featureKey
            ];

        if (!feature) return;

        const shouldShow =
            Boolean(visible);
        const expressionIds =
            feature.expressions.map(
                expression =>
                    expression.id
            );
        const isShown =
            expressionIds.some(id =>
                activeExpressionIds.includes(id)
            );

        /* Scene state is authoritative. Do not synthesize a DOM click to
           change geometry: that created stale checkbox/Desmos combinations
           when step changes and animation callbacks happened together. */
        if (shouldShow && !isShown) {
            showFeature(feature);
        } else if (
            !shouldShow
            && isShown
        ) {
            hideFeature(feature);
        }

        const checkbox =
            geometryControls.querySelector(
                `input[data-feature-key="${featureKey}"]`
            );

        if (checkbox) {
            checkbox.checked =
                shouldShow;

            if (featureKey === "selectedBitangentPair") {
                const selector =
                    geometryControls.querySelector(
                        ".clebsch-schlafli-selector"
                    );
                selector?.syncSchlafliState?.();
            }
        }

        if (
            featureKey
                === "projectionLine"
        ) {
            setProjectionLineControlsEnabled(
                shouldShow
            );
        }
    }

    function syncClebschControlVisibility(
        mode = currentClebschInfoMode,
        remarkMode = currentClebschRemarkMode
    ) {
        const visibleGroups = new Set(["main", "setup"]);

        if (mode === "equation") {
            visibleGroups.add("equation");
        }

        if (mode === "remark") {
            visibleGroups.add(
                remarkMode === "tangent"
                    ? "remark-extra"
                    : "remark-27"
            );
        }

        geometryControls
            .querySelectorAll("[data-feature-group]")
            .forEach(element => {
                const group =
                    element.dataset.featureGroup || "main";
                element.hidden = !visibleGroups.has(group);
            });

        if (mode === "equation") {
            const visibleFeatureKeys =
                currentClebschEquationStep <= 2
                    ? new Set(["projectionLine"])
                    : new Set([
                        "projectionLine",
                        "ramificationCurve"
                    ]);

            geometryControls
                .querySelectorAll('[data-feature-group="equation"]')
                .forEach(element => {
                    const key =
                        element.dataset.featureKey;
                    element.hidden =
                        !visibleFeatureKeys.has(key);
                });

            if (
                projectionLineControlRefs?.ramificationExample
            ) {
                projectionLineControlRefs.ramificationExample.hidden =
                    currentClebschEquationStep < 3;
            }
        }
    }

    function syncClebschScene(
        mode = currentClebschInfoMode,
        remarkMode = currentClebschRemarkMode
    ) {
        if (
            projectionBlowupActive
            && (
                mode !== "equation"
                || currentClebschEquationStep !== 4
            )
        ) {
            setProjectionBlowupActive(false);
        }

        setClebschFeature("surface", true);
        setClebschFeature("projectionNode", true);

        const equation = mode === "equation";
        if (mode !== "remark") {
            targetContactFitSelectionKey = null;
            if (targetContactFitFrame !== null) {
                cancelAnimationFrame(targetContactFitFrame);
                targetContactFitFrame = null;
            }
        }

        setClebschFeature(
            "projectionSlicePlane",
            false
        );
        setClebschFeature(
            "projectionLine",
            equation
            && currentClebschEquationStep <= 4
        );
        setClebschFeature(
            "polarQuadric",
            false
        );
        setClebschFeature(
            "ramificationCurve",
            equation
            && currentClebschEquationStep >= 3
        );

        setSliceProjectionVisible(false);

        const lineConic =
            mode === "remark"
            && remarkMode === "line-conic";
        if (!lineConic) complexContactPreviewOpen = false;
        if (!lineConic) complexSheetsMode=false;
        if (!lineConic) {
            geometryControls.querySelector(
                ".clebsch-schlafli-selector"
            )?.stopSchlafliPlayback?.();
        }
        setClebschFeature("selectedBitangentPair", lineConic);
        setClebschFeature("selectedBitangentPlane", lineConic);

        const tangent =
            mode === "remark"
            && remarkMode === "tangent";
        setClebschFeature("projectionPlane", tangent);
        setClebschFeature("projectionCubic", tangent);

        const showTargetProjection =
            mode === "remark"
            || (
                equation
                && currentClebschEquationStep === 4
            );
        setTangentProjectionVisible(showTargetProjection);

        if (showTargetProjection) {
            updateTargetProjectionCard(remarkMode);
        }

        if (!lineConic) {
            setClebschFeature("lines27", false);
        }
    }

    function clebschWorkspaceTrack() {
        return document.querySelector(".workspace-track");
    }

    function applyClebschProofPanelWidth() {
        const track = clebschWorkspaceTrack();
        if (!track) return;

        if (clebschProofPanelCollapsed) {
            track.style.gridTemplateColumns =
                "minmax(var(--scene-min), 1fr) var(--collapsed-proof-width)";
            track.style.width =
                "max(100%, calc(var(--scene-min) + var(--collapsed-proof-width)))";
            track.style.minWidth =
                "calc(var(--scene-min) + var(--collapsed-proof-width))";
            return;
        }

        /* Fixed Page 2 proof width: collapsing is allowed, resizing is not. */
        track.style.gridTemplateColumns = "";
        track.style.width = "";
        track.style.minWidth = "";
    }

    function setClebschProofPanelCollapsed(collapsed) {
        clebschProofPanelCollapsed = Boolean(collapsed);

        appShell?.classList.toggle(
            "clebsch-proof-collapsed",
            clebschProofPanelCollapsed
        );

        rightPanel?.classList.toggle(
            "clebsch-proof-collapsed",
            clebschProofPanelCollapsed
        );

        const toggle = document.getElementById(
            "clebsch-proof-panel-toggle"
        );

        if (toggle) {
            toggle.textContent =
                clebschProofPanelCollapsed ? "«" : "»";
            toggle.title =
                clebschProofPanelCollapsed
                    ? "Show proof panel"
                    : "Hide proof panel";
        }

        applyClebschProofPanelWidth();

        requestAnimationFrame(() => {
            mainCalculator?.resize?.();
            if (clebschProofPanelCollapsed) {
                workspaceScroll?.scrollTo?.({
                    left: 0,
                    behavior: "auto"
                });
            }
        });
    }

    function setupClebschProofPanelToggle() {
        const toggle = document.getElementById(
            "clebsch-proof-panel-toggle"
        );

        toggle?.addEventListener("click", () => {
            setClebschProofPanelCollapsed(
                !clebschProofPanelCollapsed
            );
        });

        setClebschProofPanelCollapsed(false);
    }

    function setupClebschInfoTabs() {
        const tabs = Array.from(
            infoPanel.querySelectorAll("[data-clebsch-tab]")
        );
        const panels = Array.from(
            infoPanel.querySelectorAll("[data-clebsch-panel]")
        );
        const remarkButtons = Array.from(
            infoPanel.querySelectorAll("[data-clebsch-remark-mode]")
        );
        const equationStepButtons = Array.from(
            infoPanel.querySelectorAll("[data-clebsch-equation-step]")
        );
        const equationStepPanels = Array.from(
            infoPanel.querySelectorAll("[data-clebsch-equation-step-panel]")
        );
        const equationPrev =
            infoPanel.querySelector("[data-clebsch-equation-prev]");
        const equationNext =
            infoPanel.querySelector("[data-clebsch-equation-next]");
        const equationProgress =
            infoPanel.querySelector("[data-clebsch-equation-progress]");

        if (!tabs.length || !panels.length) return;

        const syncRemarkButtons = () => {
            remarkButtons.forEach(button => {
                const active =
                    button.dataset.clebschRemarkMode
                    === currentClebschRemarkMode;
                button.classList.toggle("active", active);
                button.setAttribute("aria-pressed", String(active));
            });
        };

        const syncEquationStep = () => {
            equationStepButtons.forEach(button => {
                const step =
                    Number(button.dataset.clebschEquationStep);
                const active =
                    step === currentClebschEquationStep;
                button.classList.toggle("active", active);
                button.setAttribute(
                    "aria-current",
                    active ? "step" : "false"
                );
            });

            equationStepPanels.forEach(panel => {
                panel.classList.toggle(
                    "active",
                    Number(
                        panel.dataset.clebschEquationStepPanel
                    ) === currentClebschEquationStep
                );
            });

            if (equationPrev) {
                equationPrev.disabled =
                    currentClebschEquationStep === 1;
            }

            if (equationNext) {
                equationNext.disabled =
                    currentClebschEquationStep === 4;
            }

            if (equationProgress) {
                equationProgress.textContent =
                    `Step ${currentClebschEquationStep} of 4`;
            }

            if (currentClebschInfoMode === "equation") {
                syncClebschControlVisibility();
                syncClebschScene();
                commitProjectionLine();
            }
        };

        const setEquationStep = step => {
            currentClebschEquationStep = Math.max(
                1,
                Math.min(4, Number(step) || 1)
            );
            syncEquationStep();
        };

        const activate = key => {
            currentClebschInfoMode = key;
            infoPanel.classList.toggle(
                "clebsch-bitangents-chapter",
                key === "remark"
            );
            const chapterTitle = infoPanel.querySelector(".clebsch-info h2");
            if(chapterTitle){
                chapterTitle.textContent = key === "remark"
                    ? "27 lines & 28 bitangents"
                    : "Projection from a point";
            }

            tabs.forEach(tab => {
                const active =
                    tab.dataset.clebschTab === key;
                tab.classList.toggle("active", active);
                tab.setAttribute("aria-selected", String(active));
            });

            panels.forEach(panel => {
                panel.classList.toggle(
                    "active",
                    panel.dataset.clebschPanel === key
                );
            });

            syncRemarkButtons();
            if (key === "equation") {
                syncEquationStep();
            } else {
                syncClebschControlVisibility();
                syncClebschScene();
            }
        };

        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                activate(tab.dataset.clebschTab);
            });
        });

        equationStepButtons.forEach(button => {
            button.addEventListener("click", () => {
                setEquationStep(
                    button.dataset.clebschEquationStep
                );
            });
        });

        equationPrev?.addEventListener("click", () => {
            setEquationStep(
                currentClebschEquationStep - 1
            );
        });

        equationNext?.addEventListener("click", () => {
            setEquationStep(
                currentClebschEquationStep + 1
            );
        });

        remarkButtons.forEach(button => {
            button.addEventListener("click", () => {
                currentClebschRemarkMode =
                    button.dataset.clebschRemarkMode;
                syncRemarkButtons();
                syncClebschControlVisibility(
                    "remark",
                    currentClebschRemarkMode
                );
                syncClebschScene(
                    "remark",
                    currentClebschRemarkMode
                );
            });
        });

        activateClebschInfoTab = activate;
        currentClebschInfoMode = "intro";
        currentClebschRemarkMode = "line-conic";
        currentClebschEquationStep = 1;
        syncEquationStep();
        activate("intro");
    }

    // The standalone sidebar chapter reuses the original 28-bitangent
    // proof, Schläfli selector, 2D target and animation synchronization.
    function showBitangentsChapter(){
        if(typeof activateClebschInfoTab!=="function")
            throw new Error("Clebsch bitangent chapter not initialized");
        activateClebschInfoTab("remark");
    }

    function setClebschEquationsVisible(visible) {
        clebschEquationsVisible = Boolean(visible);

        /* Our chevron is the only drawer control.
           Remove Desmos's drawer entirely when closed, instead of merely
           collapsing it and leaving Desmos's own chevron visible. */
        mainCalculator?.updateSettings?.({
            expressions: clebschEquationsVisible,
            expressionsCollapsed: false
        });

        const toggle = document.getElementById(
            "clebsch-equations-toggle"
        );

        if (toggle) {
            toggle.hidden = clebschEquationsVisible;
            toggle.textContent = "»";
            toggle.title = "Show Desmos equations";
            toggle.setAttribute("aria-label", toggle.title);
            toggle.setAttribute(
                "aria-expanded",
                String(clebschEquationsVisible)
            );
        }

        requestAnimationFrame(() => {
            mainCalculator?.resize?.();
        });
    }

    function setupClebschEquationToggle() {
        const toggle = document.getElementById(
            "clebsch-equations-toggle"
        );
        const calculatorRoot =
            document.getElementById("calculator");

        toggle?.addEventListener("click", () => {
            setClebschEquationsVisible(true);
        });

        /* Once open, Desmos's own close/fold control takes over.
           When it is clicked, remove the expression drawer completely
           and restore our external chevron. */
        calculatorRoot?.addEventListener(
            "click",
            event => {
                const closeControl = event.target.closest(
                    ".dcg-action-hideexpressions, "
                    + ".dcg-resize-list-btn"
                );

                if (!closeControl) return;

                setTimeout(() => {
                    setClebschEquationsVisible(false);
                }, 0);
            },
            true
        );

        clebschEquationsVisible = false;
        if (toggle) {
            toggle.hidden = false;
            toggle.textContent = "»";
            toggle.title = "Show Desmos equations";
            toggle.setAttribute(
                "aria-label",
                toggle.title
            );
            toggle.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    function buildView() {
        visualStage.innerHTML = `
            <div id="calculator" class="standard-calculator"></div>

            <button
                id="clebsch-equations-toggle"
                class="clebsch-equations-toggle"
                type="button"
                title="Show Desmos equations"
                aria-label="Show Desmos equations">
                »
            </button>

            <div id="clebsch-slice-card" class="clebsch-slice-card" hidden>
                <div class="clebsch-slice-card-header">
                    <div>
                        <div class="clebsch-slice-card-title">Plane slice Π</div>
                        <div class="clebsch-slice-card-subtitle">
                            C = S₃ ∩ Π
                        </div>
                    </div>
                    <div class="clebsch-slice-card-meaning">
                        ℓ ∩ C = P + Q₁ + Q₂
                    </div>
                </div>
                <div id="clebsch-slice-projection" class="clebsch-slice-calculator"></div>
            </div>

            <button
                id="clebsch-blowup-prompt"
                class="clebsch-blowup-prompt"
                type="button"
                hidden>
                So you want to zoom in?
            </button>

            <div
                id="clebsch-blowup-view"
                class="clebsch-blowup-view"
                hidden>
                <div class="clebsch-blowup-header">
                    <div>
                        <div class="clebsch-blowup-title">
                            Resolved local view near P
                        </div>
                        <div class="clebsch-blowup-subtitle">
                            P is replaced by
                            <span class="clebsch-blowup-header-math">
                                E = ℙ(T<sub>P</sub>S<sub>3</sub>)
                            </span>
                        </div>
                    </div>
                    <button
                        id="clebsch-blowup-back"
                        class="clebsch-blowup-back"
                        type="button">
                        Back to global view
                    </button>
                </div>

                <div class="clebsch-blowup-diagram">
                    <svg
                        class="clebsch-blowup-svg clebsch-blowup-svg-full"
                        viewBox="0 0 1080 620"
                        aria-label="Blow-up triangle from S3 through Bl_P S3 to P2">
                        <defs>
                            <marker
                                id="clebsch-blowup-arrowhead"
                                viewBox="0 0 10 10"
                                refX="8.5"
                                refY="5"
                                markerWidth="6"
                                markerHeight="6"
                                orient="auto-start-reverse">
                                <path
                                    d="M 0 0 L 10 5 L 0 10 z"
                                    class="clebsch-blowup-arrowhead-fill" />
                            </marker>
                            <marker
                                id="clebsch-blowup-axis-arrowhead"
                                viewBox="0 0 10 10"
                                refX="8.5"
                                refY="5"
                                markerWidth="4"
                                markerHeight="4"
                                orient="auto">
                                <path
                                    d="M 0 0 L 10 5 L 0 10 z"
                                    class="clebsch-blowup-axis-arrowhead-fill" />
                            </marker>
                        </defs>

                        <g class="clebsch-blowup-after">
                            <text
                                class="clebsch-blowup-stage-title"
                                x="540"
                                y="32"
                                text-anchor="middle">
                                X = Bl<tspan class="clebsch-svg-sub">P</tspan> S<tspan class="clebsch-svg-sub">3</tspan>
                            </text>
                            <text
                                class="clebsch-blowup-stage-subtitle"
                                x="540"
                                y="53"
                                text-anchor="middle">
                                U<tspan class="clebsch-svg-sub">a</tspan> = {a ≠ 0}: t = su, E = {s = 0}
                            </text>

                            <text
                                id="clebsch-blowup-complementary-toggle"
                                class="clebsch-blowup-complementary-toggle"
                                x="282"
                                y="68"
                                text-anchor="start"
                                role="button"
                                tabindex="0"
                                aria-label="show U_b"
                                aria-expanded="false">
                                <tspan id="clebsch-blowup-complementary-toggle-verb">show</tspan>
                                <tspan> U</tspan><tspan class="clebsch-svg-sub">b</tspan>
                            </text>

                            <g
                                id="clebsch-blowup-complementary-stage"
                                class="clebsch-blowup-complementary-chart">

                                <rect
                                    class="clebsch-blowup-complement-frame"
                                    x="280" y="76"
                                    width="174" height="190"
                                    rx="4" />
                                <text
                                    class="clebsch-blowup-complement-title"
                                    x="367"
                                    y="94"
                                    text-anchor="middle">
                                    U<tspan class="clebsch-svg-sub">b</tspan> = {b ≠ 0}
                                </text>
                                <text
                                    class="clebsch-blowup-complement-subtitle"
                                    x="367"
                                    y="110"
                                    text-anchor="middle">
                                    s = tv, v = a/b
                                </text>
                                <line
                                    class="clebsch-blowup-coordinate-axis"
                                    x1="294" y1="148.97"
                                    x2="440" y2="148.97"
                                    marker-end="url(#clebsch-blowup-axis-arrowhead)" />
                                <line
                                    class="clebsch-blowup-exceptional-line"
                                    x1="348.75" y1="252"
                                    x2="348.75" y2="116" />
                                <line
                                    class="clebsch-blowup-coordinate-axis"
                                    x1="348.75" y1="252"
                                    x2="348.75" y2="116"
                                    marker-end="url(#clebsch-blowup-axis-arrowhead)" />
                                <text
                                    class="clebsch-blowup-coordinate-label"
                                    x="442"
                                    y="145">
                                    t
                                </text>
                                <text
                                    class="clebsch-blowup-coordinate-label"
                                    x="355"
                                    y="118">
                                    v
                                </text>
                                <text
                                    class="clebsch-blowup-exceptional-axis-label"
                                    x="383"
                                    y="263"
                                    text-anchor="middle">
                                    E : t = 0
                                </text>
                                <path
                                    id="clebsch-blowup-complementary-strict-transform"
                                    class="clebsch-blowup-strict-transform-complement" />
                                <circle
                                    id="clebsch-blowup-moving-complementary"
                                    class="clebsch-blowup-moving-correspondence-point"
                                    r="4.2" />
                                <circle
                                    id="clebsch-blowup-moving-exceptional-complementary"
                                    class="clebsch-blowup-moving-exceptional-point"
                                    r="4.1">
                                    <title>e = [V] on E</title>
                                </circle>
                                <circle
                                    id="clebsch-blowup-complementary-point-1"
                                    class="clebsch-blowup-exceptional-point"
                                    r="4.1" />
                                <circle
                                    id="clebsch-blowup-complementary-point-2"
                                    class="clebsch-blowup-exceptional-point"
                                    r="4.1" />
                                <text
                                    id="clebsch-blowup-complementary-label-1"
                                    class="clebsch-blowup-special-label">
                                    <tspan>e</tspan><tspan class="clebsch-svg-sub">1</tspan>
                                </text>
                                <text
                                    id="clebsch-blowup-complementary-label-2"
                                    class="clebsch-blowup-special-label">
                                    <tspan>e</tspan><tspan class="clebsch-svg-sub">2</tspan>
                                </text>
                                <text
                                    class="clebsch-blowup-complement-note"
                                    x="399"
                                    y="163"
                                    text-anchor="middle">
                                    v = 0 ↔ u = ∞
                                </text>
                            </g>

                            <g
                                id="clebsch-blowup-static-correspondences">
                            </g>
                            <path
                                id="clebsch-blowup-moving-correspondence"
                                class="clebsch-blowup-moving-correspondence" />

                            <line
                                class="clebsch-blowup-coordinate-axis"
                                x1="456" y1="166"
                                x2="688" y2="166"
                                marker-end="url(#clebsch-blowup-axis-arrowhead)" />
                            <text
                                class="clebsch-blowup-coordinate-label"
                                x="691"
                                y="161">
                                s
                            </text>
                            <line
                                class="clebsch-blowup-exceptional-line"
                                x1="540" y1="258"
                                x2="540" y2="74" />
                            <line
                                class="clebsch-blowup-coordinate-axis"
                                x1="540" y1="258"
                                x2="540" y2="74"
                                marker-end="url(#clebsch-blowup-axis-arrowhead)" />
                            <text
                                class="clebsch-blowup-coordinate-label"
                                x="548"
                                y="82">
                                u
                            </text>

                            <path
                                id="clebsch-blowup-actual-strict-transform"
                                class="clebsch-blowup-strict-transform-full" />
                            <circle
                                id="clebsch-blowup-moving-main"
                                class="clebsch-blowup-moving-correspondence-point"
                                r="4.2" />
                            <circle
                                id="clebsch-blowup-moving-exceptional-main"
                                class="clebsch-blowup-moving-exceptional-point"
                                r="4.1">
                                <title>e = [V] on E</title>
                            </circle>

                            <circle
                                id="clebsch-blowup-exceptional-point-1"
                                class="clebsch-blowup-exceptional-point"
                                cx="540"
                                cy="127"
                                r="4.5" />
                            <circle
                                id="clebsch-blowup-exceptional-point-2"
                                class="clebsch-blowup-exceptional-point"
                                cx="540"
                                cy="205"
                                r="4.5" />

                            <text
                                id="clebsch-blowup-e-label-1"
                                class="clebsch-blowup-special-label"
                                x="566"
                                y="118">
                                <tspan>e</tspan><tspan class="clebsch-svg-sub">1</tspan> = [V<tspan class="clebsch-svg-sub">1</tspan>]
                            </text>
                            <text
                                id="clebsch-blowup-e-label-2"
                                class="clebsch-blowup-special-label"
                                x="566"
                                y="224">
                                <tspan>e</tspan><tspan class="clebsch-svg-sub">2</tspan> = [V<tspan class="clebsch-svg-sub">2</tspan>]
                            </text>

                            <text
                                class="clebsch-blowup-exceptional-axis-label"
                                x="540"
                                y="282"
                                text-anchor="middle">
                                E = {s = 0}
                            </text>
                            <text
                                class="clebsch-blowup-curve-label"
                                x="655"
                                y="252">
                                T̃
                            </text>

                        </g>

                        <path
                            class="clebsch-blowup-arrow"
                            d="M485 250 L344 326"
                            marker-end="url(#clebsch-blowup-arrowhead)" />
                        <text
                            class="clebsch-blowup-arrow-label"
                            x="407"
                            y="278"
                            text-anchor="middle">
                            b
                        </text>

                        <path
                            class="clebsch-blowup-arrow"
                            d="M595 250 L735 326"
                            marker-end="url(#clebsch-blowup-arrowhead)" />
                        <text
                            class="clebsch-blowup-arrow-label"
                            x="673"
                            y="278"
                            text-anchor="middle">
                            φ<tspan class="clebsch-svg-sub">|-K<tspan class="clebsch-svg-sub-inner">X</tspan>|</tspan>
                        </text>

                        <g class="clebsch-blowup-before">
                            <text
                                class="clebsch-blowup-stage-title"
                                x="250"
                                y="315"
                                text-anchor="middle">
                                S<tspan class="clebsch-svg-sub">3</tspan>
                            </text>
                            <text
                                class="clebsch-blowup-stage-subtitle"
                                x="250"
                                y="336"
                                text-anchor="middle">
                                T = S<tspan class="clebsch-svg-sub">3</tspan> ∩ T<tspan class="clebsch-svg-sub">P</tspan>S<tspan class="clebsch-svg-sub">3</tspan> has a node at P
                            </text>

                            <path
                                id="clebsch-blowup-actual-curve"
                                class="clebsch-blowup-full-curve" />
                            <line
                                id="clebsch-blowup-moving-source-line"
                                class="clebsch-blowup-moving-source-line" />
                            <text
                                id="clebsch-blowup-moving-source-line-label"
                                class="clebsch-blowup-moving-source-line-label">
                                ℓ<tspan class="clebsch-svg-sub">V</tspan>
                            </text>
                            <circle
                                id="clebsch-blowup-moving-source"
                                class="clebsch-blowup-moving-correspondence-point"
                                r="4.2" />
                            <text
                                id="clebsch-blowup-moving-source-label"
                                class="clebsch-blowup-moving-source-point-label">
                                Q
                            </text>

                            <line
                                id="clebsch-blowup-tangent-1"
                                class="clebsch-blowup-tangent-guide"
                                x1="250" y1="334"
                                x2="250" y2="526" />
                            <line
                                id="clebsch-blowup-tangent-2"
                                class="clebsch-blowup-tangent-guide"
                                x1="250" y1="334"
                                x2="250" y2="526" />

                            <text
                                id="clebsch-blowup-tangent-label-1"
                                class="clebsch-blowup-tangent-label"
                                x="250" y="324">
                                V<tspan class="clebsch-svg-sub">1</tspan>
                            </text>
                            <text
                                id="clebsch-blowup-tangent-label-2"
                                class="clebsch-blowup-tangent-label"
                                x="250" y="536">
                                V<tspan class="clebsch-svg-sub">2</tspan>
                            </text>

                            <circle
                                class="clebsch-blowup-node"
                                cx="250"
                                cy="430"
                                r="5" />
                            <text
                                class="clebsch-blowup-point-label"
                                x="262"
                                y="436">
                                P
                            </text>
                            <text
                                class="clebsch-blowup-curve-label"
                                x="365"
                                y="558">
                                T
                            </text>
                        </g>

                        <g class="clebsch-blowup-target-stage">
                            <text
                                class="clebsch-blowup-stage-title"
                                x="860"
                                y="315"
                                text-anchor="middle">
                                P<tspan class="clebsch-svg-sup">2</tspan>
                            </text>
                            <text
                                class="clebsch-blowup-stage-subtitle"
                                x="860"
                                y="336"
                                text-anchor="middle">
                                target chart z = 0
                            </text>

                            <rect
                                class="clebsch-blowup-target-frame"
                                x="710"
                                y="350"
                                width="300"
                                height="220"
                                rx="4" />
                            <path
                                id="clebsch-blowup-target-branch"
                                class="clebsch-blowup-target-branch" />
                            <path
                                id="clebsch-blowup-target-bitangent"
                                class="clebsch-blowup-target-bitangent" />

                            <circle
                                id="clebsch-blowup-target-point-1"
                                class="clebsch-blowup-target-point"
                                r="4" />
                            <circle
                                id="clebsch-blowup-target-point-2"
                                class="clebsch-blowup-target-point"
                                r="4" />
                            <circle
                                id="clebsch-blowup-target-moving"
                                class="clebsch-blowup-target-moving"
                                r="4.2" />
                            <text
                                id="clebsch-blowup-target-moving-label"
                                class="clebsch-blowup-target-moving-label">
                                φ(e)
                            </text>
                            <text
                                id="clebsch-blowup-target-label-1"
                                class="clebsch-blowup-target-point-label">
                                φ(e<tspan class="clebsch-svg-sub">1</tspan>)
                            </text>
                            <text
                                id="clebsch-blowup-target-label-2"
                                class="clebsch-blowup-target-point-label">
                                φ(e<tspan class="clebsch-svg-sub">2</tspan>)
                            </text>

                            <text
                                class="clebsch-blowup-target-line-label"
                                x="960"
                                y="374">
                                ℓ<tspan class="clebsch-svg-sub">E</tspan>
                            </text>
                            <text
                                class="clebsch-blowup-target-branch-label"
                                x="983"
                                y="552">
                                B
                            </text>
                        </g>

                    </svg>

                    <div
                        id="clebsch-blowup-inline-sync"
                        class="clebsch-blowup-inline-sync"
                        aria-label="Synchronized exceptional-direction controls">
                        <div class="clebsch-blowup-inline-direction-card">
                            <svg
                                class="clebsch-blowup-inline-exceptional-svg"
                                viewBox="0 0 150 145"
                                aria-label="Exceptional curve as tangent directions">
                                <circle
                                    class="clebsch-blowup-exceptional"
                                    cx="75"
                                    cy="67"
                                    r="43" />
                                <g data-blowup-inline-special-points></g>
                                <line
                                    id="clebsch-blowup-inline-ray"
                                    class="clebsch-blowup-ray"
                                    x1="75"
                                    y1="67"
                                    x2="118"
                                    y2="67" />
                                <circle
                                    id="clebsch-blowup-inline-selected"
                                    class="clebsch-blowup-selected"
                                    cx="118"
                                    cy="67"
                                    r="5" />
                                <text
                                    id="clebsch-blowup-inline-selected-label"
                                    class="clebsch-blowup-selected-label"
                                    x="130"
                                    y="67">
                                    e
                                </text>
                            </svg>
                        </div>

                        <div class="clebsch-blowup-inline-projection-strip">
                            <span>projection from P</span>
                            <span class="clebsch-blowup-inline-projection-line"></span>
                        </div>

                        <div class="clebsch-blowup-inline-slider-card">
                            <div class="clebsch-blowup-inline-quotient">
                                [V] = [λV], λ ≠ 0
                            </div>
                            <div class="clebsch-blowup-inline-control">
                                <button
                                    id="clebsch-blowup-inline-play"
                                    class="clebsch-blowup-inline-play"
                                    type="button"
                                    aria-label="Animate e=[V]"
                                    aria-pressed="false"
                                    title="Animate e=[V]">
                                    ▶
                                </button>
                                <span class="clebsch-blowup-inline-control-label">e=[V]</span>
                                <input
                                    id="clebsch-blowup-inline-direction"
                                    type="range"
                                    min="0"
                                    max="179.9"
                                    step="0.1"
                                    value="64"
                                    aria-label="Direction on the exceptional curve">
                                <output
                                    id="clebsch-blowup-inline-value"
                                    class="clebsch-blowup-inline-value"
                                    for="clebsch-blowup-inline-direction">
                                    64.0°
                                </output>
                            </div>
                            <div
                                id="clebsch-blowup-ramification-cue"
                                class="clebsch-blowup-ramification-cue"
                                aria-live="polite">
                            </div>
                        </div>
                    </div>

                    <div class="clebsch-blowup-note">
                        This is one resolved picture of S<sub>3</sub> ← X → P<sup>2</sup>. The source nodal cubic T, the main blow-up chart U<sub>a</sub>, the target, and the synchronized direction control all belong to this same diagram. A direction [V] selects e=[V]∈E and synchronizes the corresponding points, including its common target point in P<sup>2</sup>. Only the complementary chart U<sub>b</sub> is hidden initially; use “show U<sub>b</sub>” (or click T̃) when the second affine chart is needed.
                    </div>
                </div>
            </div>

            <div id="clebsch-complex-contact-card"
                 class="clebsch-complex-contact-card" role="group"
                 aria-label="Non-real conjugate contacts in the complex parameter plane"
                 hidden>
                <div class="clebsch-complex-header">
                    <span data-complex-view-title>Complex t-plane</span>
                    <button id="clebsch-complex-sheets-toggle"
                            type="button" aria-pressed="false"
                            title="View two curves upstairs">Sheets</button>
                    <button id="clebsch-complex-close" type="button"
                            aria-label="Close complex diagram">×</button>
                </div>
                <svg class="clebsch-complex-svg" viewBox="0 0 144 113"
                     role="img" aria-label="Conjugate roots reflected about the real axis">
                    <line class="clebsch-complex-axis" x1="14" y1="57" x2="129" y2="57"/>
                    <line class="clebsch-complex-axis" x1="72" y1="13" x2="72" y2="101"/>
                    <text x="112" y="52">Re(t)</text>
                    <text x="79" y="14">Im(t)</text>
                    <circle data-complex-positive cx="72" cy="22" r="4"
                            class="clebsch-complex-dot"/>
                    <circle data-complex-negative cx="72" cy="92" r="4"
                            class="clebsch-complex-dot"/>
                </svg>
                <div data-complex-sheets-view
                     class="clebsch-complex-sheets-view" hidden>
                    <div class="clebsch-complex-sheets-legend">
                        <span data-complex-sheets-first>D₁ (line)</span>
                        <span class="clebsch-complex-sheets-second">D₂ (conic)</span>
                    </div>
                    <svg viewBox="0 0 320 248"
                         class="clebsch-complex-sheets-svg"
                         data-complex-sheets-svg role="img"
                         aria-label="Two sheet surfaces touch at exactly two conjugate points"></svg>
                    <div class="clebsch-complex-sheets-note"
                         data-complex-sheets-caption>
                        The selected bitangent's contacts appear here.
                    </div>
                </div>
                <div data-complex-roots class="clebsch-complex-roots"></div>
                <div data-complex-parameter class="clebsch-complex-footnote"></div>
            </div>
            <div id="clebsch-tangent-projection-card" class="clebsch-target-card" hidden>
                <div class="clebsch-target-card-header">
                    <div class="clebsch-target-card-copy">
                        <div class="clebsch-target-card-title">Target P² = {z = 0}</div>
                        <div class="clebsch-target-card-subtitle">
                            the line and conic have the same image
                        </div>
                        <div class="clebsch-target-card-meaning">
                            φ(L) = φ(C_L) = ℓ
                        </div>
                    </div>
                    <button id="clebsch-complex-contacts-toggle"
                            class="clebsch-complex-toggle" type="button"
                            aria-label="View complex contacts" aria-pressed="false"
                            hidden>ℂ</button>
                </div>

                <div
                    id="clebsch-exceptional-inset"
                    class="clebsch-exceptional-inset"
                    hidden>
                    <div class="clebsch-exceptional-title">
                        E = ℙ(TₚS₃)
                    </div>
                    <div class="clebsch-exceptional-subtitle">
                        direction model
                    </div>

                    <svg
                        class="clebsch-exceptional-svg"
                        viewBox="0 0 150 145"
                        aria-label="Exceptional curve as tangent directions">
                        <circle
                            class="clebsch-blowup-exceptional"
                            cx="75"
                            cy="67"
                            r="43" />
                        <g data-blowup-special-points></g>
                        <line
                            id="clebsch-blowup-ray"
                            class="clebsch-blowup-ray"
                            x1="75"
                            y1="67"
                            x2="118"
                            y2="67" />
                        <circle
                            id="clebsch-blowup-selected"
                            class="clebsch-blowup-selected"
                            cx="118"
                            cy="67"
                            r="5" />
                        <text
                            id="clebsch-blowup-selected-label"
                            class="clebsch-blowup-selected-label"
                            x="130"
                            y="67">
                            e
                        </text>
                    </svg>

                    <div class="clebsch-exceptional-quotient">
                        [V] = [λV], λ ≠ 0
                    </div>
                    <div class="clebsch-exceptional-control">
                        <span>e=[V]</span>
                        <input
                            id="clebsch-blowup-direction"
                            type="range"
                            min="0"
                            max="179.9"
                            step="0.1"
                            value="64"
                            aria-label="Direction on the exceptional curve">
                    </div>
                </div>

                <div
                    id="clebsch-exceptional-map-divider"
                    class="clebsch-exceptional-map-divider"
                    hidden>
                    φ|<sub>E</sub> →
                </div>

                <div
                    id="clebsch-target-special-legend"
                    class="clebsch-target-special-legend"
                    hidden>
                    <div class="clebsch-target-special-legend-row">
                        <span class="clebsch-target-legend-dot clebsch-target-legend-dot-special"></span>
                        <span>φ(e₁), φ(e₂)</span>
                    </div>
                    <div class="clebsch-target-special-legend-row">
                        <span class="clebsch-target-legend-dot clebsch-target-legend-dot-moving"></span>
                        <span>φ(e)</span>
                    </div>
                </div>

                <div id="clebsch-tangent-projection" class="clebsch-target-calculator"></div>
            </div>
        `;
        mainCalculator = registerCalculator(
            Desmos.Calculator3D(document.getElementById("calculator"), {
                expressions: false,
                settingsMenu: true,
                keypad: false,
                zoomButtons: true
            })
        );

        setupWarmup3DControlReveal("calculator");

        if (
            typeof mainCalculator.observeEvent
            === "function"
        ) {
            mainCalculator.observeEvent(
                "change",
                scheduleProjectionLineBoundsCheck
            );
        }

        setupTangentProjectionCard();
        setupComplexContactPreview();
        setupClebschEquationToggle();
        setupProjectionBlowupView();

        const page = pages.clebsch;
        const initialExpressions = Object.entries(page.features)
            .filter(([, feature]) => feature.checked)
            .flatMap(([key, feature]) => key === "lines27"
                ? lineExpressionsForCurrentPalette()
                : feature.expressions);
        mainCalculator.setExpressions(initialExpressions);
        activeExpressionIds = initialExpressions.map(expression => expression.id);
        diagnoseExpressions(initialExpressions);
        buildControls(page);
        geometryControls.classList.add(
            "clebsch-geometry-controls"
        );
        infoPanel.innerHTML = page.info;
        rightPanel?.classList.add("clebsch-proof-mode");
        setupClebschProofPanelToggle();
        setupClebschInfoTabs();
        typeset(infoPanel);

        /* The plane-slice inset is supplemental. Initialize it only after the
           main Page 2 UI is fully alive, so a 2D Desmos failure can never blank
           the surface, controls, or proof panel. */
        requestAnimationFrame(() => {
            try {
                setupSliceProjectionCard();
                if (currentClebschInfoMode === "equation") {
                    setSliceProjectionVisible(true);
                }
            } catch (error) {
                console.error(
                    "Could not initialize the Page 2 plane-slice inset",
                    error
                );
                const card = document.getElementById("clebsch-slice-card");
                if (card) card.hidden = true;
                sliceProjection2D = null;
            }
        });
    }

    function refreshTheme() {
        if (
            tangentProjection2D
            && currentClebschInfoMode === "remark"
        ) {
            updateTargetProjectionCard(
                currentClebschRemarkMode
            );
        }
    }


    function destroy() {
        complexContactPreviewOpen = false;
        if (targetContactFitFrame !== null) {
            cancelAnimationFrame(targetContactFitFrame);
            targetContactFitFrame = null;
        }
        targetContactFitSelectionKey = null;
        all28BitangentsVisible = false;
        all28BitangentsOnTarget = false;        complexSheetsMode=false;
        geometryControls.querySelector(
            ".clebsch-schlafli-selector"
        )?.stopSchlafliPlayback?.();
        stopAllProjectionLineAnimations();

        if (
            projectionLinePendingCommitFrame
            !== null
        ) {
            cancelAnimationFrame(
                projectionLinePendingCommitFrame
            );
            projectionLinePendingCommitFrame =
                null;
        }

        if (
            projectionLineBoundsTimer
            !== null
        ) {
            clearTimeout(
                projectionLineBoundsTimer
            );
            projectionLineBoundsTimer =
                null;
        }

        projectionLineLastLatex = null;
        projectionLineParameterExtent = null;
        projectionLineKeyboardRamificationKey = null;
        projectionLineTransientShineActive = false;

        if (
            projectionLineTransientShineTimer
            !== null
        ) {
            clearTimeout(
                projectionLineTransientShineTimer
            );
            projectionLineTransientShineTimer =
                null;
        }

        if (
            projectionLineAnimationFrame
            !== null
        ) {
            cancelAnimationFrame(
                projectionLineAnimationFrame
            );
            projectionLineAnimationFrame =
                null;
        }

        projectionLineAnimationLastTime = 0;
        projectionLineAnimationLastCommitTime = 0;
        projectionLineGloballyPaused = false;
        projectionLinePausedKeys = [];
        projectionLineGlobalStopButton = null;
        projectionLineNonstopButton = null;
        projectionLineNonstop = false;
        projectionLineNonstopVisitedRamificationPoints = [];
        projectionLineNonstopVisitedTargetPoints = [];
        projectionBlowupActive = false;
        projectionBlowupSavedLineState = null;
        projectionBlowupSlider = null;
        projectionBlowupSelectedPoint = null;
        projectionBlowupSelectedLabel = null;
        projectionBlowupDirectionRay = null;
        projectionBlowupPlayButton = null;
        projectionBlowupValueLabel = null;
        if (
            projectionBlowupAnimationFrame
            !== null
        ) {
            cancelAnimationFrame(
                projectionBlowupAnimationFrame
            );
            projectionBlowupAnimationFrame = null;
        }
        projectionBlowupAnimationLastTime = 0;
        projectionBlowupPlaying = false;
        projectionBlowupNextStopDegrees = null;
        projectionLineAutoStopArmed = true;
        projectionRamificationLocked = false;

        Object.keys(
            projectionLineAnimations
        ).forEach(key => {
            delete projectionLineAnimations[key];
        });

        projectionLineControlRefs = null;
        geometryControls.classList.remove(
            "clebsch-geometry-controls"
        );
        currentClebschInfoMode = "intro";
        activateClebschInfoTab = null;
        infoPanel.classList.remove("clebsch-bitangents-chapter");
        currentClebschRemarkMode = "line-conic";
        currentClebschEquationStep = 1;
        clebschEquationsVisible = false;
        clebschProofPanelCollapsed = false;
        tangentProjectionDragCleanup?.();
        tangentProjectionDragCleanup = null;

        if (
            targetProjectionViewportSyncTimer
            !== null
        ) {
            clearTimeout(
                targetProjectionViewportSyncTimer
            );
            targetProjectionViewportSyncTimer =
                null;
        }

        targetProjectionLastViewportSignature =
            null;
        tangentProjection2D = null;
        sliceProjection2D = null;
        projectionSliceAngle =
            PROJECTION_SLICE_INITIAL_ANGLE;
        projectionLineState.azimuth =
            PROJECTION_LINE_INITIAL.azimuth;
        projectionLineState.elevation =
            PROJECTION_LINE_INITIAL.elevation;

        appShell?.classList.remove(
            "clebsch-proof-collapsed"
        );

        rightPanel?.classList.remove(
            "clebsch-proof-mode",
            "clebsch-proof-collapsed"
        );

        const track = clebschWorkspaceTrack();
        if (track) {
            track.style.gridTemplateColumns = "";
            track.style.width = "";
            track.style.minWidth = "";
        }
    }

    function prepareForMovingPoint() {
        stopAllProjectionLineAnimations();
        geometryControls.querySelector(
            ".clebsch-schlafli-selector"
        )?.stopSchlafliPlayback?.();
        if (projectionBlowupActive) {
            setProjectionBlowupActive(false);
        }
        complexContactPreviewOpen = false;
        complexSheetsMode = false;
        document.getElementById("clebsch-complex-contact-card")
            ?.setAttribute("hidden", "");
        setTangentProjectionVisible(false);
        setSliceProjectionVisible(false);
    }
    function schlafliLineLabel(number) {
        return schlafliLabelsByLine[number - 1]?.key
            || "line " + number;
    }
    return { createData, buildView, destroy, refreshTheme,
        showBitangentsChapter, prepareForMovingPoint, schlafliLineLabel };
})();
