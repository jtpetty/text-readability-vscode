// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { stringify } from 'querystring';
import * as vscode from 'vscode';

const rs = require('text-readability')

interface IScaleDefinition {
	id: string;
	label: string;
	calculate: (text: string) => string;
	clarify?: (score: string) => string;
	precheck?: (text: string) => string;
	asStatusBarItem?: { 
		alignment: vscode.StatusBarAlignment, 
		priority?: number
	};
}

// I found this on Stackoverflow - I feel like there should be a library for this, but using this for now: https://stackoverflow.com/questions/13627308/add-st-nd-rd-and-th-ordinal-suffix-to-a-number
function nth(n: number){return["st","nd","rd"][((n+90)%100-10)%10-1]||"th"}


const complexityScalesToExpose: IScaleDefinition[] = [
	{ 
		id: 'syllableCount',
		label: 'Syllable Count',
		calculate: function(text: string) { return rs.syllableCount(text, 'en-US') },
		asStatusBarItem: {
			alignment: vscode.StatusBarAlignment.Left,
			priority: 25,
		},
	},
	{ 
		id: 'lexiconCount',
		label: 'Lexicon Count',
		calculate: function(text: string) { return rs.lexiconCount(text, true) }
	},
	{ 
		id: 'sentenceCount',
		label: 'Sentence Count',
		calculate: function(text: string) { return rs.sentenceCount(text) },
	},
	{ 
		id: 'fleschReadingEase',
		label: 'Flesch Reading Ease',
		calculate: function(text: string) { return rs.fleschReadingEase(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			if (score < 0 || score > 100) return "Unknown";
			if (score < 30) return "Very Confusing";
			if (score < 50) return "Difficult";
			if (score < 60) return "Fairly Difficult";
			if (score < 70) return "Standard";
			if (score < 80) return "Fairly Easy";
			if (score < 90) return "Easy";
			return "Very Easy";
		},
	},
	{ 
		id: 'fleschKincade',
		label: 'Flesch-Kincaid Grade Level',
		calculate: function(text: string) { return rs.fleschKincaidGrade(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			return gradeToGradeLevelDescription(score);
		}
	},
	{ 
		id: 'fogScale',
		label: 'Gunning FOG Formula',
		calculate: function(text: string) { return rs.gunningFog(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			return gradeToGradeLevelDescription(score);
		}
	},
	{ 
		id: 'smogIndex',
		label: 'SMOG Index',
		calculate: function(text: string) { return rs.smogIndex(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			return gradeToGradeLevelDescription(score);
		},
		precheck: function(text: string) : string {
			var numSentences = rs.sentenceCount(text);
			if (numSentences < 30) {
				return `Invalid - Need >= 30 sentences, found ${numSentences}`;
			}
			return "";
		}
	},
	{ 
		id: 'automatedReadabilityIndex',
		label: 'Automated Readability Index',
		calculate: function(text: string) { return rs.automatedReadabilityIndex(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			let gradeStart = Math.floor(score);
			let gradeEnd = Math.ceil(score);
			if (gradeStart == gradeEnd) {
				return gradeToGradeLevelDescription(score);
			}
			return `${gradeToGradeLevelDescription(gradeStart)} - ${gradeToGradeLevelDescription(gradeEnd)}`;
		}
	},
	{ 
		id: 'colemanLiau',
		label: 'Coleman-Liau Index',
		calculate: function(text: string) { return rs.colemanLiauIndex(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			return gradeToGradeLevelDescription(score);
		}
	},
	{ 
		id: 'linsearWrite',
		label: 'Linsear Write Formula',
		calculate: function(text: string) { return rs.linsearWriteFormula(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			return gradeToGradeLevelDescription(score);
		}
	},
	{ 
		id: 'daleChall',
		label: 'Dale-Chall Readability Score',
		calculate: function(text: string) { return rs.daleChallReadabilityScore(text); },
		clarify: function (rawScore: string) : string {
			let score = parseFloat(rawScore);
			if (score < 5) return "Average 4th-grade student or lower";
			if (score < 6) return "Average 5th or 6th-grade student";
			if (score < 7) return "Average 7th or 8th-grade student";
			if (score < 8) return "Average 9th or 10th-grade student";
			if (score < 9) return "Average 11th or 12th-grade student";
			if (score < 10) return "Average college student";
			return "Unknown student grade";
		}
	},
	{ 
		id: 'readabilityConsensus',
		label: 'Readability Consensus',
		calculate: function(text: string) { return rs.textStandard(text, false); },
		precheck: function(text: string) : string {
			if (text) {
				return  "";
			}
			return "Invalid - Need text";
		},
		asStatusBarItem: {
			alignment: vscode.StatusBarAlignment.Left,
			priority: 25,
		},
	},
];

function gradeToGradeLevelDescription(grade: number) {
	if (grade >= 17) return "College graduate";
	if (grade >= 16) return "College senior";
	if (grade >= 15) return "College junior";
	if (grade >= 14) return "College sophomore";
	if (grade >= 13) return "College freshman"
	if (grade >= 12) return "High school senior";
	if (grade >= 11) return "High school junior";
	if (grade >= 10) return "High school sophomore";
	if (grade >= 9) return "High school freshman"

	return `${grade}${nth(grade)} grade`
}

export function activate(context: vscode.ExtensionContext) {

	complexityScalesToExpose.forEach( (scale) => {
		let commandId = `text-readability-vscode.${scale.id}`;
		context.subscriptions.push(vscode.commands.registerCommand(commandId, createCommandCallback(scale)));
		// TODO: which scales are visible in the status bar should be a user controlled setting and the command for 
		//       that is triggered when clicking on the status bar item should probably be to open up that configuration
		if (scale.asStatusBarItem) {
			let statusBarProps = scale.asStatusBarItem;
			let statusBarItem = vscode.window.createStatusBarItem(statusBarProps.alignment, statusBarProps.priority);
			statusBarItem.command = commandId;
			context.subscriptions.push(statusBarItem);

			let updateStatusBarItem = function(): void {
				//TODO: Should we only react here if the file is plain text?
				if (vscode.window.activeTextEditor) { 
					const text = vscode.window.activeTextEditor.document.getText();
					if (scale.precheck) {
						let precheckMessage = scale.precheck(text);
						if (precheckMessage) {
							statusBarItem.text = " "; // TODO: should show some type of warning
							statusBarItem.tooltip = precheckMessage;
							return;
						}
					}
					const metric = scale.calculate(text);
					statusBarItem.text = `${metric}`;
					if (scale.clarify) {
						statusBarItem.tooltip = `${scale.label} : ${scale.clarify(metric)}`;
					}
					else {
						statusBarItem.tooltip = `${scale.label} : ${metric}`;
					}
					statusBarItem.show();
				} else {
					statusBarItem.hide();
				}
			}

			context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem));
			context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));
			updateStatusBarItem();
		}
	});	

	let provider = new  ReadabilityScaleProvider();
	let providerRefresh = function(): void {
		provider.refresh();
	};
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(providerRefresh));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(providerRefresh));
	vscode.window.registerTreeDataProvider(
		'text-readability-vscode.readabilityScalesView',
		provider
	);
}


function createCommandCallback(scale: IScaleDefinition) {
	return function () {

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			let currentSelection = editor.selection;
			let text = "";
			if (!currentSelection.isEmpty) {
				text = editor.document.getText(currentSelection);
			}
			else {
				text = editor.document.getText();
			}
			if (text) {
				if (scale.precheck) {
					let precheckMessage = scale.precheck(text);
					if (precheckMessage) {
						vscode.window.showInformationMessage(`${scale.label} : ${precheckMessage}`);
						return;
					}
				}
				let metric = scale.calculate(text);
				let result = `${metric}`;
				if (scale.clarify) {
					let clarification = scale.clarify(metric);
					result = `${result} - ${clarification}`;
				}
				vscode.window.showInformationMessage(`${scale.label} : ${result}`);
			}
		}
	};
}

