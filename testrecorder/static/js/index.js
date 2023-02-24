// Some app controls
const video = document.getElementById('video')
const cameraCheckbox = document.getElementById('webcam-recording')
const screenCheckbox = document.getElementById('screen-recording')
//const keyLogCheckbox = document.getElementById('key-logging')
const audioCheckbox = document.getElementById('audio-settings')
const publicVideosCheckbox = document.getElementById('public-videos')
//const clickupTaskNotesCheckbox = document.getElementById('clickupTaskNotesCheckbox')
let btnViewRecords = document.getElementById('view_records');

// App global variables
let usernameValue = null;
let testNameValue = null;
let testDescriptionValue = null;
let screenRecorderChunks = [];
let webcamChunks = [];
let mergedStreamChunks = [];
let testRecordingData = null;
let screenRecorder = null;
let mergedStreamRecorder = null;
let webcamRecorder = null
let webCamStream = null;
let screenStream = null;
let audioStream = null;
let webcamMediaConstraints = {
  video: true, audio: true
};
let screenAudioConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
  },
  video: false
};
let recordingSynched = false;

let fileRandomString = "qwerty";

let appWebsocket = null;
let webcamWebSocket = null;
let screenWebSocket = null;
let streamWebcamToYT = false;
let streamScreenToYT = false;
let streamMergedToYT = false;
let newBroadcastID = null;
let newRtmpUrl = null;
let websocketReconnect = false;
let recordinginProgress = false;
let videoPrivacyStatus = "private";
let lastMsgRcvTime = 0;
let msgRcvdFlag = false;
let networkTimer = false;
let filesTimestamp = null;
let screenFileName = null;
let webcamFileName = null;
let taskIdWebSocket = null;
let receivedTaskID = [];
//let receivedTaskID = ["3703820","33k9h43","33k9h43D"];
let taskIDwasRreceived = false;
let faultyTaskID = null; // Bad clickup task or task id
let currentRadioButtonID = null;
let userPlaylists = null;
let userPlaylistSelection = null;
let channelTitle = null;
let todaysPlaylistId = null;
let tablePlaylists = [];
// channels global Variables
let userChannelSelection = null;
let tableChannels = [];
let selectTableChannel = [];
let defaultChannel = 'UX Live from uxlivinglab';
let currentChannelTitle = defaultChannel;
let showNotificationPermission = 'default';

// Initialize the playlist table
let playlistTable = $('#playlist-table').DataTable({
  data: tablePlaylists,
  columns: [
    { title: 'Playlists Titles' },
  ],
});
// Initialize the channel table
let ChannelsTable = $('#channels-table').DataTable({
  data: tableChannels,
  columns: [
    { title: 'Channels Titles' },
  ],
});


// Ojophilip
// Initialize the channel table
let selectChannelsTable = $('#select-channels-table').DataTable({
  data: selectTableChannel,
  info: false,
  paging: false,
  columns: [
    { title: '' },
  ],
});

// Show selenium IDE installation modal, if not disabled
let dontShowSeleniumIDEModalAgain = localStorage.getItem("dontShowSelIDEInstallAgain");
if (dontShowSeleniumIDEModalAgain != "true") {
  let seleniumIDEModal = new bootstrap.Modal(document.getElementById('seleniumIDEModal'));
  seleniumIDEModal.show();
}

// Generate random string for appending to file name
generateString(6).then((randomString) => {
  fileRandomString = randomString;
})

// Clickup error modal
let taskErrorModal = new bootstrap.Modal(document.getElementById('taskErrorOccurred'));

// user settings modal
let userSettingsModal = new bootstrap.Modal(document.getElementById('user-settings-modal'));

// Get task id from user modal
let getTaskIdFromUserModal = new bootstrap.Modal(document.getElementById('getTaskIdFromUserModal'));

// Fill user email settings if it exists
document.getElementById("userClickupEmail").value = localStorage.getItem("userClickupEmail");

// Gets webcam stream
async function captureMediaDevices(currentMediaConstraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(currentMediaConstraints)

    video.src = null
    video.srcObject = stream
    video.muted = true

    return stream
  }
  catch (err) {
    let msg = "STATUS: Error while getting webcam stream."
    document.getElementById("app-status").innerHTML = msg;
    // Reset app status
    await resetStateOnError();
    alert("Error while getting webcam stream!\n -Please give permission to webcam or mic when requested.\n -Try to start the recording again.");
  }
}

// Gets screen recording stream
async function captureScreen(mediaConstraints = {
  video: {
    cursor: 'always',
    resizeMode: 'crop-and-scale'
  },
  audio: true
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

// Records webcam and audio
async function recordStream() {
  webCamStream = await captureMediaDevices(webcamMediaConstraints);

  video.src = null
  video.srcObject = webCamStream
  video.muted = true

  let options = await getSupportedMediaType();

  if (options === null) {
    alert("None of the required codecs was found!\n - Please update your browser and try again.");
    document.location.reload();
  }

  webcamRecorder = new MediaRecorder(webCamStream, options);

  webcamRecorder.ondataavailable = event => {
    if (recordinginProgress == true) {
      if ((event.data.size > 0) && (recordingSynched == true) && (streamWebcamToYT == true)) {
        appWebsocket.send(event.data);
      } else if ((event.data.size > 0) && (recordingSynched == true) && (streamScreenToYT == false)) {
        //console.log("Sending screen data to webcam websocket");
        let recordWebcam = cameraCheckbox.checked;
        let recordScreen = screenCheckbox.checked;
        if ((recordScreen == true) && (recordWebcam == true)) {
          webcamWebSocket.send(event.data);
        }
      }
    }
  }

  webcamRecorder.onstop = () => {
    // Show that webcam recording has stopped
    msg = "STATUS: Webcam Recording stopped."
    document.getElementById("app-status").innerHTML = msg;
  }

  //webcamRecorder.start(200)
}

// Records merged screen and webcam stream
async function recordMergedStream() {
  try {
    var merger = new VideoStreamMerger();

    // Set width and height of merger
    let screenWidth = screen.width;
    let screenHeight = screen.height;
    merger.setOutputSize(screenWidth, screenHeight);

    // Check if we need to add audio stream
    let recordAudio = audioCheckbox.checked;
    let muteState = !recordAudio;
    //console.log("muteState: ",muteState)

    // Add the screen capture. Position it to fill the whole stream (the default)
    merger.addStream(screenStream, {
      x: 0, // position of the topleft corner
      y: 0,
      width: merger.width,
      height: merger.height,
      //mute: true // we don't want sound from the screen (if there is any)
      //mute: false // we want sound from the screen (if there is any)
      mute: muteState // user preference on sound from the screen (if there is any)
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
      mute: false
    })

    // Start the merging. Calling this makes the result available to us
    merger.start()

    // We now have a merged MediaStream!
    const mergedStream = merger.result
    let options = await getSupportedMediaType();

    if (options === null) {
      alert("None of the required codecs was found!\n - Please update your browser and try again.");
      document.location.reload();
    }

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
      // Show that webcam recording has stopped
      msg = "STATUS: Merged Stream Recording stopped."
      document.getElementById("app-status").innerHTML = msg;
    }

    //mergedStreamRecorder.start(200);
  }
  catch (err) {
    let msg = "STATUS: Error while recording merged stream stream."
    document.getElementById("app-status").innerHTML = msg;
    alert("Error while recording merged stream stream.");
    console.log("Error while recording merged stream stream: " + err.message);

    // Reset app status
    resetStateOnError();
  }
}


// Stops webcam and screen recording
async function stopRecording() {

  // Stop network timer
  try {
    clearInterval(networkTimer);
  } catch (error) {
    console.error("Error while stopping network timer!");
  }
  // Close the websocket and stop streaming
  await stopStreamin();

  // Transition the broadcast to complete state
  await endBroadcast();

  // Enable start recording button
  document.getElementById("start").disabled = false;

  // Enable view records button
  if (publicVideosCheckbox.checked) {
    btnViewRecords.disabled = false;
  } else {
    btnViewRecords.disabled = true;
  }


  // Show upload in progress modal
  let uploadModal = new bootstrap.Modal(document.getElementById('uploadInProgress'));
  uploadModal.show();

  // Clear the progress bar
  let globalProgress = 0;
  await setProgressBarValue(globalProgress);

  // Check the settings
  let recordWebcam = cameraCheckbox.checked;
  let recordScreen = screenCheckbox.checked;
  //let logKeyboard = keyLogCheckbox.checked;
  let logKeyboard = false;

  // Initialize upload data object if null
  if (testRecordingData == null) {
    testRecordingData = new FormData();
  }

  // Add the clickup task ID
  if (receivedTaskID.length > 0) {
    testRecordingData.set('clickupTaskIDs', receivedTaskID);
  }

  // add the selected playlist information as an object
  if (userPlaylistSelection != null) {
    try {
      let Account_info = {
        'Channeltitle': channelTitle,
        'Playlist_title': userPlaylistSelection[currentRadioButtonID]
      }
      testRecordingData.set('Account_info', JSON.stringify(Account_info));
    } catch (error) {
      console.error("Error while adding Account_info to upload data.", error)
    }
  }

  // Set videos youtube links, or file names
  if ((recordScreen == true) && (recordWebcam == true)) {
    let youtubeLink = "https://youtu.be/" + newBroadcastID;
    testRecordingData.set('merged_webcam_screen_file', youtubeLink);
    testRecordingData.set('screen_file', screenFileName);
    testRecordingData.set('webcam_file', webcamFileName);
  } else if (recordScreen == true) {
    let youtubeLink = "https://youtu.be/" + newBroadcastID;
    testRecordingData.set('screen_file', youtubeLink);
  } else if (recordWebcam == true) {
    let youtubeLink = "https://youtu.be/" + newBroadcastID;
    testRecordingData.set('webcam_file', youtubeLink);
  }

  // Append test details data
  testRecordingData.set('user_name', usernameValue);
  testRecordingData.set('test_description', testDescriptionValue);
  testRecordingData.set('test_name', testNameValue);
  testRecordingData.set('user_files_timestamp', filesTimestamp);

  // Send data to server for storage
  sendAvailableData(globalProgress);
}

// Records screen and audio
async function recordScreenAndAudio() {
  screenStream = await captureScreen();

  // Check if we need to add audio stream
  let recordAudio = audioCheckbox.checked;
  let stream = null;
  if (recordAudio == true) {
    audioStream = await captureMediaDevices(screenAudioConstraints);
    //stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
    try {
      const mergeAudioStreams = (desktopStream, voiceStream) => {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();

        // Create a couple of sources
        const source1 = context.createMediaStreamSource(desktopStream);
        const source2 = context.createMediaStreamSource(voiceStream);

        const desktopGain = context.createGain();
        const voiceGain = context.createGain();

        desktopGain.gain.value = 0;
        voiceGain.gain.value = 0;

        source1.connect(desktopGain).connect(destination);
        // Connect source2
        source2.connect(voiceGain).connect(destination);
        //mute

        console.log('mute')
        voiceGain.gain.setValueAtTime(0, context.currentTime);
        return destination.stream.getAudioTracks();
      };

      //stream = mergeAudioStreams;
      //stream = new MediaStream([...mergeAudioStreams.getTracks()]);
      const tracks = [
        ...screenStream.getVideoTracks(),
        ...mergeAudioStreams(screenStream, audioStream)
      ];

      //console.log('Tracks to add to stream', tracks);
      stream = new MediaStream(tracks);
    } catch (error) {
      console.error("Error while creating merged audio streams: ", error)
      stream = new MediaStream([...screenStream.getTracks(), ...audioStream.getTracks()]);
    }

  } else {
    stream = new MediaStream([...screenStream.getTracks()]);
    //stream = new MediaStream([...screenStream.getVideoTracks()]);
  }

  // Show screen record if webcam is not recording
  let recordWebcam = cameraCheckbox.checked;

  if (recordWebcam == false) {
    video.src = null
    video.srcObject = stream
    video.muted = true
  } else {
    video.src = null
    video.srcObject = webCamStream
    video.muted = true
  }

  let options = await getSupportedMediaType();
  if (options === null) {
    alert("None of the required codecs was found!\n - Please update your browser and try again.");
    document.location.reload();
  }

  screenRecorder = new MediaRecorder(stream, options);
  /*  ahmed 
  screenRecorder.ondataavailable = event => {
    //console.log("Data available");
    if (recordinginProgress == true) {
      if ((event.data.size > 0) && (recordingSynched == true) && (streamScreenToYT == true)) {
        appWebsocket.send(event.data);
      } else if ((event.data.size > 0) && (recordingSynched == true) && (streamScreenToYT == false)) {
        //console.log("Sending screen data to screen websocket");
        let recordWebcam = cameraCheckbox.checked;
        let recordScreen = screenCheckbox.checked;
        if ((recordScreen == true) && (recordWebcam == true)) {
          screenWebSocket.send(event.data);
        }
      }
    }
  } */
  screenRecorder.onstop = function(){
        console.log("screen Recorder  r Stop");
        var blob = new Blob (chunkssave , {    // chunks kisi b file ko save krny k liya use hota hai
            type: "video/webm"  // isky bad semocolon nai lagana wrna error aay ga
          })
          
        var videoUrl = window.URL.createObjectURL(blob);
        downloadlink.setAttribute("href",videoUrl);

    }
    // chunks mein data add kiya jo k aaray
    // jb b recording start ho ge to uska aik data bny ga " ondatavailable"
    let chunkssave = [];
    screenRecorder.ondataavailable = event => {
      console.log("Data available");
      chunkssave.push (event.data);
    } 
    console.log("chunks let",chunkssave);

  screenRecorder.start(200)
}

// Checks recording settings and starts the recording
async function startRecording() {

  // Remove focus from start recording button
  document.getElementById('start').blur();

  // Enable stop recording button
  // document.getElementById("stop").disabled = false;



  // Generate random string for appending to file name
  generateString(6).then((randomString) => {
    fileRandomString = randomString;
    //console.log("fileRandomString: ", fileRandomString)
  })

  // Enable or disable audio recording
  try {
    let recordAudio = audioCheckbox.checked;

    if (recordAudio == true) {
      // Enable audio recording for webcam
      webcamMediaConstraints = {
        video: true, audio: true
      };

      // Enable audio recording for screen recording
      screenAudioConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        },
        video: false
      };
    } else {
      // Disable audio recording for webcam
      webcamMediaConstraints = {
        video: true, audio: false
      };

      // Disable audio recording for screen recording
      screenAudioConstraints = {
        audio: false,
        video: false
      };
    }
  }
  catch (err) {
    let msg = "STATUS: Screen recording Error."
    document.getElementById("app-status").innerHTML = msg;
    console.error("Screen recording Error: " + err.message);
  }

  // show the creating broadcast modal
  showCreatingBroadcastModal(true);

  // Record merged screen and webcam stream
  let recordWebcam = cameraCheckbox.checked;
  let recordScreen = screenCheckbox.checked;
  if ((recordScreen == true) && (recordWebcam == true)) {
    try {
      await recordStream();
      //console.log("Done with webcam and audio.")
      await recordScreenAndAudio();
      //console.log("Done with screen and audio.")
      await recordMergedStream();
      //console.log("Done with merged.")

      // Synchronize recording
      recordingSynched = true;
      streamWebcamToYT = false;
      streamScreenToYT = false;
      streamMergedToYT = true;
      /*screenRecorder.start(200);
      webcamRecorder.start(200);
      mergedStreamRecorder.start(200);*/

      // Enable view records button
      if (publicVideosCheckbox.checked) {
        btnViewRecords.disabled = false;
      } else {
        btnViewRecords.disabled = true;
      }

      // Create websockets now
      createAllsockets();

      msg = "STATUS: Recording Started."
      document.getElementById("app-status").innerHTML = msg;
    }
    catch (err) {
      let msg = "STATUS: Merged stream recording Error."
      document.getElementById("app-status").innerHTML = msg;
      console.error("Merged stream recording Error: " + err.message);
    }
  } else if (recordWebcam == true) {
    // Record webcam if enabled
    try {
      // Show webcam recording has started
      msg = "STATUS: Recording Started."
      document.getElementById("app-status").innerHTML = msg;

      recordStream().then(() => {
        recordingSynched = true;
        streamWebcamToYT = true;
        streamScreenToYT = false;
        streamMergedToYT = false;
        //webcamRecorder.start(200);
        streamWebcamToYT = true;
        // Enable view records button
        if (publicVideosCheckbox.checked) {
          btnViewRecords.disabled = false;
        } else {
          btnViewRecords.disabled = true;
        }

        // Create websockets now
        createAllsockets();
      });
    }
    catch (err) {
      let msg = "STATUS: Webcam recording Error."
      document.getElementById("app-status").innerHTML = msg;
      console.error("Webcam recording Error: " + err.message);
    }
  } else if (recordScreen == true) {
    // Record screen if enabled
    try {
      // Show screen recording has started
      msg = "STATUS: Recording Started."
      document.getElementById("app-status").innerHTML = msg;

      recordScreenAndAudio().then(() => {
        recordingSynched = true;
        streamWebcamToYT = false;
        streamScreenToYT = true;
        streamMergedToYT = false;
        //screenRecorder.start(200);
        // Enable view records button
        if (publicVideosCheckbox.checked) {
          btnViewRecords.disabled = false;
        } else {
          btnViewRecords.disabled = true;
        }

        // Create websockets now
        createAllsockets();
      });
    }
    catch (err) {
      let msg = "STATUS: Screen recording Error."
      document.getElementById("app-status").innerHTML = msg;
      console.error("Screen recording Error: " + err.message);
    }
  }
}

