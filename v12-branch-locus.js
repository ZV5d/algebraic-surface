/* v12: branch discriminant in an affine chart of the projective plane
   of directions. Uses the current cubic restriction callback unchanged. */
const v12BranchLocus=(()=>{
"use strict";
const zero=()=>new Float64Array(49),at=(i,j,v=1)=>{const p=zero();p[i*7+j]=v;return p;};
const add=(a,b,k=1)=>a.map((v,i)=>v+k*b[i]);
const scale=(a,k)=>a.map(v=>v*k);
const multiply=(a,b)=>{
 const c=zero();
 for(let i=0;i<=6;i++)for(let j=0;i+j<=6;j++){
  const v=a[i*7+j];if(!v)continue;
  for(let k=0;k+i<=6;k++)for(let l=0;i+j+k+l<=6;l++){
   const w=b[k*7+l];if(w)c[(i+k)*7+j+l]+=v*w;
  }
 }
 return c;
};
const square=a=>multiply(a,a),cube=a=>multiply(square(a),a);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const length=Math.hypot(...a);return length>1e-12?a.map(x=>x/length):null;};
function lineDirection(index){
 const [a,b]=clebschGeometry.linePlanePairs[index-1];
 return unit(cross(a.slice(0,3),b.slice(0,3)));
}
function frame(lines){
 const vectors=lines.map(lineDirection);let n=[0,0,1];
 if(vectors.length){
  let best=-Infinity;
  for(let flags=0;flags<2**(vectors.length-1);flags++){
   const candidate=unit(vectors.reduce((s,d,i)=>{
    const sign=i===0||(flags&(1<<(i-1)))?1:-1;
    return s.map((x,k)=>x+sign*d[k]);
   },[0,0,0]));
   if(!candidate)continue;
   const score=Math.min(...vectors.map(d=>Math.abs(dot(d,candidate))));
   if(score>best){best=score;n=candidate;}
  }
 }
 const ref=Math.abs(n[2])>.91?[0,1,0]:[0,0,1];
 const u=unit(cross(ref,n)),v=cross(n,u);
 return {n,u,v};
}
function coordinates(chart,d){
 const denominator=dot(chart.n,d);
 return Math.abs(denominator)<1e-8?null:{
  x:dot(chart.u,d)/denominator,y:dot(chart.v,d)/denominator
 };
}
const binomial=[[1],[0,1],[0,-.5,.5],[0,1/3,-.5,1/6]];
const choose=(n,k)=>{if(k>n||k<0)return 0;let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v;};
function restrictionPolys(p,chart,restriction){
 const values={};
 for(let i=0;i<=3;i++)for(let j=0;i+j<=3;j++){
  const d=chart.n.map((n,k)=>n+i*chart.u[k]+j*chart.v[k]);
  values[i+","+j]=restriction(p,d);
 }
 return [1,2,3].map(degree=>{
  const result=zero();
  for(let i=0;i<=degree;i++)for(let j=0;i+j<=degree;j++){
   let difference=0;
   for(let a=0;a<=i;a++)for(let b=0;b<=j;b++)
    difference+=((i+j-a-b)%2?-1:1)*choose(i,a)*choose(j,b)*values[a+","+b][degree];
   for(let r=0;r<binomial[i].length;r++)
    for(let s=0;s<binomial[j].length;s++)
     result[r*7+s]+=difference*binomial[i][r]*binomial[j][s];
  }
  const magnitude=Math.max(...result.map(Math.abs));
  for(let i=0;i<49;i++)if(Math.abs(result[i])<1e-12*Math.max(1,magnitude))result[i]=0;
  return result;
 });
}
function latex(poly){
 const magnitude=Math.max(...poly.map(Math.abs));if(magnitude<1e-25)return "0=0";
 const terms=[];
 for(let total=6;total>=0;total--)for(let i=total;i>=0;i--){
  const j=total-i,c=poly[7*i+j]/magnitude;
  if(Math.abs(c)<1e-11)continue;
  const coefficient=Number(Math.abs(c).toFixed(12));
  if(!coefficient)continue;
  const variables=(i?"x"+(i===1?"":"^{"+i+"}"):"")+(j?"y"+(j===1?"":"^{"+j+"}"):"");
  const term=(variables&&Math.abs(coefficient-1)<1e-12?"":coefficient)+variables;
  terms.push((terms.length?(c>=0?"+":"-"):(c>=0?"":"-"))+term);
 }
 return (terms.join("")||"0")+"=0";
}
function evaluate(poly,u,v){
 let result=0;
 for(let i=0;i<=6;i++)for(let j=0;i+j<=6;j++)result+=poly[7*i+j]*u**i*v**j;
 return result;
}
function gradient(poly,u,v){
 let du=0,dv=0;
 for(let i=0;i<=6;i++)for(let j=0;i+j<=6;j++){
  if(i)du+=i*poly[7*i+j]*u**(i-1)*v**j;
  if(j)dv+=j*poly[7*i+j]*u**i*v**(j-1);
 }
 return [du,dv];
}
function build(p,d,passingLines,restriction,onSurface){
 const chart=frame(passingLines);
 const [c1,c2,c3]=restrictionPolys(p,chart,restriction);
 const c0=restriction(p,chart.n)[0];
 const curve=onSurface
  ?add(square(c2),multiply(c1,c3),-4)
  :add(
   add(
    add(multiply(square(c1),square(c2)),cube(c2),-4*c0),
    multiply(cube(c1),c3),-4),
   add(scale(square(c3),-27*c0*c0),
       scale(multiply(multiply(c1,c2),c3),18*c0)));
 const nodes=onSurface?passingLines.map(line=>({
  line,point:coordinates(chart,lineDirection(line))
 })).filter(item=>item.point):[];
 return {chart,degree:onSurface?4:6,curve,latex:latex(curve),nodes,
  image:coordinates(chart,d),c0,coefficients:[c1,c2,c3]};
}
/* For an exterior projection write the line cubic in homogeneous line
   coordinates as c0*s^3+c1*s^2+c2*s+c3, with c0=F(P) nonzero.
   Its depressed-cubic invariants are:
   U=c1^2-3c0*c2 (a conic of directions) and
   T=2c1^3-9c0*c1*c2+27c0^2*c3 (a cubic).
   The branch discriminant is (4U^3-T^2)/(27c0^2).
   Their six projective intersections are ordinary cusps for generic P.
   Desmos plots only real points. Never fabricate the nonreal four. */
function exteriorCuspGeometry(branch){
 if(branch.degree!==6||Math.abs(branch.c0)<1e-9)return null;
 const [c1,c2,c3]=branch.coefficients,c0=branch.c0;
 const conic=add(square(c1),c2,-3*c0);
 const cubic=add(
  add(scale(cube(c1),2),multiply(c1,c2),-9*c0),
  c3,27*c0*c0
 );
 const norm=p=>Math.max(1e-30,...p.map(Math.abs));
 const U=scale(conic,1/norm(conic)),T=scale(cubic,1/norm(cubic));
 const roots=[];
 const find=(a,b)=>{
  let x=a,y=b;
  for(let i=0;i<36;i++){
   const u=evaluate(U,x,y),t=evaluate(T,x,y);
   if(Math.max(Math.abs(u),Math.abs(t))<1e-9)break;
   const [ux,uy]=gradient(U,x,y),[tx,ty]=gradient(T,x,y);
   const determinant=ux*ty-uy*tx;
   if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-12)return;
   let dx=(u*ty-uy*t)/determinant;
   let dy=(ux*t-u*tx)/determinant;
   const step=Math.max(1,Math.hypot(dx,dy)/2);
   dx/=step;dy/=step;
   x-=dx;y-=dy;
   if(!Number.isFinite(x+y)||Math.max(Math.abs(x),Math.abs(y))>120)return;
  }
  if(Math.max(Math.abs(evaluate(U,x,y)),Math.abs(evaluate(T,x,y)))>2e-7)return;
  if(roots.some(point=>Math.hypot(point.x-x,point.y-y)<1e-5))return;
  roots.push({x,y});
 };
 // Multiple starting grids also catch real cusps outside the inset viewport.
 for(const span of [2,5,12]){
  for(let i=-10;i<=10;i++)for(let j=-10;j<=10;j++)
   find(span*i/10,span*j/10);
 }
 roots.sort((a,b)=>a.x-b.x||a.y-b.y);
 return {
  conic,conicLatex:latex(conic),cubic,
  realCusps:roots,complexCuspCount:6
 };
}
return Object.freeze({build,lineDirection,coordinates,evaluate,gradient,exteriorCuspGeometry});
})();
