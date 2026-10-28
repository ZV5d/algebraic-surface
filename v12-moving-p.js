/* v12 — moving projection center, isolated extension of the stable v10.
   v10 keeps ownership of all fixed-P proofs, quartic and bitangents.
   While experimenting, ONLY recomputed geometric expressions are shown.
   Single model snapshot -> 3D expressions + sidebar + right geometry caption. */
(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const P0 = Object.freeze({ ...clebschGeometry.projectionPoint });
    const state = {
        active: false,
        preset: "line",
        p: {x:0.35,y:-0.35,z:-1/3},
        a:0.35,
        azimuth:30,
        elevation:-45,
        surface:true,
        ramification:true,
        allLines:false,
        targetPlane:true,
        chosenIntersection:{pair:0,triple:0}
    };
    /* Fixed palette. P never inherits a selected-line family color. */
    const V12_COLORS=Object.freeze({
        P:"#A944A7",throughP:"#009FE3",
        test:"#A71912",contacts:COLORS.intersection,
        target:COLORS.blueCurve
    });
    let panel = null;
    let choosePreset = null;
    let v12NeedsCleanScene = false;
    let branchCalculator = null;
    function disposeBranchCard(){
        if(branchCalculator){
            branchCalculator.destroy?.();
            branchCalculator=null;
        }
        $("v12-branch-card")?.remove();
    }
    function createBranchCard(){
        disposeBranchCard();
        const card=document.createElement("div");
        card.id="v12-branch-card";
        card.className="clebsch-target-card v12-branch-card";
        card.innerHTML=
            '<div class="clebsch-target-card-header">'+
              '<div class="clebsch-target-card-copy">'+
               '<div class="clebsch-target-card-title" id="v12-branch-title">'+
                'Branch locus in P²</div>'+
               '<div class="clebsch-target-card-subtitle">'+
                'Projective directions through P · affine chart</div>'+
               '<div class="clebsch-target-card-meaning v12-branch-legend" '+
                    'aria-label="Branch locus legend">'+
                 '<span class="v12-branch-legend-item">'+
                  '<i class="v12-branch-key-curve"></i>'+
                  '<span id="v12-branch-key-curve">Branch quartic</span></span>'+
                 '<span class="v12-branch-legend-item" id="v12-branch-key-node">'+
                  '<i class="v12-branch-key-node"></i>'+
                  '<span id="v12-branch-node-description"></span></span>'+
                 '<span class="v12-branch-legend-item">'+
                  '<i class="v12-branch-key-direction"></i>'+
                  'Test direction</span>'+
               '</div>'+
              '</div></div>'+
            '<div id="v12-branch-plot" class="clebsch-target-calculator"></div>';
        visualStage.appendChild(card);
        branchCalculator=Desmos.GraphingCalculator(
            $("v12-branch-plot"),{
                expressions:false,settingsMenu:false,
                keypad:false,zoomButtons:true
            }
        );
    }
    function updateBranchCard(s){
        if(!branchCalculator)return;
        /* The residual quadratic has degree-four discriminant when
           P belongs to S3. Outside S3 the full cubic has degree-six
           discriminant. No fixed-P quartic is reused. */
        const b=v12BranchLocus.build(
            s.p,s.d,s.passingLines,polynomial,s.onSurface
        );
        const nodes=b.nodes.map((item,i)=>({
            id:"v12-branch-node-"+(i+1),
            latex:"("+fmt(item.point.x)+","+fmt(item.point.y)+")",
            color:V12_COLORS.throughP,
            pointStyle:Desmos.Styles.POINT,
            pointSize:7,showLabel:false,label:"",
            /* A slot hidden in an earlier mode stays hidden in Desmos
               unless explicitly re-enabled when a new node occupies it. */
            hidden:false
        }));
        branchCalculator.setExpressions([
            {
                id:"v12-branch-discriminant",
                latex:b.latex,
                color:COLORS.surface,lineWidth:1.75
            },
            ...[0,1,2].map(i=>nodes[i]||({
                id:"v12-branch-node-"+(i+1),latex:"(0,0)",
                hidden:true
            })),
            {
                id:"v12-branch-test-image",
                latex:b.image
                    ?"("+fmt(b.image.x)+","+fmt(b.image.y)+")"
                    :"(0,0)",
                color:V12_COLORS.target,
                pointStyle:Desmos.Styles.OPEN,
                pointSize:4,showLabel:false,label:"",
                hidden:!b.image
            }
        ]);
        /* Keep the chart stable as the test line rotates. Only a change
           in the configuration of lines through P changes this frame. */
        const coords=b.nodes.map(x=>x.point);
        const xs=coords.map(x=>x.x),ys=coords.map(x=>x.y);
        const cx=xs.length?(Math.min(...xs)+Math.max(...xs))/2:0;
        const cy=ys.length?(Math.min(...ys)+Math.max(...ys))/2:0;
        /* Two contracted directions can be very close in this chart.
           Tighten the 2D view so separate A₁ points stay distinguishable. */
        const reach=coords.length>=2
            ?Math.max(.85,...coords.map(x=>
                1.55*Math.max(Math.abs(x.x-cx),Math.abs(x.y-cy))+.55
            ))
            :2.5;
        const bounds={left:cx-reach,right:cx+reach,
            bottom:cy-reach,top:cy+reach};
        const boundsKey=[
            ...s.passingLines,":",...Object.values(bounds)
        ].join(",");
        if(branchCalculator._v12BoundsKey!==boundsKey){
            branchCalculator.setMathBounds(bounds);
            branchCalculator._v12BoundsKey=boundsKey;
        }
        $("v12-branch-title").textContent=
            "Branch "+(s.onSurface?"quartic":"sextic")+" · Bₚ";
        $("v12-branch-key-curve").textContent=
            s.onSurface?"Branch quartic":"Branch sextic";
        $("v12-branch-key-node").hidden=!b.nodes.length;
        $("v12-branch-node-description").textContent=b.nodes.length
            ?"A₁ singular "+(b.nodes.length===1?"point":"points")+
              " · contracted "+b.nodes.map(node=>lineLabel(node.line))
                  .join(", ")
            :"";
        $("v12-right-branch").textContent=s.onSurface
            ?"The green quartic is Δₚ=c₂²−4c₁c₃=0. "+
             (b.nodes.length
                ?b.nodes.length+" marked singular direction(s) correspond "+
                  "to the blue lines contracted by projection."
                :"It is smooth here: no cubic line through P.")
            :"The green branch locus is the degree-six discriminant "+
             "of F(P+tD). Projection from P is generically 3:1.";
    }
    const fmt = value => {
        const v = Number(value.toFixed(8));
        return Object.is(v,-0) ? "0" : String(v);
    };
    const expressionPoint = p => "(" +
        [p.x,p.y,p.z].map(fmt).join(",") + ")";
    const xyz = p => [p.x,p.y,p.z];
    const F3 = v => {
        const [x,y,z]=v;
        return 81*(x*x*x+y*y*y+z*z*z)
            -189*(x*x*y+x*x*z+y*y*x+y*y*z+z*z*x+z*z*y)
            +54*x*y*z;
    };
    const F = p => {
        const [x,y,z]=xyz(p);
        return F3([x,y,z])+126*(x*y+y*z+z*x)
            -9*(x*x+y*y+z*z)-9*(x+y+z)+1;
    };
    const gradient = p => {
        const [x,y,z]=xyz(p);
        const part=(a,b,c)=>
            243*a*a-189*(2*a*b+2*a*c+b*b+c*c)
            +54*b*c+126*(b+c)-18*a-9;
        return [part(x,y,z),part(y,x,z),part(z,x,y)];
    };
    const polynomial = (p,d) => {
        const a=xyz(p);
        const c0=F(p);
        const c1=gradient(p).reduce((sum,v,i)=>sum+v*d[i],0);
        let c2=0;
        for(let i=0;i<3;i++){
            c2+=243*a[i]*d[i]*d[i]-9*d[i]*d[i];
            for(let j=0;j<3;j++)if(i!==j){
                c2-=189*(d[i]*d[i]*a[j]
                    +2*a[i]*d[i]*d[j]);
            }
        }
        c2+=54*(d[0]*d[1]*a[2]
            +d[0]*a[1]*d[2]+a[0]*d[1]*d[2]);
        c2+=126*(d[0]*d[1]+d[1]*d[2]+d[2]*d[0]);
        return [c0,c1,c2,F3(d)];
    };
    const evaluate = (coeff,t) =>
        ((coeff[3]*t+coeff[2])*t+coeff[1])*t+coeff[0];
    function realRoots(coeff) {
        const scale=Math.max(1,...coeff.map(Math.abs));
        const eps=1e-11*scale;
        let degree=3;
        while(degree>0&&Math.abs(coeff[degree])<eps)degree--;
        if(degree===0)return Math.abs(coeff[0])<eps?null:[];
        if(degree===1)return [-coeff[0]/coeff[1]];
        if(degree===2){
            const disc=coeff[1]**2-4*coeff[2]*coeff[0];
            if(disc < -eps)return [];
            const root=Math.sqrt(Math.max(0,disc));
            const roots=[(-coeff[1]-root)/(2*coeff[2]),
                (-coeff[1]+root)/(2*coeff[2])];
            return roots.filter((v,i)=>i===0||Math.abs(v-roots[0])>1e-7);
        }
        const bound=1+Math.max(
            Math.abs(coeff[0]/coeff[3]),
            Math.abs(coeff[1]/coeff[3]),
            Math.abs(coeff[2]/coeff[3])
        );
        const critical=[];
        const a=3*coeff[3],b=2*coeff[2],c=coeff[1];
        const disc=b*b-4*a*c;
        if(disc>=0){
            critical.push((-b-Math.sqrt(disc))/(2*a));
            critical.push((-b+Math.sqrt(disc))/(2*a));
        }
        const edges=[-bound,...critical.filter(v=>
            Number.isFinite(v)&&v>-bound&&v<bound
        ).sort((x,y)=>x-y),bound];
        const result=[];
        const values=edges.map(t=>evaluate(coeff,t));
        for(let i=0;i<edges.length;i++){
            /* A near-zero critical value is not necessarily a root:
               nearby genuine roots can bracket a turning point. */
            const bracketed=
                (i>0 && values[i-1]*values[i]<0) ||
                (i+1<edges.length && values[i]*values[i+1]<0);
            if(!bracketed && Math.abs(values[i])<1e-8*scale)
                result.push(edges[i]);
        }
        for(let i=0;i+1<edges.length;i++){
            let lo=edges[i],hi=edges[i+1],
                fl=values[i],fh=values[i+1];
            if(fl*fh>=0)continue;
            for(let k=0;k<80;k++){
                const mid=(lo+hi)/2,fm=evaluate(coeff,mid);
                if(fl*fm<=0){hi=mid;fh=fm;}
                else{lo=mid;fl=fm;}
            }
            result.push((lo+hi)/2);
        }
        return result.filter(Number.isFinite).sort((a,b)=>a-b)
            .filter((v,i,array)=>i===0 ||
                Math.abs(v-array[i-1])>1e-6);
    }
    /* Polar of the current center with respect to the homogenized v10
       Clebsch cubic. R is the intersection of this quadric and S3. */
    function polarCoefficients(p){
        const [a,b,c]=[p.x,p.y,p.z];
        return [
            243*a-189*(b+c)-9,
            -378*(a+b)+54*c+126,
            -378*(a+c)+54*b+126,
            243*b-189*(a+c)-9,
            -378*(b+c)+54*a+126,
            243*c-189*(a+b)-9,
            -18*a+126*(b+c)-18,
            -18*b+126*(a+c)-18,
            -18*c+126*(a+b)-18,
            3-9*(a+b+c)
        ];
    }
    function ramificationExpression(p){
        const monomials=[
            "x^2","xy","xz","y^2","yz","z^2","x","y","z",""
        ];
        const terms=polarCoefficients(p).flatMap((coefficient,i)=>{
            if(Math.abs(coefficient)<1e-11)return [];
            const number=Number(Math.abs(coefficient).toPrecision(13));
            return [(coefficient<0?"-":"+")+number+monomials[i]];
        });
        const polar=terms.join("").replace(/^\+/,"");
        const cubic=pages.clebsch.features.surface.expressions[0].latex
            .replace(/\s+/g,"").trim();
        return {
            id:"v12-ramification-curve",
            latex:polar+"=0\\left\\{"+cubic+"\\right\\}",
            color:COLORS.purpleCurve,
            lineWidth:1.45,
            hidden:!state.ramification
        };
    }
    const lineLabel=number=>
        clebschPage.schlafliLineLabel?.(number) ||
        "line "+number;
    const linesLabel=numbers=>numbers.map(lineLabel).join(" ∩ ");
    function snapshot(){
        const p={...state.p};
        const az=state.azimuth*Math.PI/180,
            el=state.elevation*Math.PI/180;
        const d=[
            Math.cos(el)*Math.cos(az),
            Math.cos(el)*Math.sin(az),
            Math.sin(el)
        ];
        const coeff=polynomial(p,d);
        const onSurface=Math.abs(coeff[0])<1e-7;
        /* On S3, factor F(P+tD)=t(c1+c2*t+c3*t^2).
           Anchor P at t=0 and solve only the remaining quadratic;
           floating-point noise must never create a fourth contact. */
        const otherRoots=onSurface
            ?realRoots([coeff[1],coeff[2],coeff[3],0])
            :null;
        const roots=onSurface
            ?otherRoots===null?null:[0,...otherRoots.filter(t=>
                Math.abs(t)>1e-7
            )].sort((a,b)=>a-b)
            :realRoots(coeff);
        const intersections=roots===null?null:roots.map(t=>({
            t,x:p.x+t*d[0],y:p.y+t*d[1],z:p.z+t*d[2]
        }));
        const target=Math.abs(d[2])<1e-8||Math.abs(p.z)<1e-8
            ?null:{
                x:p.x-p.z*d[0]/d[2],
                y:p.y-p.z*d[1]/d[2],z:0
            };
        return {
            p,d,coeff,roots,intersections,target,f:F(p),
            onSurface,
            passingLines:v12Incidence.linesThrough(p),
            onL16:Math.abs(p.x+p.y)<1e-7
                &&Math.abs(3*p.z+1)<1e-7
        };
    }
    function dynamicScene(s){
        const green=clebschGeometry.createLineExpressions({
            complementaryColor:COLORS.clebschLine15,
            doubleSixColor:COLORS.clebschLine12
        });
        const p=s.p,d=s.d;
        const pt=(t)=>expressionPoint({
            x:p.x+t*d[0],y:p.y+t*d[1],z:p.z+t*d[2]
        });
        /* Use fixed Desmos IDs: changing P never leaves stale lines.
           All 2/3 concurrent source lines share one consistent blue. */
        const incidentLines=[0,1,2].map(index=>{
            const number=s.passingLines[index];
            return {
                id:"v12-incident-line-"+(index+1),
                latex:number?green[number-1].latex:"x=999999",
                color:V12_COLORS.throughP,lineWidth:1.05,
                hidden:!number
            };
        });
        /* The polar section has degree six. Every cubic line through
           P is an actual component of R_P, not just a contracted curve:
           S3 ∩ polar_P = sum of the k incident lines + C_(6-k).
           Retain the established solid blue incident lines; purple
           dashes on top identify their additional ramification role. */
        const sharedRamification=[0,1,2].map(i=>{
            const number=s.passingLines[i];
            return {
                id:"v12-ramification-line-"+(i+1),
                latex:number?green[number-1].latex:"x=999999",
                color:COLORS.purpleCurve,
                lineStyle:Desmos.Styles.DASHED,
                lineWidth:1.45,
                hidden:!number || !state.ramification
            };
        });
        const main=[
            ...pages.clebsch.features.surface.expressions.map(v=>({
                ...v,hidden:!state.surface
            })),
            /* Suppress the green copy of each highlighted blue line.
               Two opaque overlapping expressions would otherwise look
               like random palette changes when "All 27" is selected. */
            ...green.map((v,index)=>({
                ...v,
                hidden:!state.allLines ||
                    s.passingLines.includes(index+1)
            })),
            ...incidentLines,
            ramificationExpression(p),
            ...sharedRamification,
            {
                id:"v12-target-plane",latex:"z=0",
                color:COLORS.bluePlane,
                hidden:!state.targetPlane
            },
            {
                id:"v12-test-line",
                latex:"\\operatorname{segment}("+pt(-3)+","+pt(3)+")",
                color:V12_COLORS.test,lineWidth:1.2
            },
            {
                id:"v12-target-image",
                latex:s.target?expressionPoint(s.target):"(0,0,0)",
                color:V12_COLORS.target,pointSize:4,
                showLabel:true,label:"image",hidden:!s.target
            },
            ...[0,1,2].map(i=>{
                /* A source point P on the cubic already supplies one
                   root t=0. It must not be covered by a second orange
                   marker, which falsely suggests a fourth contact. */
                const other=s.intersections?.filter(point=>
                    Math.abs(point.t)>1e-7
                )[i];
                return {
                    id:"v12-cubic-intersection-"+(i+1),
                    latex:other?expressionPoint(other):"(0,0,0)",
                    color:V12_COLORS.contacts,pointSize:3.5,
                    hidden:!other
                };
            }),
            /* P is drawn last, always purple, with an explicit label.
               Off S3 a purple P + 3 orange roots means four markers
               but only THREE intersections with the surface. */
            {
                id:"v12-moving-P",latex:expressionPoint(p),
                color:V12_COLORS.P,pointSize:4.5,
                showLabel:true,label:"P"
            }
        ];
        return main;
    }
    function applySnapshot(){
        if(!state.active||!mainCalculator)return;
        const s=snapshot();
        const expressions=dynamicScene(s);
        if (v12NeedsCleanScene) {
            const ids=(mainCalculator.getExpressions?.()||[])
                .filter(item=>item?.id).map(item=>({id:item.id}));
            if(ids.length)mainCalculator.removeExpressions?.(ids);
            v12NeedsCleanScene=false;
        }
        mainCalculator.setExpressions(expressions);
        updateBranchCard(s);
        const incident=s.passingLines;
        const location=incident.length===3
            ? "is an Eckardt point where "+
              linesLabel(incident)+" meet"
            : incident.length===2
                ? "lies at "+linesLabel(incident)
                : incident.length===1
                    ? "lies on "+lineLabel(incident[0])
                    : s.onSurface
                        ? "lies on S₃ away from its lines"
                        : "lies outside S₃";
        $("v12-point-status").textContent=
            "Purple P "+location+". The red line has "+
            (s.intersections===null
                ? "infinitely many points on S₃ (it lies on S₃)."
                : s.intersections.length+
                  " distinct real intersection(s) with S₃.")+
            (!s.onSurface
                ? " Purple P is separate from the cubic. The "+
                  (s.intersections?.length||0)+
                  " orange marker(s) are the actual intersections."
                : " P is itself an intersection and remains purple.");
        $("v12-image-status").textContent=s.target
            ?"The blue point is the line's image on z = 0: ("+
               fmt(s.target.x)+", "+fmt(s.target.y)+")."
            :"No affine target point in this chart for this position/direction.";
        $("v12-right-class").textContent="Purple P "+location+".";
        $("v12-ramification-component-legend").hidden=
            !state.ramification || !incident.length;
        $("v12-right-ramification").textContent=!state.ramification
            ?"Ramification R is hidden. Check Ramification curve R "+
              "to see its components."
            :incident.length
                ?"Rₚ = S₃ ∩ polarₚ is a degree-6 curve. Here "+
                  "Rₚ splits into "+incident.length+
                  (incident.length===1?" line component ("
                    :" line components (")+
                  incident.map(lineLabel).join(", ")+
                  ") and a residual curve of degree "+
                  (6-incident.length)+". Purple dashes on the blue "+
                  "lines identify the line components of Rₚ; the "+
                  "remaining purple locus is the residual curve."
                :"Rₚ = S₃ ∩ polarₚ has degree 6, with no "+
                  "cubic line through P as a component. "+
                  "Uncheck Surface to see Rₚ more clearly.";
        $("v12-right-lines").textContent=incident.length
            ? incident.length+" blue cubic line(s) through P. "+
              "Projection contracts "+(incident.length===1
                 ? "this line to a point"
                 : "these lines to "+incident.length+" distinct points")+
              " in the plane of directions. Blowing up P turns "+
              "them into (-2)-curves, yielding "+incident.length+
              " A₁ singular "+(incident.length===1?"point.":"points.")
            : s.onSurface
                ? "No cubic line passes through P; projection "+
                  "is generically two-to-one."
                : "No cubic line passes through P; projection "+
                  "is generically three-to-one from outside S₃.";
        $("v12-right-intersections").textContent=s.intersections===null
            ?"The red line is contained in the cubic."
            :s.intersections.length+" distinct real intersection(s). "+
             (s.onSurface
               ? "Purple P is one of them; only the other roots are orange."
               : "P is outside S₃, so the purple marker is not an intersection. "+
                 "The orange markers alone are the cubic intersections.");
        $("v12-right-target").textContent=s.target
            ?"Line through P → ("+fmt(s.target.x)+", "+
               fmt(s.target.y)+") on the target z = 0."
            :"The fixed affine target chart is unavailable here.";
    }
    function syncUI(){
        if(!panel)return;
        $("v12-xyz-controls").hidden=
            state.preset!=="free" && state.preset!=="outside";
        $("v12-line-control").hidden=state.preset!=="line";
        $("v12-crossing-control").hidden=
            state.preset!=="pair" && state.preset!=="triple";
        $("v12-show-surface").checked=state.surface;
        $("v12-show-ramification").checked=state.ramification;
        $("v12-line-slider").value=String(state.a);
        $("v12-line-slider-value").textContent="a = "+state.a.toFixed(3);
        for(const axis of ["x","y","z"]){
            $("v12-"+axis).value=state.p[axis];
            $("v12-"+axis+"-value").textContent=axis+" = "+
                state.p[axis].toFixed(3);
        }
        for(const [label,k]of [["azimuth","azimuth"],["elevation","elevation"]]){
            $("v12-"+label).value=state[k];
            $("v12-"+label+"-value").textContent=
                state[k]+"°";
        }
    }
    function enter(preset="line"){
        if(state.active){choosePreset(preset);return;}
        /* Reset v10's visual calculators and autoplay first, so the
           experimental scene has no stale updates from v10 behind it. */
        loadPage("clebsch");
        clebschPage.prepareForMovingPoint?.();
        state.active=true;
        v12NeedsCleanScene=true;
        state.preset="line";
        state.chosenIntersection={pair:0,triple:0};
        state.a=.35;
        state.p={x:state.a,y:-state.a,z:-1/3};
        document.body.classList.add("v12-moving-p");
        panel.hidden=false;
        geometryControls.hidden=true;
        controlHeadingActions.hidden=true;
        const info=$("info-panel");
        info.innerHTML=
            '<div class="clebsch-info proof-info v12-geometry-copy">'+
            '<h2>Moving the point P</h2>'+
            '<div class="surface-type">CLEBSCH CUBIC · V12 GEOMETRY</div>'+
            '<div class="theorem clebsch-question proof-question">'+
            '<div class="theorem-name">Experiment</div>'+
            '<p>Move P along a cubic line or freely through space. '+
            'The same cubic surface and 27 lines remain fixed.</p></div>'+
            '<div class="proof-answer active">'+
            '<div class="theorem-name">Live geometric picture</div>'+
            '<p id="v12-right-class"></p>'+
            '<p id="v12-right-lines"></p>'+
            '<p id="v12-right-branch"></p>'+
            '<p id="v12-right-ramification"></p>'+
            '<div class="v12-color-legend">'+
             '<span><i class="v12-swatch-p"></i>P · purple</span>'+
             '<span><i class="v12-swatch-incident"></i>Lines through P · blue</span>'+
             '<span><i class="v12-swatch-lines"></i>Other lines · green</span>'+
             '<span><i class="v12-swatch-ramification"></i>Ramification R · purple</span>'+
             '<span id="v12-ramification-component-legend" hidden>'+
               '<i class="v12-swatch-shared"></i>'+
               'Purple dashes on blue · line components of R</span>'+
             '<span><i class="v12-swatch-test"></i>Test line · red</span>'+
             '<span><i class="v12-swatch-contact"></i>Intersections · orange</span>'+
             '<span><i class="v12-swatch-target"></i>Target image · blue dot</span>'+
            '</div>'+
            '<p>P is always purple. The red line passes through P; '+
            'orange dots are real cubic intersections other than P.</p>'+
            '<p id="v12-right-intersections"></p>'+
            '<p id="v12-right-target"></p>'+
            '<div class="proof-note">The branch locus in the inset is '+
            'recomputed for the current P. The original fixed-P 28 '+
            'bitangents and blow-up equations remain hidden while P moves. '+
            'Use “Return to v10 geometry” to recover the fully verified '+
            'original construction.</div></div></div>';
        createBranchCard();
        syncUI();
        if(mainCalculator?.getExpressions){
            const old=mainCalculator.getExpressions();
            if(old.length)mainCalculator.removeExpressions(
                old.filter(v=>v?.id).map(v=>({id:v.id}))
            );
        } else {
            const ids=Object.values(pages.clebsch.features)
                .flatMap(v=>v.expressions||[])
                .map(x=>({id:x.id}));
            mainCalculator?.removeExpressions?.(ids);
        }
        choosePreset(preset);
    }
    function leave(){
        disposeBranchCard();
        state.active=false;
        v12NeedsCleanScene=false;
        document.body.classList.remove("v12-moving-p");
        if(panel)panel.hidden=true;
        geometryControls.hidden=false;
        controlHeadingActions.hidden=false;
        loadPage("clebsch");
    }
    const slider=(id,label,min,max,step,value)=>
        '<label class="v12-field" for="v12-'+id+'">'+label+
        '<output id="v12-'+id+'-value"></output></label>'+
        '<input type="range" id="v12-'+id+'" min="'+min+
        '" max="'+max+'" step="'+step+'" value="'+value+'">';
    function createControl(){
        const section=document.querySelector(".left-panel .geometry-section");
        if(!section||$("v12-control"))return;
        panel=document.createElement("div");
        panel.id="v12-control";
        panel.className="v12-control";
        panel.hidden=true;
        panel.innerHTML=
            '<div id="v12-line-control">'+
                slider("line-slider","Position along L₁₆",.08,.62,.001,.35)+
                '</div>'+
            '<div id="v12-crossing-control" hidden>'+
              '<label class="v12-field" for="v12-crossing-select">'+
                'Choose line intersection</label>'+
              '<select id="v12-crossing-select"></select>'+
              '<div class="v12-crossing-note">The points are computed '+
                'from the 27 lines. Three-line intersections are '+
                'Eckardt points; three additional ones lie at infinity.</div>'+
            '</div>'+
            '<div id="v12-xyz-controls" hidden>'+
                slider("x","x",-1.5,1.5,.001,.35)+
                slider("y","y",-1.5,1.5,.001,-.35)+
                slider("z","z",-1.5,1.5,.001,-.333)+'</div>'+
            '<div class="v12-group-title">LINE THROUGH P</div>'+
                slider("azimuth","Azimuth",-180,180,1,30)+
                slider("elevation","Elevation",-80,80,1,-45)+
            '<label class="geometry-control"><input id="v12-show-27" '+
                'type="checkbox"> All 27 lines</label>'+
            '<label class="geometry-control"><input id="v12-show-surface" '+
                'type="checkbox" checked> Surface</label>'+
            '<label class="geometry-control"><input id="v12-show-ramification" '+
                'type="checkbox" checked> Ramification curve R</label>'+
            '<label class="geometry-control"><input id="v12-show-plane" '+
                'type="checkbox" checked> Target plane z = 0</label>'+
            '<div id="v12-point-status" class="v12-status"></div>'+
            '<div id="v12-image-status" class="v12-status"></div>'+
            '<button id="v12-return" class="v12-return" type="button">'+
                '← Return to v10 geometry</button>';
        section.appendChild(panel);
        function fillCrossingList(){
            const select=$("v12-crossing-select");
            select.replaceChildren();
            const entries=v12Incidence[state.preset];
            entries.forEach((entry,i)=>{
                const option=document.createElement("option");
                option.value=String(i);
                option.textContent=linesLabel(entry.lines)+
                    " · ("+[entry.p.x,entry.p.y,entry.p.z]
                        .map(x=>Number(x.toFixed(3))).join(", ")+")";
                select.appendChild(option);
            });
            select.value=String(state.chosenIntersection[
                state.preset
            ]||0);
        }
        function selectCrossing(){
            const chosen=v12Incidence[state.preset][
                state.chosenIntersection[state.preset]
            ];
            if(!chosen)throw Error("Invalid chosen line intersection");
            state.p={...chosen.p};
            /* Preserve the independent L16 slider parameter when
               selecting a two- or three-line intersection. */
        }
        $("v12-return").addEventListener("click",leave);
        choosePreset=preset=>{
                const previousPreset=state.preset;
                state.preset=preset;
                if(state.preset==="surface"){
                    state.p={...P0};
                } else if(state.preset==="line"){
                    /* A deliberate click from another case starts at
                       a generic one-line point, not the old intersection.
                       The slider still allows reaching intersections. */
                    if(previousPreset!=="line")state.a=.35;
                    state.p={x:state.a,y:-state.a,z:-1/3};
                } else if(state.preset==="pair" ||
                    state.preset==="triple"){
                    fillCrossingList();
                    selectCrossing();
                } else if(state.preset==="outside"){
                    state.p={x:.4,y:-.2,z:.7};
                }
                syncUI();applySnapshot();
        };
        $("v12-crossing-select").addEventListener(
            "change",event=>{
                state.chosenIntersection[state.preset]=
                    Number(event.target.value);
                selectCrossing();
                syncUI();applySnapshot();
            }
        );
        $("v12-line-slider").addEventListener("input",event=>{
            state.a=Number(event.target.value);
            state.p={x:state.a,y:-state.a,z:-1/3};
            syncUI();applySnapshot();
        });
        for(const axis of ["x","y","z"]){
            $("v12-"+axis).addEventListener("input",event=>{
                state.p[axis]=Number(event.target.value);
                state.preset="free";
                syncUI();applySnapshot();
            });
        }
        for(const key of ["azimuth","elevation"]){
            $("v12-"+key).addEventListener("input",event=>{
                state[key]=Number(event.target.value);
                syncUI();applySnapshot();
            });
        }
        for(const [id,key]of [
            ["v12-show-27","allLines"],
            ["v12-show-surface","surface"],
            ["v12-show-ramification","ramification"],
            ["v12-show-plane","targetPlane"]
        ]){
            $(""+id).addEventListener("change",event=>{
                state[key]=event.target.checked;
                applySnapshot();
            });
        }
        // The frame above is deliberately not animated independently.
    }
    function onPageLoad(name){
        disposeBranchCard();
        state.active=false;
        v12NeedsCleanScene=false;
        document.body.classList.remove("v12-moving-p");
        if(panel)panel.hidden=true;
        geometryControls.hidden=false;
        controlHeadingActions.hidden=false;
    }
    function init(){
        createControl();
        onPageLoad("clebsch");
    }
    window.v12MovingP={onPageLoad,init,enter,leave,
        snapshot,polynomial,realRoots,F,polarCoefficients,ramificationExpression};
    init();
})();