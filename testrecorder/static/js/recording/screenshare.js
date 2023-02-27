var sharebtn= document.querySelector("#screen-share");
var screenReco =document.getElementById("screen_recording")
//var cameraCheckbox = document.getElementById('webcam-recording')
var recbtn= document.querySelector("#record");
var stopbtn= document.querySelector("#stop");
const videoElement = document.getElementById('video');
var downloadlink = document.querySelector("#downloadlink");
var error = document.querySelector('#error').innerHTML;

let screenAudioConstraintss = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
  },
  video: false
};

// Custom function

sharebtn.onclick= shareScreen;
recbtn.onclick= onBtnrecordClick;
stopbtn.onclick= onBtnStopClick;

// Custom Variables 
var mediaRecorder;
var localStream = null;
error="Welcome Sharing Portal ";

//Options from Users 
// Voice enable/Disable 
var microphoen_btn = null;
async function micphone_status(){
  microphoen_btn= document.getElementById("audio-settings");
  if (microphoen_btn.checked == true) {
    return microphoen_btn = true;
  } else {
   return microphoen_btn = false;
  }
  //console.log("microphoen btn value" , microphoen_btn);
}

// Gets computer/capture screen stream 
async function computerscreen(){
    if(computerScreen_btn == true){
    mediaConstraints = {
      video: {
        cursor: 'always',
        resizeMode: 'crop-and-scale'
      },
      //audio: true
      } 
    try { // phly screen stream ko global null kiya
      const screenStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints)
      return screenStream
    }
    catch (err) {
      let msg = "STATUS: Error while getting screen stream."
      document.getElementById("error").innerHTML = msg;
    }
  }
  }

  // Share Computer Screen and Audio stream 
 async function shareScreen() {
    console.log("share Screen");
    document.getElementById("error").innerHTML=" Click Start For Screen Share";
    let recordAudio = await micphone_status();
    //screenStream = await computerscreen();
    //let computscreen = await computerScreen_status();
    // Check if we need to add audio stream
    //let recordAudio = voice;   
    let stream = null;
    if (recordAudio == true) {
      audioStream = await captureMediaDevices(screenAudioConstraintss);
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

        console.log('Tracks to add to stream 102', tracks);
        stream = new MediaStream(tracks);
      } catch (error) {
        console.error("Error while creating merged audio streams: ", error)
        stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
      }

    }else {
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