// Validates test details
async function validateModal() {

  // Clear previous test data
  usernameValue = null;
  testNameValue = null;
  testDescriptionValue = null;
  testRecordingData = null;

  // Validate username
  let docIsValid = true;
  usernameValue = document.getElementById("username").value;
  // Remove leading and trailling white space
  usernameValue = usernameValue.trim();
  let msg = "";

  // Check for empty string
  if (usernameValue === "") {
    msg = "Please fill the user name";
    docIsValid = false;
  }

  document.getElementById("username-error").innerHTML = msg;

  // Validate Test Name
  let testNameIsValid = true;
  testNameValue = document.getElementById("test-name").value;
  // Remove leading and trailling white space
  testNameValue = testNameValue.trim();
  let testNameErrorMsg = "";

  // Check for empty string
  if (testNameValue === "") {
    testNameErrorMsg = "Please fill the test name";
    testNameIsValid = false;
  }

  // Check if username starts with a number
  if (testNameValue.match(/^\d/)) {
    testNameErrorMsg = "Test name cannot start with a number";
    testNameIsValid = false;
  }

  // Check for space inside string
  if (/\s/.test(testNameValue)) {
    testNameErrorMsg = "Please replace the space with an underscore for example hi_you";
    testNameIsValid = false;
  }

  document.getElementById("test-name-error").innerHTML = testNameErrorMsg;

  // Get test description
  testDescriptionValue = document.getElementById("test-description").value;

  // All test details are available now
  if ((docIsValid == true) && (testNameIsValid == true)) {
    // Click on close modal button
    document.getElementById("close-test-details-modal").click();

    // Disable start recording button
    document.getElementById("start").disabled = true;

    setVideoPrivacyStatus()
      .then(() => {
        startRecording();
      })
      .catch((err) => {
        console.error("Start recording error: ", err)
        resetStateOnError();
        showErrorModal();
      });
    /*.catch((error) => {
      console.error("Failed to set video privacy status")
    });*/
  }
}

// Sends recorded test data using axios
async function sendAvailableData(prevProgress) {


   // show stop button
  document.querySelector('.record-btn').style.display = 'block';


  // show stop button
  document.querySelector('.stop-btn').style.display = 'none';

  // reset video title
  document.querySelector(".video-title").innerHTML = ""
  // Get csrftoken
  let csrftoken = await getCookie('csrftoken');


  // Send data
  if ((usernameValue != null) && (testRecordingData != null)) {
    setProgressBarValue(50);
    //let fileUploadUrl = 'http://localhost:8000/file/upload/';
    //let fileUploadUrl = "https://liveuxstoryboard.com/file/upload/"
    let fileUploadUrl = '/file/upload/';
    let responseStatus = null;
    await fetch(fileUploadUrl, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrftoken },
      body: testRecordingData
    })
      .then(response => {
        console.log(response)
        responseStatus = response.status;
        console.log("Response Status", responseStatus);
        // Return json data
        return response.json();
      })
      .then((json) => {
        if (responseStatus == 201) {
          msg = "STATUS: Files Uploaded."
          document.getElementById("app-status").innerHTML = msg;
          setProgressBarValue(100);

          // Clear previous test data
          usernameValue = null;
          testNameValue = null;
          testDescriptionValue = null;
          testRecordingData = null;
          // Clear old webcam data
          webcamChunks = [];
          // Clear old screen recording data
          screenRecorderChunks = [];
          // Clear old merged stream recording data
          mergedStreamChunks = [];
          // Clear task id data
          receivedTaskID = [];
          taskIDwasRreceived = false;
          // clear playlist selection
          userPlaylistSelection = null;
          channelTitle = null;

          // Hide upload in progress modal
          const btnCloseUploadigModal = document.getElementById('btnCloseUploadigModal');
          btnCloseUploadigModal.click();

          // Show upload complete modal
          let uploadCompleteModal = new bootstrap.Modal(document.getElementById('uploadComplete'));
          uploadCompleteModal.show();

          //Set current video file links on vps
          try {
            let newFileLinks = json;
            console.log("newFileLinks: ", newFileLinks)
            set_video_links(newFileLinks)
          } catch (error) {
            console.error("Error while setting video links: ", error)
          }
        } else {
          // Server error message
          console.log("Server Error Message: ", json)
          msg = "STATUS: Files Upload Failed."
          document.getElementById("app-status").innerHTML = msg;

          // Hide upload in progress modal
          const btnCloseUploadigModal = document.getElementById('btnCloseUploadigModal');
          btnCloseUploadigModal.click();

          // Check which error modal to show
          let errorMessage = null;
          if ("error_msg" in json) {
            errorMessage = json.error_msg;
          }

          //if (errorMessage.includes("Error while handling Clickup Task")) {
          if (errorMessage.includes("Failed to get")) {
            // Get task id that has error
            const faultyTaskIDArray = errorMessage.split(";");
            faultyTaskID = faultyTaskIDArray[1];
            faultyTaskID = faultyTaskID.trim();
            console.log("faultyTaskIDArray: ", faultyTaskIDArray)
            console.log("faultyTaskID: ", faultyTaskID)

            // Set the value of the task id input
            clickupTaskIdRetryInput = document.getElementById('clickup-task-id-retry');
            clickupTaskIdRetryInput.value = faultyTaskID;
            // Show clickup task error modal
            taskErrorModal.show();
          } else {
            // Show upload failed modal
            let uploadFailedModal = new bootstrap.Modal(document.getElementById('uploadFailed'));
            uploadFailedModal.show();
          }
        }
      })
      .catch(error => {
        console.error(error);
        msg = "STATUS: Files Upload Failed."
        document.getElementById("app-status").innerHTML = msg;

        // Hide upload in progress modal
        const btnCloseUploadigModal = document.getElementById('btnCloseUploadigModal');
        btnCloseUploadigModal.click();

        // Show upload failed modal
        let uploadFailedModal = new bootstrap.Modal(document.getElementById('uploadFailed'));
        uploadFailedModal.show();
      });
  }
}

