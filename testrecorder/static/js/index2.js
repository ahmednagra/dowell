
var sharebtn= document.querySelector("#screen-share");
var recbtn= document.querySelector("#record");
var stopbtn= document.querySelector("#stop");
const videoElement = document.getElementById('video');
var downloadlink = document.querySelector("#downloadlink");
//var mic = document.querySelector('#audio-settings');
// for mic constrainits
/* let screenAudioConstraints = {
  audio: true
}; */ 
//let screenStream = null;
// Custom function

sharebtn.onclick= shareScreen;
recbtn.onclick= onBtnrecordClick;
stopbtn.onclick= onBtnStopClick;
//let audioStream = null;

// Custom Variables 
var mediaRecorder;
var localStream = null;
document.getElementById("error").innerHTML="ffff";

//define all functions 
 var micbtn = null;
async function mic_setting(){
   micbtn= document.getElementById("audio-settings");
  if (micbtn.checked == true) {
    return micbtn = true;
  } else {
   return micbtn = false;
  }
  console.log("micbtn value" , micbtn);
}

// Gets computer/capture screen stream recording stream
async function computerscreen(mediaConstraints = {
  video: {
    cursor: 'always',
    resizeMode: 'crop-and-scale'
  },
  //audio: true
}) {
  try { // phly screen stream ko global null kiya
    const screenStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints)
    return screenStream
  }
  catch (err) {
    let msg = "STATUS: Error while getting screen stream."
    document.getElementById("error").innerHTML = msg;
  }
}


// Share Screen Function 
 async function shareScreen() {
    console.log("shareS creen");
    document.getElementById("error").innerHTML="";
   /* var screenConstraints = {
        video:true,
        //audio:true,
    }  // knsa media diplay krna hia 
    var micstream= navigator.mediaDevices.getDisplayMedia(screenConstraints).then(function(screenStream){
        // mic ko enablekiya hai
        var micConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          },
        };
        // mic ko share kiya .then k baad promises use kiya hai
        navigator.mediaDevices.getUserMedia(micConstraints).then(function(micStream){
            // ab is k sath vido screen share ko attach kiya hai 
            var composedSrtream = new MediaStream();
            //add screen aur phir screen video mein convert ho gi
            screenStream.getVideoTracks().forEach(function(videoTrack){
                composedSrtream.addTrack(videoTrack);
            })

            //Create New Audio
            recordAudio = mic.unchecked;
            //stream = null;
            if (recordAudio == true) {
                var context= new AudioContext();
                var audioDestinationNode= context.createMediaStreamDestination();

              // at lenght 0 mean no voice
              if (screenStream && screenStream.getAudioTracks().length>0){
                      const systemSource = context.createMediaStreamSource(screenStream);
                      const systemGain = context.createGain(); // sytem audio ko intract krta hai createGain
                          systemGain.gain.value = 1;
                          //audio ko connect kiya video k sath aur jo audio thi usko mice se jo voice aa rahi hai us se 
                          systemSource.connect(systemGain).connect(audioDestinationNode)
              }
              if(micStream && micStream.getAudioTracks().length > 0 ){
                  const micSource = context.createMediaStreamSource(micStream);
                  const micGain= context.createGain();
                  micGain.gain.value = 1;
                  micSource.connect(micGain).connect(audioDestinationNode);
              }

              audioDestinationNode.stream.getAudioTracks().forEach(function(audioTrack){
                  composedSrtream.addTrack(audioTrack);
                   
              })

              onCombineAvailable(composedSrtream);
              console.log("onCombineAvailable 79 voice" , onCombineAvailable) 
            } else{
              composedSrtream
                    onCombineAvailable(composedSrtream);   
                    console.log("onCombineAvailable 82 no voice" , onCombineAvailable)   
            }  
           

            // error mic ka 
        }).catch(function(error){
            console.error(error);
        document.getElementById("error").innerHTML="Attach Microphone";
        })

        // is k sath he hum error ko catch kr k console pe print krwA LAY GAY
    }).catch(function(error){
        console.log(error);
    document.getElementById("error").innerHTML="Must Share Screen";
    })
 */ 
    voice = await mic_setting();
    screenStream = await computerscreen();
    // Check if we need to add audio stream
    let recordAudio = voice;
    let stream = null;
    if (recordAudio == true) {
      audioStream = await captureMediaDevices(screenAudioConstraints);
      //stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
      try {
        const mergeAudioStreams = (desktopStream, voiceStream) => {
          const context = new AudioContext();
          // Create a couple of sources
          const source1 = context.createMediaStreamSource(desktopStream);
          const source2 = context.createMediaStreamSource(voiceStream);
          const destination = context.createMediaStreamDestination();
          const desktopGain = context.createGain();
          const voiceGain = context.createGain();

          desktopGain.gain.value = 0.7;
          voiceGain.gain.value = 0.7;
          // source 1 computer screen hai
          source1.connect(desktopGain).connect(destination);
          // Connect source2 voice hai
          source2.connect(voiceGain).connect(destination);
          return destination.stream.getAudioTracks();
        };

        //stream = mergeAudioStreams;
        //stream = new MediaStream([...mergeAudioStreams.getTracks()]);
        const tracks = [
          ...screenStream.getVideoTracks(),
          ...mergeAudioStreams(screenStream, audioStream)
        ];

        console.log('Tracks to add to stream 167', tracks);
        stream = new MediaStream(tracks);
      } catch (error) {
        console.error("Error while creating merged audio streams: ", error)
        stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
      }

    } else {
      stream = new MediaStream([...screenStream.getTracks()]);
      //stream = new MediaStream([...screenStream.getVideoTracks()]);
    }
    onCombineAvailable(stream);

 }


 function onCombineAvailable(stream){
    console.log("onCombineAvailable 179");
    localStream = stream;
    videoElement.srcObject = localStream;
    videoElement.play();
    videoElement.muted = true // mean k jo bol raha ho wo speaker mein na sunnai day
    sharebtn.disabled = true;
    recbtn.disabled = false;
    stopbtn.disabled = false;

 }
