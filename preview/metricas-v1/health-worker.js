/* Ritmo Apple Saúde: importação em worker, sem bloquear a interface. */
'use strict';
// Carregar a biblioteca apenas após informar que o worker iniciou.
self.onmessage = async event => {
 const {file,period} = event.data;
 postMessage({kind:'progress',percent:0,stage:'Leitor iniciado. Preparando ZIP…'});
 const cutoff = period==='all'?'0000-00-00':(()=>{const d=new Date();d.setDate(d.getDate()-Number(period));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})();
 const today=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})();
 const workouts=[],hr=new Map();let records=0,scanned=0,bytes=0,seen=false,doneXml=false;
 const decoder=new TextDecoder();let buf='',lastProgress=0;
 const attr=(tag,key)=>{const m=tag.match(new RegExp('(?:^|\\s)'+key+'="([^"]*)"'));return m?m[1]:null;};
 const ms=s=>{const m=String(s).match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([+-]\d\d)(\d\d)$/);return m?Date.parse(m[1]+'T'+m[2]+m[3]+':'+m[4]):Date.parse(s);};
 function consumeRecord(tag) {
  if(!tag.includes('HKQuantityTypeIdentifierHeartRate')||attr(tag,'type')!=='HKQuantityTypeIdentifierHeartRate')return;
  const start=attr(tag,'startDate')||'',day=start.slice(0,10);
  if(day<cutoff||day>today)return;
  const bpm=Number(attr(tag,'value')),time=ms(start);
  if(!Number.isFinite(bpm)||bpm<30||bpm>250||!Number.isFinite(time))return;
  const arr=hr.get(day)||[];if(arr.length>=35000)return;
  arr.push([time,bpm]);hr.set(day,arr);records++;
 }
 function consumeWorkout(xml){
  scanned++;
  const tag=xml.slice(0,xml.indexOf('>')+1);
  const start=attr(tag,'startDate')||'',end=attr(tag,'endDate')||'',day=start.slice(0,10);
  if(day<cutoff||day>today||!/^\d{4}-\d\d-\d\d$/.test(day))return;
  const raw=attr(tag,'workoutActivityType')||'',source=attr(tag,'sourceName')||'';
  const duration=Number(attr(tag,'duration')||0),unit=attr(tag,'durationUnit')||'min';
  const minutes=unit==='sec'?duration/60:unit==='hr'?duration*60:duration;
  if(!Number.isFinite(minutes)||minutes<=0)return;
  const stat=(suffix)=>{const regex=/<WorkoutStatistics\b[^>]*\/?>/g;for(const m of xml.matchAll(regex)){const t=m[0];if((attr(t,'type')||'').endsWith(suffix))return t;}return null;};
  const sum=t=>t?Number(attr(t,'sum')??attr(t,'value')):null;
  const energy=stat('ActiveEnergyBurned'),distance=stat('DistanceWalkingRunning')||stat('DistanceCycling')||stat('DistanceSwimming')||stat('Distance');
  let kcal=sum(energy),km=sum(distance);
  if(kcal!==null&&!Number.isFinite(kcal))kcal=null;
  if(kcal!==null&&(attr(energy,'unit')||'').toLowerCase()==='kj')kcal/=4.184;
  if(km!==null&&!Number.isFinite(km))km=null;
  if(km!==null){const u=attr(distance,'unit')||'km';if(u==='m')km/=1000;if(u==='mi')km*=1.609344;}
  const names={Running:'Corrida',Walking:'Caminhada',Cycling:'Ciclismo',TraditionalStrengthTraining:'Musculação',FunctionalStrengthTraining:'Treino funcional',Swimming:'Natação',HighIntensityIntervalTraining:'HIIT',CrossTraining:'CrossFit',Elliptical:'Elíptico',Rowing:'Remo',Yoga:'Yoga',Other:'Outro'};
  const code=raw.replace(/^HKWorkoutActivityType/,'');
  workouts.push({type:names[code]||code||'Outro',day,minutes:Math.round(minutes*10)/10,distance_km:km===null?null:Math.round(km*100)/100,active_kcal:kcal===null?null:Math.round(kcal),hr_avg:null,hr_max:null,source:'Apple Saúde',import_key:[start,end,raw,source].join('|'),start,end});
 }
 function parseChunk(bytes,final=false){
  buf+=decoder.decode(bytes,{stream:!final});
  while(true){
   const r=buf.indexOf('<Record '),w=buf.indexOf('<Workout ');
   const pos=r<0?w:w<0?r:Math.min(r,w);
   if(pos<0){buf=buf.slice(-40);break;}
   if(pos>0)buf=buf.slice(pos);
   if(buf.startsWith('<Record ')){
    const close=buf.indexOf('>');if(close<0){if(buf.length>100000)throw Error('Registro XML inválido');break;}
    const tag=buf.slice(0,close+1);consumeRecord(tag);buf=buf.slice(close+1);
   }else{
    const close=buf.indexOf('</Workout>');if(close<0){if(buf.length>4*1024*1024)throw Error('Treino XML excessivamente grande');break;}
    consumeWorkout(buf.slice(0,close+10));buf=buf.slice(close+10);
   }
  }
 }
 function progress(force=false){if(force||bytes-lastProgress>512*1024){lastProgress=bytes;postMessage({kind:'progress',stage:'Analisando histórico…',percent:Math.min(99,Math.round(bytes/file.size*100)),scanned,records});}}
 try {
  if(file.name.toLowerCase().endsWith('.zip')){
   postMessage({kind:'progress',percent:0,stage:'Carregando descompactador…'});
   if(!self.fflate)importScripts('https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js');
   postMessage({kind:'progress',percent:0,stage:'Lendo arquivo compactado…'});
   await new Promise(async(resolve,reject)=>{
    let completed=false,reader;
    const fail=e=>{if(!completed){completed=true;reject(e);}};
    const unzip=new fflate.Unzip(entry=>{
     if(!/(^|\/)(export|exportar)\.xml$/i.test(entry.name)||seen){entry.ondata=()=>{};return;}
     seen=true;
     entry.ondata=(error,chunk,final)=>{if(error)return fail(error);try{parseChunk(chunk,final);if(final)doneXml=true;}catch(e){fail(e);}};
     entry.start();
    });
    unzip.register(fflate.UnzipInflate);
    try{
     reader=file.stream().getReader();
     while(!completed){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;
      progress();
      unzip.push(value,false);
      // Libera a fila de mensagens do worker entre blocos grandes.
      await new Promise(resolve=>setTimeout(resolve,0));
      if(completed)break;
     }
     if(!completed){unzip.push(new Uint8Array(0),true);if(!seen||!doneXml)throw Error('XML do Apple Saúde incompleto ou ausente');completed=true;resolve();}
    }catch(e){fail(e)}finally{reader?.releaseLock();}
   });
  }else if(file.name.toLowerCase().endsWith('.xml')){
   const reader=file.stream().getReader();try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;parseChunk(value);progress();}parseChunk(new Uint8Array(0),true);}finally{reader.releaseLock();}
  }else throw Error('Selecione ZIP ou XML.');
  postMessage({kind:'progress',stage:'Relacionando batimentos aos treinos…',percent:99,scanned,records});
  for(const w of workouts){
   const t0=ms(w.start),t1=ms(w.end);let n=0,total=0,max=0;
   if(Number.isFinite(t0)&&Number.isFinite(t1)){
    const days=new Set([w.start.slice(0,10),w.end.slice(0,10)]);
    for(const day of days)for(const [t,bpm] of hr.get(day)||[]){if(t>=t0&&t<=t1){n++;total+=bpm;max=Math.max(max,bpm);}}
   }
   if(n){w.hr_avg=Math.round(total/n);w.hr_max=Math.round(max);}
   delete w.start;delete w.end;
  }
  postMessage({kind:'done',workouts,scanned,records});
 }catch(e){postMessage({kind:'error',message:String(e.message||e)});}
};