// A function to retry sending test data and files to server
async function retryTestFilesUpload() {
  // Hide upload failed modal
  const btnCloseUploadFailedModal = document.getElementById('btnCloseUploadFailedModal');
  btnCloseUploadFailedModal.click();

  msg = "STATUS: Trying to send files again."
  document.getElementById("app-status").innerHTML = msg;

  // Generate random string for appending to file name
  generateString(6).then((randomString) => {
    fileRandomString = randomString;
    //console.log("fileRandomString: ", fileRandomString);

    // Try to Send test data again
    stopRecording();
  })
}

// Gets the key log file
async function uploadSeleniumIdeFile() {
  // Close modal if showing
  const btnCloseKeyLofFileUploadModal2 = document.getElementById('closeFileModal2');
  btnCloseKeyLofFileUploadModal2.click();
  // Show the get key log file modal
  let keyLogFileUploadModal = new bootstrap.Modal(document.getElementById('keyLogFileUploadModal'));
  keyLogFileUploadModal.show();

  // Selenium ide file input
  const input = document.getElementById('inpt-test-file');
  const currentKeyLogFile = input.files[0];

  // Beanote/Clickup file upload
  const input2 = document.getElementById('inpt-beanote-file');
  const currentBeanoteFile = input2.files[0];

  // Append beanote/Clickup file first
  // Close modal
  if (currentBeanoteFile != null) {
    input2.value = "";

    // Initialize the data object if null
    if (testRecordingData == null) {
      testRecordingData = new FormData();
    }

    // Append file
    //let newBeanoteFileName = fileRandomString + "_" + currentBeanoteFile.name;
    //testRecordingData.set('beanote_file', currentBeanoteFile, newBeanoteFileName);
    //let newBeanoteFileName = filesTimestamp + "_" + currentBeanoteFile.name;
    let newBeanoteFileName = testNameValue + "_" + filesTimestamp + "_" + currentBeanoteFile.name;
    testRecordingData.set('beanote_file', currentBeanoteFile, newBeanoteFileName);
    console.log("newBeanoteFileName: ", newBeanoteFileName);
  }


  // Close modal
  if (currentKeyLogFile != null) {
    input.value = "";

    // Initialize the data object if null
    if (testRecordingData == null) {
      testRecordingData = new FormData();
    }

    // Append key log file
    //let newFileName = fileRandomString + "_" + currentKeyLogFile.name;
    //testRecordingData.set('key_log_file', currentKeyLogFile, newFileName);
    let newFileName = testNameValue + "_" + filesTimestamp + "_" + currentKeyLogFile.name;
    testRecordingData.set('key_log_file', currentKeyLogFile, newFileName);
    console.log("newFileName: ", newFileName);

  }

  if ((currentKeyLogFile != null) || (currentBeanoteFile != null)) {
    // Hide the get key log file modal and proceed to stop test
    const btnCloseKeyLofFileUploadModal = document.getElementById('btnCloseKeyLogFileUploadModal');
    btnCloseKeyLofFileUploadModal.click();
  }
}

// A function to check if we need to get the key log file
async function keyLogFileCheck() {
  try {

    //let logKeyboard = keyLogCheckbox.checked;
    let logKeyboard = false;

    if (logKeyboard == true) {
      let msg = "STATUS: Getting key log file."
      document.getElementById("app-status").innerHTML = msg;
      uploadSeleniumIdeFile();
    } else {
      // Proceed to stop test
      stopRecording();
    }
  }
  catch (err) {
    let msg = "STATUS: Checking For Key Log File error."
    document.getElementById("app-status").innerHTML = msg;
    console.log("Checking For Key Log File error: " + err.message);
  }
}

// Opens the selenium IDE window
async function openSeleniumIDEExtensionPage() {
  url = "https://chrome.google.com/webstore/detail/selenium-ide/mooikfkahbdckldjjndioackbalphokd?authuser=1&gclid=CjwKCAiA_omPBhBBEiwAcg7smRFkTf9gIMuqU8EpOoGhMahx1N6boXa65-NkPtbqXIW9R8L7EKgIJxoCdx4QAvD_BwE";
  window.open(url, '_blank').focus();

  // A way to remember not to show the modal again
  storeSeleniumIDEInstallModalSettings();
}

// stores the install selenium ide modal settings
async function storeSeleniumIDEInstallModalSettings() {
  // A way to remember not to show the modal again
  let dontShowAgainCheckbox = document.getElementById("dontShowModalAgain");
  let dontShowAgain = dontShowAgainCheckbox.checked;
  localStorage.setItem("dontShowSelIDEInstallAgain", dontShowAgain.toString());
}

// A function to start the selenium ide extension
async function startSeleniumIDEExtension() {
  try {
    console.log("Starting Selenium IDE Extension");
    url = "chrome-extension://mooikfkahbdckldjjndioackbalphokd/index.html";
    let seleniumIDEWindow = window.open(url, '_blank').focus();
    //seleniumIDEWindow.location.reload();
    //setTimeout(()=>{seleniumIDEWindow.location.reload();}, 5000);
  }
  catch (err) {
    let msg = "STATUS: Error while starting selenium IDE Extension."
    document.getElementById("app-status").innerHTML = msg;
    console.error("Error while starting selenium IDE Extension: " + err.message);
  }
}

// A function to clear global variables on error
async function resetStateOnError() {
  console.error("Reseting state due to error");
  let recordWebcam = cameraCheckbox.checked;
  let recordScreen = screenCheckbox.checked;

  // Update application status
  let msg = "STATUS: Recording stopped due to error."
  document.getElementById("app-status").innerHTML = msg;

  // Stop video display tracks
  stopVideoElemTracks(video);


  // show stop button
  document.querySelector('.record-btn').style.display = 'block';

// show stop button
  document.querySelector('.record-btn').style.display = 'block';

// reset video title 
  document.querySelector(".video-title").innerHTML = ""


  // Stop the webcam stream
  if (recordWebcam == true) {
    try {
      webcamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping webcam recorder: " + err.message);
    }
  }

  // Stop screen stream
  if (recordScreen == true) {
    try {
      screenRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping screen recorder: " + err.message);
    }
  }

  // Stop screen and webcam merged stream
  if ((recordScreen == true) && (recordWebcam == true)) {
    try {
      mergedStreamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping merged stream recorder: " + err.message);
    }
  }

  // Enable start recording button
  document.getElementById("start").disabled = false;
  

  // Close any open websocket
  try {
    appWebsocket.close();
  } catch (error) {
    console.error("Error while closing appWebsocket");
  }
  try {
    webcamWebSocket.close();
  } catch (error) {
    console.error("Error while closing webcamWebSocket");
  }
  try {
    screenWebSocket.close();
  } catch (error) {
    console.error("Error while closing screenWebSocket");
  }

  // Reset App global variables
  usernameValue = null;
  testNameValue = null;
  testDescriptionValue = null;
  screenRecorderChunks = [];
  webcamChunks = [];
  mergedStreamChunks = [];
  testRecordingData = null;
  screenRecorder = null;
  mergedStreamRecorder = null;
  webCamStream = null;
  screenStream = null;
  audioStream = null;
  recordinginProgress = false;
  //websocketReconnect = false;
  webcamMediaConstraints = {
    video: true, audio: true
  };
  screenAudioConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    },
    video: false
  };

  taskIdWebSocket = null;
  receivedTaskID = [];
  taskIDwasRreceived = false;
  // clear playlist selection
  userPlaylistSelection = null;
  channelTitle = null;
  // hide the creating broadcast modal
  showCreatingBroadcastModal(false);
}

// Updates the test information upload progress bar
async function setProgressBarValue(newProgress) {
  let uploadProgressBar = document.getElementById('uploadProgressBar');
  uploadProgressBar.setAttribute("aria-valuenow", newProgress.toString());
  let progressString = newProgress.toString() + "%";
  uploadProgressBar.style.width = progressString;
  uploadProgressBar.innerHTML = progressString;
}

async function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Generates a random string for attaching to file names
async function generateString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}

// Shows upload failed modal
async function showUploadFailedModal() {
  modalstate = document.getElementById('uploadFailed').classList.contains('show');
  //console.log("modalstate", modalstate);

  if (modalstate != true) {
    let uploadFailedModal = document.getElementById('uploadFailed');
    uploadFailedModal.classList.add('show');
    //console.log("modal shown");
  }
}

async function set_video_links(linksData) {
  //console.log("linksData", linksData)
  let webcamLink = document.getElementById('webcam_link');
  let screenLink = document.getElementById('screen_link');
  let mergedLink = document.getElementById('merged_link');
  let beanoteFileLink = document.getElementById('beanote_file_link');
  let keyLogFileLink = document.getElementById('key_log_file_link');

  // Set links value, check if data exists first
  if ("webcam_file" in linksData) {
    webcamLink.value = linksData.webcam_file;
  }
  if ("screen_file" in linksData) {
    screenLink.value = linksData.screen_file;
  }
  if ("merged_webcam_screen_file" in linksData) {
    mergedLink.value = linksData.merged_webcam_screen_file;
  }
  if ("beanote_file" in linksData) {
    beanoteFileLink.value = linksData.beanote_file;
  }
  if ("key_log_file" in linksData) {
    keyLogFileLink.value = linksData.key_log_file;
  }
}

async function createWebsocket() {
  let wsStart = 'ws://'

  if (window.location.protocol == 'https:') {
    wsStart = 'wss://'
  } else {
    wsStart = 'ws://'
  }
  //let wsStart = 'ws://'
  let endpoint = wsStart + window.location.host + "/ws/app/"

  //let endpoint = "wss://immense-sands-53205.herokuapp.com/ws/app/"
  //let endpoint = "ws://206.72.196.211:8000/ws/app/"
  //let endpoint = "ws://206.72.196.211:80/ws/app/"
  //let endpoint = "wss://liveuxstoryboard.com/ws/app/"

  appWebsocket = new WebSocket(endpoint)
  console.log(endpoint)

  appWebsocket.onopen = function (evt) {
    console.log(evt)

    // Alert user websocket is open
    let msg = "STATUS: Websocket created."
    document.getElementById("app-status").innerHTML = msg;
    console.log(msg);

    // No need to reconnect
    websocketReconnect = false;

    // Youtube socket was created, create webcam socket if necessary
    let recordWebcam = cameraCheckbox.checked;
    let recordScreen = screenCheckbox.checked;
    if ((recordScreen == true) && (recordWebcam == true)) {
      try {
        createWebcamScreenSocket("webcam")
      } catch (err) {
        console.error("Error while Creating webcam socket: " + err.message);
        resetStateOnError();
        showErrorModal();
      }
    } else {
      // No need to create other sockets
      createBroadcast()
        .catch((err) => {
          console.error("Create broadcast error: ", err)
          resetStateOnError();
          showErrorModal();
        });
    }
  };

  let errorStop = false;
  appWebsocket.onclose = function (evt) {
    console.log("Websocket Closed: ", evt)
    if (evt.code != 1000) {
      if (errorStop == false) {
        errorStop = true;
        //alert("Recording stopped due to websocket error!")
      }
    }
  };

  appWebsocket.onerror = function (evt) {
    let msg = "STATUS: Websocket creation error."
    document.getElementById("app-status").innerHTML = msg;
    console.error("Websocket creation error: ", evt.message);

    // Tell user, stop the recording.
    resetStateOnError();
    showErrorModal();
  };

  appWebsocket.onmessage = function (e) {
    //console.log('message', e)
    let receivedMsg = e.data;
    //console.log("Received data: ", receivedMsg)
    msgRcvdFlag = true;

    if (receivedMsg.includes("RTMP url received: rtmp://")) {
      console.log('RTMP url ACK received');

      // Indicate that recording is in progress
      recordinginProgress = true;

      // Start the recorders
      let recordWebcam = cameraCheckbox.checked;
      let recordScreen = screenCheckbox.checked;
      if ((recordScreen == true) && (recordWebcam == true)) {
        screenRecorder.start(200);
        webcamRecorder.start(200);
        mergedStreamRecorder.start(200);
      } else if (recordWebcam == true) {
        webcamRecorder.start(200);
      } else if (recordScreen == true) {
        screenRecorder.start(200);
      }

      // Update application status
      let msg = "STATUS: Recording in Progress."
      document.getElementById("app-status").innerHTML = msg;

      // Start the task id websocket
      /*let getClickupTaskIDs = clickupTaskNotesCheckbox.checked;
      if (getClickupTaskIDs == true) {
        console.log("Creating Task ID websocket connection")
        createTaskidWebsocket();
      }*/
    } else {
      //console.error('RTMP url ACK not received');
    }
  };
}

