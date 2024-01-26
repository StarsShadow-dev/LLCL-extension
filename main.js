'use strict';

const vscode = require('vscode');
const child_process = require('child_process')
const fs = require("fs");
const { homedir } = require('os');

console.log("setting up the LLCL VS Code Extension");

let diagnosticCollection = vscode.languages.createDiagnosticCollection('go');

function getCompilerPath() {
	const compilerPathConfiguration = vscode.workspace.getConfiguration().get('conf.llcl_vscode.compilerPath')
	let compilerPath = "";
	if (compilerPathConfiguration.length > 0) {
		if (compilerPathConfiguration[0] == "~") {
			let newCompilerPath = compilerPathConfiguration.split("");
			newCompilerPath.shift();
			compilerPath = `${homedir}${newCompilerPath.join("")}`;
		} else {
			compilerPath = `${vscode.workspace.workspaceFolders[0].uri.path}${compilerPathConfiguration}`;
		}
	} else {
		compilerPath = `${homedir}/.LLCL/LLCL`;
	}
	return compilerPath;
}

vscode.languages.registerHoverProvider('llcl', {
	async provideHover(document, position, token) {
		// get the document text (it may not have been saved to the file system yet)
		const text = document.getText();
		
		// get the hover location
		const line = position.line + 1;
		const character = position.c;
		console.log("line", line, "character", character);
		
		// get the compilerPath
		const compilerPath = getCompilerPath();
		
		return new Promise((resolve, reject) => {
			let gotData = false;
			
			try {
				const args = ["query", "hover", document.uri.path, text.length, line, character];
				console.log(compilerPath, args);
				const childProcess = child_process.spawn(compilerPath, args);
				
				childProcess.stdin.write(text);
				
				childProcess.on('error', (error) => {
					console.log(`error: ${error}`);
				});
				
				childProcess.stdout.on('data', (data) => {
					console.log("hover data", `${data}`, JSON.parse(`${data}`));
					
					gotData = true;
					try {
						const array = JSON.parse(`${data}`);
						
						let contents = [];
						
						let diagnosticList = [];
						
						for (let i = 0; i < array.length; i++) {
							const e = array[i];
							if (e[0] == 0) {
								diagnosticList.push(
									new vscode.Diagnostic(new vscode.Range(
										new vscode.Position(e[1] - 1, e[2]),
										new vscode.Position(e[1] - 1, e[3])),
										e[4]
									)
								);
							} else if (e[0] == 2) {
								contents.push(new vscode.MarkdownString(e[3]));
							}
						}
						
						diagnosticCollection.clear();
						diagnosticCollection.set(document.uri, diagnosticList);
						
						resolve({
							contents: contents
						});
					} catch (error) {
						console.log("error", error);
						resolve({
							contents: ["childProcess stdout error"]
						});
					}
				});
				
				childProcess.on('close', (code) => {
					console.log(`process exited with code ${code}`);
					if (!gotData) {
						if (code != 0) {
							resolve({
								contents: ["childProcess error"]
							});
						} else {
							resolve(undefined);
						}
					}
				});
			} catch (error) {
				console.log(error);
			}
		})
	}
});

function getNewCompletion(completionItemKind, label, documentationString) {
	vscode.CompletionItemKind;
	
	const newCompletion = new vscode.CompletionItem(label, completionItemKind);
	newCompletion.documentation = new vscode.MarkdownString(documentationString);
	return newCompletion;
}

vscode.languages.registerCompletionItemProvider('llcl', {
	async provideCompletionItems(document, position, token, context) {
		// get the document text (it may not have been saved to the file system yet)
		const text = document.getText();
		
		const line = position.line + 1;
		const character = position.e;
		console.log("line", line, "character", character);
		
		// get the compilerPath
		const compilerPath = getCompilerPath();
		
		return new Promise((resolve, reject) => {
			let gotData = false;
			try {
				const args = ["query", "suggestions", document.uri.path, text.length, line, character];
				console.log(compilerPath, args);
				const childProcess = child_process.spawn(compilerPath, args);
				
				childProcess.stdin.write(text);
				
				childProcess.on('error', (error) => {
					console.log(`error: ${error}`);
				});
				
				childProcess.stdout.on('data', (data) => {
					console.log("suggestions data", `${data}`);
					
					gotData = true;
					try {
						let completionItems = [];
						
						const array = JSON.parse(`${data}`);
						
						let diagnosticList = [];
						
						for (let i = 0; i < array.length; i++) {
							const e = array[i];
							if (e[0] == 0) {
								diagnosticList.push(
									new vscode.Diagnostic(new vscode.Range(
										new vscode.Position(e[1] - 1, e[2]),
										new vscode.Position(e[1] - 1, e[3])),
										e[4]
									)
								);
							} else if (e[0] == 2) {
								completionItems.push(getNewCompletion(e[1], e[2], e[3]))	
							}
						}
						
						diagnosticCollection.clear();
						diagnosticCollection.set(document.uri, diagnosticList);
						
						console.log("completionItems", completionItems);
						resolve(completionItems);
					} catch (error) {
						console.log(error);
						resolve(undefined);
					}
				});
				
				childProcess.on('close', (code) => {
					// console.timeEnd("registerCompletionItemProvider");
					
					console.log(`process exited with code ${code}`);
					if (!gotData) {
						resolve(undefined);
					}
				});
			} catch (error) {
				console.log(error);
			}
		})
	}
});