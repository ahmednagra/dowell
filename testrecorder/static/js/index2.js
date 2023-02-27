
var sharebtn= document.querySelector("#screen-share");
var screenReco =document.getElementById("screen_recording")
var webcam = document.getElementById('webcam-recording')
var recbtn= document.querySelector("#record");
var stopbtn= document.querySelector("#stop");
const videoElement = document.getElementById('video');
var downloadlink = document.querySelector("#downloadlink");
var error = document.querySelector('#error').innerHTML;

//let screenStream = null;
// Custom function

sharebtn.onclick= shareScreen;
recbtn.onclick= onBtnrecordClick;
stopbtn.onclick= onBtnStopClick;
//let audioStream = null;

// Custom Variables 
var mediaRecorder;
var localStream = null;
error="Welcome Sharing Portal ";

//Options from Users 
// Voice enable/Disable 
async function micphoneStatus(screenAudioConstraints, screenStream){
 
  return stream;
}
//Webcam Enable/disable
var webcam_status_btn = null;
async function webcam_status(){
  webcam_status_btn= webcam;
  if (webcam_status_btn.checked == true) {
    return webcam_status_btn = true;
  } else {
   return webcam_status_btn = false;
  }
  //console.log("microphoen btn value" , microphoen_btn);
}
// Computer Screen 
var computerScreen_btn = null;
async function computerScreen_status(){
  computerScreen_btn= screenReco;
  if (computerScreen_btn == true){
    return computerScreen_btn = true;
  } else {
    return computerScreen_btn=false;
  }
}


// Gets computer/capture screen stream 
async function computerscreen(mediaConstraints = {
  video: {
    cursor: 'always',
    resizeMode: 'crop-and-scale'
  },
  //audio: true
}) {

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

// Gets webcam/camera stream
async function captureMediaDevices(currentMediaConstraints) {
  if (webcam_status_btn == true){
      try {
        const stream = await navigator.mediaDevices.getUserMedia(currentMediaConstraints)
        video.src = null
        video.srcObject = stream
        video.muted = true
        return stream
      }
        catch (err) {
          let msg = "STATUS: Error while getting webcam stream."
          document.getElementById("error").innerHTML = msg;
          // Reset app status
        }
      }
}


// Records webcam and audio
async function recordStream() {
  webCamStream = await captureMediaDevices(webcamMediaConstraints);
 console.log("Computer Webcamer", webCamStream);

  video.src = null
  video.srcObject = webCamStream
  video.muted = true

  webcamRecorder = new MediaRecorder(webCamStream, options);

  webcamRecorder.ondataavailable = event => {
    if (recordinginProgress == true) {
      if ((event.data.size > 0) && (recordingSynched == true) && (streamWebcamToYT == true)) {
        appWebsocket.send(event.data);
        console.log("webcamRecorder screen data to webcam websocket120", webcamRecorder);
      } else if ((event.data.size > 0) && (recordingSynched == true) && (streamScreenToYT == false)) {
        console.log("webcamRecorder screen data to webcam websocket122", webcamRecorder);
        let recordWebcam = webcam_status_btn;
        let recordScreen = computerScreen_btn;
        if ((recordScreen == true) && (recordWebcam == true)) {
          webcamWebSocket.send(event.data);

        }
      }
    }
  }

  webcamRecorder.onstop = () => {
    // Show that webcam recording has stopped
    msg = "STATUS: Webcam Recording stopped."
    document.getElementById("error").innerHTML = msg;
  }

  //webcamRecorder.start(200)
}

// Records merged Computer screen and webcam stream
async function recordMergedStream() {
  try {
    var merger = new VideoStreamMerger();

    // Set width and height of merger
    let screenWidth = screen.width;
    let screenHeight = screen.height;
    merger.setOutputSize(screenWidth, screenHeight);

    // Check if we need to add audio stream
    //voice = await micphone_status();
    //let recordAudio = voice;
//    let muteState = !recordAudio;
    //console.log("muteState 102: ",recordAudio)
    //if (recordAudio == true){
    // Add the screen capture. Position it to fill the whole stream (the default)
    merger.addStream(screenStream, {
      x: 0, // position of the topleft corner
      y: 0,
      width: merger.width,
      height: merger.height,
      //mute: true // we don't want sound from the screen (if there is any)
      //mute: false // we want sound from the screen (if there is any)
      //mute: muteState // user preference on sound from the screen (if there is any)
    })

    // Calculate dynamic webcam stream height and width
    let webcamStreamWidth = Math.floor(0.15 * screenWidth);
    //console.log("webcamStreamWidth: " + webcamStreamWidth);
    let webcamStreamHeight = Math.floor((webcamStreamWidth * screenHeight) / screenWidth);
    //console.log("webcamStreamHeight: " + webcamStreamHeight);

    // Add the webcam stream. Position it on the bottom left and resize it to 0.15 of screen width.
    merger.addStream(webCamStream, {
      x: 0,
      y: merger.height - webcamStreamHeight,
      width: webcamStreamWidth,
      height: webcamStreamHeight,
      //mute: false
    })

    // Start the merging. Calling this makes the result available to us
    merger.start()

    // We now have a merged MediaStream!
    const mergedStream = merger.result
    mergedStreamRecorder = new MediaRecorder(mergedStream, options);

    mergedStreamRecorder.ondataavailable = event => {
      if (recordinginProgress == true) {
        if ((event.data.size > 0) && (recordingSynched == true) && (streamMergedToYT == true)) {
          //mergedStreamChunks.push(event.data);
          appWebsocket.send(event.data);
        }
      }
    }

    webcamRecorder.onstop = () => {

      // @ Muhammad Ahmed for local path downloaf testing 
      const blob = new Blob(chunks, {
        type: 'video/webm;codecs=vp9'
      })
      chunks = []
      const blobUrl = URL.createObjectURL(blob)
      console.log(" web and voice stream link ", blobUrl)
      
    // old code below

      // Show that webcam recording has stopped
      msg = "STATUS: Merged Stream Recording stopped."
      document.getElementById("Error").innerHTML = msg;
    }

    //mergedStreamRecorder.start(200);
  }
  catch (err) {
    let msg = "STATUS: Error while recording merged stream stream."
    document.getElementById("app-status").innerHTML = msg;
    alert("Error while recording merged stream stream.");
    console.log("Error while recording merged stream stream: " + err.message);

    // Reset app status
    //resetStateOnError();
  }
}

// web + computer screen + voice stream 

// Share Computer Screen and Audio stream 
 async function shareScreen() {
  
    let screenAudioConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      },
      video: false
    };
    console.log("share Screen");
    screenStream = await computerscreen();
    console.log("screenStream 239", screenStream);
    let microphone = document.getElementById("audio-settings"); 
    
    let stream = null;
    console.log("stream 240",stream);
    stream = new MediaStream([...screenStream.getTracks()]);
    if (microphone.checked == true ) {
      audioStream = await captureMediaDevices(screenAudioConstraints);
      console.log("audioStream 243",audioStream);
      try {
        const mergeAudioStreams = (desktopStream, voiceStream) => {
          const context = new AudioContext();
          console.log("desktopStream",desktopStream)
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
        const tracks = [
          ...screenStream.getVideoTracks(),
          ...mergeAudioStreams(screenStream, audioStream)
        ];
        console.log('Tracks to add to stream 167', tracks);
        stream = new MediaStream(tracks);
      } catch (error) {
        console.error("Error while creating merged audio streams: ", error)
      }
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
const video1 = document.getElementById('vidsssssssseocustom')
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