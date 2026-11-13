const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{const dir=process.argv[2],outp=process.argv[3],FPS=30,N=45*FPS;
const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium',outp],{stdio:['pipe','inherit','inherit']});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:540,height:960},deviceScaleFactor:2});
await p.goto('file://'+dir+'/index.html');await p.waitForTimeout(500);
for(let f=0;f<N;f++){await p.evaluate(t=>render(t),f/FPS);const buf=await p.screenshot({type:'jpeg',quality:92});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();await b.close();await new Promise(r=>ff.on('close',r));console.log('done');})();
