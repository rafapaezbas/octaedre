const async = require('async');
const chords = require('./chords');
const render = require('./render');
const io = require('./midi-io.js');

exports.playNextStep = (state,scenes) => {
	sendNoteOff(state);
	sendNoteOn(state,scenes);
	checkSceneChange(state,scenes);
};

exports.resetClock = (state) => {
	if(state.resetClockTimeout != undefined){
		clearTimeout(state.resetClockTimeout);
	}
	state.resetClockTimeout = setTimeout(() => {
		state.clockTick = -1;
		state.currentStep = 0;
	},500);
};

const sendNoteOn = (state,scenes) => {
	var tasks = [];
	var scene = getPlayingScene(state);
	scenes[scene].tracks.map(t => {
		var trackCurrentStep = (state.currentStep * t.tempoModifier);
		var step = t.pattern[trackCurrentStep % t.trackLength];
		if(step != undefined && step.active && !t.muted){
			playStep(t,step,state,tasks);
			playChord(t,step,state,tasks);
			async.parallel(tasks,(error,results) => {});
		}
	});
};

const playStep = (track,step,state,tasks) => {
	step.notes.map((n,i) => {
		if(n) {
			tasks.push((callback) => {
				io.output.send('noteon', {note: track.midiRoot + i,velocity: step.velocity,channel: track.channel});
				state.midiNotesQueue.push({clockTick: state.clockTick, length: step.length / track.tempoModifier, note: track.midiRoot + i, channel: track.channel});
				callback();
			});
		}
	});
};

const playChord = (track,step,state,tasks) => {
	step.chords.map(n => {
		var chord = state.chords[n];
		state.chords[n].inversion.filter((e,i) => chords.filterByMode(i,chord.mode)).map(e => {
			tasks.push((callback) => {
				io.output.send('noteon', {note: e, velocity: step.velocity, channel: track.channel});
				state.midiNotesQueue.push({clockTick: state.clockTick, length: step.length, note: e, channel: track.channel});
				callback();
			});
		});
	});
};

const sendNoteOff = (state) => {
	var tasks = [];
	state.midiNotesQueue.map((e) => {
		if(state.clockTick - e.clockTick >= e.length * state.clockResolution) {
			tasks.push((callback) => {
				io.output.send('noteoff', {note: e.note ,velocity: 127,channel: e.channel});
				callback();
			});
		}
	});
	state.midiNotesQueue = state.midiNotesQueue.filter(e => state.clockTick - e.clockTick < e.length * state.clockResolution);
	async.parallel(tasks,(error,results) => {});
};

const getPlayingScene = (state) => {
	var shouldChange = state.clockTick % (6*16) == 0;
	var nextScene = !shouldChange ? state.scenesChain[state.currentSceneInChain % state.scenesChain.length] : state.scenesChain[state.currentSceneInChain++ % state.scenesChain.length];
	return state.chainMode && shouldChange ? nextScene : state.currentScene;
};

const checkSceneChange = (state,scenes) => {
	if(state.chainMode && state.clockTick % (6*16) == 0){
		state.currentScene = state.scenesChain[state.currentSceneInChain % state.scenesChain.length];
		render.render(scenes,state);
	}
};
