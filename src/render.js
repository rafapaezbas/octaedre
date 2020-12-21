const utils = require('./utils');
const cons = require('./constants');

const header = [ 240, 00, 32, 41, 2, 24, 10 ];
const flashHeader = [ 240, 00, 32, 41, 2, 24, 40 , 0 ];

exports.render = (output,scenes,state) => {
	var sysex = []
	var stepsMessage = generateStepsMessage(scenes,state);
	var mutesMessage = generateMutesMessage(scenes,state);
	var notesMessage = generateNotesMessage(scenes,state);
	var scenesMessage = generateScenesMessage(scenes,state);
	var arrowMessage = generateArrowMessage();
	var flashLastPressedStepMessage = flashLastPressedStep(scenes,state);
	var message = sysex.concat(header).concat(stepsMessage).concat(mutesMessage).concat(scenesMessage).concat(notesMessage).concat(arrowMessage).concat([247]);
	output.send('sysex',message);
	output.send('sysex',flashLastPressedStepMessage);
	return message;
};

// TODO improve this, please.
exports.lightCurrentStep = (output,state,scenes) => { 
	var trackLength = scenes[state.currentScene].tracks[state.currentTrack].trackLength;
	var modCurrentStep = state.currentStep * scenes[state.currentScene].tracks[state.currentTrack].tempoModifier;
	var prevStep = modCurrentStep != 0 ? modCurrentStep - 1 : trackLength - 1;
	if(utils.isInt(modCurrentStep)){
		var sysex = [];
		var message = sysex.concat(header).concat(resetStepMessage((prevStep) % trackLength,state, scenes)).concat([cons.BIG_GRID[modCurrentStep % trackLength],cons.COLOR_4]).concat([247]);
		output.send('sysex',message);
	}
	if(prevStep % trackLength == state.lastPressedStep){
		var flashLastPressedStepMessage = flashLastPressedStep(scenes,state);
		output.send('sysex',flashLastPressedStepMessage);
	}
}

const generateStepsMessage = (scenes,state) => {
	return scenes[state.currentScene].tracks[state.currentTrack].pattern.reduce((acc,e,i) => {
		acc.push(cons.BIG_GRID[i]);
		if(i < scenes[state.currentScene].tracks[state.currentTrack].trackLength){
			e.active ? acc.push(cons.COLOR_2) : acc.push(scenes[state.currentScene].tracks[state.currentTrack].color);
		} else {
			acc.push(0);
		}
		return acc;
	},[]);
};

const generateNotesMessage = (scenes,state) => {
	return scenes[state.currentScene].tracks[state.currentTrack].pattern[state.lastPressedStep].notes.reduce((acc,e,i) => {
		acc.push(cons.INNER_GRID[i]);
		e ? acc.push(7) : acc.push(cons.COLOR_6);
		return acc;
	},[]);
};

const generateMutesMessage = (scenes,state) => {
	return scenes[state.currentScene].tracks.reduce((acc,e,i) => {
		acc.push(cons.MUTE_BUTTONS[i]);
		e.muted ? acc.push(0) : acc.push(e.color);
		return acc;
	},[]);
};

const generateScenesMessage = (scenes,state) => {
	return cons.SCENE_BUTTONS.reduce((acc,e, i) => {
		acc.push(e);
		i == state.currentScene ? acc.push(cons.COLOR_2) : acc.push(cons.COLOR_5);
		return acc;
	},[]);
};

const generateArrowMessage = () => {
	return [cons.LEFT_ARROW_BUTTON, cons.COLOR_6,cons.RIGHT_ARROW_BUTTON, cons.COLOR_6];
}

const flashLastPressedStep = (scenes, state) => {
	var sysex = [];
	var stepButton = cons.BIG_GRID[state.lastPressedStep];
	var currentTrack = scenes[state.currentScene].tracks[state.currentTrack];
	var color = currentTrack.pattern[state.lastPressedStep].active ? cons.COLOR_2 : currentTrack.color;
	return sysex.concat(flashHeader).concat([stepButton, color]).concat([247]);
};

const resetStepMessage = (step,state,scenes) => {
	var trackColor = scenes[state.currentScene].tracks[state.currentTrack].color;
	var color = scenes[state.currentScene].tracks[state.currentTrack].pattern[step].active ? cons.COLOR_2 : trackColor;
	return [cons.BIG_GRID[step], color];
}
