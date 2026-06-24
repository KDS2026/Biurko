/* ============================================================
   notation.js — wspolny silnik zapisu nutowego (klucz basowy)
   Uzywany przez midi.html oraz audio.html.
   Eksportuje globalnie: diatonic, NOTE_VALUES, quantizeDur,
   buildScore, renderScore, noteName.
   ============================================================ */
(function (global) {
  'use strict';

  /* --- TEORIA: MIDI -> pozycja na pieciolinii --- */
  // wartosc diatoniczna: oktawa*7 + indeks litery (C=0..B=6)
  const PC = [ // [litera 0..6, czy krzyzyk]
    [0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]
  ];
  function diatonic(midi){
    const oct = Math.floor(midi/12)-1;          // MIDI 60 = C4
    const [letter, sharp] = PC[midi%12];
    return {dv: oct*7 + letter, sharp};
  }
  // linie klucza basowego (od dolu): G2,B2,D3,F3,A3 -> dv 18,20,22,24,26
  const DV_MID = 22, DV_TOP = 26, DV_BOT = 18;   // srodkowa linia = D3

  function noteName(m){
    const N=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
    return N[m%12]+(Math.floor(m/12)-1);
  }

  /* --- WARTOSCI RYTMICZNE / KWANTYZACJA --- */
  const NOTE_VALUES = [
    {q:4,   type:'whole',  dot:false},
    {q:3,   type:'half',   dot:true},
    {q:2,   type:'half',   dot:false},
    {q:1.5, type:'quarter',dot:true},
    {q:1,   type:'quarter',dot:false},
    {q:0.75,type:'eighth', dot:true},
    {q:0.5, type:'eighth', dot:false},
    {q:0.25,type:'16th',   dot:false},
  ];
  function quantizeDur(q){
    let best=NOTE_VALUES[NOTE_VALUES.length-1], bd=Infinity;
    for(const v of NOTE_VALUES){ const d=Math.abs(v.q-q); if(d<bd){bd=d;best=v;} }
    return best;
  }

  /* --- BUDOWA ZAPISU: akordy, pauzy ---
     notes: [{midi, start, dur}] w tickach; division = ticki / cwiercnuta */
  function buildScore(notes, division){
    const qOf = t => t/division;                 // ticki -> cwiercnuty
    const grid = division/4;                     // szesnastka
    const snap = t => Math.round(t/grid)*grid;

    const groups = new Map();
    for(const n of notes){
      const s = snap(n.start);
      (groups.get(s) || groups.set(s,[]).get(s)).push(n);
    }
    const starts = [...groups.keys()].sort((a,b)=>a-b);

    const elements = [];
    let cursor = 0;
    for(const s of starts){
      const chord = groups.get(s);
      if(s - cursor >= grid){
        const rv = quantizeDur(qOf(s-cursor));
        elements.push({rest:true, ...rv});
      }
      const durs = chord.map(n=>n.dur).sort((a,b)=>a-b);
      const med = durs[Math.floor(durs.length/2)];
      const rv = quantizeDur(qOf(med));
      const midis = [...new Set(chord.map(n=>n.midi))].sort((a,b)=>a-b);
      elements.push({rest:false, midis, ...rv});
      cursor = s + med;
    }
    return elements;
  }

  /* --- RENDERER SVG: pieciolinia w kluczu basowym --- */
  const SVGNS='http://www.w3.org/2000/svg';
  function el(name,attrs){const e=document.createElementNS(SVGNS,name);for(const k in attrs)e.setAttribute(k,attrs[k]);return e;}

  function renderScore(elements, meta){
    const S=11, halfS=S/2, stemLen=3.4*S;
    const innerW=1080, marginL=14, marginR=14, clefW=58;
    const sysGap=7.2*S, topPad=4*S, botPad=3*S;
    const measureBeats = meta.beats*(4/meta.beatval);

    const minElW=44;
    const systems=[]; let cur=[]; let x=marginL+clefW; let beatPos=0;
    for(const e of elements){
      const w = minElW + (e.dot?8:0) + (!e.rest && needsAcc(e.midis)?12:0);
      if(x + w > innerW - marginR){ systems.push(cur); cur=[]; x=marginL+clefW; }
      if(beatPos >= measureBeats-1e-6){ if(cur.length) cur[cur.length-1].bar=true; beatPos-=measureBeats; }
      cur.push({e, x, w});
      x += w; beatPos += e.q;
    }
    if(cur.length) systems.push(cur);

    const totalH = topPad + systems.length*sysGap + botPad;
    const svg = el('svg',{viewBox:`0 0 ${innerW} ${totalH}`, width:innerW, role:'img','aria-label':'Zapis nutowy'});
    svg.style.fontFamily="'Inter',sans-serif";

    systems.forEach((sys,si)=>{
      const y0 = topPad + si*sysGap;
      const lineY = i => y0 + i*S;
      for(let i=0;i<5;i++) svg.appendChild(el('line',{x1:marginL,y1:lineY(i),x2:innerW-marginR,y2:lineY(i),stroke:'#333','stroke-width':1}));
      drawBassClef(svg, marginL+10, y0, S);
      if(si===0){
        const tx=marginL+clefW-16;
        const t1=el('text',{x:tx,y:y0+1.45*S,'font-size':1.9*S,'font-weight':600,'text-anchor':'middle',fill:'#222'});t1.textContent=meta.beats;svg.appendChild(t1);
        const t2=el('text',{x:tx,y:y0+3.4*S,'font-size':1.9*S,'font-weight':600,'text-anchor':'middle',fill:'#222'});t2.textContent=meta.beatval;svg.appendChild(t2);
      }
      for(const it of sys){
        const cx = it.x + it.w/2;
        if(it.e.rest) drawRest(svg, cx, y0, S, it.e);
        else drawChord(svg, cx, y0, S, it.e, stemLen);
        if(it.bar) svg.appendChild(el('line',{x1:it.x+it.w,y1:y0,x2:it.x+it.w,y2:lineY(4),stroke:'#333','stroke-width':1.4}));
      }
      const lastX = innerW-marginR;
      svg.appendChild(el('line',{x1:lastX-3,y1:y0,x2:lastX-3,y2:lineY(4),stroke:'#333','stroke-width':1.4}));
      svg.appendChild(el('line',{x1:lastX,y1:y0,x2:lastX,y2:lineY(4),stroke:'#333','stroke-width':3}));
    });
    return svg;

    function yForDv(dv, y0){ return (y0+2*S) - (dv-DV_MID)*halfS; }
    function needsAcc(midis){ return midis.some(m=>diatonic(m).sharp); }

    function drawChord(svg, cx, y0, S, e, stemLen){
      const heads = e.midis.map(m=>{const d=diatonic(m);return {midi:m, dv:d.dv, sharp:d.sharp, y:yForDv(d.dv,y0)};});
      heads.sort((a,b)=>a.dv-b.dv);
      const rx=0.72*S, ry=0.54*S;
      const avg = heads.reduce((s,h)=>s+h.dv,0)/heads.length;
      const stemUp = avg < DV_MID;
      const filled = (e.type!=='whole' && e.type!=='half');
      for(const h of heads){
        drawLedgers(svg, cx, h.dv, y0, S, rx);
        svg.appendChild(el('ellipse',{cx:cx,cy:h.y,rx:rx,ry:ry,transform:`rotate(-18 ${cx} ${h.y})`,
          fill: filled?'#1a1a2e':'#fff', stroke:'#1a1a2e','stroke-width':1.4}));
        if(h.sharp){const a=el('text',{x:cx-rx-7,y:h.y+0.55*S,'font-size':1.7*S,fill:'#1a1a2e','text-anchor':'middle'});a.textContent='♯';svg.appendChild(a);}
        if(e.dot) svg.appendChild(el('circle',{cx:cx+rx+5,cy:h.y-2,r:1.7,fill:'#1a1a2e'}));
      }
      if(e.type!=='whole'){
        const top=heads[heads.length-1].y, bot=heads[0].y;
        const sx = stemUp ? cx+rx-0.5 : cx-rx+0.5;
        const y1 = stemUp ? top : bot;
        const y2 = stemUp ? top-stemLen : bot+stemLen;
        svg.appendChild(el('line',{x1:sx,y1:y1,x2:sx,y2:y2,stroke:'#1a1a2e','stroke-width':1.6}));
        const flags = e.type==='eighth'?1 : e.type==='16th'?2 : 0;
        for(let f=0;f<flags;f++){
          const fy=y2 + (stemUp? f*0.9*S : -f*0.9*S);
          const dir=stemUp?1:-1;
          svg.appendChild(el('path',{d:`M${sx},${fy} q ${1.7*S},${dir*0.6*S} ${1.3*S},${dir*2.1*S}`,
            fill:'none',stroke:'#1a1a2e','stroke-width':2.4,'stroke-linecap':'round'}));
        }
      }
    }

    function drawLedgers(svg, cx, dv, y0, S, rx){
      const ext=rx+4;
      if(dv>DV_TOP){ for(let d=DV_TOP+2; d<=dv; d+=2){const y=yForDv(d,y0);svg.appendChild(el('line',{x1:cx-ext,y1:y,x2:cx+ext,y2:y,stroke:'#333','stroke-width':1.2}));} }
      if(dv<DV_BOT){ for(let d=DV_BOT-2; d>=dv; d-=2){const y=yForDv(d,y0);svg.appendChild(el('line',{x1:cx-ext,y1:y,x2:cx+ext,y2:y,stroke:'#333','stroke-width':1.2}));} }
    }

    function drawRest(svg, cx, y0, S, e){
      const yMid=y0+2*S;
      if(e.type==='whole'){ svg.appendChild(el('rect',{x:cx-0.7*S,y:y0+S,width:1.4*S,height:0.5*S,fill:'#1a1a2e'})); }
      else if(e.type==='half'){ svg.appendChild(el('rect',{x:cx-0.7*S,y:yMid-0.5*S,width:1.4*S,height:0.5*S,fill:'#1a1a2e'})); }
      else if(e.type==='quarter'){
        svg.appendChild(el('path',{d:`M${cx-0.4*S},${yMid-1.4*S} l ${0.9*S},${1.2*S} l ${-0.9*S},${1.1*S} q ${1.1*S},${0.5*S} ${0.5*S},${1.5*S} q ${0.2*S},${-1.0*S} ${-0.8*S},${-0.6*S} l ${0.8*S},${-1.0*S} z`,fill:'#1a1a2e'}));
      } else {
        svg.appendChild(el('path',{d:`M${cx-0.2*S},${yMid+1.3*S} l ${0.7*S},${-2.4*S}`,stroke:'#1a1a2e','stroke-width':1.6,fill:'none'}));
        svg.appendChild(el('circle',{cx:cx-0.2*S,cy:yMid-0.4*S,r:0.32*S,fill:'#1a1a2e'}));
        if(e.type==='16th') svg.appendChild(el('circle',{cx:cx-0.05*S,cy:yMid+0.4*S,r:0.32*S,fill:'#1a1a2e'}));
      }
      if(e.dot) svg.appendChild(el('circle',{cx:cx+S,cy:yMid,r:1.7,fill:'#1a1a2e'}));
    }

    function drawBassClef(svg, x, y0, S){
      const cy=y0+S, cx=x+0.7*S;
      svg.appendChild(el('circle',{cx:cx,cy:cy,r:0.55*S,fill:'#1a1a2e'}));
      const d=`M${cx},${cy} `+
        `C ${cx},${cy-1.1*S} ${cx+1.9*S},${cy-1.5*S} ${cx+1.7*S},${cy-0.1*S} `+
        `C ${cx+1.6*S},${cy+1.5*S} ${cx+0.1*S},${cy+2.6*S} ${cx-1.0*S},${cy+3.0*S}`;
      svg.appendChild(el('path',{d:d,fill:'none',stroke:'#1a1a2e','stroke-width':0.42*S,'stroke-linecap':'round'}));
      svg.appendChild(el('circle',{cx:cx+2.3*S,cy:cy-0.5*S,r:0.22*S,fill:'#1a1a2e'}));
      svg.appendChild(el('circle',{cx:cx+2.3*S,cy:cy+0.5*S,r:0.22*S,fill:'#1a1a2e'}));
    }
  }

  global.Notation = { diatonic, noteName, NOTE_VALUES, quantizeDur, buildScore, renderScore };
})(typeof window !== 'undefined' ? window : globalThis);