async function createBroadcast() {
  url = "youtube/createbroadcast/api/"
  let broadcast_data = new Object();
  broadcast_data.videoPrivacyStatus = videoPrivacyStatus;
  broadcast_data.testNameValue = testNameValue;
  broadcast_data.channel_title = currentChannelTitle;
  json_broadcast_data = JSON.stringify(broadcast_data);
  let csrftoken = await getCookie('csrftoken');
  //headers: {"Content-type":"application/json;charset=UTF-8"}
  const myHeaders = new Headers();
  myHeaders.append('Accept', 'application/json');
  myHeaders.append('Content-type', 'application/json');
  myHeaders.append('X-CSRFToken', csrftoken);

  let broadcastCreated = false;

  await fetch(url, { method: 'post', body: json_broadcast_data, headers: myHeaders })
    .then((response) => {
      if (response.status != 201) {
        throw new Error("Error when creating broadcast!");
      } else {
        broadcastCreated = true;
        return response.json();
      }
    })
    .then((json) => {
      data = json;
      console.log("data: ", data);
      newStreamId = data.newStreamId;
      newStreamName = data.newStreamName;
      newStreamIngestionAddress = data.newStreamIngestionAddress;
      //newRtmpUrl=data.newRtmpUrl;
      newRtmpUrl = "rtmp://a.rtmp.youtube.com/live2" + "/" + newStreamName;
      newBroadcastID = data.new_broadcast_id;
      console.log("newStreamId:", newStreamId);
      console.log("newStreamName:", newStreamName);
      console.log("newStreamIngestionAddress", newStreamIngestionAddress);
      console.log("newRtmpUrl:", newRtmpUrl);
      console.log("new_broadcast_id:", newBroadcastID);
    })
    .catch((err) => {
      console.error("Broadcast creation error: ", err)
      resetStateOnError();
      showErrorModal();
    });

  if (broadcastCreated == true) {
    // Request user to select a Channel
    showSelectYoutubeChannelModal();
  }
}

async function endBroadcast() {
  url = "youtube/transitionbroadcast/api/";
  let broadcast_data = new Object();
  broadcast_data.the_broadcast_id = newBroadcastID;
  broadcast_data.channel_title = currentChannelTitle;
  json_broadcast_data = JSON.stringify(broadcast_data);
  let csrftoken = await getCookie('csrftoken');
  //headers: {"Content-type":"application/json;charset=UTF-8"}
  const myHeaders = new Headers();
  myHeaders.append('Accept', 'application/json');
  myHeaders.append('Content-type', 'application/json');
  myHeaders.append('X-CSRFToken', csrftoken);

  fetch(url, { method: 'post', body: json_broadcast_data, headers: myHeaders })
    .then((response) => {
      if (response.status != 200) {
        throw new Error("Error when transitioning broadcast!");
      } else {
        return response.json();
      }
    })
    .then((json) => {
      data = json;
      console.log("data: ", data);
    })
    .then(console.log("Broadcast Trasitioned to complete state!"))
    .catch((err) => {
      console.error("Broadcast Trasitioning to complete state failed!");
    });
}

async function stopStreamin() {
  try {
    streamWebcamToYT = false;
    streamScreenToYT = false;
    streamMergedToYT = false;
    recordinginProgress = false;
    // Close any open websocket
    try {
      appWebsocket.close(1000, "User stopped recording");;
    } catch (error) {
      console.error("Error while closing appWebsocket");
    }
    try {
      webcamWebSocket.close(1000, "User stopped recording");;
    } catch (error) {
      console.error("Error while closing webcamWebSocket");
    }
    try {
      screenWebSocket.close(1000, "User stopped recording");;
    } catch (error) {
      console.error("Error while closing screenWebSocket");
    }
  } catch (error) {
    console.error("Error while stopping streaming!", error)
  }
}

async function goToPage(event) {
  //let youtubeLink = "https://youtu.be/9Kann9lg1O8";
  let youtubeLink = "https://youtu.be/" + newBroadcastID;
  window.open(youtubeLink, '_blank');
  return false;
}

// Shows upload failed modal
async function showErrorModal() {
  let errorModal = new bootstrap.Modal(document.getElementById('errorOccurred'));
  errorModal.show();
}

// Timer to check network status every second
networkTimer = setInterval(() => {
  checkNetworkStatus();
}, 1000) // each 1 second

// Function to check network status
async function checkNetworkStatus() {
  //console.log("Checking network status:");
  let currentDateTime = new Date();
  //console.log("The current date time is as follows:");
  //console.log(currentDateTime);
  let resultInSeconds = currentDateTime.getTime() / 1000;
  //console.log("The current date time in seconds is as follows:")
  //console.log(resultInSeconds);
  let timeNow = resultInSeconds;
  //console.log("Disconnect time count: ", ((timeNow - lastMsgRcvTime)*1000));

  if (msgRcvdFlag == true) {
    lastMsgRcvTime = timeNow;
    msgRcvdFlag = false;
  } else {
    if (recordinginProgress == false) {
      lastMsgRcvTime = timeNow;
    } else if ((timeNow - lastMsgRcvTime) > 25) { // More than 25 secs
      msgRcvdFlag = false;
      lastMsgRcvTime = timeNow;
      // Stop recording due to network problem
      //clearInterval(networkTimer);
      stopStreams();
      resetStateOnError();
      //alert("Recording stopped due to network problem");
      //let errorModal = new bootstrap.Modal(document.getElementById('networkErrorOccurred'));
      //errorModal.show();

      // Show system tray notification and alert
      showNetworkErrorOccurredModal();
    }

  }
}

// sets youtube video privacy status
async function setVideoPrivacyStatus() {
  // Check if we need to make videos public
  let makePublic = publicVideosCheckbox.checked;
  if (makePublic == true) {
    videoPrivacyStatus = "public";
  } else {
    videoPrivacyStatus = "private";
  }
}

// Shows the beanote file upload modal
async function showBeanoteFileUploadModal() {
  // Synchronized recording stop
  recordingSynched = false;
  //let logKeyboard = keyLogCheckbox.checked;
  let logKeyboard = false;
  let recordWebcam = cameraCheckbox.checked;
  let recordScreen = screenCheckbox.checked;

  // Stop the webcam stream
  if (recordWebcam == true) {
    try {
      webcamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping webcam recorder: " + err.message);
    }
  }

  // Stop screen stream
  if (recordScreen == true) {
    try {
      screenRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping screen recorder: " + err.message);
    }
  }

  // Stop screen and webcam merged stream
  if ((recordScreen == true) && (recordWebcam == true)) {
    try {
      mergedStreamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping merged stream recorder: " + err.message);
    }
  }

  // Close modal if showing
  const btnCloseBeanoteFileModal = document.getElementById('closeBeanoteFileModal');
  btnCloseBeanoteFileModal.click();
  // Show the get key log file modal
  let beanoteFileUploadModal = new bootstrap.Modal(document.getElementById('beanoteFileUploadModal'));
  beanoteFileUploadModal.show();
}

// Stop streams
async function stopStreams() {
  // Synchronized recording stop
  recordingSynched = false;
  //let logKeyboard = keyLogCheckbox.checked;
  let logKeyboard = false;
  let recordWebcam = cameraCheckbox.checked;
  let recordScreen = screenCheckbox.checked;

  // Stop the webcam stream
  if (recordWebcam == true) {
    try {
      webcamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping webcam recorder: " + err.message);
    }
  }

  // Stop screen stream
  if (recordScreen == true) {
    try {
      screenRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping screen recorder: " + err.message);
    }
  }

  // Stop screen and webcam merged stream
  if ((recordScreen == true) && (recordWebcam == true)) {
    try {
      mergedStreamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping merged stream recorder: " + err.message);
    }
  }
}


// Gets the key log file
async function getBeanoteFile() {

  const input = document.getElementById('inpt-beanote-file');
  const currentBeanoteFile = input.files[0];

  // Close modal
  if (currentBeanoteFile != null) {
    input.value = "";

    // Initialize the data object if null
    if (testRecordingData == null) {
      testRecordingData = new FormData();
    }

    // Append key log file
    let newFileName = fileRandomString + "_" + currentBeanoteFile.name;
    testRecordingData.set('beanote_file', currentBeanoteFile, newFileName);
    console.log("newBeanoteFileName: ", newFileName);

    // Hide the get key log file modal and proceed to stop test
    const btnCloseBeanoteFileModal = document.getElementById('closeBeanoteFileModal');
    btnCloseBeanoteFileModal.click();

    // Check for keylog file
    keyLogFileCheck();
  }
}

async function createWebcamScreenSocket(socketType) {
  let wsStart = 'ws://'

  if (window.location.protocol == 'https:') {
    wsStart = 'wss://'
  } else {
    wsStart = 'ws://'
  }
  var endpoint = wsStart + window.location.host + "/ws/webcamscreen/"
  //var endpoint = wsStart + window.location.host + window.location.pathname
  //var endpoint = wsStart + window.location.host + "/ws/app/"
  //var endpoint = "wss://immense-sands-53205.herokuapp.com/ws/app/"
  //var endpoint = "ws://206.72.196.211:80/ws/app/" 
  //let endpoint = "wss://liveuxstoryboard.com/ws/webcamscreen/"

  var socket = new WebSocket(endpoint)
  if (socketType === "webcam") {
    webcamWebSocket = socket;
  } else {
    screenWebSocket = socket;
  }
  console.log(endpoint)

  socket.onopen = function (e) {
    console.log('open', e)
    let msg = "";

    if (socketType === "webcam") {
      webcamFileName = testNameValue + "_" + filesTimestamp + "_" + socketType + ".webm";
      msg = "FILENAME," + webcamFileName;
    } else {
      screenFileName = testNameValue + "_" + filesTimestamp + "_" + socketType + ".webm";
      msg = "FILENAME," + screenFileName;
    }

    socket.send(msg)
  }


  socket.onmessage = function (e) {
    //console.log('message', e)
    let receivedMsg = e.data;
    //console.log("Received data: ", receivedMsg)
    msgRcvdFlag = true;

    if (receivedMsg.includes("Received Recording File Name")) {
      console.log('Socket received file name');
      // ToDo: Enable streaming of video using websocket

      // webcam socket was created, create screen socket
      let recordWebcam = cameraCheckbox.checked;
      let recordScreen = screenCheckbox.checked;
      if ((recordScreen == true) && (recordWebcam == true)) {
        try {
          if (socketType === "webcam") {
            createWebcamScreenSocket("screen");
          } else {
            // Start recording
            //startRecording();
            createBroadcast();
          }
        } catch (err) {
          console.error("Error while Creating webcam socket: " + err.message);
          // Tell user, stop the recording.
          resetStateOnError();
          showErrorModal();
        }
      }
    } else {
      //Handle next message;
      //console.log(receivedMsg);
      //console.log("Received data: ", receivedMsg)
    }
  }

  socket.onerror = function (evt) {
    msg = socketType + "Websocket creation error: ";
    console.error(msg, evt);
    // Tell user, stop the recording.
    resetStateOnError();
    showErrorModal();
  };
}

