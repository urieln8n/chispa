// Cielo con estrellas que titilan (para los fondos del directo)
(function(){const c=document.querySelector('canvas.estrellas');if(!c)return;c.width=1920;c.height=1080;const x=c.getContext('2d');let s=11;const r=()=>(s=(s*16807)%2147483647)/2147483647;
const E=Array.from({length:220},()=>({x:r()*1920,y:r()*1080,t:r()*2.4+.4,f:r()*6.28,v:.5+r()*1.5}));
(function pinta(ms){x.clearRect(0,0,1920,1080);for(const e of E){x.fillStyle=`rgba(244,241,234,${.15+.45*(.5+.5*Math.sin(e.f+ms/1000*e.v))})`;x.beginPath();x.arc(e.x,e.y,e.t,0,7);x.fill();}requestAnimationFrame(pinta);})(0);})();
