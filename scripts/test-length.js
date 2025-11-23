const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

// Get the input file from command line args
const inputFile = process.argv[2] || 'example_project/forgotten-sunset.als';

console.log(`Testing length extraction for: ${inputFile}`);

// Decompress and parse
const input = fs.createReadStream(inputFile);
const chunks = [];
const unzip = zlib.createUnzip();

input.pipe(unzip);

unzip.on('data', chunk => chunks.push(chunk));
unzip.on('end', () => {
  const xmlData = Buffer.concat(chunks).toString('utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  const parsed = parser.parse(xmlData);
  const liveSet = parsed.Ableton?.LiveSet;

  if (!liveSet) {
    console.log('ERROR: Could not find LiveSet in XML');
    return;
  }

  // Get tempo - stored in MainTrack > DeviceChain > Mixer > Tempo
  let tempo = 120;
  if (liveSet.MainTrack?.DeviceChain?.Mixer?.Tempo?.Manual?.['@_Value']) {
    tempo = parseFloat(liveSet.MainTrack.DeviceChain.Mixer.Tempo.Manual['@_Value']);
  }

  console.log(`Tempo: ${tempo} BPM`);

  let furthestBeat = 0;
  let clipCount = 0;

  function processTrackClips(track, trackName) {
    if (!track?.DeviceChain?.MainSequencer) return;

    const mainSeq = track.DeviceChain.MainSequencer;

    // Check arrangement clips
    const arrangerEvents = mainSeq.ClipTimeable?.ArrangerAutomation?.Events;
    if (arrangerEvents) {
      ['MidiClip', 'AudioClip'].forEach(clipType => {
        const clips = arrangerEvents[clipType];
        if (clips) {
          const clipArray = Array.isArray(clips) ? clips : [clips];
          clipArray.forEach(clip => {
            if (clip) {
              clipCount++;
              const startTime = parseFloat(clip['@_Time'] || '0');
              const currentEnd = parseFloat(clip.CurrentEnd?.['@_Value'] || '0');
              const currentStart = parseFloat(clip.CurrentStart?.['@_Value'] || '0');
              const clipEnd = startTime + (currentEnd - currentStart);
              console.log(`  [Arr] ${clipType} in ${trackName}: start=${startTime}, end=${clipEnd}`);
              if (clipEnd > furthestBeat) furthestBeat = clipEnd;
            }
          });
        }
      });
    }

    // Check session clips
    const clipSlots = mainSeq.ClipSlotList?.ClipSlot;
    if (clipSlots) {
      const slotArray = Array.isArray(clipSlots) ? clipSlots : [clipSlots];
      slotArray.forEach(slot => {
        const clipValue = slot?.ClipSlot?.Value;
        if (clipValue) {
          ['MidiClip', 'AudioClip'].forEach(clipType => {
            const clip = clipValue[clipType];
            if (clip) {
              clipCount++;
              const currentEnd = parseFloat(clip.CurrentEnd?.['@_Value'] || '0');
              const currentStart = parseFloat(clip.CurrentStart?.['@_Value'] || '0');
              const clipLength = currentEnd - currentStart;
              console.log(`  [Session] ${clipType} in ${trackName}: length=${clipLength} beats`);
              if (clipLength > furthestBeat) furthestBeat = clipLength;
            }
          });
        }
      });
    }
  }

  // Process all tracks
  ['AudioTrack', 'MidiTrack', 'ReturnTrack'].forEach(trackType => {
    const tracks = liveSet.Tracks?.[trackType];
    if (tracks) {
      const trackArray = Array.isArray(tracks) ? tracks : [tracks];
      trackArray.forEach(track => {
        const trackName = track.Name?.EffectiveName?.['@_Value'] || 'Unknown';
        processTrackClips(track, trackName);
      });
    }
  });

  console.log(`\nTotal clips found: ${clipCount}`);
  console.log(`Furthest beat: ${furthestBeat}`);

  if (furthestBeat > 0) {
    const lengthInSeconds = (furthestBeat / tempo) * 60;
    const minutes = Math.floor(lengthInSeconds / 60);
    const seconds = Math.floor(lengthInSeconds % 60);
    console.log(`Project length: ${lengthInSeconds.toFixed(2)} seconds (${minutes}:${seconds.toString().padStart(2, '0')})`);
  } else {
    console.log('No clips found - cannot determine length');
  }
});

unzip.on('error', err => {
  console.error('Error:', err);
});