// Creates all the required websockets
async function createAllsockets() {
  let recordWebcam = cameraCheckbox.checked;
  let recordScreen = screenCheckbox.checked;

  try {
    // Create youtube websocket first, then others follow on success
    createRecordingTimestamp()
      .then(createWebsocket())
      .catch((err) => {
        throw new Error(err);
      });
  } catch (err) {
    console.error("Error while Creating sockets: " + err.message);
    // Tell user, stop the recording.
    resetStateOnError();
    showErrorModal();
  }
  //}
}

// Creates a timestamp for the files
async function createRecordingTimestamp() {
  let currentdate = new Date();
  let newTimestamp = currentdate.getDate() + "_"
    + (currentdate.getMonth() + 1) + "_"
    + currentdate.getFullYear() + "_T"
    + currentdate.getHours() + "_"
    + currentdate.getMinutes() + "_"
    + currentdate.getSeconds();

  // Set the files timestamp
  filesTimestamp = newTimestamp;
  console.log("New File Timestamp: ", filesTimestamp);
}

// Replace a faulty clickup task id
async function replaceClickupTaskID() {
  // Validate clickup task ID
  let taskIDIsValid = true;
  let newClickupTaskID = document.getElementById("clickup-task-id-retry").value;
  //console.log("newClickupTaskID: ",newClickupTaskID);
  // Remove leading and trailling white space
  newClickupTaskID = newClickupTaskID.trim();
  // Remove forward slashes
  newClickupTaskID = newClickupTaskID.replaceAll('/', '');
  // Remove hash symbol
  newClickupTaskID = newClickupTaskID.replaceAll('#', '');
  //console.log("newClickupTaskID: ", newClickupTaskID);
  let idMsg = "";

  // Check for empty string
  if (newClickupTaskID === "") {
    idMsg = "Please fill the task id";
    taskIDIsValid = false;
  }

  document.getElementById("clickup-task-id-retry-error").innerHTML = idMsg;

  // Proceed to retry
  if (taskIDIsValid) {
    // Replace old task id with new one
    const index = receivedTaskID.indexOf(faultyTaskID);
    if (index !== -1) {
      receivedTaskID[index] = newClickupTaskID;
    }

    // Hide clickup task error modal
    const btnCloseClickupErrorModal = document.getElementById('btnCloseClickupErrorModal');
    btnCloseClickupErrorModal.click();

    retryTestFilesUpload();
  }
}

// Creates task id websocket
async function createTaskidWebsocket() {
  number_one = document.getElementById('main')
  let wsStart = 'ws://'

  if (window.location.protocol == 'https:') {
    wsStart = 'wss://'
  } else {
    wsStart = 'ws://'
  }
  var endpoint = wsStart + window.location.host + "/ws/taskid/"

  var socket = new WebSocket(endpoint)
  taskIdWebSocket = socket;
  console.log(endpoint)

  socket.onopen = function (e) {
    console.log('Task ID websocket open', e)
  }


  socket.onmessage = function (e) {
    //console.log('message', e)
    let receivedMsg = e.data;
    console.log("Received data: ", receivedMsg)
    let task_json_infor = JSON.parse(receivedMsg);

    if ("message" in task_json_infor.payload) {
      let storedUserEmail = localStorage.getItem("userClickupEmail");
      console.log("storedUserEmail: ", storedUserEmail);
      let receivedUserEmail = task_json_infor.payload.message.history_items[0].user.email;
      console.log("receivedUserEmail: ", receivedUserEmail);

      // Make sure task id is for current user
      if (storedUserEmail === receivedUserEmail) {
        receivedTaskID.push(task_json_infor.payload.message.task_id);
        taskIDwasRreceived = true;
        console.log("Received Task ID: ", receivedTaskID);
        alert("Received Task ID: " + receivedTaskID);
      } else {
        console.log("None user task id received");
      }
    }
  }

  socket.onerror = function (evt) {
    console.error("Websocket creation error: ", evt);
    // Try to reconnect on failure
    taskidWebsocketReconnection();
  };
}

// Makes task id websocket connection retrys
async function taskidWebsocketReconnection() {
  console.log("Retrying connection to task id websocket in 5 Seconds")
  setTimeout(createTaskidWebsocket(), 5000);
}

// Handle task id checkbox state changes
async function handleTaskIdCheckbox(e) {
  const { checked } = e.target;
  console.log("Task ID Checked? ", checked)

  if (checked === true) {
    //console.log("Creating Task ID websocket connection")
    //createTaskidWebsocket();
    showUserSettingsModal();
  } else {
    console.log("Closing Task ID websocket connection")

    receivedTaskID = [];
    taskIDwasRreceived = false;

    try {
      taskIdWebSocket.close();
    } catch (error) {
      console.error("Error while closing webcamWebSocket");
      taskIdWebSocket = null;
    }
  }
}

// Gets clickup extension current user email
async function getClickupUser() {
  let clickupExtension = "chrome-extension://pliibjocnfmkagafnbkfcimonlnlpghj";
  let userDetails = window.localStorage.getItem(clickupExtension);
  console.log("Clickup user details: ", userDetails)
}

// Save clickup user email address
async function saveClickupUserEmail() {
  // Validate email
  let emailIsValid = true;
  let userClickupEmail = document.getElementById("userClickupEmail").value;
  console.log("userClickupEmail: ", userClickupEmail);
  // Remove leading and trailling white space
  userClickupEmail = userClickupEmail.trim();

  let emailErrorMsg = "";

  // Check for empty string
  if (userClickupEmail === "") {
    emailErrorMsg = "Please fill in the email address";
    emailIsValid = false;
  }

  // check for correct email format
  let validRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

  if (!userClickupEmail.match(validRegex)) {
    emailErrorMsg = "Please enter a valid email address";
    emailIsValid = false;
  }

  document.getElementById("userEmailError").innerHTML = emailErrorMsg;

  // Proceed to save email address
  if (emailIsValid) {
    // Hide user settings modal
    const btnCloseUserSettingsModal = document.getElementById('close-user-settings-modal');
    btnCloseUserSettingsModal.click();

    // Save in localstorage
    localStorage.setItem("userClickupEmail", userClickupEmail);
  }
}

// show user settings modal
async function showUserSettingsModal() {

  // Check if user email is stored
  let storedUserEmail = localStorage.getItem("userClickupEmail");

  if (storedUserEmail === null) {
    // close modal if open
    const btnCloseUserSettingsModal = document.getElementById('close-user-settings-modal');
    btnCloseUserSettingsModal.click();

    // Show modal
    userSettingsModal.show();
  }
}

// Shows get task id from user modal
async function showGetTaskIdFromUserModal() {

  // Stop video display tracks
  await stopVideoElemTracks(video);

  try {
    // Try to stop network timer
    try {
      clearInterval(networkTimer);
    } catch (error) {
      console.error("Error while stopping network timer!");
    }

    // Synchronized recording stop
    recordingSynched = false;
    //let logKeyboard = keyLogCheckbox.checked;
    let recordWebcam = cameraCheckbox.checked;
    let recordScreen = screenCheckbox.checked;

    // Stop the webcam stream
    if (recordWebcam == true) {
      try {
        webcamRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Error while stopping webcam recorder: " + err.message);
      }
    }

    // Stop screen stream
    if (recordScreen == true) {
      try {
        screenRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Error while stopping screen recorder: " + err.message);
      }
    }

    // Stop screen and webcam merged stream
    if ((recordScreen == true) && (recordWebcam == true)) {
      try {
        mergedStreamRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Error while stopping merged stream recorder: " + err.message);
      }
    }

    // Check if we need to show modal first
    //let getClickupTaskNotes = clickupTaskNotesCheckbox.checked;
    let getClickupTaskNotes = false;
    if ((getClickupTaskNotes == true) && (receivedTaskID.length <= 0)) {
      // Get task id from user
      let msg = "STATUS: Getting Task ID from user..."
      document.getElementById("app-status").innerHTML = msg;

      // close modal if open
      const btnCloseGetTaskIdFromUserModal = document.getElementById('btnCloseGetTaskIdFromUserModal');
      btnCloseGetTaskIdFromUserModal.click();

      // Show modal
      getTaskIdFromUserModal.show();
    } else {
      // Proceed to check for beanote and selenium ide fiels
      keyLogFileCheck();
    }
  } catch (err) {
    let msg = "STATUS: Error While Getting Clickup Task ID From User."
    document.getElementById("app-status").innerHTML = msg;
    //console.log("Error While Getting Clickup Task ID From User: " + error.message);
    console.log("Error While Getting Clickup Task ID From User: " + err.message);
  }
}

// Saves task id from user
async function saveTaskIDFromUser() {
  // Validate clickup task ID
  let taskIDIsValid = true;
  let newClickupTaskIDs = document.getElementById("clickupTaskIdFromUser").value;
  //console.log("newClickupTaskIDs: ",newClickupTaskIDs);
  // Remove leading and trailling white space
  newClickupTaskIDs = newClickupTaskIDs.trim();
  // Remove forward slashes
  newClickupTaskIDs = newClickupTaskIDs.replaceAll('/', '');
  // Remove hash symbol
  newClickupTaskIDs = newClickupTaskIDs.replaceAll('#', '');
  console.log("newClickupTaskIDs: ", newClickupTaskIDs);
  let idMsg = "";

  // Check for empty string
  if (newClickupTaskIDs === "") {
    idMsg = "Please fill the task id";
    taskIDIsValid = false;
  }

  document.getElementById("clickupTaskIdFromUserError").innerHTML = idMsg;

  // Proceed to check for keylog file
  if (taskIDIsValid) {
    // Add the new task id to global list of task ids
    const newTaskIDsArray = newClickupTaskIDs.split(",");
    console.log("newTaskIDsArray: ", newTaskIDsArray)
    for (taskID in newTaskIDsArray) {
      let tempTaskID = newTaskIDsArray[taskID].trim();
      console.log("tempTaskID: ", tempTaskID);

      if (tempTaskID !== null) {
        receivedTaskID.push(tempTaskID);
      }
    }
    // Hide get task id from user modal
    const btnCloseGetTaskIdFromUserModal = document.getElementById('btnCloseGetTaskIdFromUserModal');
    btnCloseGetTaskIdFromUserModal.click();

    keyLogFileCheck();
  }
}

// Stops video element tracks
async function stopVideoElemTracks(videoElem) {
  // Actual video display element
  try {
    let tracks = videoElem.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoElem.srcObject = null;
  } catch (error) {
    console.error("Error while stopping video display tracks: ", error.message)
  }

  // audio stream
  try {
    audioStream.getTracks().forEach(track => track.stop());
  } catch (error) {

  }

  // screen stream
  try {
    screenStream.getTracks().forEach(track => track.stop());
  } catch (error) {

  }

  // webcam stream
  try {
    webCamStream.getTracks().forEach(track => track.stop());
  } catch (error) {

  }
}

// for debugging formdata object
async function debugFormData(formdataObject) {
  for (var pair of formdataObject.entries()) {
    console.log(pair[0] + ', ' + pair[1]);
  }
}
// Removes clickup ids from upload data
async function removeClickupTaskIds() {
  //await debugFormData(testRecordingData);
  try {
    // Remove task ids array
    testRecordingData.delete('clickupTaskIDs');

    // Clear task ids array
    receivedTaskID = [];
    //await debugFormData(testRecordingData);
  } catch (error) {
    console.error("Error while removing clickup task ids from upload data.", error);
  }
}

// Upload data without clickup notes
async function uploadWithoutClickupNotes() {
  removeClickupTaskIds().then(() => {
    retryTestFilesUpload();
  }).catch(() => {
    console.error("Error while uploading without clickup task notes.");
  });
}

