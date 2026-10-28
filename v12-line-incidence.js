/* v12 incidence geometry. Immutable source: v10 linePlanePairs.
   No separate Schläfli catalog and no handwritten contact coordinates. */
const v12Incidence = (() => {
    "use strict";
    const lines=clebschGeometry.linePlanePairs;
    function projectiveIntersection(first,second) {
        const rows=[...first,...second].map(form=>{
            const scale=Math.max(...form.map(Math.abs));
            return form.map(x=>x/scale);
        });
        const a=rows.map(r=>r.slice()),pivots=[];
        let rank=0;
        for(let col=0;col<4&&rank<4;col++){
            let best=rank;
            for(let r=rank+1;r<4;r++)
                if(Math.abs(a[r][col])>Math.abs(a[best][col]))best=r;
            if(Math.abs(a[best][col])<1e-9)continue;
            [a[rank],a[best]]=[a[best],a[rank]];
            const pivot=a[rank][col];
            for(let k=col;k<4;k++)a[rank][k]/=pivot;
            for(let r=0;r<4;r++)if(r!==rank){
                const factor=a[r][col];
                for(let k=col;k<4;k++)a[r][k]-=factor*a[rank][k];
            }
            pivots.push(col);rank++;
        }
        if(rank!==3)return null;
        const free=[0,1,2,3].find(i=>!pivots.includes(i));
        const result=[0,0,0,0];
        result[free]=1;
        for(let k=2;k>=0;k--)result[pivots[k]]=-a[k][free];
        const size=Math.hypot(...result);
        const point=result.map(x=>x/size);
        if(rows.some(row=>Math.abs(
            row.reduce((acc,v,i)=>acc+v*point[i],0)
        )>1e-8))return null;
        return point;
    }
    function linesThrough(p) {
        const x=[p.x,p.y,p.z,1];
        return lines.flatMap((forms,i)=>
            forms.every(row=>Math.abs(
                row.reduce((a,v,j)=>a+v*x[j],0)
            )<1e-7*Math.hypot(...row))?[i+1]:[]
        );
    }
    const points=[];
    let incidentPairs=0,infinityPairs=0;
    for(let i=0;i<lines.length;i++){
        for(let j=i+1;j<lines.length;j++){
            const h=projectiveIntersection(lines[i],lines[j]);
            if(!h)continue;
            incidentPairs++;
            if(Math.abs(h[3])<1e-9){
                infinityPairs++;continue;
            }
            const p={x:h[0]/h[3],y:h[1]/h[3],z:h[2]/h[3]};
            if(!points.some(q=>Math.hypot(
                q.p.x-p.x,q.p.y-p.y,q.p.z-p.z
            )<1e-6))points.push({p});
        }
    }
    const classified=points.map(({p})=>({
        p,lines:linesThrough(p)
    }));
    if(classified.some(({lines})=>
        lines.length!==2&&lines.length!==3
    ))throw Error("Inconsistent Clebsch line incidence");
    const ordering=(a,b)=>{
        const aOnL16=a.lines.includes(1),bOnL16=b.lines.includes(1);
        if(aOnL16!==bOnL16)return aOnL16?-1:1;
        for(let k=0;k<3;k++){
            const diff=(a.lines[k]??99)-(b.lines[k]??99);
            if(diff)return diff;
        }
        return a.p.x-b.p.x;
    };
    const pair=classified.filter(item=>item.lines.length===2).sort(ordering);
    const triple=classified.filter(item=>item.lines.length===3).sort(ordering);
    // 27 lines: 135 intersecting line pairs, 3 Eckardt points at infinity
    // (each contributes 3 pairs), 105 affine double points, 7 affine triple.
    if(incidentPairs!==135 || infinityPairs!==9
        ||pair.length!==105 || triple.length!==7){
        throw Error("Unexpected Clebsch incidence: "+JSON.stringify({
            incidentPairs,infinityPairs,double:pair.length,triple:triple.length
        }));
    }
    return Object.freeze({
        pair:Object.freeze(pair),triple:Object.freeze(triple),
        linesThrough,
        stats:Object.freeze({incidentPairs,infinityPairs,
            double:pair.length,triple:triple.length})
    });
})();