// onBtnrecordClick Function 
function onBtnrecordClick() {
    console.log("onBtnrecordClick");
    if (localStream !=null){
        mediaRecorder = new MediaRecorder(localStream);
        mediaRecorder.onstop = function(){
            console.log("Meida Recorder Stop");
            var blob = new Blob (chunks , {    // chunks kisi b file ko save krny k liya use hota hai
                type: "video/webm"  // isky bad semocolon nai lagana wrna error aay ga
              })
              
            var videoUrl = window.URL.createObjectURL(blob);
            downloadlink.setAttribute("href",videoUrl);
            console.log("chunks array",chunks);

        }
         // chunks mein data add kiya jo k aaray
         // jb b recording start ho ge to uska aik data bny ga " ondatavailable"
        let chunks = [];
        mediaRecorder.ondataavailable = function(e){
            chunks.push (e.data);
        } 
        console.log("chunks let",chunks);
        //is k bad phir se media recoder ko start kr day
        mediaRecorder.start(2);
        recbtn.style.background = "red";
        //recbtn.color.background = "#fff";
        sharebtn.disabled = true;
        recbtn.disabled = true;
        stopbtn.disabled = false;
    
         
    }
 }

// onBtnStopClick Function  
 function onBtnStopClick() {
    // sb se phly media recorder ko stop
    mediaRecorder.stop();

    console.log(mediaRecorder.state);
    recbtn.style.background = ""
    recbtn.style.color = ""
    
    downloadlink.style.color = "#fff";
    console.log("After download link");
 }


/*
const video1 = document.getElementById('videocustom')
 let mediaConstraints = {
    video: {
      width: 1280,
      height: 720
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    }
  }

  //Screen stream
  async function captureMediaDevices() {
    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
    return stream
  }

   //Screen screen recording stream     147

  async function captureScreen() {
    const audioStream = await captureMediaDevices(stream)
    const stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()])

    mediaConstraints = {
      video: {
        cursor: 'always',
        resizeMode: 'crop-and-scale'
      }
    }
   try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints)
    return screenStream
  }
  catch (err) {
    let msg = "STATUS: Error while getting screen stream."
    document.getElementById("app-status").innerHTML = msg;
    alert("Error while getting screen stream!\n -Please share screen when requested.\n -Try to start the recording again.");
    // Tell user, stop the recording.
    resetStateOnError();
  }
}

  //Record the streams     172
let recorder = null
let stream = null
let blobUrl = null
async function recordStream() {
  const stream = await captureMediaDevices()
  recorder = new MediaRecorder(stream)
  let chunks = []
  recorder.ondataavailable = event => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  // Show that SCreen recording has stopped 204
  recorder.onstop = () => {
    const blob = new Blob(chunks, {
      type: 'video/webm;codecs=vp9'
    })
    chunks = []
    const blobUrl = URL.createObjectURL(blob)
    console.log(blobUrl)
   }
  recorder.start(200)
}

//Stop the recording

async function stopRecording() {
    recorder.stream.getTracks().forEach(track => track.stop())
   

// Merge Both Screens 383
const screenStream = await captureScreen()
mediaConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
  },
  video: false
}
}

//const audioStream = await captureMediaDevices(stream)
//const stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()])



video1.srcObject = stream //to preview the stream

video1.src = blobUrl // to preview the finished video



*/