// Shows youtube playlist selection modal
async function showSelectYoutubePlaylistModal(channel_title=null) {

  // hide the creating broadcast modal
  showCreatingBroadcastModal(false);

  // close modal if open
  const btnCloseChannelSelectionModal = document.getElementById('close-channels-selection-modal');
  btnCloseChannelSelectionModal.click();

  // Show loading playlists message
  const receivedPlaylistsDiv = document.getElementById('received-playlists');
  const loadingPlaylistsDiv = document.getElementById('loading-playlists');
  const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-playlists');
  receivedPlaylistsDiv.hidden = true;
  loadingPlaylistsDiv.hidden = false;
  failedToReceivePlaylistsDiv.hidden = true;

  // close modal if open
  const btnClosePlaylistSelectionModal = document.getElementById('close-playlist-selection-modal');
  btnClosePlaylistSelectionModal.click();

  // Show modal
  const playlistSelectionlModal = new bootstrap.Modal(document.getElementById('playlist-selection-modal'));
  playlistSelectionlModal.show();

  // Make attempt to fetch playlist
  currentRadioButtonID = null;
  if (!channel_title){
    fetchPlaylists(defaultChannel)
  }
  else{
    fetchPlaylists(channel_title);
  }
}

// creates a list of radio buttons
async function createRadioButtons(id_title_dict) {

  // clear the table's playlist array
  tablePlaylists = [];
  // Create and add radio buttons to their HTML container
  for (const key in id_title_dict) {

    console.log(`${key}: ${id_title_dict[key]}`);
    var radiobox = document.createElement('input');
    radiobox.type = 'radio';
    radiobox.id = key; // playlist id
    radiobox.value = id_title_dict[key]; // playlist title
    radiobox.name = "user_playlist"
    radiobox.classList.add("form-check-input");
    radiobox.classList.add("ms-2");
    radiobox.onchange = function () {
      getSelectedRadioButton();
    }


    var label = document.createElement('label')
    label.classList.add("ms-2");
    label.htmlFor = key;

    var description = document.createTextNode(id_title_dict[key]);
    label.appendChild(description);

    var newline = document.createElement('br');

    let radiboxString = radiobox.outerHTML.replace(">", ' onchange = "getSelectedRadioButton(event);" />');
    let oneRow = radiboxString + label.outerHTML + newline.outerHTML
    let tempArray = [];
    tempArray.push(oneRow);

    // console.log('TempAray  ',tempArray)
    tablePlaylists.push(tempArray)
  }
  console.log(tablePlaylists);
}

// Checks which radio button was pressed
function getSelectedRadioButton(event) {
  //console.log(event);
  currentRadioButtonID = null;

  let currentRadioButton = event.currentTarget;
  //console.log("Current Radio Button: ", currentRadioButton.value, currentRadioButton.id);
  currentRadioButtonID = currentRadioButton.id;
  userPlaylistSelection = { [currentRadioButtonID]: currentRadioButton.value };
  console.log("userPlaylistSelection: ", userPlaylistSelection);
}

// fetches the playlists
async function fetchPlaylists(Channel_title) {
  // Show loading playlists message
  const receivedPlaylistsDiv = document.getElementById('received-playlists');
  const loadingPlaylistsDiv = document.getElementById('loading-playlists');
  const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-playlists');
  receivedPlaylistsDiv.hidden = true;
  loadingPlaylistsDiv.hidden = false;
  failedToReceivePlaylistsDiv.hidden = true;

  let broadcast_data = new Object();
  // broadcast_data.channel_title = currentChannelTitle;
  broadcast_data.channel_title = Channel_title;
  json_broadcast_data = JSON.stringify(broadcast_data);
  let csrftoken = await getCookie('csrftoken');
  const myHeaders = new Headers();
  myHeaders.append('Accept', 'application/json');
  myHeaders.append('Content-type', 'application/json');
  myHeaders.append('X-CSRFToken', csrftoken);

  let fetchPlaylistsApiUrl = '/youtube/fetchplaylists/api/';
  let responseStatus = null;
  await fetch(fetchPlaylistsApiUrl, {
    method: 'POST',
    body: json_broadcast_data, 
    headers: myHeaders 
  })
    .then(response => {
      console.log(response)
      responseStatus = response.status;
      console.log("Fetch playlists Response Status", responseStatus);
      // Return json data
      return response.json();
    })
    .then((json) => {
      if (responseStatus == 200) {
        msg = "STATUS: Playlists Received."
        document.getElementById("app-status").innerHTML = msg;

        // set global plalist value
        userPlaylists = json.id_title_dict;

        // Get today's playlist id
        let todaysPlaylistObject = json.todays_playlist_dict
        //console.log("todaysPlaylistObject: ", todaysPlaylistObject);
        todaysPlaylistId = todaysPlaylistObject.todays_playlist_id
        console.log("todaysPlaylistId: ", todaysPlaylistId);

        // Use data to display radio buttons
        channelTitle = json.channel_title;
        console.log("Received playlists Information: ", json)
        createRadioButtons(json.id_title_dict)

        // show the radio buttons
        const receivedPlaylistsDiv = document.getElementById('received-playlists');
        const loadingPlaylistsDiv = document.getElementById('loading-playlists');
        const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-playlists');
        receivedPlaylistsDiv.hidden = false;
        loadingPlaylistsDiv.hidden = true;
        failedToReceivePlaylistsDiv.hidden = true;

        // Refresh the playlist selection table
        $('#playlist-table').DataTable().clear().rows.add(tablePlaylists).draw();
        //console.log("tablePlaylists: ", tablePlaylists);

      } else {
        // Server error message
        console.log("Server Error Message: ", json)
        msg = "STATUS: Failed to Fetch Playlists."
        document.getElementById("app-status").innerHTML = msg;

        // Show loading playlists failed message
        const receivedPlaylistsDiv = document.getElementById('received-playlists');
        const loadingPlaylistsDiv = document.getElementById('loading-playlists');
        const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-playlists');
        receivedPlaylistsDiv.hidden = true;
        loadingPlaylistsDiv.hidden = true;
        failedToReceivePlaylistsDiv.hidden = false;
      }
    })
    .catch(error => {
      console.error(error);
      msg = "STATUS: Failed to Fetch Playlists."
      document.getElementById("app-status").innerHTML = msg;

      // Show loading playlists failed message
      const receivedPlaylistsDiv = document.getElementById('received-playlists');
      const loadingPlaylistsDiv = document.getElementById('loading-playlists');
      const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-playlists');
      receivedPlaylistsDiv.hidden = true;
      loadingPlaylistsDiv.hidden = true;
      failedToReceivePlaylistsDiv.hidden = false;
    });
}
// Inserts a video into a youtube playlist
async function insertVideoIntoPlaylist() {

  // show stop button
  document.querySelector('.stop-btn').style.display = 'block';


  // show stop button
  document.querySelector('.record-btn').style.display = 'none';


// ojohilip
  // Get name of the youtube video
  let videoTitle = document.getElementById("test-name").value;
  let finalvideoTitle = videoTitle.replace(/_/ig, " ");
  document.querySelector(".video-title").innerHTML = `<h2>${finalvideoTitle}</h2>`


  let playlistItemsInsertURL = '/youtube/playlistitemsinsert/api/';
  let responseStatus = null;
  await fetch(playlistItemsInsertURL, {
    method: 'POST',
    body: JSON.stringify({
      videoId: newBroadcastID,
      playlistId: currentRadioButtonID,
      channel_title: currentChannelTitle
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    }
  })
    .then(response => {
      console.log(response)
      responseStatus = response.status;
      console.log("Insert video into user playlist Response Status", responseStatus);
      // Return json data
      return response.json();
    })
    .then((json) => {
      if (responseStatus == 200) {
        msg = "STATUS: Video Inserted Into User Playlist."
        document.getElementById("app-status").innerHTML = msg;

        // Insert video into daily playlist
        if (todaysPlaylistId != null) {
          insertVideoIntoTodaysPlaylist();
        } else {
          sendRTMPURL();
        }

      } else {
        // Server error message
        console.log("Server Error Message: ", json)
        msg = "STATUS: Failed to Insert Video Into User Playlist."
        document.getElementById("app-status").innerHTML = msg;

        // Show error modal
        playlistInsertVideoErrorModal();
      }
    })
    .catch(error => {
      console.error(error);
      msg = "STATUS: Failed to Insert Video Into User Playlist."
      document.getElementById("app-status").innerHTML = msg;

      // Show error modal
      playlistInsertVideoErrorModal();
    });
}

// Inserts a video into the current day's youtube playlist
async function insertVideoIntoTodaysPlaylist() {
  let playlistItemsInsertURL = '/youtube/playlistitemsinsert/api/';
  let responseStatus = null;
  await fetch(playlistItemsInsertURL, {
    method: 'POST',
    body: JSON.stringify({
      videoId: newBroadcastID,
      playlistId: todaysPlaylistId,
      channel_title: currentChannelTitle
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    }
  })
    .then(response => {
      console.log(response)
      responseStatus = response.status;
      console.log("Insert video into daily playlist Response Status", responseStatus);
      // Return json data
      return response.json();
    })
    .then((json) => {
      if (responseStatus == 200) {
        msg = "STATUS: Video Inserted Into Daily Playlist."
        document.getElementById("app-status").innerHTML = msg;

        // Proceed to send RTMP URL
        sendRTMPURL();

      } else {
        // Server error message
        console.log("Server Error Message: ", json)
        msg = "STATUS: Failed to Insert Video Into Daily Playlist."
        document.getElementById("app-status").innerHTML = msg;

        // Show error modal
        playlistInsertVideoErrorModal();
      }
    })
    .catch(error => {
      console.error(error);
      msg = "STATUS: Failed to Insert Video Into Daily Playlist."
      document.getElementById("app-status").innerHTML = msg;

      // Show error modal
      playlistInsertVideoErrorModal();
    });
}

// Proceeds after playlist is selected
async function playlistSelected() {
  // Don't proceed if user has not selected a playlist
  if (currentRadioButtonID == null) {
    alert("Please select a playlist first!")
  } else {
    // Hide modal
    const btnClosePlaylistSelectionModal = document.getElementById('close-playlist-selection-modal');
    btnClosePlaylistSelectionModal.click();

    // confirm playlist selection
    confirmPlaylistSelection();
  }
}

// Sends an RTMP URL to the websocket
function sendRTMPURL() {
  // Check if we need to add audio stream
  let recordAudio = audioCheckbox.checked;
  if (recordAudio == true) {
    let msg = "browser_sound," + newRtmpUrl;
    appWebsocket.send(msg)
    console.log("Sent RTMP URL: ", msg)
  } else {
    appWebsocket.send(newRtmpUrl)
    console.log("Sent RTMP URL: ", newRtmpUrl)
  }
}

// Shows youtube playlist insert video error modal
async function playlistInsertVideoErrorModal() {

  // close modal if open
  const btnClosePlaylistInsertErrorModal = document.getElementById('btnClosePlaylistInsertErrorModal');
  btnClosePlaylistInsertErrorModal.click();

  // Show modal
  const playlistInsertErrorModal = new bootstrap.Modal(document.getElementById('playlist-insert-video-error-modal'));
  playlistInsertErrorModal.show();
}

// Creating youtube broadcast modal
async function showCreatingBroadcastModal(showModal) {
  if (showModal) {
    // close modal if open
    const btnCloseCreatingBroadcastModal = document.getElementById('btnCloseCreatingBroadcastModal');
    btnCloseCreatingBroadcastModal.click();

    // Show modal
    const creatingBroadcastModal = new bootstrap.Modal(document.getElementById('creatingBroadcastModal'));
    creatingBroadcastModal.show();
  } else {
    // close modal
    const btnCloseCreatingBroadcastModal = document.getElementById('btnCloseCreatingBroadcastModal');
    btnCloseCreatingBroadcastModal.click();
  }
}

// Confirms playlist selection
function confirmPlaylistSelection1() {
  try {
    let playlist = userPlaylistSelection[currentRadioButtonID];
    let text = "Are you sure you want to use the playlist:\n" + playlist + ".";
    if (confirm(text) == true) {
      playlistSelected();
    } else {
      //showSelectYoutubePlaylistModal();
    }
  } catch (error) {
    console.error("Error while showing confirm playlist selection: ", error)
  }
}

function confirmPlaylistSelection() {

  try {
    // close playlist selection modal
    const btnClosePlaylistSelectionModal = document.getElementById('close-playlist-selection-modal');
    btnClosePlaylistSelectionModal.click();

    let playlist = userPlaylistSelection[currentRadioButtonID];
    //let playlist = "VOC"
    let text = "Are you sure you want to use the <strong>" + playlist + "</strong> playlist?";
    // close modal if open
    const btnCloseConfirmPlaylistSelectionModal = document.getElementById('btn-close-confirm-playlist-selection-modal');
    btnCloseConfirmPlaylistSelectionModal.click();

    // Add playlist confirmation message
    document.getElementById('playlist-confirmation-message').innerHTML = text;

    // Show modal
    const confirmPlaylistSelectionModal = new bootstrap.Modal(document.getElementById('confirm-playlist-selection-modal'));
    confirmPlaylistSelectionModal.show();
  } catch (error) {
    console.error("Error while showing confirm playlist selection modal: ", error)
  }
}
// close channel list selection modal
async function closeYoutubeChannelSelectionModal(){
  showTestDetailsModal()
  resetStateOnClosingPlaylistModal()
}
// close youtube list selection modal
async function closeYoutubePlaylistSelectionModal(){
  showSelectYoutubeChannelModal()
}

// reset state on closing youtube playlist modal
async function resetStateOnClosingPlaylistModal() {
  // console.error("Reseting state due to error");
  let recordWebcam = cameraCheckbox.checked;
  let recordScreen = screenCheckbox.checked;

  // Update application status
  let msg = "STATUS: Youtube Playlist Selection Modal Closed."
  document.getElementById("app-status").innerHTML = msg;

  // Stop video display tracks
  stopVideoElemTracks(video);




// show stop button
  document.querySelector('.record-btn').style.display = 'block';

  // Stop the webcam stream
  if (recordWebcam == true) {
    try {
      webcamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping webcam recorder: " + err.message);
    }
  }

  // Stop screen stream
  if (recordScreen == true) {
    try {
      screenRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping screen recorder: " + err.message);
    }
  }

  // Stop screen and webcam merged stream
  if ((recordScreen == true) && (recordWebcam == true)) {
    try {
      mergedStreamRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Error while stopping merged stream recorder: " + err.message);
    }
  }

  // Enable start recording button
  document.getElementById("start").disabled = false;
  

  // Close any open websocket
  try {
    appWebsocket.close();
  } catch (error) {
    console.error("Error while closing appWebsocket");
  }
  try {
    webcamWebSocket.close();
  } catch (error) {
    console.error("Error while closing webcamWebSocket");
  }
  try {
    screenWebSocket.close();
  } catch (error) {
    console.error("Error while closing screenWebSocket");
  }

  // Reset App global variables
  usernameValue = null;
  testNameValue = null;
  testDescriptionValue = null;
  screenRecorderChunks = [];
  webcamChunks = [];
  mergedStreamChunks = [];
  testRecordingData = null;
  screenRecorder = null;
  mergedStreamRecorder = null;
  webCamStream = null;
  screenStream = null;
  audioStream = null;
  recordinginProgress = false;
  //websocketReconnect = false;
  webcamMediaConstraints = {
    video: true, audio: true
  };
  screenAudioConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    },
    video: false
  };

  taskIdWebSocket = null;
  receivedTaskID = [];
  taskIDwasRreceived = false;
  // clear playlist selection
  userPlaylistSelection = null;
  channelTitle = null;
  // hide the creating broadcast modal
  showCreatingBroadcastModal(false);
}