// this method is called when your extension is deactivated
export function deactivate() {}

interface IScaleResult {
	scale: IScaleDefinition,
	metric: string,
	clarification?: string,
	precheck?: string,
}

export class ReadabilityScaleProvider implements vscode.TreeDataProvider<IScaleResult> {
	
	private _onDidChangeTreeData: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
	readonly onDidChangeTreeData: vscode.Event<undefined> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: IScaleResult): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(element.scale.label);
		if (element.precheck) {
			treeItem.description = `${element.precheck}`;
		} else {
			treeItem.description = `${element.metric}`;
			if (element.clarification) {
				treeItem.tooltip = `${element.clarification}`;
			}
		}

		return treeItem;
	}

	getChildren(element?: IScaleResult): Thenable<IScaleResult[]> {
		if (element) {
			return Promise.resolve([]);
		}
		let childPromises: Promise<IScaleResult>[] = [];
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const text = editor.document.getText();
			complexityScalesToExpose.forEach((scale) => {
				childPromises.push(
					new Promise((resolve, reject) => {
						let metric = scale.calculate(text);
						let result: IScaleResult = { scale: scale, metric: metric };
						if (scale.precheck) {
							result.precheck = scale.precheck(text);
						}
						if (scale.clarify) {
							result.clarification = scale.clarify(metric);
						}
						resolve(result);
					}));
			});
		}
		return Promise.all(childPromises);
	}
}

