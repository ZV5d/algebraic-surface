/* v12 footnote to the v10 generic projection: self-contained special cases.
   Uses the current v12 Clebsch polynomial/line incidence/discriminant, but
   never takes control of the main v10 3D calculator or projection animation. */
(() => {
    "use strict";
    const $=id=>document.getElementById(id);
    const state={
        caseName:"lines", k:1,
        show:{surface:true,point:true,ramification:true}
    };
    let overlay=null,calculator3D=null,calculator2D=null,previousFocus=null;
    let mathVersion=0,mathTypesetQueue=Promise.resolve();
    let exteriorCusps=null,themeObserver=null;
    const blue="#009FE3",purple=COLORS.purpleCurve;
    const fmt=x=>{
        const v=Number(x.toFixed(8));
        return Object.is(v,-0)?"0":String(v);
    };
    function current(){
        if(state.caseName==="outside")
            return {p:{x:7/16,y:-1/16,z:2/3},lines:[],outside:true};
        if(state.k===3){
            const item=v12Incidence.triple[0];
            return {p:{...item.p},lines:[...item.lines],outside:false};
        }
        if(state.k===2){
            const item=v12Incidence.pair.find(entry=>entry.lines.includes(1));
            return {p:{...item.p},lines:[...item.lines],outside:false};
        }
        return {p:{x:.35,y:-.35,z:-1/3},lines:[1],outside:false};
    }
    function html(){
        return '<section id="v12-special-dialog" class="v12-special-dialog" '+
            'role="dialog" aria-modal="true" aria-labelledby="v12-special-title">'+
          '<header class="v12-special-header">'+
            '<div><span id="v12-special-eyebrow" class="v12-special-eyebrow">CLEBSCH CUBIC · SPECIAL CASES</span>'+
            '<div class="v12-special-heading-line">'+
              '<h2 id="v12-special-title">Projection from a point <i>P</i></h2>'+
              '<span id="v12-special-header-context" class="v12-special-header-context">— What changes when <i>P</i> is not a generic point in <i>S</i><sub>3</sub>?</span>'+
            '</div></div>'+
            '<button type="button" id="v12-special-close" class="v12-special-close" '+
              'aria-label="Close special cases">×</button>'+
          '</header>'+
          '<div class="v12-special-body">'+
            '<aside class="v12-special-left">'+
              '<h3>Show geometry</h3>'+
              '<div class="v12-special-object-controls">'+
                '<label class="v12-special-toggle" for="v12-special-show-surface">'+
                  '<input id="v12-special-show-surface" type="checkbox" checked>'+
                  '<svg class="v12-special-object-icon v12-special-surface-icon" viewBox="0 0 44 26" aria-hidden="true">'+
                    '<defs><linearGradient id="v12-special-surface-gradient" x1="0" y1="1" x2="1" y2="0">'+
                      '<stop offset="0%" stop-color="#6E8F6B"/>'+
                      '<stop offset="15%" stop-color="#8EA88A"/>'+
                      '<stop offset="28%" stop-color="#5C7C59"/>'+
                      '<stop offset="50%" stop-color="#436340"/>'+
                      '<stop offset="72%" stop-color="#5C7C59"/>'+
                      '<stop offset="85%" stop-color="#8EA88A"/>'+
                      '<stop offset="100%" stop-color="#6E8F6B"/>'+
                    '</linearGradient></defs>'+
                    '<path d="M2 4 C10 5.5 15 5.5 22 4 C29 2.5 35 2.5 42 4 C39 9 45 17 42 22 C34 20.5 29 20.5 22 22 C14 23.5 8 23.5 2 22 C5 17 -1 9 2 4 Z"/>'+
                  '</svg>'+
                  '<span>Surface <i>S</i></span>'+
                '</label>'+
                '<label class="v12-special-toggle" for="v12-special-show-point">'+
                  '<input id="v12-special-show-point" type="checkbox" checked>'+
                  '<svg class="v12-special-object-icon v12-special-point-icon" viewBox="0 0 44 26" aria-hidden="true">'+
                    '<circle cx="22" cy="13" r="5.4"/>'+
                  '</svg>'+
                  '<span>Point <i>P</i></span>'+
                '</label>'+
                '<label class="v12-special-toggle" for="v12-special-show-ramification">'+
                  '<input id="v12-special-show-ramification" type="checkbox" checked>'+
                  '<svg class="v12-special-object-icon v12-special-ramification-icon" viewBox="0 0 60 20" aria-hidden="true">'+
                    '<path d="M2,12 C10,4 18,4 26,12 C34,20 42,20 58,6"/>'+
                  '</svg>'+
                  '<span>Ramification <i>R</i></span>'+
                '</label>'+
                '<label class="v12-special-toggle" for="v12-special-show-branch">'+
                  '<input id="v12-special-show-branch" type="checkbox" checked>'+
                  '<svg class="v12-special-object-icon v12-special-branch-icon" viewBox="0 0 60 20" aria-hidden="true">'+
                    '<path d="M2,12 C10,4 18,4 26,12 C34,20 42,20 58,6"/>'+
                  '</svg>'+
                  '<span>Branch <i>B</i></span>'+
                '</label>'+
              '</div>'+
            '</aside>'+
            '<div class="v12-special-visual">'+
              '<div id="v12-special-3d" class="v12-special-3d" '+
                 'aria-label="Three dimensional cubic and ramification locus"></div>'+
              '<div id="v12-special-branch-card" class="v12-special-branch-card">'+
                '<div class="v12-special-branch-heading">'+
                  '<strong id="v12-special-branch-title">Branch quartic · Bₚ</strong>'+
                  '<small id="v12-special-branch-note">Projective directions through P</small>'+
                  '<div id="v12-special-cusp-key" class="v12-special-cusp-key" hidden>'+
                    '<span><i class="v12-special-conic-swatch"></i>Conic</span>'+
                    '<span><i class="v12-special-cusp-swatch"></i><b id="v12-special-real-cusp-count">0</b> real cusps / 6 over ℂ</span>'+
                  '</div>'+
                '</div>'+
                '<div id="v12-special-2d" class="v12-special-2d" '+
                     'aria-label="Branch curve in the plane of directions"></div>'+
              '</div>'+
              '<div class="v12-special-scene-caption" id="v12-special-scene-caption"></div>'+
            '</div>'+
            '<aside class="v12-special-right">'+

              '<button type="button" id="v12-special-question-lines" '+
                'class="v12-special-question" aria-pressed="true">'+
                '1. What if P lies on one of the 27 lines?</button>'+
              '<div id="v12-special-line-choices" class="v12-special-line-choices">'+
                '<button type="button" data-v12-special-k="1" aria-pressed="true">1 line</button>'+
                '<button type="button" data-v12-special-k="2" aria-pressed="false">2 lines</button>'+
                '<button type="button" data-v12-special-k="3" aria-pressed="false">3 lines</button>'+
              '</div>'+
              '<button type="button" id="v12-special-question-outside" '+
                'class="v12-special-question" aria-pressed="false">'+
                '2. What if P lies outside S₃?</button>'+
              '<div id="v12-special-explanation" class="v12-special-explanation" aria-live="polite"></div>'+
            '</aside>'+
          '</div>'+
        '</section>';
    }

    function typesetExplanation(panel){
        const version=++mathVersion,dialog=overlay;
        // Serialize pending MathJax updates when switching the cases rapidly.
        mathTypesetQueue=mathTypesetQueue.catch(()=>{}).then(()=>{
            if(!dialog || overlay!==dialog || version!==mathVersion ||
               !window.MathJax?.typesetPromise)return;
            return window.MathJax.typesetPromise([panel]);
        }).catch(error=>{
            console.warn("Could not typeset the special-cases explanation",error);
        });
    }
    function lineTex(number){
        const key=clebschPage.schlafliLineLabel?.(number) || "L"+number;
        const match=/^([A-Za-z])([0-9]+)$/.exec(key);
        return match?"\\mathrm{"+match[1]+"}_{"+match[2]+"}"
            :"\\ell_{"+number+"}";
    }
    function updateText(s,b){
        const on=state.caseName==="lines",k=s.lines.length;
        $("v12-special-question-lines").setAttribute("aria-pressed",String(on));
        $("v12-special-question-outside").setAttribute("aria-pressed",String(s.outside));
        $("v12-special-line-choices").hidden=!on;
        overlay.querySelectorAll("[data-v12-special-k]").forEach(button=>
            button.setAttribute("aria-pressed",String(Number(button.dataset.v12SpecialK)===k))
        );
        $("v12-special-branch-title").textContent="Branch "+(s.outside?"sextic":"quartic")+" · Bₚ";
        $("v12-special-branch-note").textContent=s.outside
            ?"Degree 6 · "+(exteriorCusps?.realCusps.length??0)+" real of 6 cusps"
            :k+" A₁ singular "+(k===1?"point":"points")+" · degree 4";
        $("v12-special-scene-caption").textContent=s.outside
            ?"P = (7/16, −1/16, 2/3) is outside S₃: projection has degree 3."
            :k+" cubic "+(k===1?"line passes":"lines pass")+
              " through P. Purple dashes mark line components of R.";
        const panel=$("v12-special-explanation");
        window.MathJax?.typesetClear?.([panel]);
        if(s.outside){
            panel.innerHTML=String.raw`
                <h4>\(P\) is no longer a root</h4>
                <p>Here \(P=(\tfrac{7}{16},-\tfrac{1}{16},\tfrac23)\notin S_3\).
                    On a line \(Q=P+tV\), the cubic restricts to</p>
                <p class="v12-special-formula">
                    \(\displaystyle c_0+c_1(V)t+c_2(V)t^2+c_3(V)t^3=0\),
                    with \(c_0=F(P)\ne0\).
                </p>
                <p>There is no fixed root \(t=0\), and no blow-up is needed.
                    Projection from \(P\) is generically <strong>3:1</strong>.</p>
                <p>The branch locus is the full cubic discriminant:</p>
                <p class="v12-special-formula">
                    \(\displaystyle
                        \begin{aligned}
                        \Delta_3={}&c_1^2c_2^2-4c_0c_2^3-4c_1^3c_3\\
                        &-27c_0^2c_3^2+18c_0c_1c_2c_3.
                        \end{aligned}
                    \)
                </p>
                <p>Since \(\deg_V c_i=i\), each summand has degree six.
                    Thus <strong>\(\deg B=6\)</strong>.</p>
                <p>Write \(U=c_1^2-3c_0c_2\) and
                    \(T=2c_1^3-9c_0c_1c_2+27c_0^2c_3\). Then</p>
                <p class="v12-special-formula">
                    \(\displaystyle 27c_0^2\Delta_3=4U^3-T^2.\)
                </p>
                <p>The cusps lie at \(U=T=0\): a <strong>conic</strong>
                    meets a cubic in <strong>six points over
                    \(\mathbb C\)</strong>. For this projection center,
                    <strong>all six cusps are distinct and real</strong>
                    (orange dots on the dashed orange conic).</p>
                <p>The purple ramification curve is still the polar section
                    \(S_3\cap\operatorname{Polar}_{P}(S_3)\),
                    of degree six.</p>`;
        }else{
            const components=s.lines.map(lineTex).join("+");
            panel.innerHTML=String.raw`
                <h4>${k} ${k===1?"line":"lines"} through \(P\)</h4>
                <p>The ramification curve has degree six and splits as</p>
                <p class="v12-special-formula">
                    \(\displaystyle R_P=${components}+C_{${6-k}}.\)
                </p>
                <p>The <strong>${k} line ${k===1?"component":"components"}</strong>
                    (purple dashes over blue lines) plus a residual curve
                    of <strong>degree ${6-k}</strong> make degree six.</p>
                <p>Because \(P\in S_3\), the cubic restriction has the factor \(t\):</p>
                <p class="v12-special-formula">
                    \(\displaystyle F(P+tV)=t\bigl(c_1+c_2t+c_3t^2\bigr).\)
                </p>
                <p>The <strong>branch quartic</strong> comes from the
                    residual quadratic,
                    \(\Delta_2=c_2^2-4c_1c_3\), of degree four.
                    It has <strong>${k} distinct \(A_1\) singular
                    ${k===1?"point":"points"}</strong>, one for each
                    line through \(P\) (solid blue points in the inset).</p>`;
        }
        typesetExplanation(panel);
    }
    function render(){
        if(!overlay||!calculator3D||!calculator2D)return;
        const s=current(),sh=state.show;
        const lines=clebschGeometry.createLineExpressions({
            complementaryColor:COLORS.clebschLine15,
            doubleSixColor:COLORS.clebschLine12
        });
        const ramification={
            ...window.v12MovingP.ramificationExpression(s.p),
            id:"v12-special-R",hidden:!sh.ramification,lineWidth:1.45
        };
        const main=[
            {...pages.clebsch.features.surface.expressions[0],
                id:"v12-special-surface",hidden:!sh.surface},
            ramification,
            ...[0,1,2].flatMap(i=>{
                const number=s.lines[i],latex=number?lines[number-1].latex:"x=999999";
                return [
                    {id:"v12-special-blue-"+i,latex,
                     color:blue,lineWidth:1.05,hidden:!number},
                    {id:"v12-special-shared-"+i,latex,
                     color:purple,lineStyle:Desmos.Styles.DASHED,
                     lineWidth:1.45,hidden:!number||!sh.ramification}
                ];
            }),
            {id:"v12-special-P",
             latex:"("+[s.p.x,s.p.y,s.p.z].map(fmt).join(",")+")",
             color:purple,pointSize:4.5,showLabel:true,label:"P",hidden:!sh.point}
        ];
        calculator3D.setExpressions(main);
        const b=v12BranchLocus.build(
            s.p,[.43,.28,.77],s.lines,window.v12MovingP.polynomial,!s.outside
        );
        const cuspGeometry=s.outside
            ?(exteriorCusps ||= v12BranchLocus.exteriorCuspGeometry(b))
            :null;
        const cuspPoints=cuspGeometry?.realCusps || [];
        const cuspColor="#D68A12";
        const branchCard=$("v12-special-branch-card");
        branchCard.classList.toggle("v12-special-has-cusps",Boolean(cuspGeometry));
        $("v12-special-cusp-key").hidden=!cuspGeometry;
        $("v12-special-real-cusp-count").textContent=String(cuspPoints.length);
        const dots=b.nodes.map((n,i)=>({
            id:"v12-special-singularity-"+i,
            latex:"("+fmt(n.point.x)+","+fmt(n.point.y)+")",
            color:blue,pointStyle:Desmos.Styles.POINT,pointSize:7,
            showLabel:false,label:"",hidden:!sh.branch
        }));
        calculator2D.setExpressions([
            {id:"v12-special-discriminant",latex:b.latex,
             color:COLORS.surface,lineWidth:1.75,hidden:!sh.branch},
            ...[0,1,2].map(i=>dots[i]||{
                id:"v12-special-singularity-"+i,latex:"(0,0)",hidden:true
            }),
            {
                id:"v12-special-cusp-conic",
                latex:cuspGeometry?.conicLatex||"x=999999",
                color:cuspColor,lineStyle:Desmos.Styles.DASHED,
                lineWidth:1.4,hidden:!sh.branch||!cuspGeometry
            },
            ...Array.from({length:6},(_,i)=>{
                const point=cuspPoints[i];
                return {
                    id:"v12-special-cusp-point-"+i,
                    latex:point
                        ?"("+fmt(point.x)+","+fmt(point.y)+")"
                        :"(0,0)",
                    color:cuspColor,
                    pointStyle:Desmos.Styles.POINT,
                    pointSize:7,showLabel:false,label:"",
                    hidden:!sh.branch||!point
                };
            })
        ]);
        const coords=[...b.nodes.map(x=>x.point),...cuspPoints];
        const xs=coords.map(p=>p.x),ys=coords.map(p=>p.y);
        const cx=xs.length?(Math.min(...xs)+Math.max(...xs))/2:0;
        const cy=ys.length?(Math.min(...ys)+Math.max(...ys))/2:0;
        const reach=coords.length>1
            ?Math.max(1.1,...coords.map(p=>
                1.5*Math.max(Math.abs(p.x-cx),Math.abs(p.y-cy))+.6))
            :2.5;
        calculator2D.setMathBounds({
            left:cx-reach,right:cx+reach,bottom:cy-reach,top:cy+reach
        });
        $("v12-special-branch-card").hidden=!sh.branch;
        for(const key of ["surface","point","ramification","branch"]){
            $("v12-special-show-"+key).checked=sh[key];
        }
        updateText(s,b);
        calculator3D.resize?.();
        if(sh.branch)calculator2D.resize?.();
    }
    function choose(caseName,k){
        state.caseName=caseName==="outside"?"outside":"lines";
        if(k!==undefined)state.k=k;
        render();
    }
    function close(){
        if(!overlay)return;
        ++mathVersion;
        window.MathJax?.typesetClear?.([$("v12-special-explanation")]);
        themeObserver?.disconnect();
        themeObserver=null;
        calculator3D?.destroy?.();
        calculator2D?.destroy?.();
        calculator3D=null;calculator2D=null;
        overlay.remove();overlay=null;
        document.body.classList.remove("v12-special-open");
        previousFocus?.focus?.();previousFocus=null;
    }
    function open(){
        if(overlay)return;
        previousFocus=document.activeElement;
        state.caseName="lines";state.k=1;
        state.show={surface:true,point:true,ramification:true};
        overlay=document.createElement("div");
        overlay.id="v12-special-overlay";
        overlay.className="v12-special-overlay";
        overlay.innerHTML=html();
        document.body.appendChild(overlay);
        document.body.classList.add("v12-special-open");
        overlay.addEventListener("click",event=>{
            if(event.target===overlay)close();
        });
        $("v12-special-close").addEventListener("click",close);
        $("v12-special-question-lines").addEventListener("click",()=>choose("lines"));
        $("v12-special-question-outside").addEventListener("click",()=>choose("outside"));
        overlay.querySelectorAll("[data-v12-special-k]").forEach(button=>{
            button.addEventListener("click",()=>choose("lines",Number(button.dataset.v12SpecialK)));
        });
        for(const key of ["surface","point","ramification","branch"]){
            $("v12-special-show-"+key).addEventListener("change",event=>{
                state.show[key]=event.target.checked;
                render();
            });
        }
        calculator3D=Desmos.Calculator3D($("v12-special-3d"),{
            expressions:false,settingsMenu:true,keypad:false,zoomButtons:true
        });
        calculator2D=Desmos.GraphingCalculator($("v12-special-2d"),{
            expressions:false,settingsMenu:false,keypad:false,zoomButtons:true
        });
        // The dialog owns its calculators rather than registering them in
        // the page's activeCalculators list. Apply the current theme here,
        // otherwise dark-mode users see light Desmos plots inside a dark UI.
        const syncTheme=()=>{
            if(!overlay)return;
            const invertedColors=document.body.classList.contains("dark-mode");
            calculator3D?.updateSettings?.({invertedColors});
            calculator2D?.updateSettings?.({invertedColors});
        };
        syncTheme();
        // The site's theme button lives outside this dialog. Keyboard
        // navigation can still reach it, so keep the independent Desmos
        // calculators synchronized even when the theme changes mid-dialog.
        if(typeof MutationObserver!=="undefined"){
            themeObserver=new MutationObserver(syncTheme);
            themeObserver.observe(document.body,{
                attributes:true,attributeFilter:["class"]
            });
        }
        render();
        $("v12-special-close").focus?.();
    }
    document.addEventListener("click",event=>{
        if(event.target.closest?.("#clebsch-special-cases-open")){
            event.preventDefault?.();
            open();
        }
    });
    document.addEventListener("keydown",event=>{
        if(event.key==="Escape"&&overlay)close();
    });
    window.v12SpecialCases={open,close,choose,render,
        current:()=>current(),state};
})();