// Creating new playlist modal
async function showCreatingNewPlaylistModal() {
  // close modal if open
  const btnCloseNewPlaylistDetailsModal = document.getElementById('close-new-playlist-details-modal');
  btnCloseNewPlaylistDetailsModal.click();

  // Show modal
  const creatingNewPlaylistModal = new bootstrap.Modal(document.getElementById('new-playlist-details-modal'));
  creatingNewPlaylistModal.show();

  // Ojophilip
  fetchChannelsforPlaylistCreation();
}

// On press handler for the create playlist button
async function handleCreatePlaylistRequest() {
  // ojophilip
  // currentRadioButtonID = null;
  // let currentRadioButton = event.currentTarget;

  // // console.log("Current Radio Button: ", currentRadioButton.value, currentRadioButton.id);
  // currentRadioButtonID = currentRadioButton.id;
  // currentChannelTitle = currentRadioButton.value;

  // disable button first
  const btnCreatePlaylist = document.getElementById("create-playlist")
  btnCreatePlaylist.disabled = true;

  // Validate new playlist title
  let docIsValid = true;
  let newPlaylistTitle = document.getElementById("new-playlist-title").value;
  // Remove leading and trailling white space
  newPlaylistTitle = newPlaylistTitle.trim();
  let msg = "";

  // Check for empty string
  if (newPlaylistTitle === "") {
    msg = "Please fill in the playlist title";
    docIsValid = false;
  }

  // ojophilip
  // Check for empty string
  // if (currentChannelTitle === "") {
  //   msg = "Please Select Your Channel";
  //   docIsValid = false;
  // }

  document.getElementById("new-playlist-title-error").innerHTML = msg;

  // Get playlist description
  let newPlaylistDescription = document.getElementById("new-playlist-description").value;

  // Get playlist privacy status
  let newPlaylistPrivacyStatus = document.getElementById("new-playlist-privacy-status").checked;
  if (newPlaylistPrivacyStatus === true) {
    newPlaylistPrivacyStatus = "public"
  } else {
    newPlaylistPrivacyStatus = "private"
  }
  

  if (docIsValid) {
    // close create new playlist modal
    const btnCloseNewPlaylistDetailsModal = document.getElementById('close-new-playlist-details-modal');
    btnCloseNewPlaylistDetailsModal.click();

    // Show creating playlist spinner
    showCreatingPlaylistModal(true);

    // Make request to create playlist
    await createNewPlaylist(newPlaylistTitle, newPlaylistDescription, newPlaylistPrivacyStatus);
  }

  // Enable create playlist button
  btnCreatePlaylist.disabled = false;

}


// Makes api request to create playlist
async function createNewPlaylist(title, description, privacyStatus) {
  let createPlaylistURL = '/youtube/createplaylist/api/';
  let responseStatus = null;
  await fetch(createPlaylistURL, {
    method: 'POST',
    body: JSON.stringify({
      new_playlist_title: title,
      new_playlist_description: description,
      new_playlist_privacy: privacyStatus,
      channel_title: currentChannelTitle
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    }
  })
    .then(response => {
      console.log(response)
      responseStatus = response.status;
      console.log("Create playlist Response Status", responseStatus);
      // Return json data
      return response.json();
    })
    .then((json) => {
      if (responseStatus == 200) {
        msg = "STATUS: Playlist Created"
        document.getElementById("app-status").innerHTML = msg;

        // Hide creating playlist spinner
        showCreatingPlaylistModal(false);

        // Show playlist created modal
        showPlaylistCreatedModal();

        // clear modal input fields
        document.getElementById("new-playlist-title").value = "";
        document.getElementById("new-playlist-description").value = "";
        document.getElementById("new-playlist-privacy-status").checked = false;
      } else if (responseStatus == 409) {
        // Server error message
        console.log("Server Error Message: ", json)
        msg = "STATUS: Playlist Already Exists."
        document.getElementById("app-status").innerHTML = msg;

        // Hide creating playlist spinner
        showCreatingPlaylistModal(false);

        // Show error modal
        showPlaylistAlreadyExistsModal();
      } else {
        // Server error message
        console.log("Server Error Message: ", json)
        msg = "STATUS: Failed to create playlist."
        document.getElementById("app-status").innerHTML = msg;

        // Hide creating playlist spinner
        showCreatingPlaylistModal(false);
        // Show error modal
        showPlaylistCreationErrorModal();
      }
    })
    .catch(error => {
      console.error(error);
      msg = "STATUS: Failed to create playlist."
      document.getElementById("app-status").innerHTML = msg;

      // Hide creating playlist spinner
      showCreatingPlaylistModal(false);
      // Show error modal
      showPlaylistCreationErrorModal();
    });
}

// Shows Playlist was created modal
async function showPlaylistCreatedModal() {
  // close modal if open
  const btnClosePlaylistCreatedModal = document.getElementById('close-playlist-created-modal');
  btnClosePlaylistCreatedModal.click();

  // Show modal
  const playlistCreatedModal = new bootstrap.Modal(document.getElementById('playlist-created-modal'));
  playlistCreatedModal.show();
}

// Shows Playlist creation Error occurred modal
async function showPlaylistCreationErrorModal() {
  // close modal if open
  const btnClosePlaylistCreationErrorModal = document.getElementById('close-playlist-creation-error-modal');
  btnClosePlaylistCreationErrorModal.click();

  // Show modal
  const playlistCreationErrorModal = new bootstrap.Modal(document.getElementById('playlist-creation-error-modal'));
  playlistCreationErrorModal.show();
}


async function getSupportedMediaType() {
  let options = null;
  /*if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    options = {
      mimeType: 'video/webm; codecs=vp9',
      videoBitsPerSecond: 3000000
    };
    return options;
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
    options = {
      mimeType: 'video/webm; codecs=vp8,opus',
      videoBitsPerSecond: 3000000
    };
    return options;
  } else {
    return null;
  }*/

  // Rolling back the mime type feature
  options = {
    mimeType: 'video/webm; codecs=h264',
    //videoBitsPerSecond: 3000000
    videoBitsPerSecond: 1200000
  };
  return options;
}

// Shows the playlists already exists modal
async function showPlaylistAlreadyExistsModal() {
  // close modal if open
  const btnClosePlaylistAlreadyExistsModal = document.getElementById('close-playlist-already-exists-modal');
  btnClosePlaylistAlreadyExistsModal.click();

  // Show modal
  const playlistAlreadyExistsModal = new bootstrap.Modal(document.getElementById('playlist-already-exists-modal'));
  playlistAlreadyExistsModal.show();
}

// Shows the test details modal
async function showTestDetailsModal() {

  // close modal if open
  const btnCloseTestDetailsModal = document.getElementById('close-test-details-modal');
  btnCloseTestDetailsModal.click();

  // Get permission to show notifications in system tray
  showNotificationPermission = await Notification.requestPermission();
  console.log("showNotificationPermission: ", showNotificationPermission);

  // Show modal
  const testDetailsModal = new bootstrap.Modal(document.getElementById('test-details-modal'));
  testDetailsModal.show();
}

// show network error system tray notification
async function showNetworkErrorSystemTrayNotification() {
  // check for permission first
  if (showNotificationPermission === 'granted') {
    const errorNotification = new Notification('Recording stopped due to network error!', {
      body: '1. Check your internet connection.\n2. Start the recording process again.',
      icon: '/static/images/favicon.jpg'
    });
  }
}

// Shows the network error occurred modal
async function showNetworkErrorOccurredModal() {

  // Show network error system tray notification
  showNetworkErrorSystemTrayNotification();

  // Show an alert instead of a modal, with small delay
  setTimeout(showNetworkErrorAlert, 50);

  /*// close modal if open
  const btnCloseNetworkErrorOccurredModal = document.getElementById('close-network-error-occurred-modal');
  btnCloseNetworkErrorOccurredModal.click();

  // Show modal
  const networkErrorOccurredModal = new bootstrap.Modal(document.getElementById('networkErrorOccurred'));
  networkErrorOccurredModal.show();*/
}

// Shows a network error alert
function showNetworkErrorAlert() {
  let msg1 = "Recording stopped due to network error, please do the following.\n";
  let msg2 = " 1. Check your internet connection.\n";
  let msg3 = " 2. Refresh the page on your browser.\n";
  let msg4 = " 3. Start the recording process again.";
  let msg = msg1 + msg2 + msg3 + msg4;

  alert(msg);
}

// Shows creating playlist modal
async function showCreatingPlaylistModal(status) {

  if (status === true) {
    // close modal if open
    const btnCloseCreatingPlaylistModal = document.getElementById('btnCloseCreatingPlaylistModal');
    btnCloseCreatingPlaylistModal.click();

    // Show modal
    const creatingPlaylistModal = new bootstrap.Modal(document.getElementById('creatingPlaylistModal'));
    creatingPlaylistModal.show();
  } else {
    // close modal if open
    const btnCloseCreatingPlaylistModal = document.getElementById('btnCloseCreatingPlaylistModal');
    btnCloseCreatingPlaylistModal.click();
  }
}


// ====================================== CHANNEL CODE SECTION ============================================


// =====================================  Adding A Channel ================================================
async function showAddChannelModal() {
  // close modal if open
  const btnCloseAddNewChannelModal = document.getElementById('close-add-channel-modal');
  btnCloseAddNewChannelModal.click();

  // Show the Add Channel Modal
  const createChannelModal = new bootstrap.Modal(document.getElementById('add-channel-modal'));
  createChannelModal.show();
}
let channel_id = document.querySelector('input[name=channel_id');
channel_id.addEventListener('keyup', () =>{
  document.getElementById('id-error').innerText = '';
})
// Confiqure error display 
let channel_title = document.querySelector('input[name=channel_title]');
channel_title.addEventListener('keyup', () =>{
  document.getElementById('title-error').innerText = '';
});
let channel_credential = document.querySelector('textarea[name=channel_credentials]');
channel_credential.addEventListener('keyup', () =>{
  document.getElementById('credential-error').innerText = '';
});
// Checks if a string is JSON serializable
const isJSON = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}
document.getElementById("add-channel-btn").addEventListener("click", async function(event){
  event.preventDefault();
  
  const idMsg = 'Invalid channel ID format'
  const titleMsg = "Title should not include a dot(.) and be at least 3 and at most 50 characters";
  const credentialMsg = 'Invalid credential format';
  let channelId = document.getElementById("channel_id_modal").value;
  let channelTitle = document.getElementById("channel_title_modal").value;
  let channelCredentials = document.getElementById("channel_credentials_modal").value;
  const idError = document.getElementById('id-error');
  const titleError = document.getElementById('title-error');
  const credentialError = document.getElementById('credential-error');  
  let valid_input = true; 

  if (!channelId.match(/^UC[a-zA-Z0-9-_]{22}$/)) { 
      idError.innerText = idMsg;
      valid_input = false;
  } 
  if (!channelTitle.match(/^[a-zA-Z0-9_ -]{3,50}$/)) {
      titleError.innerText = titleMsg;
      valid_input = false;
  } 
  if (!isJSON(channelCredentials)) { 
      credentialError.innerText = credentialMsg;
      valid_input = false;
  } 
  if (valid_input) {
    const form = document.getElementById("add-channel");
    const formData = new FormData(form);
    fetch("http://127.0.0.1:8000/", {
      method: 'POST',
      body: formData
    })
    .then(async response => {
      const resp = await response.json()
      const { channel_id, channel_title, channel_credential} = resp;
      if (channel_id) {
        idError.innerText = channel_id[0]
      }
      if (channel_title) {
        titleError.innerText = channel_title[0]
      }
      if (channel_credential) {
        credentialError.innerText = channel_credential[0]
      }
      if ('message' in resp) {
        if (resp['message'] === 'Invalid channel!'){
          document.getElementById('add-status').style.color = 'rgb(161, 76, 76)';
          document.getElementById('add-status').innerText = resp['message'];
        } else {
          document.getElementById('add-status').style.color = 'rgb(72, 174, 128)';   
          document.getElementById('add-status').innerText = resp['message'];
        }
        console.log(resp['message'])
      }
    })
  }
})


