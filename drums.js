/*

   This is modified code from the "shiny drum machine" example at http://chromium.googlecode.com/svn/trunk/samples/audio/shiny-drum-machine.html

*/
/*
Copyright 2011, Google Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
    * Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

function Drums(soundsDir) {
// Temporary patch until all browsers support unprefixed context.
if (window.hasOwnProperty('AudioContext') && !window.hasOwnProperty('webkitAudioContext'))
    window.webkitAudioContext = AudioContext;

var impulseResponsesDir = soundsDir + "/impulse-responses"

var context;
var convolver;
var compressor;
var masterGainNode;
var effectLevelNode;

// Each effect impulse response has a specific overall desired dry and wet volume.
// For example in the telephone filter, it's necessary to make the dry volume 0 to correctly hear the effect.
var effectDryMix = 1.0;
var effectWetMix = 1.0;

var timeoutId;

var startTime;
var lastDrawTime = -1;

var kits;

var kNumInstruments = 6;
var kInitialKitIndex = 1;
var kMaxSwing = .08;

var currentKit;

kickPitch = snarePitch = hihatPitch = tom1Pitch = tom2Pitch = tom3Pitch = 0;

var loopLength = 16;
var rhythmIndex = 0;
var kMinTempo = 50;
var kMaxTempo = 180;
var noteTime = 0.0;

var instruments = ['Kick', 'Snare', 'HiHat', 'Tom1', 'Tom2', 'Tom3'];

var volumes = [0, 0.3, 1];

var kitCount = 0;

var kitName = [
    "R8",
    "CR78",
    "KPR77",
    "LINN",
    "Kit3",
    "Kit8",
    "Techno",
    "Stark",
    "breakbeat8",
    "breakbeat9",
    "breakbeat13",
    "acoustic-kit",
    "4OP-FM",
    "TheCheebacabra1",
    "TheCheebacabra2"
    ];

var kitNamePretty = [
    "Roland R-8",
    "Roland CR-78",
    "Korg KPR-77",
    "LinnDrum",
    "Kit 3",
    "Kit 8",
    "Techno",
    "Stark",
    "Breakbeat 8",
    "Breakbeat 9",
    "Breakbeat 13",
    "Acoustic Kit",
    "4OP-FM",
    "The Cheebacabra 1",
    "The Cheebacabra 2"
    ];

function Kit(name) {
    this.name = name;

    this.pathName = function() {
        var pathName = soundsDir + "/drum-samples/" + this.name + "/";
        return pathName;
    };

    this.kick = 0;
    this.snare = 0;
    this.hihat = 0;

    this.instrumentCount = kNumInstruments;
    this.instrumentLoadCount = 0;
    
    this.startedLoading = false;
    this.isLoaded = false;
    
}

Kit.prototype.load = function() {
    if (this.startedLoading)
        return;
        
    this.startedLoading = true;
        
    var pathName = this.pathName();

    var kickPath = pathName + "kick.wav";
    var snarePath = pathName + "snare.wav";
    var hihatPath = pathName + "hihat.wav";
    var tom1Path = pathName + "tom1.wav";
    var tom2Path = pathName + "tom2.wav";
    var tom3Path = pathName + "tom3.wav";

    this.loadSample(0, kickPath, false);
    this.loadSample(1, snarePath, false);
    this.loadSample(2, hihatPath, true);  // we're panning only the hihat
    this.loadSample(3, tom1Path, false);
    this.loadSample(4, tom2Path, false);
    this.loadSample(5, tom3Path, false);
}

Kit.prototype.loadSample = function(sampleID, url, mixToMono) {
    // Load asynchronously

    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    var kit = this;

    request.onload = function() {
        context.decodeAudioData(
            request.response,
            function(buffer) {
                switch (sampleID) {
                    case 0: kit.kick = buffer; break;
                    case 1: kit.snare = buffer; break;
                    case 2: kit.hihat = buffer; break;
                    case 3: kit.tom1 = buffer; break;
                    case 4: kit.tom2 = buffer; break;
                    case 5: kit.tom3 = buffer; break;
                }

                kit.instrumentLoadCount++;
                if (kit.instrumentLoadCount == kit.instrumentCount) {
                    kit.isLoaded = true;
                    assetLoaded(kit)
                }
            },
            
            function(buffer) {
                console.log("Error decoding drum samples!");
            }
        );
    }

    request.send();
}

var impulseResponseInfoList = [
    // Impulse responses - each one represents a unique linear effect.
    {"name":"No Effect", "url":"undefined", "dryMix":1, "wetMix":0},
    {"name":"Spreader 1", "url":impulseResponsesDir+"/spreader50-65ms.wav",        "dryMix":0.8, "wetMix":1.4},
    {"name":"Spreader 2", "url":impulseResponsesDir+"/noise-spreader1.wav",        "dryMix":1, "wetMix":1},
    {"name":"Spring Reverb", "url":impulseResponsesDir+"/feedback-spring.wav",     "dryMix":1, "wetMix":1},
    {"name":"Space Oddity", "url":impulseResponsesDir+"/filter-rhythm3.wav",       "dryMix":1, "wetMix":0.7},
    {"name":"Reverse", "url":impulseResponsesDir+"/spatialized5.wav",              "dryMix":1, "wetMix":1},
    {"name":"Huge Reverse", "url":impulseResponsesDir+"/matrix6-backwards.wav",    "dryMix":0, "wetMix":0.7},
    {"name":"Telephone Filter", "url":impulseResponsesDir+"/filter-telephone.wav", "dryMix":0, "wetMix":1.2},
    {"name":"Lopass Filter", "url":impulseResponsesDir+"/filter-lopass160.wav",    "dryMix":0, "wetMix":0.5},
    {"name":"Hipass Filter", "url":impulseResponsesDir+"/filter-hipass5000.wav",   "dryMix":0, "wetMix":4.0},
    {"name":"Comb 1", "url":impulseResponsesDir+"/comb-saw1.wav",                  "dryMix":0, "wetMix":0.7},
    {"name":"Comb 2", "url":impulseResponsesDir+"/comb-saw2.wav",                  "dryMix":0, "wetMix":1.0},
    {"name":"Cosmic Ping", "url":impulseResponsesDir+"/cosmic-ping-long.wav",      "dryMix":0, "wetMix":0.9},
    {"name":"Kitchen", "url":impulseResponsesDir+"/kitchen-true-stereo.wav", "dryMix":1, "wetMix":1},
    {"name":"Living Room", "url":impulseResponsesDir+"/dining-living-true-stereo.wav", "dryMix":1, "wetMix":1},
    {"name":"Living-Bedroom", "url":impulseResponsesDir+"/living-bedroom-leveled.wav", "dryMix":1, "wetMix":1},
    {"name":"Dining-Far-Kitchen", "url":impulseResponsesDir+"/dining-far-kitchen.wav", "dryMix":1, "wetMix":1},
    {"name":"Medium Hall 1", "url":impulseResponsesDir+"/matrix-reverb2.wav",      "dryMix":1, "wetMix":1},
    {"name":"Medium Hall 2", "url":impulseResponsesDir+"/matrix-reverb3.wav",      "dryMix":1, "wetMix":1},
    {"name":"Large Hall", "url":impulseResponsesDir+"/spatialized4.wav",           "dryMix":1, "wetMix":0.5},
    {"name":"Peculiar", "url":impulseResponsesDir+"/peculiar-backwards.wav",       "dryMix":1, "wetMix":1},
    {"name":"Backslap", "url":impulseResponsesDir+"/backslap1.wav",                "dryMix":1, "wetMix":1},
    {"name":"Warehouse", "url":impulseResponsesDir+"/cardiod-rear-levelled.wav", "dryMix":1, "wetMix":1},
    {"name":"Diffusor", "url":impulseResponsesDir+"/diffusor3.wav",                "dryMix":1, "wetMix":1},
    {"name":"Binaural Hall", "url":impulseResponsesDir+"/s2_r4_bd.wav",   "dryMix":1, "wetMix":0.5},
    {"name":"Huge", "url":impulseResponsesDir+"/matrix-reverb6.wav",               "dryMix":1, "wetMix":0.7},
]

var impulseResponseList = 0;

function ImpulseResponse(url, index) {
    this.url = url;
    this.index = index;
    this.startedLoading = false;
    this.isLoaded_ = false;
    this.buffer = 0;
}

ImpulseResponse.prototype.isLoaded = function() {
    return this.isLoaded_;
}

ImpulseResponse.prototype.load = function() {
    if (this.startedLoading) {
        return;
    }
    
    this.startedLoading = true;

    // Load asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", this.url, true);
    request.responseType = "arraybuffer";
    this.request = request;
    
    var asset = this;

    request.onload = function() {
        context.decodeAudioData(
            request.response,
            function(buffer) {
                asset.buffer = buffer;
                asset.isLoaded_ = true;
                assetLoaded(asset)
            },
            
            function(buffer) {
                console.log("Error decoding impulse response!");
            }
        );
    }

    request.send();
}

function startLoadingAssets() {
    impulseResponseList = new Array();

    for (i = 0; i < impulseResponseInfoList.length; i++) {
        impulseResponseList[i] = new ImpulseResponse(impulseResponseInfoList[i].url, i);
    }
    
    // Initialize drum kits
    var numKits = kitName.length;
    kits = new Array(numKits);
    for (var i  = 0; i < numKits; i++) {
        kits[i] = new Kit(kitName[i]);
        assetsLoading++
    }  
    
    // Then load the remaining assets.
    // Note that any assets which have previously started loading will be skipped over.
    for (var i  = 0; i < numKits; i++) {
        kits[i].load();
    }  

    // Start at 1 to skip "No Effect"
    for (i = 1; i < impulseResponseInfoList.length; i++) {
        impulseResponseList[i].load();
        assetsLoading++
    }
    
    // Setup initial drumkit
    currentKit = kits[kInitialKitIndex];
}


function init() {
    startLoadingAssets();

    context = new webkitAudioContext();

    var finalMixNode;
    if (context.createDynamicsCompressor) {
        // Create a dynamics compressor to sweeten the overall mix.
        compressor = context.createDynamicsCompressor();
        compressor.connect(context.destination);
        finalMixNode = compressor;
    } else {
        // No compressor available in this implementation.
        finalMixNode = context.destination;
    }

    // Create master volume.
    masterGainNode = context.createGain();
    masterGainNode.gain.value = 0.7; // reduce overall volume to avoid clipping
    masterGainNode.connect(finalMixNode);

    // Create effect volume.
    effectLevelNode = context.createGain();
    effectLevelNode.gain.value = 1.0; // effect level slider controls this
    effectLevelNode.connect(masterGainNode);

    // Create convolver for effect
    convolver = context.createConvolver();
    convolver.connect(effectLevelNode);
}

var assetsLoading = 0

function assetLoaded(asset) {
  assetsLoading--
  if (assetsLoading == 0 )
    document.dispatchEvent(new CustomEvent("drumsloaded", drums))
}


function playNote(buffer, pan, x, y, z, sendGain, mainGain, playbackRate, noteTime) {
    // Create the note
    var voice = context.createBufferSource();
    voice.buffer = buffer;
    voice.playbackRate.value = playbackRate;

    // Optionally, connect to a panner
    var finalNode;
    if (pan) {
        var panner = context.createPanner();
        panner.setPosition(x, y, z);
        voice.connect(panner);
        finalNode = panner;
    } else {
        finalNode = voice;
    }

    // Connect to dry mix
    var dryGainNode = context.createGain();
    dryGainNode.gain.value = mainGain * effectDryMix;
    finalNode.connect(dryGainNode);
    dryGainNode.connect(masterGainNode);

    // Connect to wet mix
    var wetGainNode = context.createGain();
    wetGainNode.gain.value = sendGain;
    finalNode.connect(wetGainNode);
    wetGainNode.connect(convolver);

    voice.start(noteTime);
}

function setEffect(index) {
    if (index > 0 && !impulseResponseList[index].isLoaded()) {
        alert('Sorry, this effect is still loading.  Try again in a few seconds :)');
        return;
    }

    effectDryMix = impulseResponseInfoList[index].dryMix;
    effectWetMix = impulseResponseInfoList[index].wetMix;            
    convolver.buffer = impulseResponseList[index].buffer;
}

init()

function playDrum(name, gain) {
  var drum
  if (typeof name == "object")
    drum = name
  else
    drum = { name: name, gain : gain }
  if (drum.gain == undefined) drum.gain = 1.0
  playNote(currentKit[drum.name], false, 0,0,-2, 0.5*drum.gain, 1.0*drum.gain, 1);
}

var drums = {
  setEffect: setEffect,
  play: playDrum
}

return drums

}