// ======================================= Selecting a channel ===============================================

// Proceeds after channel is selected
async function channelSelected() {
  // Don't proceed if user has not selected a playlist
  if (currentRadioButtonID == null) {
    alert("Please select a channel!")
  } else {
    // Hide modal
    const btnCloseChannelSelectionModal = document.getElementById('close-channels-selection-modal');
    btnCloseChannelSelectionModal.click();
  
    confirmChannelSelection();
  }
}

// confirm playlist selection
async function confirmChannelSelection() {
  try {
    // close playlist selection modal
    const btnClosePlaylistSelectionModal = document.getElementById('close-channels-selection-modal');
    btnClosePlaylistSelectionModal.click();
    // Begins loading of playlists of the seleted channel
    showSelectYoutubePlaylistModal(currentChannelTitle);
  } catch (error) {
    console.error("Error while showing confirm channel selection modal: ", error.message)
  }
}

// creates a list of CHANNEL radio buttons
async function createchannelRadioButtons(id_title_dict) {

  // clear the table's playlist array
  tablePlaylists = [];
  // Create and add radio buttons to their HTML container
  for (const key in id_title_dict) {

    console.log(`${key}: ${id_title_dict[key]}`);
    var radiobox = document.createElement('input');
    radiobox.type = 'radio';
    radiobox.id = key; // playlist id
    radiobox.value = id_title_dict[key]; // playlist title
    radiobox.name = "user_playlist"
    radiobox.classList.add("form-check-input");
    radiobox.classList.add("ms-2");
    radiobox.onchange = function () {
      getSelectedChannelRadioButton();
    }
    let label = document.createElement('label')
    label.classList.add("ms-2");
    label.htmlFor = key;

    let description = document.createTextNode(id_title_dict[key]);
    label.appendChild(description);

    let newline = document.createElement('br');

    let radiboxString = radiobox.outerHTML.replace(">", ' onchange = "getSelectedChannelRadioButton(event);" />');
    let oneRow = radiboxString + label.outerHTML + newline.outerHTML
    let tempArray = [];
    tempArray.push(oneRow);

    // console.log('TempAray  ',tempArray)
    tableChannels.push(tempArray)
  }
  // console.log('Table Channels', tableChannels);
}

// Checks which radio button was pressed
async function getSelectedChannelRadioButton(event) {
  //console.log(event);
  currentRadioButtonID = null;
  let currentRadioButton = event.currentTarget;

  // console.log("Current Radio Button: ", currentRadioButton.value, currentRadioButton.id);
  currentRadioButtonID = currentRadioButton.id;
  currentChannelTitle = currentRadioButton.value;
  // console.log('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC')
  // console.log("userChanelSelection: ", currentChannelTitle); 
}

// Show modal window for user o select a channel
async function showSelectYoutubeChannelModal() {
  tableChannels = [];
  // hide the creating broadcast modal
  showCreatingBroadcastModal(false);

  // Show loading playlists message
  const receivedPlaylistsDiv = document.getElementById('received-channels');
  const loadingPlaylistsDiv = document.getElementById('loading-channels');
  const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-channels');
  receivedPlaylistsDiv.hidden = true;
  loadingPlaylistsDiv.hidden = false;
  failedToReceivePlaylistsDiv.hidden = true;

  // close modal if open
  const btnClosePlaylistSelectionModal = document.getElementById('close-channels-selection-modal');
  btnClosePlaylistSelectionModal.click();

  // Show modal
  const playlistSelectionlModal = new bootstrap.Modal(document.getElementById('channels-selection-modal'));
  playlistSelectionlModal.show();

  // Make attempt to fetch playlist
  currentRadioButtonID = null;
  // fetching the channels
  fetchChannels();
}

// fetches the channels
async function fetchChannels() {
  // Show loading playlists message
  const receivedChannelDiv = document.getElementById('received-channels');
  const loadingChannelDiv = document.getElementById('loading-channels');
  const failedToRetrieveChannelDiv = document.getElementById('failed-to-receive-channels');
  receivedChannelDiv.hidden = true;
  loadingChannelDiv.hidden = false;
  failedToRetrieveChannelDiv.hidden = true;

  let channels = {};

  let fetchChannelsApiUrl = 'youtube/fetchchannels/api/';
  // console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
  let status = null
  await fetch(fetchChannelsApiUrl, {
    method: 'GET',
  })
    .then(response =>{
      status = response.status;
      return response.json()
    }
  )
  .then((data) => {
    // console.log('ssssssssssssssssss  ', status);
    let channels_list = data.channels_list;
    console.log(channels_list);
    channels_list.map(obj =>{
      channels[obj.channel_id] = obj.channel_title;
      console.log('obj id ',obj.channel_id);
    })
    console.log('channels: ', channels)
    if (status == 200) {
      msg = "STATUS: Channels Received."
      document.getElementById("app-status").innerHTML = msg;

      // Use data to display radio buttons
      // console.log("Received channels Information: ", data)

      // Create Radio butttions for reieved/fetched channels
      createchannelRadioButtons(channels);

      // show the radio buttons
      const receivedChannelsDiv = document.getElementById('received-channels');
      const loadingChannelsDiv = document.getElementById('loading-channels');
      const failedToReceiveChannelsDiv = document.getElementById('failed-to-receive-channels');
      receivedChannelsDiv.hidden = false;
      loadingChannelsDiv.hidden = true;
      failedToReceiveChannelsDiv.hidden = true;

      // Refresh the channel selection table
      $('#channels-table').DataTable().clear().rows.add(tableChannels).draw();
      // console.log("tableChannels:  ", tableChannels);
    }
    else {
      // Server error message
      console.log("Server Error Message: ", json)
      msg = "STATUS: Failed to Fetch Playlists."
      document.getElementById("app-status").innerHTML = msg;

      // Show loading channels failed message
      const receivedPlaylistsDiv = document.getElementById('received-channels');
      const loadingPlaylistsDiv = document.getElementById('loading-channels');
      const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-channels');
      receivedPlaylistsDiv.hidden = true;
      loadingPlaylistsDiv.hidden = true;
      failedToReceivePlaylistsDiv.hidden = false;
    }    
  })
  .catch(error => {
    // console.error(error)
    msg = "STATUS: Failed to Fetch Playlists."
    document.getElementById("app-status").innerHTML = msg;

    //  Show loading channels failed message
    const receivedPlaylistsDiv = document.getElementById('received-channels');
    const loadingPlaylistsDiv = document.getElementById('loading-channels');
    const failedToReceivePlaylistsDiv = document.getElementById('failed-to-receive-channels');
    receivedPlaylistsDiv.hidden = true;
    loadingPlaylistsDiv.hidden = true;
    failedToReceivePlaylistsDiv.hidden = false;
  });
}

// Ojophilip
// fetch youtube channel for playlist creation
async function fetchChannelsforPlaylistCreation() {

  let channels = {};

  let fetchChannelsApiUrl = 'youtube/fetchchannels/api/';
  // console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
  let status = null
  await fetch(fetchChannelsApiUrl, {
    method: 'GET',
  })
    .then(response =>{
      status = response.status;
      return response.json()
    }
  )
  .then((data) => {
    // console.log('ssssssssssssssssss  ', status);
    let channels_list = data.channels_list;
    console.log(channels_list);
    channels_list.map(obj =>{
      channels[obj.channel_id] = obj.channel_title;
      console.log('obj id ',obj.channel_id);
    })
    console.log('channels: ', channels)
    if (status == 200) {
      msg = "STATUS: Channels Received."
      document.getElementById("app-status").innerHTML = msg;

  
      createchannelRadioButtons(channels);

      // Refresh the channel selection table
      $('#select-channels-table').DataTable().clear().rows.add(tableChannels).draw();
      // console.log("tableChannels:  ", tableChannels);
    }
    else {
      // Server error message
      console.log("Server Error Message: ", json)
      msg = "STATUS: Failed to Fetch channel."
      document.getElementById("app-status").innerHTML = msg;
    }    
  })
  .catch(error => {
    // console.error(error)
    msg = "STATUS: Failed to Fetch channel."
    document.getElementById("app-status").innerHTML = msg;
  });
}
